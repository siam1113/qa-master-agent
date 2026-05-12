# QA Master Agent

Enterprise AI application intelligence and autonomous QA platform. The system onboards AI agents into applications the way organizations onboard human QA engineers: with durable training material, workflow memory, execution history, clarification loops, browser evidence, and persistent operational knowledge.

## Production capabilities

- **Knowledge ingestion** for onboarding documents, UI capture notes, workflows, and business rules.
- **Graph-based memory engine** with semantic memory, visual memory, workflow nodes, execution-derived insights, confidence scores, version lineage, and JSON/Mongo snapshot persistence.
- **Hybrid retrieval/RAG pipeline** with semantic chunking, local vector scoring, and provider-ready embedding boundaries.
- **LLM provider router** with OpenAI and Anthropic adapters, provider failover, timeouts, retries, usage accounting, and extractive fallback when no provider is configured.
- **Autonomous browser execution** with Playwright-powered Chromium/Firefox/WebKit sessions, screenshot capture, DOM snapshots, MCP-compatible tool audit logs, and WebSocket streaming.
- **Modern operational UI** with sidebar navigation, dashboard, knowledge graph view, memory lineage, enhance pipeline, execution console, live viewer, chat, sessions, agents, and settings.
- **Infrastructure templates** for Docker, MongoDB snapshot persistence, PostgreSQL/pgvector, Neo4j graph schema, and Redis.

## Tech stack

- **Frontend**: React + Vite, modern CSS, Lucide icons.
- **Backend**: Node.js + Express with modular services, WebSocket execution streaming, structured event logs, API-key protection, and environment validation.
- **Memory**: File-backed production state plus schemas for MongoDB snapshots, PostgreSQL/pgvector chunks, and Neo4j graph persistence.
- **Execution**: Session-oriented Playwright execution engine with MCP-compatible tools and browser/perception evidence capture.

## Run locally

```bash
npm install
npm --prefix client install
npx playwright install chromium
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

Copy `.env.example` if present or create `.env` with production values:

```bash
PORT=5050
API_KEY=replace-with-secret
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
EXECUTION_BASE_URL=https://your-application.example.com
STORAGE_PATH=./data/qa-master-agent-state.json
```

The server starts with empty production memory by default. Set `SEED_FIXTURE_DATA=true` only for local development or tests that intentionally load fixture onboarding content.

## Architecture documentation

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the system diagram, data flow, module responsibilities, and scaling notes.

## API overview

- `GET /api/graph` returns graph memory, versions, sessions, agents, tools, logs, and observability state.
- `POST /api/enhance` ingests onboarding content, UI notes, and business rules.
- `POST /api/act` starts a browser-backed operational execution session and streams events over WebSocket. Include `targetUrl` or configure `EXECUTION_BASE_URL`.
- `POST /api/chat` answers informational questions using graph/vector retrieval and configured LLM providers.
- `GET /api/sessions`, `/api/agents`, `/api/tools` expose operational state and registries.

## Testing

```bash
npm test
npm run build
```

The smoke test validates fixture import, versioned graph memory, execution session persistence, chat retrieval, and knowledge enhancement.
