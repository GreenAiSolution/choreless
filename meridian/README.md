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

**Core:** `trigger` · `manual.input` · `transform` · `condition` · `template` ·
`log` · `delay` · `merge` · `set.variable` · `http.request`

**Integrations (act on the world):** `webhook.send` · `slack.message` ·
`email.send` (Resend) · `llm.complete` (Anthropic — puts AI in the loop)

Each self-describes its ports and config fields, so the front-end palette is
generated, never hard-coded. Integration nodes read secrets from config or the
environment (`SLACK_WEBHOOK_URL`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`) and
route success to `out` / failure to `error`, so a flow can branch on outcome.

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

## MCP server (drive it from an AI agent)

Meridian ships an **MCP (Model Context Protocol) server** so any MCP client —
Claude Desktop, IDEs, or your own agent — can author, validate, and run business
automations through tools. It runs the engine **in-process** against the same
JSON store as the web app, so an agent and a human can collaborate on the same
workflows.

```bash
npm run mcp          # stdio transport (dev, via tsx) — for local clients
npm run mcp:http     # Streamable HTTP transport on :8788 — for remote clients
# or, after `npm run build`:
npm run mcp:serve        # node dist/mcp/index.js       (stdio)
npm run mcp:http:serve   # node dist/mcp/http-index.js  (HTTP)

npm run eval         # drive the server and check evaluations/mcp_eval.xml (10/10)
```

**Transports.** `stdio` is for locally-spawned clients (Claude Desktop). The
**Streamable HTTP** transport runs stateless (no server sessions) and exposes
`POST /mcp` plus a `GET /health`, so you can host it and point remote clients at
`http://host:8788/mcp`.

### Tools

| Tool | What it does |
| --- | --- |
| `meridian_list_node_types` | Catalog of building blocks (call this first when authoring). |
| `meridian_list_workflows` | List automations. |
| `meridian_get_workflow` | Read one workflow in full. |
| `meridian_create_workflow` | Create a workflow from nodes + edges (returns a validation report). |
| `meridian_update_workflow` | Update a workflow (full graph replacement). |
| `meridian_delete_workflow` | Delete a workflow (destructive). |
| `meridian_validate_workflow` | Static validation without running. |
| `meridian_run_workflow` | Execute a workflow and return per-node results + output. |
| `meridian_list_runs` | Run history for a workflow. |
| `meridian_get_run` | One run in full, with per-node input/output/logs. |

Every tool carries a detailed description, a Zod-validated input schema,
structured output, and behavior annotations (`readOnlyHint`, `destructiveHint`,
etc.). Errors are actionable — a missing workflow or an invalid graph comes back
with the specific issues and the next tool to call.

### Claude Desktop config

After `npm run build`, add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "meridian": {
      "command": "node",
      "args": ["/absolute/path/to/meridian/dist/mcp/index.js"],
      "env": { "DATA_DIR": "/absolute/path/to/meridian/data" }
    }
  }
}
```

Then ask the agent: *"List Meridian's node types, then build an automation that
auto-approves refunds under $50 and escalates the rest, and run it on a $120
refund."* It will compose the tools to author and execute the workflow.

## Project layout

```
meridian/
├── src/
│   ├── domain/      types
│   ├── engine/      execution engine, expressions, node registry + builtins
│   ├── store/       Store interface + JSON file store
│   ├── api/         node:http router, server, static serving
│   ├── mcp/         MCP server: tools, schemas, formatting (stdio)
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
