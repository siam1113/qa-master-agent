import assert from 'node:assert/strict';
import { KnowledgeGraphService } from '../services/knowledgeGraph.js';
import { agentRegistry } from '../services/agentRegistry.js';

const graph = new KnowledgeGraphService();
graph.seed();

const seededState = graph.getState();
assert.ok(seededState.nodes.length > 20, 'seed should create a production-size memory graph');
assert.ok(seededState.edges.length > 20, 'seed should create relationship edges');
assert.ok(seededState.memoryVersions.length >= 1, 'seed should create an initial memory version');
assert.ok(seededState.nodes.some((node) => node.type === 'Workflow'), 'seed should include workflow nodes');
assert.ok(seededState.nodes.some((node) => node.type === 'BusinessRule'), 'seed should include business rules');

const actionResult = graph.simulateAction('Validate checkout promo code and payment retry behavior', agentRegistry.get('agent-exploratory-qa'));
assert.ok(actionResult.action.result.includes('Executed plan'), 'action loop should execute a planned session');
assert.ok(actionResult.action.session.logs.length >= 4, 'execution session should contain replayable logs');
assert.ok(graph.getState().sessions.length === 1, 'execution should persist a session');
assert.ok(graph.getState().memoryVersions[0].reason === 'execution', 'execution should create a memory version');

const chatResult = graph.chat('What validations exist for promo code checkout?');
assert.ok(chatResult.answer.includes('graph memory'), 'chat should answer with graph-backed matches');
assert.ok(chatResult.matches.length > 0, 'chat should cite matched memory nodes');

const enhanced = graph.enhanceKnowledge({
  title: 'Profile onboarding',
  content: 'Profile editing requires avatar upload, display name validation, and save confirmation.',
  imageAlt: 'Profile page with avatar upload and save button.',
  businessRule: 'Display names must be unique and less than 40 characters.'
});
assert.ok(enhanced.nodes.some((node) => node.label === 'Profile onboarding'), 'enhance should add the new document node');
assert.ok(enhanced.memoryVersions[0].reason === 'ingestion', 'enhance should version memory');

console.log('KnowledgeGraphService production MVP smoke test passed.');
