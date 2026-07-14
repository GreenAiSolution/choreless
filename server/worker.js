// The worker: pulls a job, REFUSES to run it without a valid authorization on file,
// selects the adapter, hands it a safety-bounded context, records the outcome.
// This is the single choke point where "act on the customer's behalf" is gated.
import { claimNext, update } from "./lib/queue.js";
import { getAuthorization } from "./lib/authorization.js";
import { makeContext } from "./adapters/context.js";
import { audit } from "./lib/audit.js";

import { adapter as refund } from "./adapters/refund-price-adjustment.js";
import { adapter as broker } from "./adapters/broker-optout.js";

const ADAPTERS = { [refund.id]: refund, [broker.id]: broker };

export async function runJob(job) {
  audit({ type: "job.started", jobId: job.id, service: job.service, adapter: job.adapter, customerId: job.customerId });

  const adapter = ADAPTERS[job.adapter];
  if (!adapter) return fail(job, `no adapter "${job.adapter}"`);

  // HARD GATE: signed authorization must exist, for this customer, for this service.
  const auth = getAuthorization(job.customerId, job.service);
  if (!auth) {
    audit({ type: "job.refused", jobId: job.id, reason: "no authorization on file" });
    return fail(job, "refused: no signed authorization on file for this customer + service");
  }

  const ctx = makeContext(adapter, job);
  try {
    const result = await adapter.run(job, ctx);
    update(job.id, { status: "done", result, authorizationId: auth.id, finishedAt: new Date().toISOString() });
    audit({ type: "job.done", jobId: job.id, recovered: result.recovered ?? null });
    return result;
  } catch (err) {
    return fail(job, err.message);
  }
}

function fail(job, message) {
  update(job.id, { status: "failed", error: message, finishedAt: new Date().toISOString() });
  audit({ type: "job.failed", jobId: job.id, error: message });
  return { error: message };
}

// Drain the queue (one pass). A real deployment runs this as a long-lived fleet.
export async function drain() {
  const out = [];
  let job;
  while ((job = claimNext())) out.push({ job, result: await runJob(job) });
  return out;
}
