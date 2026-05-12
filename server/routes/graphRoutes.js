import express from 'express';
import { knowledgeGraph } from '../services/knowledgeGraph.js';
import { agentRegistry } from '../services/agentRegistry.js';
import { toolRegistry } from '../services/toolRegistry.js';

export function withRegistries(state = knowledgeGraph.getState()) {
  return { ...state, agents: agentRegistry.list(), tools: toolRegistry.list('*') };
}

export function createGraphRouter({ executionEngine } = {}) {
  const graphRouter = express.Router();

  graphRouter.get('/graph', (_request, response) => {
    response.json(withRegistries());
  });

  graphRouter.post('/enhance', (request, response) => {
    const { title, content, imageAlt, businessRule } = request.body;
    if (!title?.trim() || !content?.trim()) return response.status(400).json({ error: 'Title and content are required.' });
    response.json(withRegistries(knowledgeGraph.enhanceKnowledge({ title, content, imageAlt, businessRule })));
  });

  graphRouter.post('/act', async (request, response, next) => {
    try {
      const { command, agentId = 'agent-exploratory-qa', targetUrl, browserName } = request.body || {};
      if (!command?.trim()) return response.status(400).json({ error: 'Command is required.' });
      const result = await executionEngine.run({ command, agentId, targetUrl, browserName });
      response.json({ ...result, state: withRegistries(result.state) });
    } catch (error) {
      next(error);
    }
  });

  graphRouter.post('/chat', async (request, response, next) => {
    try {
      const { query } = request.body;
      if (!query?.trim()) return response.status(400).json({ error: 'Query is required.' });
      const result = await knowledgeGraph.chat(query);
      response.json({ ...result, state: withRegistries(result.state) });
    } catch (error) {
      next(error);
    }
  });

  graphRouter.get('/sessions', (_request, response) => response.json(knowledgeGraph.getState().sessions));
  graphRouter.get('/agents', (_request, response) => response.json(agentRegistry.list()));
  graphRouter.get('/tools', (_request, response) => response.json({ tools: toolRegistry.list('*'), audit: toolRegistry.audit }));

  return graphRouter;
}

export const graphRouter = createGraphRouter();
