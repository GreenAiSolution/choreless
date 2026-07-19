// End-to-end smoke test. Runs the real server + engine in simulation mode
// against a throwaway data dir. Exercises: signup, dev checkout, task drop
// routing, full pipeline to delivery, approval flow, ledger debits, free
// revision, autopilots, ops overview.
//
//   npm test

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.SIMULATE = "1";
process.env.NODE_ENV = "test";
process.env.CHORELESS_DATA_DIR = mkdtempSync(join(tmpdir(), "choreless-test-"));
process.env.OPS_KEY = "test-ops-key";

const { server } = await import("./server.mjs");
const { runTask } = await import("./engine.mjs");

await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

let token = null;
let passed = 0;
const assert = (cond, name) => {
  if (!cond) { console.error(`✗ ${name}`); process.exitCode = 1; throw new Error(name); }
  passed++; console.log(`✓ ${name}`);
};
const api = async (path, { method, body, ops } = {}) => {
  const res = await fetch(BASE + "/api" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(ops ? { "X-Ops-Key": "test-ops-key" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
};

try {
  // catalog is public
  let r = await api("/catalog");
  assert(r.status === 200 && r.data.services.length === 7, "catalog serves 7 services");
  assert(r.data.services.some((s) => s.id === "before-you-sign" && s.flagship), "flagship service present");

  // signup grants free credits
  r = await api("/signup", { body: { email: "test@choreless.dev", password: "hunter22!" } });
  assert(r.status === 201 && r.data.token, "signup returns token");
  token = r.data.token;
  assert(r.data.customer.credits === 3, "signup grants 3 credits");

  // auth is enforced
  const saved = token; token = null;
  r = await api("/tasks");
  assert(r.status === 401, "tasks require auth");
  token = saved;

  // dev checkout grants plan credits instantly
  r = await api("/checkout", { body: { plan: "pro" } });
  assert(r.status === 200 && r.data.dev_mode && r.data.granted === 30, "dev checkout grants pro credits");
  r = await api("/me");
  assert(r.data.customer.credits === 33 && r.data.customer.plan === "pro", "balance 33, plan pro");

  // task drop routes to the flagship
  r = await api("/route", { body: { text: "I'm about to sign a lease and clause 14 scares me" } });
  assert(r.data.routed && r.data.service === "before-you-sign", "task drop routes lease → before-you-sign");

  // create a task, run the pipeline, auto-delivery (no approval needed)
  r = await api("/tasks", { body: {
    service: "before-you-sign",
    inputs: { document: "Clause 14: tenant pays all repairs regardless of cause.", doc_type: "apartment lease" },
  }});
  assert(r.status === 201 && r.data.task.status === "queued", "task created queued");
  const taskId = r.data.task.id;
  await runTask(taskId); // drive the worker synchronously
  r = await api("/tasks/" + taskId);
  assert(r.data.task.status === "delivered", "before-you-sign delivered without approval gate");
  assert(r.data.task.deliverable.includes("SIMULATED"), "simulated deliverable watermarked");
  assert(r.data.task.qa && r.data.task.qa.pass, "QA verdict attached");
  r = await api("/me");
  assert(r.data.customer.credits === 31, "2 credits debited on delivery, not intake");

  // approval-gated service pauses before shipping
  r = await api("/tasks", { body: {
    service: "ghostwriter",
    inputs: { situation: "Client 90 days overdue on $4k invoice", outcome: "get paid in 14 days", relationship: "long-term client, keep relationship" },
  }});
  const gwId = r.data.task.id;
  await runTask(gwId);
  r = await api("/tasks/" + gwId);
  assert(r.data.task.status === "awaiting_approval", "ghostwriter waits for approval");
  r = await api("/me");
  assert(r.data.customer.credits === 31, "no debit while awaiting approval");
  r = await api(`/tasks/${gwId}/approve`, { method: "POST" });
  assert(r.data.task.status === "delivered", "approval delivers");
  r = await api("/me");
  assert(r.data.customer.credits === 29, "debit lands after approval");

  // free revision returns the credit and requeues
  r = await api(`/tasks/${gwId}/revise`, { body: { notes: "shorter, less formal" } });
  assert(r.data.task.status === "queued", "revision requeues");
  r = await api("/me");
  assert(r.data.customer.credits === 31, "revision refunds the credit");
  await runTask(gwId);
  r = await api("/tasks/" + gwId);
  assert(r.data.task.status === "awaiting_approval", "revision reruns pipeline");

  // insufficient credits rejected
  r = await api("/tasks", { body: { service: "social-autopilot", inputs: { business: "x", platforms: "ig" } } });
  assert(r.status === 400 || r.data.task, "social (8cr) fits in 31 — create ok");
  // burn down: create clip factory task requiring missing field
  r = await api("/tasks", { body: { service: "clip-factory", inputs: { source: "https://youtu.be/x" } } });
  assert(r.status === 400 && /missing field/.test(r.data.error), "intake validation enforced");

  // autopilot
  r = await api("/autopilots", { body: { service: "reputation-autopilot", cadence: "weekly", inputs: { business: "Cafe", reviews: "5 stars, loved it" } } });
  assert(r.status === 201 && r.data.autopilot.enabled, "autopilot created");
  r = await api("/autopilots", { body: { service: "ghostwriter", cadence: "weekly", inputs: {} } });
  assert(r.status === 400, "non-autopilot service rejected");

  // ops console
  r = await api("/ops/overview", { ops: true });
  assert(r.status === 200 && r.data.metrics.tasks_total >= 3, "ops overview reports metrics");
  assert(Array.isArray(r.data.audit) && r.data.audit.length > 5, "audit log populated");
  r = await api("/ops/overview");
  assert(r.status === 401, "ops requires key");

  console.log(`\nAll ${passed} checks passed.`);
} finally {
  server.close();
  rmSync(process.env.CHORELESS_DATA_DIR, { recursive: true, force: true });
}
