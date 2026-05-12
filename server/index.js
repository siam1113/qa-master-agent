import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { createGraphRouter } from './routes/graphRoutes.js';
import { knowledgeGraph } from './services/knowledgeGraph.js';
import { GraphSnapshot } from './models/GraphSnapshot.js';
import { env, validateEnvironment } from './config/env.js';
import { ExecutionEngine } from './services/executionEngine.js';
import { observability } from './services/observability.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const executionEngine = new ExecutionEngine({ graph: knowledgeGraph });

validateEnvironment(console);
app.disable('x-powered-by');
app.use(cors({ origin: env.corsOrigin === '*' ? true : env.corsOrigin }));
app.use(express.json({ limit: '10mb' }));
app.use((request, response, next) => {
  const started = Date.now();
  response.on('finish', () => observability.event('http', `${request.method} ${request.path} ${response.statusCode}`, { durationMs: Date.now() - started }));
  next();
});

app.use('/samples', express.static(path.join(__dirname, '../client/public/samples')));
app.use('/api', createGraphRouter({ executionEngine }));
app.get('/api/health', (_request, response) => response.json({ ok: true, service: 'qa-master-agent', architecture: 'memory+reasoning+execution', timestamp: new Date().toISOString() }));

app.use((error, _request, response, _next) => {
  observability.event('error', error.message, { stack: error.stack });
  response.status(500).json({ error: 'Internal server error', message: env.nodeEnv === 'development' ? error.message : undefined });
});

const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_request, response) => response.sendFile(path.join(clientDist, 'index.html')));
}

const wss = new WebSocketServer({ server, path: '/ws/executions' });
const clients = new Set();
wss.on('connection', (socket) => {
  clients.add(socket);
  socket.send(JSON.stringify({ type: 'connected', message: 'Execution stream connected.' }));
  socket.on('close', () => clients.delete(socket));
});
executionEngine.on('session', (event) => {
  const payload = JSON.stringify(event);
  for (const socket of clients) if (socket.readyState === socket.OPEN) socket.send(payload);
});

async function connectMongoIfConfigured() {
  if (!env.mongoUri) {
    knowledgeGraph.log('system', 'MONGO_URI not set; using adapter-backed local memory for development.');
    return;
  }
  await mongoose.connect(env.mongoUri);
  knowledgeGraph.log('system', 'Connected to MongoDB for graph snapshot persistence.');
}

async function persistSnapshotIfConfigured() {
  if (!env.mongoUri) return;
  await GraphSnapshot.create(knowledgeGraph.getState());
}

async function start() {
  knowledgeGraph.seed();
  await connectMongoIfConfigured();
  await persistSnapshotIfConfigured();
  server.listen(env.port, () => {
    knowledgeGraph.log('system', `Server listening on port ${env.port}.`);
    console.log(`QA Master Agent API listening on http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start QA Master Agent:', error);
  process.exit(1);
});
