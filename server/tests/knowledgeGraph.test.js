import assert from 'node:assert/strict';
import { KnowledgeGraphService } from '../services/knowledgeGraph.js';

// This smoke test proves the core POC graph, action, enhance, and chat paths work without a browser.
const graph = new KnowledgeGraphService();
graph.seed();

const seededState = graph.getState();
assert.ok(seededState.nodes.length > 0, 'seed should create nodes');
assert.ok(seededState.edges.length > 0, 'seed should create edges');

const actionResult = graph.simulateAction();
assert.ok(actionResult.action.result.includes('Selected'), 'action loop should select a graph action');

const chatResult = graph.chat('How should I test login MFA?');
assert.ok(chatResult.answer.includes('graph item'), 'chat should answer with graph-backed matches');

const enhanced = graph.enhanceKnowledge({
  title: 'Profile onboarding',
  content: 'Profile editing requires avatar upload, display name validation, and save confirmation.',
  imageAlt: 'Profile page with avatar upload and save button.'
});
assert.ok(enhanced.nodes.some((node) => node.label === 'Profile onboarding'), 'enhance should add the new document node');

console.log('KnowledgeGraphService smoke test passed.');
