// Choreless API + web server. Zero framework — node:http and a small router.
//
//   node server/server.mjs          (PORT=8787 by default)
//
// Env:
//   ANTHROPIC_API_KEY      — enables live fulfillment (else simulation mode)
//   STRIPE_SECRET_KEY      — enables real Stripe Checkout (else dev billing)
//   STRIPE_WEBHOOK_SECRET  — enables webhook signature verification
//   OPS_KEY                — ops console key (default: choreless-ops-dev)
//   PORT, CHORELESS_DATA_DIR

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { load, save, id, audit, auditTail } from "./store.mjs";
import { SERVICES, PLANS, routeTask } from "./catalog.mjs";
import { balance, ledgerFor, credit, createCheckout, handleStripeWebhook } from "./billing.mjs";
import {
  createTask, approveTask, requestRevision, resolveException,
  createAutopilot, startWorker, metrics,
} from "./engine.mjs";

const PORT = Number(process.env.PORT || 8787);
const OPS_KEY = process.env.OPS_KEY || "choreless-ops-dev";
const ROOT = new URL(".", import.meta.url).pathname;
const SIGNUP_CREDITS = 3; // first tasks free while the system learns you

// ---------- auth ----------

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}
function checkPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(password, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

function authed(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const db = load();
  const customerId = db.tokens[token];
  return customerId ? db.customers[customerId] : null;
}

// ---------- helpers ----------

function json(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) });
  res.end(data);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 5e6) req.destroy(); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
const parse = (raw) => { try { return JSON.parse(raw || "{}"); } catch { return {}; } };

function publicTask(t) {
  const { customer, ...rest } = t;
  return rest;
}
function meView(c) {
  return {
    id: c.id, email: c.email, plan: c.plan, profile: c.profile || null,
    credits: balance(c.id),
  };
}

// ---------- routes ----------

const routes = [];
const route = (method, pattern, handler) => routes.push({ method, pattern, handler });

route("GET", /^\/api\/catalog$/, (req, res) => {
  const services = Object.values(SERVICES).map(({ produce_prompt, rubric, ...s }) => s);
  json(res, 200, { services, plans: PLANS, mode: metrics().mode });
});

route("POST", /^\/api\/route$/, async (req, res) => {
  const { text } = parse(await readBody(req));
  if (!text) return json(res, 400, { error: "text required" });
  const hit = routeTask(text);
  if (!hit) return json(res, 200, { routed: false, note: "No pipeline match — logged as a candidate for the next service." });
  const svc = SERVICES[hit.service];
  json(res, 200, { routed: true, service: svc.id, name: svc.name, credits: svc.credits, confidence: hit.confidence });
});

route("POST", /^\/api\/signup$/, async (req, res) => {
  const { email, password } = parse(await readBody(req));
  if (!email || !password || password.length < 8) return json(res, 400, { error: "email and password (8+ chars) required" });
  const db = load();
  if (Object.values(db.customers).some((c) => c.email === email)) return json(res, 409, { error: "account exists" });
  const customer = { id: id("cus"), email, password: hashPassword(password), plan: "starter", profile: null, created_at: new Date().toISOString() };
  db.customers[customer.id] = customer;
  const token = randomBytes(24).toString("hex");
  db.tokens[token] = customer.id;
  save();
  credit(customer.id, SIGNUP_CREDITS, "signup-grant");
  audit("customer.signup", { customer: customer.id });
  json(res, 201, { token, customer: meView(customer) });
});

route("POST", /^\/api\/login$/, async (req, res) => {
  const { email, password } = parse(await readBody(req));
  const db = load();
  const customer = Object.values(db.customers).find((c) => c.email === email);
  if (!customer || !checkPassword(password || "", customer.password)) return json(res, 401, { error: "invalid credentials" });
  const token = randomBytes(24).toString("hex");
  db.tokens[token] = customer.id;
  save();
  json(res, 200, { token, customer: meView(customer) });
});

route("GET", /^\/api\/me$/, (req, res) => {
  const c = authed(req);
  if (!c) return json(res, 401, { error: "auth required" });
  json(res, 200, { customer: meView(c), ledger: ledgerFor(c.id).slice(-25) });
});

route("POST", /^\/api\/profile$/, async (req, res) => {
  const c = authed(req);
  if (!c) return json(res, 401, { error: "auth required" });
  const { profile } = parse(await readBody(req));
  const db = load();
  db.customers[c.id].profile = String(profile || "").slice(0, 4000);
  save();
  audit("customer.profile_updated", { customer: c.id });
  json(res, 200, { ok: true });
});

route("POST", /^\/api\/checkout$/, async (req, res) => {
  const c = authed(req);
  if (!c) return json(res, 401, { error: "auth required" });
  const { plan } = parse(await readBody(req));
  const origin = `http://${req.headers.host}`;
  try {
    json(res, 200, await createCheckout(c, plan, origin));
  } catch (err) {
    json(res, 400, { error: String(err.message || err) });
  }
});

route("POST", /^\/api\/stripe\/webhook$/, async (req, res) => {
  try {
    json(res, 200, handleStripeWebhook(await readBody(req), req.headers["stripe-signature"]));
  } catch (err) {
    json(res, 400, { error: String(err.message || err) });
  }
});

