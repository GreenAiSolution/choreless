// END-TO-END PROOF of the Choreless Service Framework.
//
//   npm run framework
//
// Runs all six services through the SINGLE runtime spine and proves every
// guarantee the blueprint promises:
//   • config-not-code    — services are auto-discovered from server/services/
//   • QA gate            — a bad draft is BLOCKED and the credit is returned
//   • credits            — debited on delivery, results-priced only on outcome
//   • authorization gate — an act-on-behalf job with no consent is REFUSED
//   • autopilot          — scheduled + event triggers enqueue real jobs
//   • audit chain        — every step is hash-chained and verifiable
//
// Safe by construction: DRY_RUN on, targets forced to localhost, no real payments.
import { rmSync } from "node:fs";
import { startMockTarget } from "./mock-target/server.js";
import { catalog } from "./framework/registry.js";
import { runService, OUTCOME } from "./framework/runtime.js";
import { launchGate } from "./framework/rubric.js";
import { getService } from "./framework/registry.js";
import * as credits from "./framework/credits.js";
import * as scheduler from "./framework/scheduler.js";
import { captureConsent } from "./lib/authorization.js";
import { enqueue, claimNext } from "./lib/queue.js";
import { verifyChain, readAudit } from "./lib/audit.js";

const line = (s = "") => console.log(s);
const rule = (t) => line(`\n━━ ${t} ${"━".repeat(Math.max(0, 58 - t.length))}`);

// fresh state each run
try { rmSync(new URL("./data", import.meta.url), { recursive: true, force: true }); } catch {}

const PORT = 4712;
const base = `http://127.0.0.1:${PORT}`;
const server = await startMockTarget(PORT);
const CUST = "cust_demo_jaden";

// Pull every queued job through the spine (autopilots enqueue; the spine runs them).
async function drainSpine() {
  const out = [];
  let job;
  while ((job = claimNext())) out.push(await runService(job));
  return out;
}
const badge = (o) => ({ [OUTCOME.DELIVERED]: "DELIVERED ✓", [OUTCOME.REVISION]: "REVISION ⟳ (QA blocked)", [OUTCOME.REFUSED]: "REFUSED ⛔", [OUTCOME.FAILED]: "FAILED ✗" }[o.outcome] || o.outcome);
const showRun = (o) => line(`   ${badge(o)}  ·  ${o.service?.name ?? o.service}  ·  QA ${o.qa?.score ?? "—"}/100  ·  charged ${o.charged ?? 0} cr${o.reason ? `\n      ↳ ${o.reason}` : ""}`);

// ── Catalog: generated from the actual running services ─────────────────────
rule("SERVICE CATALOG (auto-discovered — config, not code)");
for (const s of await catalog())
  line(`   ${s.autopilot ? "⚡" : "  "} ${s.name.padEnd(30)} ${s.lane.padEnd(9)} ${String(s.credits).padEnd(22)} ${s.actsOnBehalf ? "acts-on-behalf" : ""}`);

// ── Setup: grant plan credits + capture consent for act-on-behalf services ──
rule("ONBOARDING");
credits.grant(CUST, credits.PLAN_CREDITS.business, "Business plan");
line(`   granted ${credits.PLAN_CREDITS.business} credits (Business plan) · balance ${credits.balanceOf(CUST)}`);
captureConsent(CUST, "refund-comp", ["act", "dispute", "data"]);
captureConsent(CUST, "footprint", ["agent", "process", "id"]);
line("   signed authorization captured for Refund & Comp Recovery and Digital Footprint Cleaner");

// ── On-demand runs through the spine ────────────────────────────────────────
rule("ON-DEMAND JOBS");
showRun(await runService(enqueue({ customerId: CUST, service: "clip-factory", input: { sourceUrl: "https://youtu.be/demo", count: 4 } })));
showRun(await runService(enqueue({ customerId: CUST, service: "ghostwriter", input: { situation: "ending a client engagement", tone: "firm" } })));

// The QA gate in action: rush mode skips the follow-up plan → required check fails.
line("\n   ↓ same service, but 'rush' skips the follow-up plan — watch the QA gate:");
showRun(await runService(enqueue({ customerId: CUST, service: "ghostwriter", input: { situation: "asking for a raise", rush: true } })));

// ── Autopilots: scheduled + event-triggered, run themselves ─────────────────
rule("AUTOPILOTS (unprompted runs)");
scheduler.enable(CUST, "reputation-autopilot", { businessName: "Green Thumb Landscaping" });
scheduler.enable(CUST, "social-autopilot", { brand: "Green Thumb" });
scheduler.enable(CUST, "footprint", { name: "Jaden Green", targetBase: base });
scheduler.enable(CUST, "refund-comp", { targetBase: base });   // event-triggered
line("   4 autopilots switched on. Firing the weekly/monthly schedule tick…");
await scheduler.tick(Date.now());                               // enqueues reputation, social, footprint
for (const o of await drainSpine()) showRun(o);

line("\n   a tracked price drops → the 'price.dropped' event fires Refund & Comp Recovery:");
await scheduler.emit("price.dropped", { orderId: "ord_991", item: "Flight to Denver", paidPrice: 340, sku: "DENVER-FLIGHT" });
for (const o of await drainSpine()) showRun(o);

// ── The authorization gate: no consent → refused before anything runs ───────
rule("AUTHORIZATION GATE");
const refused = await runService(enqueue({ customerId: "cust_no_consent", service: "refund-comp", targetBase: base,
  input: { orderId: "ord_x", item: "Test", paidPrice: 100, sku: "STANDARD-ITEM" } }));
line(`   unconsented act-on-behalf job → ${refused.outcome === OUTCOME.REFUSED ? "REFUSED ✓" : "RAN ✗ (BUG)"}  (${refused.reason})`);

// ── Launch gate: 10 dry runs at ≥90% before a service goes live ─────────────
rule("LAUNCH GATE (blueprint rule: 10 runs ≥ 90% QA)");
const clip = await getService("clip-factory");
const testJobs = Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, input: { sourceUrl: `https://v/${i}`, count: 4 } }));
const gate = await launchGate(clip, testJobs, (s, tj) => s.pipeline(tj, { job: tj }));
line(`   clip-factory: ${gate.passRate}% pass over ${gate.runs.length} runs → ${gate.cleared ? "CLEARED FOR LAUNCH ✓" : "HELD ✗"}`);

// ── Money + integrity ledgers ───────────────────────────────────────────────
rule("CREDIT LEDGER");
line(`   ${CUST} balance: ${credits.balanceOf(CUST)} credits`);
for (const e of credits.ledgerOf(CUST).filter((x) => x.kind === "debit" || x.kind === "release"))
  line(`     ${e.kind === "debit" ? "−" : "±"}${e.amount} ${e.kind.padEnd(8)} ${e.note}`);

rule("AUDIT CHAIN");
const chain = verifyChain();
line(`   ${readAudit().length} hash-chained entries · chain intact: ${chain.ok ? "YES ✓" : "NO ✗ (TAMPERED)"}`);

line();
server.close();
