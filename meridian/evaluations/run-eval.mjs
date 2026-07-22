#!/usr/bin/env node
// Eval runner for meridian-mcp-server.
//
// Spawns the MCP server over stdio and, for each QA pair in mcp_eval.xml,
// DERIVES the answer purely by calling MCP tools (the way an agent would) and
// compares it to the expected answer by normalized string equality. This both
// exercises the server end-to-end and proves every expected answer is
// achievable through the tool surface.
//
// Usage: node evaluations/run-eval.mjs   (run from the meridian/ directory)

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "..");
const dataDir = path.join(root, "data-eval-tmp");

// ---- parse expected answers from the XML (order matters) ------------------
const xml = readFileSync(path.join(dir, "mcp_eval.xml"), "utf8");
const expected = [...xml.matchAll(/<answer>([\s\S]*?)<\/answer>/g)].map((m) =>
  m[1].trim(),
);

// ---- MCP stdio plumbing ---------------------------------------------------
const child = spawn("npx", ["tsx", "src/mcp/index.ts"], {
  cwd: root,
  env: { ...process.env, DATA_DIR: dataDir },
  stdio: ["pipe", "pipe", "inherit"],
});
let buf = "";
const waiters = new Map();
child.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id && waiters.has(msg.id)) {
      waiters.get(msg.id)(msg);
      waiters.delete(msg.id);
    }
  }
});
let nextId = 1;
const rpc = (method, params) =>
  new Promise((resolve) => {
    const id = nextId++;
    waiters.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
const notify = (method, params) =>
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
const call = (name, args = {}) =>
  rpc("tools/call", { name, arguments: args }).then((r) => {
    const sc = r.result?.structuredContent;
    return sc ?? JSON.parse(r.result.content[0].text);
  });

// ---- helpers for the solvers ---------------------------------------------
const catalog = async () =>
  (await call("meridian_list_node_types", { response_format: "json" })).nodeTypes;
const typeByName = (cat, t) => cat.find((x) => x.type === t);

async function runFreshWorkflow(nodes, edges, input) {
  const created = await call("meridian_create_workflow", {
    name: "eval-" + nextId,
    nodes,
    edges,
  });
  const run = await call("meridian_run_workflow", { id: created.workflow.id, input });
  return { created, run };
}

// ---- one solver per QA pair (in file order) -------------------------------
const solvers = [
  // 1. how many node types
  async () => String((await catalog()).length),
  // 2. category of http.request
  async () => typeByName(await catalog(), "http.request").category,
  // 3. which type is in the 'AI' category
  async () => (await catalog()).find((x) => x.category === "AI").type,
  // 4. which port does condition emit on when truthy — derive by running
  async () => {
    const { run } = await runFreshWorkflow(
      [
        { id: "in", type: "manual.input", config: { value: true } },
        { id: "c", type: "condition", config: { expression: "true" } },
        { id: "t", type: "template", config: { text: "T" } },
        { id: "f", type: "template", config: { text: "F" } },
      ],
      [
        { id: "e1", from: { node: "in", port: "out" }, to: { node: "c", port: "in" } },
        { id: "e2", from: { node: "c", port: "true" }, to: { node: "t", port: "in" } },
        { id: "e3", from: { node: "c", port: "false" }, to: { node: "f", port: "in" } },
      ],
      true,
    );
    const st = Object.fromEntries(run.run.nodeResults.map((n) => [n.nodeId, n.status]));
    // the node that succeeded is wired to the truthy port
    return st.t === "succeeded" ? "true" : "false";
  },
  // 5. merge input ports
  async () => typeByName(await catalog(), "merge").inputs.map((p) => p.name).join(", "),
  // 6. zero-input entry types, alphabetical
  async () =>
    (await catalog())
      .filter((x) => x.inputs.length === 0)
      .map((x) => x.type)
      .sort()
      .join(", "),
  // 7. delay ms default
  async () =>
    String(typeByName(await catalog(), "delay").fields.find((f) => f.key === "ms").default),
  // 8. false-branch node status when amount 150 > 100
  async () => {
    const { run } = await runFreshWorkflow(
      [
        { id: "in", type: "manual.input", config: { value: { amount: 150 } } },
        { id: "c", type: "condition", config: { expression: "input.in.amount > 100" } },
        { id: "t", type: "template", config: { text: "hi" } },
        { id: "f", type: "template", config: { text: "lo" } },
      ],
      [
        { id: "e1", from: { node: "in", port: "out" }, to: { node: "c", port: "in" } },
        { id: "e2", from: { node: "c", port: "true" }, to: { node: "t", port: "in" } },
        { id: "e3", from: { node: "c", port: "false" }, to: { node: "f", port: "in" } },
      ],
      { amount: 150 },
    );
    return run.run.nodeResults.find((n) => n.nodeId === "f").status;
  },
  // 9. transform doubled value
  async () => {
    const { created } = await runFreshWorkflow(
      [{ id: "t", type: "transform", config: { output: { doubled: "{{ 21 * 2 }}" } } }],
      [],
      null,
    );
    const run = await call("meridian_run_workflow", { id: created.workflow.id });
    // fetch full run detail to read node output
    const runs = await call("meridian_list_runs", { workflow_id: created.workflow.id });
    const full = await call("meridian_get_run", { id: runs.runs[0].id });
    return String(full.run.nodeRuns.find((n) => n.nodeId === "t").output.out.doubled);
  },
  // 10. running a missing workflow yields an error result
  async () => {
    const res = await call("meridian_run_workflow", { id: "does-not-exist" });
    return String(Boolean(res.error));
  },
];

const norm = (s) => String(s).trim();

const main = async () => {
  await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "eval", version: "0" },
  });
  notify("notifications/initialized", {});

  let pass = 0;
  console.log("Running meridian-mcp-server evaluations\n");
  for (let i = 0; i < solvers.length; i++) {
    let got;
    try {
      got = await solvers[i]();
    } catch (e) {
      got = `ERROR: ${e.message}`;
    }
    const ok = norm(got) === norm(expected[i]);
    if (ok) pass++;
    console.log(
      `${ok ? "✓" : "✗"} Q${i + 1}  expected="${expected[i]}"  got="${got}"`,
    );
  }
  console.log(`\n${pass}/${solvers.length} passed`);
  child.kill();
  process.exit(pass === solvers.length ? 0 : 1);
};

const t = setTimeout(() => {
  console.log("timed out");
  child.kill();
  process.exit(1);
}, 60000);
t.unref();

main().catch((e) => {
  console.error(e);
  child.kill();
  process.exit(1);
});
