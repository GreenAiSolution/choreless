import http from "node:http";
import type { WorkflowService } from "../service.js";
import type { TriggerInfo } from "../domain/types.js";
import { Router, HttpError, type Ctx } from "./router.js";
import { staticHandler } from "./static.js";
import { hasErrors } from "../engine/validate.js";
import type { RunEvent } from "../engine/engine.js";

export interface ServerDeps {
  service: WorkflowService;
  publicDir: string;
}

/** Build the HTTP server: JSON API + SSE + static SPA, all on one origin. */
export function buildServer(deps: ServerDeps): http.Server {
  const { service } = deps;
  const router = new Router();

  router.get("/api/health", (c) =>
    c.send(200, { status: "ok", time: new Date().toISOString() }),
  );

  router.get("/api/node-types", (c) => c.send(200, service.catalog()));

  // --- Workflows ---------------------------------------------------------
  router.get("/api/workflows", async (c) => c.send(200, await service.list()));

  router.post("/api/workflows", async (c) => {
    const body = await c.json<Record<string, never>>();
    c.send(201, await service.create(body));
  });

  router.get("/api/workflows/:id", async (c) =>
    c.send(200, await service.get(c.params.id!)),
  );

  router.put("/api/workflows/:id", async (c) => {
    const body = await c.json<Record<string, never>>();
    c.send(200, await service.update(c.params.id!, body));
  });

  router.delete("/api/workflows/:id", async (c) => {
    await service.remove(c.params.id!);
    c.send(200, { ok: true });
  });

  router.post("/api/workflows/:id/validate", async (c) => {
    const wf = await service.get(c.params.id!);
    const issues = service.validate(wf);
    c.send(200, { valid: !hasErrors(issues), issues });
  });

  // --- Runs --------------------------------------------------------------
  router.post("/api/workflows/:id/run", async (c) => {
    const body = await c.json<{ input?: unknown }>();
    const trigger: TriggerInfo = { kind: "manual", payload: body.input ?? null };
    c.send(200, await service.runById(c.params.id!, trigger));
  });

  // Live run with Server-Sent Events (GET so EventSource can consume it).
  router.get("/api/workflows/:id/run-stream", async (c) => {
    await streamRun(c, service, c.params.id!, {
      kind: "manual",
      payload: parseQueryInput(c),
    });
  });

  router.get("/api/workflows/:id/runs", async (c) => {
    const limit = Number(c.query.get("limit") ?? "50");
    c.send(200, await service.listRuns(c.params.id!, limit));
  });

  router.get("/api/runs/:id", async (c) =>
    c.send(200, await service.getRun(c.params.id!)),
  );

  // --- Webhook trigger ---------------------------------------------------
  router.post("/api/hooks/:id", async (c) => {
    const payload = await c.json<unknown>();
    const trigger: TriggerInfo = { kind: "webhook", payload };
    const run = await service.runById(c.params.id!, trigger);
    c.send(run.status === "succeeded" ? 200 : 202, {
      runId: run.id,
      status: run.status,
      output: run.output,
    });
  });

  // Static SPA for everything else.
  router.notFound(staticHandler(deps.publicDir));

  return http.createServer((req, res) => {
    void router.handle(req, res);
  });
}

function parseQueryInput(c: Ctx): unknown {
  const raw = c.query.get("input");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Run a workflow and stream engine events to the client as SSE. */
async function streamRun(
  c: Ctx,
  service: WorkflowService,
  workflowId: string,
  trigger: TriggerInfo,
): Promise<void> {
  c.res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });

  const write = (event: string, data: unknown) => {
    c.res.write(`event: ${event}\n`);
    c.res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const onEvent = (e: RunEvent) => write(e.type, e);

  try {
    const run = await service.runById(workflowId, trigger, onEvent);
    write("done", { runId: run.id, status: run.status });
  } catch (err) {
    write("error", {
      message: err instanceof Error ? err.message : String(err),
      issues: (err as { issues?: unknown }).issues ?? [],
    });
  } finally {
    c.res.end();
  }
}

// Re-export so callers don't need to reach into router internals.
export { HttpError };
