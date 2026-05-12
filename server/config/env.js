export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5050),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  mongoUri: process.env.MONGO_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  neo4jUri: process.env.NEO4J_URI || 'bolt://localhost:7687',
  postgresUrl: process.env.POSTGRES_URL || 'postgres://qa:qa@localhost:5432/qa_master_agent',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  executionBaseUrl: process.env.EXECUTION_BASE_URL || '',
  storagePath: process.env.STORAGE_PATH || './data/qa-master-agent-state.json',
  seedFixtureData: process.env.SEED_FIXTURE_DATA === 'true',
  apiKey: process.env.API_KEY || '',
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS || 30000),
  browserHeadless: process.env.BROWSER_HEADLESS !== 'false'
};

export function validateEnvironment(logger = console) {
  const warnings = [];
  if (env.nodeEnv === 'production' && env.jwtSecret === 'dev-only-change-me') warnings.push('JWT_SECRET must be set in production.');
  if (env.nodeEnv === 'production' && !env.apiKey) warnings.push('API_KEY should be set in production to protect API access.');
  if (!env.openaiApiKey && !env.anthropicApiKey) warnings.push('No LLM provider key set; conversational endpoints will return extractive memory evidence only.');
  warnings.forEach((warning) => logger.warn?.(`[env] ${warning}`));
  return { ok: warnings.length === 0, warnings };
}
