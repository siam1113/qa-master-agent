CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS organizations (id UUID PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS memory_versions (id TEXT PRIMARY KEY, parent_id TEXT, reason TEXT NOT NULL, summary TEXT NOT NULL, confidence NUMERIC NOT NULL, graph_hash TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS knowledge_chunks (id TEXT PRIMARY KEY, source_node_id TEXT NOT NULL, content TEXT NOT NULL, embedding vector(64), metadata JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS execution_sessions (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, command TEXT NOT NULL, status TEXT NOT NULL, memory_refs JSONB DEFAULT '[]', logs JSONB DEFAULT '[]', screenshots JSONB DEFAULT '[]', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops);
