# Meridian — Design

Meridian is a **visual automation-map platform**. You model a business as a
graph of typed nodes on a canvas, and that same graph runs as a live workflow:
triggers fire, data flows edge-to-edge, and every run is recorded.

The design goal is a backend that is **correct, observable, and hard to break** —
a real execution engine rather than a demo. It has **zero runtime dependencies**
(pure Node.js standard library), so it runs anywhere Node 22+ runs.

---

## 1. Core concepts

| Concept | Meaning |
| --- | --- |
| **Workflow** | A directed graph: `nodes` + `edges` + `variables`. The "map" of a business process. |
| **Node** | A single unit of work. Has a `type`, a `config`, and named input/output **ports** (handles). |
| **Edge** | A directed connection `from (node, port) → to (node, port)`. Carries data downstream. |
| **NodeType** | A registered handler that defines a node's ports and `execute()` logic. The extension point. |
| **Trigger** | What starts a run: `manual`, `webhook`, or `schedule`. |
| **Run** | One execution of a workflow. Records per-node status, timing, I/O, and logs. |

A workflow is just data (JSON). The engine is what gives it behavior. New
capability = new `NodeType`, registered once, usable in every workflow.

---

## 2. Data model

```
Workflow {
  id, name, description,
  nodes: Node[],
  edges: Edge[],
  variables: Record<string, unknown>,   // workflow-scoped constants
  createdAt, updatedAt
}

Node {
  id, type,                 // type must exist in the registry
  name,                     // human label
  config: Record<string, unknown>,  // per-node settings, may contain {{expressions}}
  position: { x, y }        // canvas placement (UI only)
}

Edge {
  id,
  from: { node, port },     // source node + output port
  to:   { node, port }      // target node + input port
}

Run {
  id, workflowId, status,   // queued | running | succeeded | failed | canceled
  trigger, input,
  startedAt, finishedAt,
  nodeRuns: NodeRun[],      // one per executed node
  output, error
}

NodeRun {
  nodeId, status, startedAt, finishedAt,
  attempts, input, output, logs[], error
}
```

---

## 3. Execution engine

The engine (`src/engine/engine.ts`) executes a workflow as a dataflow graph.

**Ordering.** Nodes run in **topological order** (`src/util/graph.ts`). The
graph is validated first: every edge references real nodes/ports, and the graph
must be **acyclic** (cycles are rejected with the offending nodes named).

**Data flow.** Each node produces an object keyed by output port. An edge
`A.out → B.in` makes `A`'s `out` value available to `B` as input port `in`. A
node with multiple inputs receives a map `{ portName: value }`.

**Input resolution & expressions.** A node's `config` may contain template
expressions resolved at run time against a scope of:
- `input` — the node's incoming port values
- `vars` — workflow variables
- `trigger` — the triggering payload
- `nodes` — outputs of already-completed nodes (`nodes.<id>.<port>`)

Expressions use `{{ ... }}` with a small, **safe evaluator** (no `eval`) that
supports dotted paths, string/number/boolean literals, and a set of pure helper
functions (`upper`, `lower`, `now`, `default`, `json`, `len`, …). A bare
`"{{ input.x }}"` returns the raw typed value; interpolation inside a larger
string coerces to text.

**Branching.** A node may emit only some of its output ports (e.g. a
`condition` node emits `true` **or** `false`). Downstream nodes whose *only*
inbound edges come from ports that did not fire are **pruned** (skipped) for that
run. This is how conditional paths work without a separate control-flow concept.

**Reliability per node.**
- `retries` with exponential backoff (configurable, capped).
- `timeoutMs` — a node that exceeds it fails with a timeout error.
- `onError: "stop" | "continue"` — stop fails the whole run; continue prunes the
  node's descendants but lets independent branches finish.

**Observability.** The engine is an `EventEmitter`. It emits
`run:start`, `node:start`, `node:log`, `node:finish`, `run:finish`. The API
turns these into a **Server-Sent Events** stream so the UI shows live progress.

**Determinism & isolation.** Node handlers get a controlled `ExecutionContext`
(logger, resolved input, config accessor, abort signal). They cannot see the
store or other nodes' internals except through resolved inputs — keeping the
graph the single source of truth.

---

## 4. Built-in node types

