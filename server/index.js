import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { graphRouter } from './routes/graphRoutes.js';
import { knowledgeGraph } from './services/knowledgeGraph.js';
import { GraphSnapshot } from './models/GraphSnapshot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 5050;

// JSON and CORS middleware keep the React client and API simple for local development.
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Static sample SVGs emulate uploaded UI images used by the Knowledge tab.
app.use('/samples', express.static(path.join(__dirname, '../client/public/samples')));

// API routes expose graph state, knowledge enhancement, action simulation, and chat.
app.use('/api', graphRouter);

// A small health endpoint helps confirm the server is running during demos.
app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'qa-master-agent-poc' });
});

// In production-style mode, Express can serve the built React client when it exists.
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_request, response) => {
    response.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Connects to MongoDB only when MONGO_URI is present; otherwise the POC stays in memory.
async function connectMongoIfConfigured() {
  if (!process.env.MONGO_URI) {
    knowledgeGraph.log('system', 'MONGO_URI not set; using in-memory graph storage.');
    return;
  }
  await mongoose.connect(process.env.MONGO_URI);
  knowledgeGraph.log('system', 'Connected to MongoDB for graph snapshot persistence.');
}

// Persists snapshots opportunistically so MongoDB supports demos without becoming a hard dependency.
async function persistSnapshotIfConfigured() {
  if (!process.env.MONGO_URI) return;
  const state = knowledgeGraph.getState();
  await GraphSnapshot.create(state);
}

// Starts the API after seeding the graph and preparing optional persistence.
async function start() {
  knowledgeGraph.seed();
  await connectMongoIfConfigured();
  await persistSnapshotIfConfigured();
  app.listen(port, () => {
    knowledgeGraph.log('system', `Server listening on port ${port}.`);
    console.log(`QA Master Agent POC API listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start QA Master Agent POC:', error);
  process.exit(1);
});
