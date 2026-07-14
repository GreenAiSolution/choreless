// End-to-end proof: starts the local sandbox, captures signed consent, enqueues a
// refund job and a footprint job, runs the worker, and prints the resulting
// ledgers + the human-ops queue + the verified audit chain.
//
//   npm run demo
//
// Safe by construction: DRY_RUN on, targets forced to localhost, no real payments.
import { rmSync } from "node:fs";
import { startMockTarget } from "./mock-target/server.js";
import { captureConsent } from "./lib/authorization.js";
import { enqueue } from "./lib/queue.js";
import { drain } from "./worker.js";
import { verifyChain, readAudit } from "./lib/audit.js";
import { listReviews } from "./lib/humanops.js";

// fresh state each run
try { rmSync(new URL("./data", import.meta.url), { recursive: true, force: true }); } catch {}

const PORT = 4711;
const base = `http://127.0.0.1:${PORT}`;
const server = await startMockTarget(PORT);
console.log(`▸ mock target up on ${base} (localhost sandbox — no real sites touched)\n`);

const customerId = "cust_demo_jaden";

// 1) Signed authorization (the legal gate) — must be captured before any job runs.
captureConsent(customerId, "refund-comp", ["act", "dispute", "data"]);
captureConsent(customerId, "footprint", ["agent", "process", "id"]);
console.log("✓ consent captured for both services\n");

// 2) Enqueue work (post-payment, in production Stripe fires this).
const j1 = enqueue({ customerId, service: "refund-comp", adapter: "refund-price-adjustment", targetBase: base,
  input: { orderId: "ord_991", item: "Flight to Denver", paidPrice: 340, sku: "DENVER-FLIGHT" } });
const j2 = enqueue({ customerId, service: "footprint", adapter: "broker-optout", targetBase: base,
  input: { name: "Jaden Green" } });

// 3) Run the worker.
const results = await drain();

for (const { job, result } of results) {
  console.log(`── ${job.adapter} ────────────────────────────────`);
  if (result.error) { console.log("  ERROR:", result.error); continue; }
  console.log(`  ${result.ledger.headline} — ${result.ledger.sub}`);
  for (const r of result.ledger.rows) console.log(`   • [${r.status}] ${r.item} — ${r.note}`);
  console.log(`  pipeline: ${result.steps.map((s) => s.actor).join(" → ")}`);
  console.log("");
}

const reviews = listReviews();
console.log(`human-ops queue: ${reviews.length} item(s) — ${reviews.map((r) => `${r.step} (${r.reason}) [${r.status}]`).join("; ") || "none"}`);

const chain = verifyChain();
console.log(`audit log: ${readAudit().length} entries, chain intact: ${chain.ok}`);

// Prove the authorization gate: a job with NO consent must be refused.
const j3 = enqueue({ customerId: "cust_no_consent", service: "refund-comp", adapter: "refund-price-adjustment", targetBase: base,
  input: { orderId: "ord_x", item: "Test", paidPrice: 100, sku: "STANDARD-ITEM" } });
const [{ result: refused }] = await drain();
console.log(`authorization gate: unconsented job -> ${refused.error ? "REFUSED ✓" : "RAN ✗ (bug)"}`);

server.close();
