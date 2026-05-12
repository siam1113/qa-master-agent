import { randomUUID as uuid } from 'node:crypto';

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.audit = [];
  }

  register(tool) {
    if (!tool?.name || typeof tool.execute !== 'function') throw new Error('Tool registration requires name and execute().');
    this.tools.set(tool.name, { permissions: [], description: '', scopes: ['default'], ...tool });
    return this.tools.get(tool.name);
  }

  list(scope = 'default') {
    return [...this.tools.values()].filter((tool) => scope === '*' || tool.scopes.includes(scope) || tool.scopes.includes('*')).map(({ execute, ...tool }) => tool);
  }

  async execute(name, input, context = {}) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    const auditEntry = { id: uuid(), timestamp: new Date().toISOString(), tool: name, input, sessionId: context.sessionId, status: 'started' };
    this.audit.unshift(auditEntry);
    try {
      const result = await tool.execute(input, context);
      auditEntry.status = 'completed';
      auditEntry.resultSummary = typeof result === 'string' ? result.slice(0, 180) : JSON.stringify(result).slice(0, 180);
      return result;
    } catch (error) {
      auditEntry.status = 'failed';
      auditEntry.error = error.message;
      throw error;
    }
  }
}

export const toolRegistry = new ToolRegistry();

toolRegistry.register({
  name: 'dom.extract',
  description: 'Extracts semantic UI regions from a captured DOM snapshot.',
  scopes: ['browser', 'default'],
  permissions: ['read:dom'],
  execute: async ({ note = '' }) => {
    try {
      const elements = JSON.parse(note);
      if (Array.isArray(elements)) {
        return {
          regions: elements
            .map((element) => [element.role || element.tag, element.type, element.text || element.href].filter(Boolean).join(': '))
            .filter(Boolean)
            .slice(0, 30)
        };
      }
    } catch {
      // Fall through to text extraction for non-JSON DOM notes.
    }
    return { regions: note.split(/[,.\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 30) };
  }
});

toolRegistry.register({
  name: 'mcp.registry.describe',
  description: 'Lists MCP-compatible tools available to the agent with permissions.',
  scopes: ['default', '*'],
  permissions: ['read:tools'],
  execute: async (_input, context) => ({ sessionId: context.sessionId, tools: toolRegistry.list(context.scope || 'default') })
});