| Type | Ports (in → out) | Purpose |
| --- | --- | --- |
| `trigger` | → `out` | Entry point; emits the trigger payload. |
| `manual.input` | → `out` | Constant/seed value from config. |
| `transform` | `in` → `out` | Reshape data with expressions. |
| `condition` | `in` → `true` / `false` | Branch on a boolean expression. |
| `http.request` | `in` → `out` / `error` | Call an external API (real `fetch`). |
| `delay` | `in` → `out` | Wait N ms (bounded). |
| `log` | `in` → `out` | Record a message to the run log. |
| `merge` | `a`,`b` → `out` | Combine two branches into one object. |
| `template` | `in` → `out` | Render a string template. |
| `set.variable` | `in` → `out` | Compute a named value for downstream use. |

Every type is registered in `src/engine/nodes/` and self-describes its ports,
config schema, and defaults — the API exposes this catalog so the UI palette is
generated, never hard-coded.

---

## 5. Triggers

- **manual** — `POST /api/workflows/:id/run` with an optional JSON body.
- **webhook** — `POST /api/hooks/:workflowId` runs the workflow with the request
  body as the trigger payload. Any workflow with a `trigger` node is reachable.
- **schedule** — an in-process scheduler (`src/triggers/scheduler.ts`) fires
  workflows on a fixed interval declared in a `trigger` node's config
  (`everyMs`). Registered on startup and when workflows change.

Triggers are deliberately thin: they all funnel into `engine.run(workflow,
{ trigger, input })`, so execution semantics are identical no matter the source.

---

## 6. Persistence

A `Store` interface (`src/store/store.ts`) abstracts persistence. The default
implementation is a **file-backed JSON store** (`data/`) with atomic writes —
no database process required, so the app is self-contained. Swapping in Postgres
or SQLite later means one new class, no engine changes.

---

## 7. HTTP API

Built directly on `node:http` with a tiny typed router (`src/api/router.ts`).

```
GET    /api/health
GET    /api/node-types                 catalog for the UI palette
GET    /api/workflows                  list
POST   /api/workflows                  create
GET    /api/workflows/:id              read
PUT    /api/workflows/:id              update (revalidates the graph)
DELETE /api/workflows/:id              delete
POST   /api/workflows/:id/validate     static validation report
POST   /api/workflows/:id/run          manual run (returns the Run)
GET    /api/workflows/:id/runs         run history
GET    /api/runs/:id                   single run
GET    /api/runs/:id/stream            SSE live progress
POST   /api/hooks/:id                  webhook trigger
```

Static files (`public/`) are served for everything else, so the canvas UI and
API share one origin and one `npm start`.

---

## 8. MCP server (agent interface)

Alongside the HTTP API, Meridian exposes an **MCP server** (`src/mcp/`) over
stdio so any Model Context Protocol client can drive the engine. It reuses the
exact same `WorkflowService`, registry, and store in-process — no HTTP hop — so
an AI agent and a human editing the canvas operate on one shared set of
workflows.

The tool surface mirrors the service: introspect node types, CRUD workflows,
validate, run, and read run history. Design choices follow MCP best practice:

- **Comprehensive, composable tools** (not one mega-tool) so an agent can plan:
  list types → create → validate → run → inspect.
- **Zod-validated inputs** with rich descriptions and constraints.
- **Structured output** (`structuredContent`) plus a text rendering, and a
  `response_format` toggle (markdown/json) on the catalog/list tools.
- **Behavior annotations** (`readOnlyHint`, `destructiveHint`, `idempotentHint`,
  `openWorldHint`) so clients can reason about safety.
- **Actionable errors**: a missing workflow or invalid graph returns the
  specific issues and the next tool to call, not a bare stack trace.
- **Response budgeting**: list tools truncate to a character limit and say so.

Because the MCP layer is thin over the service, the engine's guarantees
(validation-before-run, branching, retries, observability) apply identically
whether a workflow is triggered by a human, a webhook, a schedule, or an agent.

## 9. Why this is a strong foundation

- **Zero runtime deps** → nothing to break on install; trivially auditable.
- **Graph-validated before execution** → no run starts on a malformed map.
- **Expressions without `eval`** → data-driven configs stay safe.
- **Per-node reliability (retry/timeout/error-policy)** → real-world resilience.
- **Event-sourced runs** → full observability and a live UI for free.
- **Registry-driven node types** → the product grows by adding handlers, not by
  editing the engine.

The result: the "map" a user draws is not a diagram of the automation — it *is*
the automation.
