export class LlmProviderRouter {
  constructor({ openaiApiKey = '', anthropicApiKey = '' } = {}) {
    this.providers = {
      openai: { configured: Boolean(openaiApiKey), model: 'gpt-4.1-mini' },
      anthropic: { configured: Boolean(anthropicApiKey), model: 'claude-3-5-sonnet' }
    };
  }

  describe() {
    return this.providers;
  }

  async generateReasoningSummary({ query, retrievedNodes }) {
    return {
      provider: Object.entries(this.providers).find(([, provider]) => provider.configured)?.[0] || 'retrieval-only',
      summary: `Retrieved ${retrievedNodes.length} memory node(s) for: ${query}`,
      citations: retrievedNodes.map((node) => node.id)
    };
  }
}
