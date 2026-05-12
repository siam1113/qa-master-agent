export const agentProfiles = [
  {
    id: 'agent-exploratory-qa',
    name: 'Exploratory QA Agent',
    scope: 'qa',
    strategy: 'risk-first exploratory testing with failure reflection',
    tools: ['dom.extract', 'mcp.registry.describe']
  },
  {
    id: 'agent-onboarding',
    name: 'Onboarding Agent',
    scope: 'knowledge',
    strategy: 'workflow discovery and clarification capture',
    tools: ['mcp.registry.describe']
  },
  {
    id: 'agent-regression',
    name: 'Regression Agent',
    scope: 'qa',
    strategy: 'known path replay, variance detection, and defect triage',
    tools: ['dom.extract']
  },
  {
    id: 'agent-validation',
    name: 'Validation Agent',
    scope: 'rules',
    strategy: 'business rule mapping to validations and edge cases',
    tools: ['mcp.registry.describe']
  }
];

export class AgentRegistry {
  constructor(profiles = agentProfiles) {
    this.profiles = new Map(profiles.map((profile) => [profile.id, profile]));
  }

  list() {
    return [...this.profiles.values()];
  }

  add(profile = {}) {
    const name = String(profile.name || '').trim();
    if (!name) throw new Error('Agent name is required.');
    const id = String(profile.id || `agent-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`).trim();
    const normalized = {
      id,
      name,
      scope: String(profile.scope || 'qa').trim() || 'qa',
      strategy: String(profile.strategy || 'User-defined QA strategy').trim() || 'User-defined QA strategy',
      tools: Array.isArray(profile.tools) && profile.tools.length ? profile.tools.map(String) : ['dom.extract', 'mcp.registry.describe']
    };
    this.profiles.set(id, normalized);
    return normalized;
  }

  get(agentId = 'agent-exploratory-qa') {
    return this.profiles.get(agentId) || this.profiles.get('agent-exploratory-qa');
  }
}

export const agentRegistry = new AgentRegistry();
