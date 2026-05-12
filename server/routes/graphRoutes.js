import express from 'express';
import { knowledgeGraph } from '../services/knowledgeGraph.js';
import { agentRegistry } from '../services/agentRegistry.js';
import { toolRegistry } from '../services/toolRegistry.js';

export function createGraphRouter({ executionEngine } = {}) {
  const graphRouter = express.Router();

  graphRouter.get('/graph', (_request, response) => {
    const state = knowledgeGraph.getState();
    response.json({ ...state, agents: agentRegistry.list(), tools: toolRegistry.list('*') });
  });

  graphRouter.post('/enhance', (request, response) => {
    const { title, content, imageAlt, businessRule } = request.body;
    if (!title?.trim() || !content?.trim()) return response.status(400).json({ error: 'Title and content are required.' });
    response.json(knowledgeGraph.enhanceKnowledge({ title, content, imageAlt, businessRule }));
  });

  graphRouter.post('/act', async (request, response, next) => {
    try {
      const { command = 'Perform exploratory testing on checkout flow', agentId = 'agent-exploratory-qa' } = request.body || {};
      const result = executionEngine ? await executionEngine.run({ command, agentId }) : knowledgeGraph.simulateAction(command, agentRegistry.get(agentId));
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  graphRouter.post('/chat', (request, response) => {
    const { query } = request.body;
    if (!query?.trim()) return response.status(400).json({ error: 'Query is required.' });
    response.json(knowledgeGraph.chat(query));
  });

  graphRouter.get('/sessions', (_request, response) => response.json(knowledgeGraph.getState().sessions));
  graphRouter.get('/agents', (_request, response) => response.json(agentRegistry.list()));
  graphRouter.get('/tools', (_request, response) => response.json({ tools: toolRegistry.list('*'), audit: toolRegistry.audit }));

  return graphRouter;
}

export const graphRouter = createGraphRouter();
