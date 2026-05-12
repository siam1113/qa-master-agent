# QA Master Agent POC

A lightweight MERN proof-of-concept for an AI-powered onboarding and exploratory QA agent. The app ingests sample onboarding documents and UI image metadata, stores knowledge in a graph, and exposes a tabbed UI for graph exploration, memory insights, enhancing knowledge, simulated exploratory actions, and chat.

## Tech stack

- **MongoDB**: Optional persistence through Mongoose when `MONGO_URI` is provided.
- **Express**: REST API for graph state, document ingestion, action simulation, and chat.
- **React**: Tabbed user interface for Knowledge and Action workflows.
- **Node.js**: In-memory graph service and server runtime.

## Run locally

```bash
npm install
npm --prefix client install
npm run dev
```

- API: <http://localhost:5050>
- UI: <http://localhost:5173>

For production-style serving:

```bash
npm run build
npm start
```

## Optional MongoDB persistence

Set `MONGO_URI` to persist graph snapshots. Without it, the POC runs entirely in memory.

```bash
MONGO_URI=mongodb://localhost:27017/qa-master-agent npm start
```

## Graph schema

The graph is intentionally simple:

- `Document` nodes represent onboarding documents or uploaded notes.
- `Feature` nodes represent capabilities mentioned in documents.
- `Screen` nodes represent UI image examples.
- `Action` nodes represent exploratory QA actions.
- `Insight` nodes represent memory changes or observations.

Edges use a `relationship` label such as `mentions`, `shown_on`, `validated_by`, or `creates_insight`.

## User workflow

- **Knowledge > Graph**: Visualize the nodes and relationships.
- **Knowledge > Memory Insights**: Review graph growth and ingestion history.
- **Knowledge > Enhance**: Add text knowledge and optional UI references.
- **Action > Act**: Simulate an exploratory QA loop that chooses a graph node and logs a next test action.
- **Action > Chat**: Ask natural-language questions answered with graph evidence.
