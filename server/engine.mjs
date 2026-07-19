// Choreless execution engine.
//
// Task lifecycle: queued → running → qa → (rework → qa)? → awaiting_approval|delivered | exception
//
// Real mode (ANTHROPIC_API_KEY set, SIMULATE unset):
//   produce  — claude-opus-4-8, adaptive thinking, streamed
//   qa judge — independent call, structured output (JSON schema verdict)
//   one automatic rework with the judge's feedback, then exception queue.
// Simulation mode (no key, or SIMULATE=1):
//   deterministic templated deliverables, clearly watermarked. The full state
//   machine, ledger, approvals and ops flows run identically.

import { load, save, id, audit } from "./store.mjs";
import { SERVICES } from "./catalog.mjs";
import { balance, debitForDelivery, credit } from "./billing.mjs";

const SIMULATE = process.env.SIMULATE === "1" || !process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CHORELESS_MODEL || "claude-opus-4-8";
const QA_THRESHOLD = 80;

let anthropic = null;
async function client() {
  if (!anthropic) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    anthropic = new Anthropic();
  }
  return anthropic;
}

// ---------- task creation ----------

export function createTask(customer, serviceId, inputs, source = "web") {
  const svc = SERVICES[serviceId];
  if (!svc) throw new Error("unknown service");
  for (const f of svc.intake) {
    if (f.required && !String(inputs[f.key] || "").trim()) throw new Error(`missing field: ${f.key}`);
  }
  if (balance(customer.id) < svc.credits) throw new Error("insufficient credits");

  const db = load();
  const task = {
    id: id("task"),
    customer: customer.id,
    service: serviceId,
    credit_cost: svc.credits,
    inputs,
    source,
    status: "queued",
    steps: [{ step: "received", ts: new Date().toISOString() }],
    attempts: 0,
    deliverable: null,
    qa: null,
    created_at: new Date().toISOString(),
  };
  db.tasks[task.id] = task;
  save();
  audit("task.created", { task: task.id, customer: customer.id, service: serviceId, source });
  return task;
}

function step(task, name, detail = {}) {
  task.steps.push({ step: name, ts: new Date().toISOString(), ...detail });
}

// ---------- pipeline ----------

async function produce(svc, task, profile, reworkFeedback) {
  if (SIMULATE) return simulatedDeliverable(svc, task, reworkFeedback);

  const c = await client();
  let prompt = svc.produce_prompt(task.inputs, profile);
  if (reworkFeedback) {
    prompt += `\n\nA quality reviewer rejected the previous attempt with this feedback — fix every point:\n${reworkFeedback}\n\nPrevious attempt:\n${task.deliverable}`;
  }
  const stream = c.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system:
      "You are a Choreless fulfillment pipeline. Your output IS the finished deliverable the paying customer receives — no preamble, no meta-commentary, start directly with the deliverable content. Match the requested structure exactly.",
    messages: [{ role: "user", content: prompt }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("model refused this task — routed to human ops");
  return msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", description: "0-100 overall quality score" },
    pass: { type: "boolean" },
    failures: { type: "array", items: { type: "string" }, description: "Rubric items that failed and why" },
    fix_instructions: { type: "string", description: "Concrete instructions for a rework attempt" },
  },
  required: ["score", "pass", "failures", "fix_instructions"],
  additionalProperties: false,
};

async function judge(svc, task, deliverable) {
  if (SIMULATE) {
    return { score: 92, pass: true, failures: [], fix_instructions: "" };
  }
  const c = await client();
  const response = await c.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { format: { type: "json_schema", schema: VERDICT_SCHEMA }, effort: "medium" },
    system:
      "You are an independent QA judge for a paid work-delivery service. Judge strictly against the rubric. A deliverable a customer would ask a refund for must fail.",
    messages: [
      {
        role: "user",
        content: `Service: ${svc.name}\nCustomer inputs:\n${JSON.stringify(task.inputs, null, 2)}\n\nRubric (all must hold):\n${svc.rubric.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\nDELIVERABLE:\n<<<\n${deliverable}\n>>>\n\nScore 0-100; pass requires score >= ${QA_THRESHOLD} AND zero rubric failures.`,
      },
    ],
  });
  if (response.stop_reason === "refusal") return { score: 0, pass: false, failures: ["judge refused"], fix_instructions: "" };
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text);
}

