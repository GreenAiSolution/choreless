# Meridian

**A visual automation-map platform.** Model any business process as a map of
typed nodes on a canvas — triggers, conditions, transforms, API calls — and that
same map runs as a live workflow engine. The map you draw *is* the automation.

> Meridian doesn't magically "automate any business" on its own — no software
> does. What it gives you is a strong, general substrate: a validated dataflow
> engine plus a canvas, so you can wire up the automation for *your* business and
> run it for real.

## Highlights

- **Zero runtime dependencies.** The backend is pure Node.js standard library —
  nothing to break on install, trivially auditable.
- **Real execution engine.** Topological execution, conditional branching,
  per-node retries / timeouts / error policies, and full run history.
- **Safe expressions.** Node configs use `{{ ... }}` expressions evaluated by a
  hand-written parser — never `eval`.
- **Live runs.** Executions stream over Server-Sent Events; the canvas lights up
  node-by-node as they run.
- **Registry-driven.** Every capability is a node type in a registry; the UI
  palette and config forms are generated from it. Add a feature = add a handler.

See [`DESIGN.md`](./DESIGN.md) for the full architecture.

## Quick start

```bash
cd meridian
npm install
npm start          # http://localhost:8787
```

Open the URL, and you'll find a seeded **"Order triage"** workflow. Hit **▶ Run**
to watch it execute live, or drag new nodes from the palette and wire them up.

### Other commands

```bash
npm test           # unit + engine tests (node:test)
npm run typecheck  # tsc --noEmit
npm run build      # compile to dist/
npm run serve      # run the compiled build
```

Config via env vars: `PORT`, `HOST`, `DATA_DIR`, `PUBLIC_DIR`.

## How it works

A **workflow** is a directed graph of **nodes** connected by **edges**. Each node
has a registered **type** that defines its input/output ports and its
`execute()` logic. To run a workflow, the engine:

1. **Validates** the graph (types exist, ports match, no cycles).
2. Walks nodes in **topological order**.
3. For each node, gathers inbound port values, resolves `{{ expressions }}` in
   its config, runs the handler with retries/timeout, and records the result.
4. **Prunes** branches that a condition didn't take.

## Node types

`trigger` · `manual.input` · `transform` · `condition` · `template` · `log` ·
`delay` · `merge` · `set.variable` · `http.request`

Each self-describes its ports and config fields, so the front-end palette is
generated, never hard-coded.

## API

```
GET    /api/health
GET    /api/node-types
GET    /api/workflows            POST /api/workflows
GET    /api/workflows/:id        PUT  /api/workflows/:id     DELETE …/:id
POST   /api/workflows/:id/validate
POST   /api/workflows/:id/run
GET    /api/workflows/:id/run-stream   (SSE live run)
GET    /api/workflows/:id/runs
GET    /api/runs/:id
POST   /api/hooks/:id            (webhook trigger)
```

## Project layout

```
meridian/
├── src/
│   ├── domain/      types
│   ├── engine/      execution engine, expressions, node registry + builtins
│   ├── store/       Store interface + JSON file store
│   ├── api/         node:http router, server, static serving
│   ├── triggers/    schedule scheduler
│   ├── service.ts   application service
│   └── app.ts       composition root
├── public/          canvas UI (vanilla JS, no build)
└── test/            node:test suites
```

## Roadmap

- Auth + multi-tenant workspaces
- Durable run queue (replace the in-process scheduler)
- More integration nodes (email, Slack, DB, LLM)
- Sub-workflows and reusable node groups
- Pluggable Postgres store behind the existing `Store` interface
