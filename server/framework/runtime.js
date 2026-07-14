// THE RUNTIME SPINE — the one path every Choreless service runs through, whether
// it writes a caption or files a refund. This is where the moat is enforced in
// code, in order:
//
//   1. resolve the service (from the registry)          — config, not code
//   2. validate the customer's intake                   — no half-formed jobs
//   3. AUTHORIZATION GATE (act-on-behalf only)          — refuse without signed consent
//   4. HOLD credits                                     — reserve, don't charge yet
//   5. run the pipeline (plan → act → produce)          — actor-tagged steps
//   6. QA RUBRIC GATE                                   — drafts never reach the customer
//   7. deliver  ─ on pass                               — the deliverable goes out
//      revise   ─ on fail  → release credit, queue revision (the quality promise)
//   8. SETTLE credits (debit on delivery / results)     — money rule
//   every step writes to the immutable audit chain.
//
// Human-ops and customer-approval checkpoints for irreversible actions happen
// INSIDE the pipeline (via server/lib/humanops.js), so they're gated before the
// deliverable is even graded.
import { getService } from "./registry.js";
import { validateIntake } from "./service.js";
import { grade } from "./rubric.js";
import * as credits from "./credits.js";
import { getAuthorization } from "../lib/authorization.js";
import { makeContext } from "../adapters/context.js";
import { update, get as getJob } from "../lib/queue.js";
import { audit } from "../lib/audit.js";

// A finished run always resolves to one of these outcomes.
export const OUTCOME = {
  DELIVERED: "delivered",
  REVISION: "revision",        // QA blocked it — free revision + credit returned
  REFUSED: "refused",          // no authorization / bad intake — never even ran
  FAILED: "failed",            // pipeline threw
};

/**
 * Run one job end-to-end through the spine.
 * @param job { id, customerId, service, input, ... } (as produced by lib/queue enqueue)
 * @returns { outcome, service, deliverable?, qa?, charged?, steps?, reason? }
 */
export async function runService(job) {
  const service = await getService(job.service);
  if (!service) return finish(job, { outcome: OUTCOME.FAILED, reason: `unknown service "${job.service}"` });

  audit({ type: "run.started", jobId: job.id, service: service.id, customerId: job.customerId, source: job.source ?? "on-demand" });

  // 2. Intake validation.
  const iv = validateIntake(service, job.input ?? {});
  if (!iv.ok) return finish(job, { outcome: OUTCOME.REFUSED, service, reason: `missing intake: ${iv.missing.join(", ")}` });

  // 3. AUTHORIZATION GATE — the hard stop for act-on-behalf services.
  if (service.actsOnBehalf) {
    const auth = getAuthorization(job.customerId, service.consentKey);
    if (!auth) {
      audit({ type: "run.refused", jobId: job.id, reason: "no authorization on file" });
      return finish(job, { outcome: OUTCOME.REFUSED, service, reason: "no signed authorization on file for this customer + service" });
    }
    job.authorizationId = auth.id;
  }

  // 4. HOLD credits.
  const held = credits.hold(job.customerId, service, job.id);
  if (!held.ok) return finish(job, { outcome: OUTCOME.REFUSED, service, reason: held.reason });

  // 5. Run the pipeline. Act-on-behalf services get the safety-bounded context
  //    (allowlist + localhost lock); write-only services get a light context.
  let result;
  try {
    const ctx = service.adapter
      ? makeContext(service.adapter, job)
      : { job, profile: job.profile ?? {}, dryRun: process.env.DRY_RUN !== "0" };
    result = await service.pipeline(job, ctx);
  } catch (err) {
    credits.settle(job.customerId, service, job.id, held.holdId, { delivered: false });
    return finish(job, { outcome: OUTCOME.FAILED, service, reason: err.message });
  }

  // 6. QA RUBRIC GATE.
  const qa = grade(service, result, job);

  // 7. Deliver or revise.
  if (!qa.pass) {
    credits.settle(job.customerId, service, job.id, held.holdId, { delivered: false });
    audit({ type: "run.revision", jobId: job.id, service: service.id, failed: qa.failures.map((f) => f.id) });
    return finish(job, {
      outcome: OUTCOME.REVISION, service, qa, steps: result.steps,
      reason: `QA gate blocked delivery (${qa.failures.map((f) => f.label).join("; ")}) — credit returned, free revision queued`,
    });
  }

  // 8. SETTLE credits on successful delivery.
  const settled = credits.settle(job.customerId, service, job.id, held.holdId, { delivered: true, result });
  audit({ type: "run.delivered", jobId: job.id, service: service.id, charged: settled.charged, score: qa.score });

  return finish(job, {
    outcome: OUTCOME.DELIVERED, service,
    deliverable: result.deliverable, steps: result.steps, ledger: result.ledger ?? null,
    qa, charged: settled.charged, balance: settled.balance,
  });
}

function finish(job, out) {
  const status = out.outcome === OUTCOME.DELIVERED ? "done"
    : out.outcome === OUTCOME.REVISION ? "revision"
    : out.outcome; // refused | failed
  if (job.id && getJob(job.id)) {
    update(job.id, {
      status, outcome: out.outcome, charged: out.charged ?? null,
      qaScore: out.qa?.score ?? null, error: out.reason && out.outcome !== OUTCOME.DELIVERED ? out.reason : null,
      finishedAt: new Date().toISOString(),
    });
  }
  return { jobId: job.id, ...out };
}
