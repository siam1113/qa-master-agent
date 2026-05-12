import { EventEmitter } from 'node:events';
import { agentRegistry } from './agentRegistry.js';
import { toolRegistry } from './toolRegistry.js';

export class ExecutionEngine extends EventEmitter {
  constructor({ graph }) {
    super();
    this.graph = graph;
  }

  async run({ command, agentId = 'agent-exploratory-qa' }) {
    const agent = agentRegistry.get(agentId);
    const result = this.graph.simulateAction(command, agent);
    const session = result.action.session;
    this.emit('session', { type: 'session.started', sessionId: session.id, session });
    for (const log of session.logs) this.emit('session', { type: 'session.log', sessionId: session.id, log });
    const tools = await toolRegistry.execute('mcp.registry.describe', {}, { sessionId: session.id, scope: 'default' });
    const toolLog = this.graph.appendSessionLog(session.id, 'mcp', `Registered ${tools.tools.length} scoped MCP-compatible tool(s).`, { tools: tools.tools.map((tool) => tool.name) });
    this.emit('session', { type: 'session.log', sessionId: session.id, log: toolLog });
    this.emit('session', { type: 'session.completed', sessionId: session.id, session });
    return result;
  }
}