route("POST", /^\/api\/tasks$/, async (req, res) => {
  const c = authed(req);
  if (!c) return json(res, 401, { error: "auth required" });
  const body = parse(await readBody(req));
  try {
    let serviceId = body.service;
    if (!serviceId && body.brief) {
      const hit = routeTask(body.brief);
      if (!hit) return json(res, 422, { error: "could not route brief to a pipeline" });
      serviceId = hit.service;
    }
    const task = createTask(c, serviceId, body.inputs || {});
    json(res, 201, { task: publicTask(task) });
  } catch (err) {
    json(res, 400, { error: String(err.message || err) });
  }
});

route("GET", /^\/api\/tasks$/, (req, res) => {
  const c = authed(req);
  if (!c) return json(res, 401, { error: "auth required" });
  const db = load();
  const tasks = Object.values(db.tasks)
    .filter((t) => t.customer === c.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(publicTask);
  json(res, 200, { tasks });
});

route("GET", /^\/api\/tasks\/([^/]+)$/, (req, res, m) => {
  const c = authed(req);
  if (!c) return json(res, 401, { error: "auth required" });
  const t = load().tasks[m[1]];
  if (!t || t.customer !== c.id) return json(res, 404, { error: "not found" });
  json(res, 200, { task: publicTask(t) });
});

route("POST", /^\/api\/tasks\/([^/]+)\/approve$/, (req, res, m) => {
  const c = authed(req);
  if (!c) return json(res, 401, { error: "auth required" });
  try { json(res, 200, { task: publicTask(approveTask(m[1], c.id)) }); }
  catch (err) { json(res, 400, { error: String(err.message || err) }); }
});

route("POST", /^\/api\/tasks\/([^/]+)\/revise$/, async (req, res, m) => {
  const c = authed(req);
  if (!c) return json(res, 401, { error: "auth required" });
  const { notes } = parse(await readBody(req));
  try { json(res, 200, { task: publicTask(requestRevision(m[1], c.id, notes)) }); }
  catch (err) { json(res, 400, { error: String(err.message || err) }); }
});

route("POST", /^\/api\/autopilots$/, async (req, res) => {
  const c = authed(req);
  if (!c) return json(res, 401, { error: "auth required" });
  const { service, cadence, inputs } = parse(await readBody(req));
  try { json(res, 201, { autopilot: createAutopilot(c, service, cadence, inputs || {}) }); }
  catch (err) { json(res, 400, { error: String(err.message || err) }); }
});

route("GET", /^\/api\/autopilots$/, (req, res) => {
  const c = authed(req);
  if (!c) return json(res, 401, { error: "auth required" });
  json(res, 200, { autopilots: Object.values(load().autopilots).filter((a) => a.customer === c.id) });
});

route("DELETE", /^\/api\/autopilots\/([^/]+)$/, (req, res, m) => {
  const c = authed(req);
  if (!c) return json(res, 401, { error: "auth required" });
  const db = load();
  const ap = db.autopilots[m[1]];
  if (!ap || ap.customer !== c.id) return json(res, 404, { error: "not found" });
  ap.enabled = false;
  save();
  json(res, 200, { ok: true });
});

// ---------- ops (X-Ops-Key header) ----------

const opsAuthed = (req) => (req.headers["x-ops-key"] || "") === OPS_KEY;

route("GET", /^\/api\/ops\/overview$/, (req, res) => {
  if (!opsAuthed(req)) return json(res, 401, { error: "ops key required" });
  const db = load();
  const exceptions = Object.values(db.tasks).filter((t) => t.status === "exception");
  json(res, 200, { metrics: metrics(), exceptions, audit: auditTail(50) });
});

route("POST", /^\/api\/ops\/tasks\/([^/]+)\/resolve$/, async (req, res, m) => {
  if (!opsAuthed(req)) return json(res, 401, { error: "ops key required" });
  const { action } = parse(await readBody(req));
  try { json(res, 200, { task: resolveException(m[1], action) }); }
  catch (err) { json(res, 400, { error: String(err.message || err) }); }
});

// ---------- static ----------

const STATIC = {
  "/": join(ROOT, "..", "index.html"),
  "/app": join(ROOT, "public", "app.html"),
  "/ops": join(ROOT, "public", "ops.html"),
};

function serveStatic(req, res, url) {
  const file = STATIC[url.pathname];
  if (file && existsSync(file)) {
    const body = readFileSync(file);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(body);
  }
  json(res, 404, { error: "not found" });
}

// ---------- server ----------

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    for (const r of routes) {
      const m = req.method === r.method && url.pathname.match(r.pattern);
      if (m) return await r.handler(req, res, m);
    }
    if (req.method === "GET") return serveStatic(req, res, url);
    json(res, 404, { error: "not found" });
  } catch (err) {
    json(res, 500, { error: String(err.message || err) });
  }
});

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    const m = metrics();
    console.log(`Choreless selling system on http://localhost:${PORT}`);
    console.log(`  marketing  /        product  /app        ops  /ops (key: ${OPS_KEY})`);
    console.log(`  fulfillment mode: ${m.mode}`);
    startWorker();
  });
}

export { server, startWorker };
