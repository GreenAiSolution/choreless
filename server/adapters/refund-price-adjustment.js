// ADAPTER: Refund & Comp Recovery — price-adjustment claims.
// Drives the (mock) merchant: look up the current price, and if it dropped below
// what the customer paid, file a price-adjustment claim. Any claim over $50 is
// routed to human-ops before it "sends". Emits actor-tagged steps identical in
// shape to the pipeline shown in the product UI.
import { needsHumanOps, submitForReview, autoReview } from "../lib/humanops.js";
import { audit } from "../lib/audit.js";

export const adapter = {
  id: "refund-price-adjustment",
  service: "refund-comp",
  // In LIVE mode these would be the real merchant hosts. Left empty on purpose —
  // the operator adds them alongside legal sign-off. Until then: localhost only.
  allowlist: [],

  async run(job, ctx) {
    const { orderId, item, paidPrice, sku } = job.input;
    const base = job.targetBase; // e.g. http://127.0.0.1:4711
    const steps = [];
    const log = (label, actor, detail) => { steps.push({ label, actor, detail }); audit({ type: "agent.step", jobId: job.id, adapter: this.id, actor, label }); };

    log("Index the receipt", "system", `Watching ${item} (order ${orderId}).`);

    const { price: current } = await ctx.fetchTarget(`${base}/merchant/price?sku=${encodeURIComponent(sku)}`);
    log("Scan for recoverable money", "agent", `Current price ${current == null ? "unavailable" : "$" + current} vs paid $${paidPrice}.`);

    const recoverable = current != null && current < paidPrice ? +(paidPrice - current).toFixed(2) : 0;
    log("Match to merchant policy", "agent", recoverable ? `Price-adjustment claim eligible for $${recoverable}.` : "No recoverable difference right now.");

    log("Authorization check", "legal", `Confirmed authorization scope covers a price-adjustment request for this order.`);

    const rows = [];
    if (recoverable > 0) {
      const step = { label: "File the claim", movesMoney: true, amount: recoverable, dispute: false };
      const reason = needsHumanOps(step);
      if (reason) {
        const review = submitForReview(job.id, step, reason);
        log("File the claim", "agent", `Claim drafted for $${recoverable} — held for human-ops (${reason}).`);
        log("Human-ops review", "ops", `Specialist reviewing before anything sends.`);
        autoReview(review.id, "approved"); // stand-in for a human
      }
      // Submit to the (mock) merchant. In dry-run against a real host this would be skipped;
      // against the localhost sandbox it's safe to exercise the real code path.
      const claim = await ctx.fetchTarget(`${base}/merchant/claim`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, reason: "price-adjustment", amount: recoverable }),
      });
      log("Track to resolution", "agent", `Claim ${claim.claimId} ${claim.status}; $${recoverable} to be credited.`);
      rows.push({ item: `Price drop — ${item}`, status: reason ? "Approved · filing" : "Recovered ✓", tone: reason ? "pending" : "win", note: reason ? `Cleared human-ops (${reason}); credit in ~4 days` : "Difference credited to original card in ~4 days", recovered: recoverable });
    } else {
      rows.push({ item: `No price drop yet — ${item}`, status: "Watching", tone: "watch", note: "Re-checked continuously; you're charged only if it recovers money" });
    }

    return {
      ledger: { headline: "Recovery pipeline is live", sub: "You're only charged when money actually lands back with you.", rows },
      steps,
      recovered: recoverable,
    };
  },
};
