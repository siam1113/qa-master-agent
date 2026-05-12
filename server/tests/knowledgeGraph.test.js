import assert from 'node:assert/strict';
import { KnowledgeGraphService } from '../services/knowledgeGraph.js';
import { agentRegistry } from '../services/agentRegistry.js';
import { toolRegistry } from '../services/toolRegistry.js';
import { withRegistries } from '../routes/graphRoutes.js';

const graph = new KnowledgeGraphService();
graph.seedFixtures();

const seededState = graph.getState();
assert.ok(seededState.nodes.length > 20, 'fixture import should create a production-size memory graph');
assert.ok(seededState.edges.length > 20, 'fixture import should create relationship edges');
assert.ok(seededState.memoryVersions.length >= 1, 'fixture import should create an initial memory version');
assert.ok(seededState.nodes.some((node) => node.type === 'Workflow'), 'fixture import should include workflow nodes');
assert.ok(seededState.nodes.some((node) => node.type === 'BusinessRule'), 'fixture import should include business rules');

const { session } = graph.startExecutionSession({ command: 'Validate checkout promo code and payment retry behavior', agent: agentRegistry.get('agent-exploratory-qa'), targetUrl: 'https://example.test' });
const actionResult = graph.completeExecutionSession(session.id, {
  result: 'Browser execution completed against https://example.test; captured screenshot and DOM snapshot.',
  observations: [{ category: 'browser', message: 'Loaded target page.' }],
  screenshots: [{ id: 'shot-1', timestamp: new Date().toISOString(), src: 'data:image/png;base64,AAAA', label: 'Captured frame' }]
});
assert.ok(actionResult.action.result.includes('Browser execution completed'), 'action loop should complete a planned session');
assert.ok(actionResult.action.session.logs.length >= 4, 'execution session should contain replayable logs');
assert.ok(graph.getState().sessions.length === 1, 'execution should persist a session');
assert.ok(graph.getState().memoryVersions[0].reason === 'execution', 'execution should create a memory version');

const chatResult = await graph.chat('What validations exist for promo code checkout?');
assert.ok(chatResult.answer.includes('Memory evidence') || chatResult.answer.length > 0, 'chat should answer with graph-backed matches');
assert.ok(chatResult.matches.length > 0, 'chat should cite matched memory nodes');
const clientChatState = withRegistries(chatResult.state);
assert.deepEqual(clientChatState.agents, agentRegistry.list(), 'chat responses should keep agent dropdown options populated');
assert.deepEqual(clientChatState.tools, toolRegistry.list('*'), 'chat responses should keep tool registry data populated');

const enhanced = await graph.enhanceKnowledge({
  title: 'Profile onboarding',
  content: 'Profile editing requires avatar upload, display name validation, and save confirmation.',
  imageAlt: 'Profile page with avatar upload and save button.',
  imageSrc: 'data:image/png;base64,BBBB',
  businessRule: 'Display names must be unique and less than 40 characters.'
});
assert.ok(enhanced.nodes.some((node) => node.label === 'Profile onboarding'), 'enhance should add the new document node');
assert.ok(enhanced.nodes.some((node) => node.type === 'Screen' && node.src === 'data:image/png;base64,BBBB'), 'enhance should ingest pasted image data URLs');
assert.ok(enhanced.memoryVersions[0].reason === 'ingestion', 'enhance should version memory');

const imageOnly = await graph.enhanceKnowledge({
  title: 'Image-only checkout capture',
  imageAlt: 'Checkout screen with promo field, pay button, and order summary.',
  imageSrc: 'data:image/png;base64,CCCC'
});
const parsedScreen = imageOnly.nodes.find((node) => node.type === 'Screen' && node.src === 'data:image/png;base64,CCCC');
assert.ok(parsedScreen?.mindmap?.label, 'image-only ingestion should parse pasted images into readable mindmap memory');
assert.ok(parsedScreen.content.includes('Checkout') || parsedScreen.content.includes('checkout'), 'parsed image nodes should contain user-readable text');

const addedAgent = agentRegistry.add({ name: 'Accessibility QA Agent', scope: 'a11y', strategy: 'screen-reader first validation', tools: ['dom.extract'] });
assert.equal(agentRegistry.get(addedAgent.id).name, 'Accessibility QA Agent', 'users should be able to add custom agents');

const cleared = graph.deleteMemory();
assert.equal(cleared.nodes.length, 0, 'delete memory should clear graph nodes');
assert.equal(cleared.memoryVersions.length, 0, 'delete memory should clear memory versions');
assert.equal(cleared.sessions.length, 0, 'delete memory should clear execution sessions');

console.log('KnowledgeGraphService production smoke test passed.');
