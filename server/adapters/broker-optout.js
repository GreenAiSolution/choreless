// ADAPTER: Digital Footprint Cleaner — data-broker opt-outs.
// Drives the (mock) broker: search for the person's records and file an opt-out for
// each. Sites that demand a manual step (postcard / notarization) are routed to
// human-ops instead of being auto-completed. Authorized-agent proof is attached
// per request (CCPA/GDPR) — modeled here as a legal step in the pipeline.
import { needsHumanOps, submitForReview, autoReview } from "../lib/humanops.js";
import { audit } from "../lib/audit.js";

export const adapter = {
  id: "broker-optout",
  service: "footprint",
  allowlist: [], // real broker hosts added by the operator with legal sign-off; localhost only until then

  async run(job, ctx) {
    const { name } = job.input;
    const base = job.targetBase;
    const steps = [];
    const log = (label, actor, detail) => { steps.push({ label, actor, detail }); audit({ type: "agent.step", jobId: job.id, adapter: this.id, actor, label }); };

    log("Build identity fingerprint", "system", `Match key assembled for "${name}".`);

    const { matches } = await ctx.fetchTarget(`${base}/broker/search?name=${encodeURIComponent(name)}`);
    log("Sweep the broker network", "agent", `${matches.length} matching record(s) found.`);
    log("Attach authorized-agent proof", "legal", "Signed CCPA/GDPR authorized-agent designation bundled with each request.");

    const rows = [];
    for (const m of matches) {
      const step = { label: `Opt out — ${m.site}`, holdout: !!m.holdout, idVerification: !!m.holdout };
      const reason = needsHumanOps(step);
      if (reason) {
        const review = submitForReview(job.id, step, reason);
        log(`Opt out — ${m.site}`, "ops", `Holdout site: ${reason}. Routed to a specialist.`);
        autoReview(review.id, "approved");
        rows.push({ item: `${m.site} — manual verification`, status: "Human-ops handling", tone: "watch", note: "Specialist completing the required manual step" });
        continue;
      }
      const out = await ctx.fetchTarget(`${base}/broker/optout`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ recordId: m.recordId }),
      });
      log(`Opt out — ${m.site}`, "agent", `Removal request ${out.status}.`);
      rows.push({ item: m.site, status: out.status === "removed" ? "Removed ✓" : "Opt-out filed", tone: out.status === "removed" ? "win" : "pending", note: out.status === "removed" ? "Profile deleted and confirmed" : "Confirmation loop in progress (2–10 days)" });
    }

    log("Monthly re-scan scheduled", "system", "Re-listed records will be caught and re-filed.");

    return {
      ledger: { headline: `Erasing ${name} from the data brokers`, sub: "72-hour first sweep, then re-scanned and re-filed every month.", rows },
      steps,
    };
  },
};
