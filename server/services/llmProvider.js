import { env } from '../config/env.js';
import { observability } from './observability.js';

function estimateTokens(text = '') {
  return Math.ceil(String(text).length / 4);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export class LlmProviderRouter {
  constructor({ openaiApiKey = env.openaiApiKey, anthropicApiKey = env.anthropicApiKey, timeoutMs = env.llmTimeoutMs } = {}) {
    this.timeoutMs = timeoutMs;
    this.providers = [
      { name: 'openai', configured: Boolean(openaiApiKey), model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', apiKey: openaiApiKey },
      { name: 'anthropic', configured: Boolean(anthropicApiKey), model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest', apiKey: anthropicApiKey }
    ];
  }

  describe() {
    return Object.fromEntries(this.providers.map(({ name, configured, model }) => [name, { configured, model } ]));
  }

  async complete({ system, messages, metadata = {} }) {
    const configured = this.providers.filter((provider) => provider.configured);
    if (!configured.length) {
      observability.increment('llm.unconfigured');
      return { provider: 'none', model: 'extractive', content: '', usage: { promptTokens: estimateTokens(JSON.stringify(messages)), completionTokens: 0, totalTokens: estimateTokens(JSON.stringify(messages)) }, degraded: true };
    }

    let lastError;
    for (const provider of configured) {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const response = provider.name === 'openai'
            ? await this.callOpenAI(provider, system, messages)
            : await this.callAnthropic(provider, system, messages);
          observability.event('llm', `${provider.name} completion`, { model: provider.model, attempt, ...metadata, usage: response.usage });
          return response;
        } catch (error) {
          lastError = error;
          observability.event('llm.error', `${provider.name} attempt ${attempt} failed`, { model: provider.model, error: error.message, ...metadata });
          await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
        }
      }
    }
    throw lastError;
  }

  async callOpenAI(provider, system, messages) {
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: provider.model, temperature: 0.2, messages: [{ role: 'system', content: system }, ...messages] })
    }, this.timeoutMs);
    if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
    const data = await response.json();
    return { provider: 'openai', model: provider.model, content: data.choices?.[0]?.message?.content || '', usage: { promptTokens: data.usage?.prompt_tokens || 0, completionTokens: data.usage?.completion_tokens || 0, totalTokens: data.usage?.total_tokens || 0 } };
  }

  async callAnthropic(provider, system, messages) {
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: provider.model, max_tokens: 900, temperature: 0.2, system, messages })
    }, this.timeoutMs);
    if (!response.ok) throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
    const data = await response.json();
    const content = (data.content || []).map((item) => item.text || '').join('\n');
    return { provider: 'anthropic', model: provider.model, content, usage: { promptTokens: data.usage?.input_tokens || 0, completionTokens: data.usage?.output_tokens || 0, totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) } };
  }
}

export const llmProvider = new LlmProviderRouter();
