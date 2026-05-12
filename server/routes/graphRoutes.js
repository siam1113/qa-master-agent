import express from 'express';
import { knowledgeGraph } from '../services/knowledgeGraph.js';

export const graphRouter = express.Router();

// Returns the current graph, memory insights, sample image metadata, and logs.
graphRouter.get('/graph', (_request, response) => {
  response.json(knowledgeGraph.getState());
});

// Adds text and optional UI notes from the Knowledge > Enhance tab.
graphRouter.post('/enhance', (request, response) => {
  const { title, content, imageAlt } = request.body;
  if (!title?.trim() || !content?.trim()) {
    return response.status(400).json({ error: 'Title and content are required.' });
  }
  return response.json(knowledgeGraph.enhanceKnowledge({ title, content, imageAlt }));
});

// Runs one deterministic exploratory action loop for the Action > Act tab.
graphRouter.post('/act', (_request, response) => {
  response.json(knowledgeGraph.simulateAction());
});

// Answers chat questions with graph-backed keyword retrieval.
graphRouter.post('/chat', (request, response) => {
  const { query } = request.body;
  if (!query?.trim()) {
    return response.status(400).json({ error: 'Query is required.' });
  }
  return response.json(knowledgeGraph.chat(query));
});
