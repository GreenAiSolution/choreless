import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/engine/engine.js";
import { defaultRegistry } from "../src/engine/nodes/index.js";
import { validateWorkflow } from "../src/engine/validate.js";
import type { Workflow, Node, Edge } from "../src/domain/types.js";

const registry = defaultRegistry();
const engine = new Engine(registry);

function build(nodes: Node[], edges: Edge[], variables = {}): Workflow {
  return {
    id: "w",
    name: "test",
    description: "",
    variables,
    nodes,
    edges,
    createdAt: "",
    updatedAt: "",
  };
}
const n = (id: string, type: string, config: Record<string, unknown> = {}, extra: Partial<Node> = {}): Node => ({
  id,
  type,
  name: id,
  config,
  position: { x: 0, y: 0 },
  ...extra,
});
const e = (fn: string, fp: string, tn: string, tp: string): Edge => ({
  id: `${fn}.${fp}->${tn}.${tp}`,
  from: { node: fn, port: fp },
  to: { node: tn, port: tp },
});

test("linear flow passes data downstream", async () => {
  const wf = build(
    [
      n("in", "manual.input", { value: { amount: 5 } }),
      n("t", "transform", { output: { doubled: "{{ input.in.amount * 2 }}" } }),
      n("log", "log", { message: "result={{ input.in.doubled }}" }),
    ],
    [e("in", "out", "t", "in"), e("t", "out", "log", "in")],
  );
  const run = await engine.run(wf);
  assert.equal(run.status, "succeeded");
  const t = run.nodeRuns.find((r) => r.nodeId === "t")!;
  assert.deepEqual(t.output, { out: { doubled: 10 } });
  const log = run.nodeRuns.find((r) => r.nodeId === "log")!;
  assert.equal(log.logs[0]!.message, "result=10");
});

test("condition takes the true branch and prunes the false branch", async () => {
  const wf = build(
    [
      n("in", "manual.input", { value: { amount: 250 } }),
      n("c", "condition", { expression: "input.in.amount > vars.threshold" }),
      n("hi", "template", { text: "high" }),
      n("lo", "template", { text: "low" }),
    ],
    [
      e("in", "out", "c", "in"),
      e("c", "true", "hi", "in"),
      e("c", "false", "lo", "in"),
    ],
    { threshold: 100 },
  );
  const run = await engine.run(wf);
  assert.equal(run.status, "succeeded");
  assert.equal(run.nodeRuns.find((r) => r.nodeId === "hi")!.status, "succeeded");
  assert.equal(run.nodeRuns.find((r) => r.nodeId === "lo")!.status, "skipped");
});

test("condition false branch prunes the true side", async () => {
  const wf = build(
    [
      n("in", "manual.input", { value: { amount: 5 } }),
      n("c", "condition", { expression: "input.in.amount > 100" }),
      n("hi", "template", { text: "high" }),
      n("lo", "template", { text: "low" }),
    ],
    [
      e("in", "out", "c", "in"),
      e("c", "true", "hi", "in"),
      e("c", "false", "lo", "in"),
    ],
  );
  const run = await engine.run(wf);
  assert.equal(run.nodeRuns.find((r) => r.nodeId === "hi")!.status, "skipped");
  assert.equal(run.nodeRuns.find((r) => r.nodeId === "lo")!.status, "succeeded");
});

/** A registry whose `test.boom` node always throws — deterministic failure. */
function boomRegistry() {
  const reg = defaultRegistry();
  reg.register({
    spec: {
      type: "test.boom",
      label: "Boom",
      category: "Test",
      description: "",
      color: "#f00",
      inputs: [{ name: "in" }],
      outputs: [{ name: "out" }],
      fields: [],
    },
    execute() {
      throw new Error("kaboom");
    },
  });
  return reg;
}

test("a failing node stops the run by default", async () => {
  const eng = new Engine(boomRegistry());
  const wf = build(
    [n("in", "manual.input", { value: 1 }), n("b", "test.boom")],
    [e("in", "out", "b", "in")],
  );
  const run = await eng.run(wf);
  assert.equal(run.status, "failed");
  assert.match(run.error ?? "", /kaboom/);
});

test("onError=continue lets independent branches finish", async () => {
  const eng = new Engine(boomRegistry());
  const wf = build(
    [
      n("in", "manual.input", { value: 1 }),
      n("bad", "test.boom", {}, { onError: "continue" }),
      n("after", "log", { message: "downstream" }),
      n("ok", "log", { message: "independent" }),
    ],
    [
      e("in", "out", "bad", "in"),
      e("bad", "out", "after", "in"),
      e("in", "out", "ok", "in"),
    ],
  );
  const run = await eng.run(wf);
  // whole run still succeeds because `bad` is set to continue
  assert.equal(run.status, "succeeded");
  assert.equal(run.nodeRuns.find((r) => r.nodeId === "bad")!.status, "failed");
  assert.equal(run.nodeRuns.find((r) => r.nodeId === "after")!.status, "skipped");
  assert.equal(run.nodeRuns.find((r) => r.nodeId === "ok")!.status, "succeeded");
});

test("retries eventually succeed and are counted", async () => {
  // Register a flaky one-off type in an isolated registry.
  const reg = defaultRegistry();
  let calls = 0;
  reg.register({
    spec: {
      type: "test.flaky",
      label: "Flaky",
      category: "Test",
      description: "",
      color: "#fff",
      inputs: [],
      outputs: [{ name: "out" }],
      fields: [],
    },
    execute() {
      calls++;
      if (calls < 3) throw new Error("transient");
      return { out: calls };
    },
  });
  const eng = new Engine(reg);
  const wf = build([n("f", "test.flaky", {}, { retries: 5 })], []);
  const run = await eng.run(wf);
  assert.equal(run.status, "succeeded");
  const fr = run.nodeRuns[0]!;
  assert.equal(fr.attempts, 3);
  assert.deepEqual(fr.output, { out: 3 });
});

test("validation rejects unknown node types and cycles", () => {
  const bad = build(
    [n("x", "does.not.exist")],
    [],
  );
  const issues = validateWorkflow(bad, registry);
  assert.ok(issues.some((i) => i.code === "UNKNOWN_TYPE"));

  const cyclic = build(
    [n("a", "log"), n("b", "log")],
    [e("a", "out", "b", "in"), e("b", "out", "a", "in")],
  );
  const cissues = validateWorkflow(cyclic, registry);
  assert.ok(cissues.some((i) => i.code === "CYCLE"));
});

test("merge combines two branches", async () => {
  const wf = build(
    [
      n("a", "manual.input", { value: "A" }),
      n("b", "manual.input", { value: "B" }),
      n("m", "merge"),
    ],
    [e("a", "out", "m", "a"), e("b", "out", "m", "b")],
  );
  const run = await engine.run(wf);
  assert.equal(run.status, "succeeded");
  assert.deepEqual(run.nodeRuns.find((r) => r.nodeId === "m")!.output, {
    out: { a: "A", b: "B" },
  });
});

test("emits lifecycle events in order", async () => {
  const wf = build(
    [n("in", "manual.input", { value: 1 }), n("l", "log", { message: "hi" })],
    [e("in", "out", "l", "in")],
  );
  const events: string[] = [];
  await engine.run(wf, { onEvent: (e) => events.push(e.type) });
  assert.equal(events[0], "run:start");
  assert.equal(events.at(-1), "run:finish");
  assert.ok(events.includes("node:start"));
  assert.ok(events.includes("node:finish"));
});