function simulatedDeliverable(svc, task, rework) {
  const inputSummary = Object.entries(task.inputs)
    .map(([k, v]) => `- **${k}**: ${String(v).slice(0, 200)}`)
    .join("\n");
  return `> ⚠️ **SIMULATED DELIVERABLE** — the engine is running without an \`ANTHROPIC_API_KEY\`. In production this is real, QA'd work produced by ${"`" + MODEL + "`"}.${rework ? " (rework attempt)" : ""}

# ${svc.name} — deliverable for task ${task.id}

Produced from your inputs:
${inputSummary}

The real pipeline runs: **produce** (adaptive-thinking generation against the service prompt) → **independent QA judge** (structured verdict against this rubric):
${svc.rubric.map((r) => `- ${r}`).join("\n")}

Set \`ANTHROPIC_API_KEY\` and restart to see live fulfillment.`;
}

// ---------- worker ----------

export async function runTask(taskId) {
  const db = load();
  const task = db.tasks[taskId];
  if (!task || task.status !== "queued") return;
  const svc = SERVICES[task.service];
  const customer = db.customers[task.customer];
  const profile = customer?.profile || null;

  task.status = "running";
  step(task, "hydrate", { profile_loaded: !!profile });
  step(task, "produce", { mode: SIMULATE ? "simulated" : "live", model: MODEL });
  save();

  try {
    let deliverable = await produce(svc, task, profile, null);
    task.attempts = 1;
    task.status = "qa";
    step(task, "qa");
    save();

    let verdict = await judge(svc, task, deliverable);
    if (!verdict.pass) {
      step(task, "rework", { failures: verdict.failures });
      task.deliverable = deliverable;
      save();
      deliverable = await produce(svc, task, profile, verdict.fix_instructions || verdict.failures.join("; "));
      task.attempts = 2;
      verdict = await judge(svc, task, deliverable);
    }

    task.deliverable = deliverable;
    task.qa = verdict;

    if (!verdict.pass) {
      task.status = "exception";
      step(task, "exception", { reason: "failed QA twice" });
      audit("task.exception", { task: task.id, failures: verdict.failures });
    } else if (svc.requires_approval) {
      task.status = "awaiting_approval";
      step(task, "awaiting_approval");
      audit("task.awaiting_approval", { task: task.id });
    } else {
      deliver(task);
    }
  } catch (err) {
    task.status = "exception";
    step(task, "exception", { error: String(err.message || err) });
    audit("task.exception", { task: task.id, error: String(err.message || err) });
  }
  save();
}

function deliver(task) {
  task.status = "delivered";
  task.delivered_at = new Date().toISOString();
  step(task, "delivered");
  debitForDelivery(task.customer, task);
  audit("task.delivered", { task: task.id, credits: task.credit_cost });
}

export function approveTask(taskId, customerId) {
  const db = load();
  const task = db.tasks[taskId];
  if (!task || task.customer !== customerId) throw new Error("not found");
  if (task.status !== "awaiting_approval") throw new Error("not awaiting approval");
  step(task, "approved_by_customer");
  deliver(task);
  save();
  return task;
}

export function requestRevision(taskId, customerId, notes) {
  const db = load();
  const task = db.tasks[taskId];
  if (!task || task.customer !== customerId) throw new Error("not found");
  if (!["awaiting_approval", "delivered"].includes(task.status)) throw new Error("not revisable");
  // Quality promise: revision is free; if already delivered, the credit comes back.
  if (task.status === "delivered") {
    credit(customerId, task.credit_cost, "revision-refund", task.id);
  }
  task.status = "queued";
  task.inputs = { ...task.inputs, _revision_notes: notes || "customer requested revision" };
  step(task, "revision_requested", { notes });
  save();
  audit("task.revision", { task: task.id, notes });
  return task;
}

