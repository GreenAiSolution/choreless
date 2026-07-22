import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/engine/engine.js";
import { defaultRegistry } from "../src/engine/nodes/index.js";
import type { Workflow, Node, Edge } from "../src/domain/types.js";

const registry = defaultRegistry();
const engine = new Engine(registry);

function build(nodes: Node[], edges: Edge[]): Workflow {
  return {
    id: "w",
    name: "t",
    description: "",
    variables: {},
    nodes,
    edges,
    createdAt: "",
    updatedAt: "",
  };
}
const node = (id: string, type: string, config: Record<string, unknown> = {}): Node => ({
  id,
  type,
  name: id,
  config,
  position: { x: 0, y: 0 },
});
const edge = (fn: string, fp: string, tn: string, tp: string): Edge => ({
  id: `${fn}.${fp}->${tn}.${tp}`,
  from: { node: fn, port: fp },
  to: { node: tn, port: tp },
});

test("integration nodes are registered", () => {
  const types = registry.catalog().map((t) => t.type);
  for (const t of ["webhook.send", "slack.message", "email.send", "llm.complete"]) {
    assert.ok(types.includes(t), `missing ${t}`);
  }
  assert.equal(registry.catalog().length, 14);
});

test("slack.message without a webhook routes to the error port (no network)", async () => {
  // Ensure no ambient env credential interferes.
  delete process.env.SLACK_WEBHOOK_URL;
  const wf = build(
    [
      node("in", "manual.input", { value: "hello" }),
      node("slack", "slack.message", { text: "{{ input.in }}" }),
      node("okPath", "log", { message: "sent" }),
      node("errPath", "log", { message: "failed" }),
    ],
    [
      edge("in", "out", "slack", "in"),
      edge("slack", "out", "okPath", "in"),
      edge("slack", "error", "errPath", "in"),
    ],
  );
  const run = await engine.run(wf);
  assert.equal(run.status, "succeeded");
  const status = (id: string) => run.nodeRuns.find((r) => r.nodeId === id)!.status;
  // slack emitted only on `error`, so okPath is pruned and errPath runs.
  assert.equal(status("okPath"), "skipped");
  assert.equal(status("errPath"), "succeeded");
});

test("email.send and llm.complete fail gracefully without credentials", async () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const wf = build(
    [
      node("email", "email.send", { from: "a@b.co", to: "c@d.co", subject: "hi", html: "x" }),
      node("llm", "llm.complete", { prompt: "hi" }),
    ],
    [],
  );
  const run = await engine.run(wf);
  // Both emit on their `error` port but do not throw, so the run succeeds.
  assert.equal(run.status, "succeeded");
  const email = run.nodeRuns.find((r) => r.nodeId === "email")!;
  const llm = run.nodeRuns.find((r) => r.nodeId === "llm")!;
  assert.equal(email.status, "succeeded");
  assert.match(JSON.stringify(email.output), /Resend API key/);
  assert.match(JSON.stringify(llm.output), /Anthropic API key/);
});
