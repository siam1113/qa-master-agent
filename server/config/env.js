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
  executionBaseUrl: process.env.EXECUTION_BASE_URL || 'http://localhost:5173'
};

export function validateEnvironment(logger = console) {
  const warnings = [];
  if (env.nodeEnv === 'production' && env.jwtSecret === 'dev-only-change-me') warnings.push('JWT_SECRET must be set in production.');
  if (!env.openaiApiKey) warnings.push('OPENAI_API_KEY not set; LLM provider will use retrieval-only reasoning.');
  warnings.forEach((warning) => logger.warn?.(`[env] ${warning}`));
  return { ok: warnings.length === 0, warnings };
}
