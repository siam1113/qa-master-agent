# QA Master Agent

Production-ready MVP foundation for an AI-powered onboarding, exploratory QA, and application intelligence platform. The system is designed to onboard AI agents into applications the way organizations onboard human QA engineers: with training material, workflow memory, execution history, clarification loops, and persistent operational knowledge.

## What this MVP includes

- **Knowledge ingestion** for onboarding documents, UI capture notes, workflows, and business rules.
- **Graph-based memory engine** with semantic memory, visual memory, workflow nodes, execution-derived insights, confidence scores, and version lineage.
- **Hybrid retrieval/RAG pipeline** with chunking and deterministic local embeddings that can be replaced by hosted embedding providers.
- **Agent reasoning layer** that retrieves context, selects memory nodes, builds execution plans, records reasoning summaries, and asks for clarification when context is insufficient.
- **Autonomous execution foundation** with replayable sessions, browser/screenshot event models, MCP-compatible tool audit logs, and WebSocket streaming.
- **Modern operational UI** with sidebar navigation, dashboard, knowledge graph view, memory lineage, enhance pipeline, execution console, live viewer, chat, sessions, agents, and settings.
- **Infrastructure templates** for Docker, MongoDB snapshot persistence, PostgreSQL/pgvector, Neo4j graph schema, and Redis.

## Tech stack

- **Frontend**: React + Vite, modern CSS, Lucide icons. The UI structure is ready for migration to Next.js, Tailwind, ShadCN UI, React Query, Zustand, Framer Motion, and React Flow as the SaaS shell expands.
- **Backend**: Node.js + Express with modular services, WebSocket execution streaming, structured event logs, and environment validation.
- **Memory**: In-process development adapter plus schemas for MongoDB snapshots, PostgreSQL/pgvector chunks, and Neo4j graph persistence.
- **Execution**: Session-oriented execution engine with MCP-compatible tools and browser/perception extension points for Playwright workers.

## Run locally

```bash
npm install
npm --prefix client install
npm run dev
```

- API: <http://localhost:5050>
- UI: <http://localhost:5173>
- WebSocket stream: `ws://localhost:5050/ws/executions`

For production-style serving:

```bash
npm run build
npm start
```

## Dockerized infrastructure

```bash
docker compose up --build
```

This starts the app plus MongoDB, PostgreSQL with pgvector, Neo4j, and Redis. The database schemas live in `infra/db/postgres.sql` and `infra/db/neo4j.cypher`.

## Environment

Copy `.env.example` and set provider/API secrets as needed:

```bash
cp .env.example .env
```

The app runs without hosted LLM keys in retrieval-only mode. Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` when wiring provider-backed generation.

## Architecture documentation

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the system diagram, data flow, module responsibilities, and scaling notes.

## API overview

- `GET /api/graph` returns graph memory, versions, sessions, agents, tools, logs, and sample UI captures.
- `POST /api/enhance` ingests onboarding content, UI notes, and business rules.
- `POST /api/act` starts an operational execution session and streams events over WebSocket.
- `POST /api/chat` answers informational questions using graph-backed memory citations.
- `GET /api/sessions`, `/api/agents`, `/api/tools` expose operational state and registries.

## Testing

```bash
npm test
```

The smoke test validates seeded graph memory, versioning, execution sessions, chat retrieval, and knowledge enhancement.
