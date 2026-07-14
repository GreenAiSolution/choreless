// SERVICE PACKAGE — Refund & Comp Recovery (Life lane, act-on-behalf).
// The "act" step is the existing, safety-bounded adapter; this package wraps it in
// the declarative contract so it runs through the same spine as every other
// service. Results-priced: the customer is charged ONLY when money actually lands.
import { defineService } from "../framework/service.js";
import { adapter as refundAdapter } from "../adapters/refund-price-adjustment.js";

export default defineService({
  id: "refund-comp",
  name: "Refund & Comp Recovery",
  lane: "Life",
  version: "2026-07-13",

  // Runs itself the moment a tracked price drops — no one has to remember to claim.
  trigger: "event",
  event: "price.dropped",

  actsOnBehalf: true,
  consentKey: "refund-comp",              // matches CONSENT["refund-comp"] in the authorization store
  adapter: refundAdapter,                 // the safety-bounded browser agent (localhost-locked until LIVE + legal)

  intake: [
    { id: "orderId", label: "Order or confirmation number" },
    { id: "item", label: "What you bought" },
    { id: "paidPrice", label: "What you paid" },
    { id: "sku", label: "Product / fare code" },
  ],
  context: ["connectedReceipts"],

  // "Spent only when the service actually recovers money."
  credits: { model: "results", perRun: 2, chargeWhen: (r) => (r.recovered ?? 0) > 0 },

  irreversible: ["file a price-adjustment claim (money-moving > $50 → human-ops)"],
  sla: { starter: "48h", pro: "24h", business: "12h" },

  rubric: [
    { id: "has-ledger", label: "Produced a result ledger", check: (r) => !!r.deliverable?.rows },
    { id: "authorized-only", label: "Every filed claim was inside the authorized scope",
      // The adapter tags a "legal" step confirming scope; require it present before any claim ships.
      check: (r) => !r.steps?.some((s) => /file the claim/i.test(s.label))
        || r.steps.some((s) => s.actor === "legal") },
    { id: "money-claims-reviewed", label: "Money-moving claims cleared human-ops",
      severity: "advisory",
      check: (r) => !r.steps?.some((s) => /file the claim/i.test(s.label) && s.actor === "agent")
        || r.steps.some((s) => s.actor === "ops") },
  ],

  async pipeline(job, ctx) {
    const out = await refundAdapter.run(job, ctx);   // intake → scan → match → (human-ops) → file → track
    return {
      deliverable: out.ledger,       // the customer-facing recovery ledger
      steps: out.steps,
      ledger: out.ledger,
      recovered: out.recovered ?? 0, // read by chargeWhen — results pricing
    };
  },
});