// Ops resolution for the exception queue.
export function resolveException(taskId, action) {
  const db = load();
  const task = db.tasks[taskId];
  if (!task || task.status !== "exception") throw new Error("not an exception");
  if (action === "release") {
    // Human reviewed the deliverable and passed it.
    step(task, "ops_released");
    if (SERVICES[task.service].requires_approval) {
      task.status = "awaiting_approval";
    } else {
      deliver(task);
    }
  } else if (action === "retry") {
    task.status = "queued";
    step(task, "ops_retry");
  } else if (action === "refund") {
    task.status = "closed_refunded";
    step(task, "ops_refunded");
    // Nothing was debited (debit happens on delivery), so closing is enough.
  } else throw new Error("unknown action");
  save();
  audit("ops.resolve", { task: task.id, action });
  return task;
}

// ---------- autopilots ----------

const CADENCE_MS = { daily: 864e5, weekly: 7 * 864e5, monthly: 30 * 864e5 };

export function createAutopilot(customer, serviceId, cadence, inputs) {
  const svc = SERVICES[serviceId];
  if (!svc?.autopilot) throw new Error("service is not autopilot-capable");
  if (!CADENCE_MS[cadence]) throw new Error("cadence must be daily|weekly|monthly");
  const db = load();
  const ap = {
    id: id("ap"),
    customer: customer.id,
    service: serviceId,
    cadence,
    inputs,
    enabled: true,
    next_run: new Date(Date.now() + CADENCE_MS[cadence]).toISOString(),
    created_at: new Date().toISOString(),
  };
  db.autopilots[ap.id] = ap;
  save();
  audit("autopilot.created", { autopilot: ap.id, service: serviceId, cadence });
  return ap;
}

function tickAutopilots() {
  const db = load();
  const now = Date.now();
  for (const ap of Object.values(db.autopilots)) {
    if (!ap.enabled || Date.parse(ap.next_run) > now) continue;
    ap.next_run = new Date(now + CADENCE_MS[ap.cadence]).toISOString();
    try {
      const customer = db.customers[ap.customer];
      const task = createTask(customer, ap.service, ap.inputs, `autopilot:${ap.id}`);
      audit("autopilot.fired", { autopilot: ap.id, task: task.id });
    } catch (err) {
      audit("autopilot.skipped", { autopilot: ap.id, reason: String(err.message || err) });
    }
  }
  save();
}

// ---------- worker loop ----------

let running = false;
export function startWorker(intervalMs = 1500) {
  const loop = async () => {
    if (running) return;
    running = true;
    try {
      tickAutopilots();
      const db = load();
      const next = Object.values(db.tasks).find((t) => t.status === "queued");
      if (next) await runTask(next.id);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(loop, intervalMs);
  timer.unref?.();
  return timer;
}

export function metrics() {
  const db = load();
  const tasks = Object.values(db.tasks);
  const done = tasks.filter((t) => t.status === "delivered");
  const qaScores = tasks.filter((t) => t.qa).map((t) => t.qa.score);
  return {
    mode: SIMULATE ? "simulation" : `live (${MODEL})`,
    customers: Object.keys(db.customers).length,
    tasks_total: tasks.length,
    tasks_by_status: tasks.reduce((m, t) => ((m[t.status] = (m[t.status] || 0) + 1), m), {}),
    delivered: done.length,
    qa_pass_rate: qaScores.length ? Math.round((qaScores.filter((s) => s >= QA_THRESHOLD).length / qaScores.length) * 100) : null,
    avg_qa_score: qaScores.length ? Math.round(qaScores.reduce((a, b) => a + b, 0) / qaScores.length) : null,
    autopilots_active: Object.values(db.autopilots).filter((a) => a.enabled).length,
  };
}
