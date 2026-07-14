// SERVICE PACKAGE — Digital Footprint Cleaner (Life lane, act-on-behalf).
// Wraps the broker-optout adapter. Autopilot by nature: brokers re-list you, so it
// re-scans on a monthly cadence and re-files. Results-priced per newly-removed
// listing. Holdout sites (postcard / notarization / ID) route to human-ops.
import { defineService } from "../framework/service.js";
import { adapter as brokerAdapter } from "../adapters/broker-optout.js";

// Count confirmed removals in the result ledger (drives results pricing).
const removedCount = (r) => (r.deliverable?.rows ?? []).filter((row) => row.tone === "win").length;

export default defineService({
  id: "footprint",
  name: "Digital Footprint Cleaner",
  lane: "Life",
  version: "2026-07-13",

  trigger: "schedule",
  schedule: { every: "monthly" },         // re-listed records get caught and re-filed

  actsOnBehalf: true,
  consentKey: "footprint",                // matches CONSENT["footprint"] (CCPA §1798.135 / GDPR Art. 17)
  adapter: brokerAdapter,

  intake: [
    { id: "name", label: "Full name to remove" },
    { id: "aliases", label: "Other names / spellings", required: false },
  ],
  context: ["identityDetails"],

  credits: { model: "results", perRun: 2, chargeWhen: (r) => removedCount(r) > 0 },

  irreversible: ["submit data-deletion / opt-out request (ID-verification sites → human-ops)"],
  sla: { starter: "72h first sweep", pro: "72h first sweep", business: "72h first sweep" },

  rubric: [
    { id: "has-sweep", label: "Broker network was swept and a ledger returned", check: (r) => !!r.deliverable?.rows },
    { id: "agent-proof-attached", label: "Authorized-agent proof attached to each request",
      check: (r) => r.steps?.some((s) => s.actor === "legal") },
    { id: "holdouts-to-humanops", label: "ID/postcard holdout sites were routed to human-ops, not auto-submitted",
      check: (r) => !(r.deliverable?.rows ?? []).some((row) => /manual verification/i.test(row.item) && row.tone === "win") },
  ],

  async pipeline(job, ctx) {
    const out = await brokerAdapter.run(job, ctx);
    return {
      deliverable: out.ledger,
      steps: out.steps,
      ledger: out.ledger,
      removed: removedCount({ deliverable: out.ledger }),
    };
  },
});
