// THE QA GATE — the single most important thing that separates Choreless from a
// chatbot: "a quality gate so drafts never reach the customer." Every deliverable
// is graded against the service's rubric BEFORE it is delivered. If any `required`
// check fails, the work is blocked, the credit is returned, and a free revision is
// queued. `advisory` failures are recorded but don't block.
//
// This module is pure: it grades a result, it does not deliver or charge. The
// runtime spine decides what to do with the verdict.
import { audit } from "../lib/audit.js";

/**
 * Grade a pipeline result against a service's rubric.
 * @returns { pass, score, required, advisory, failures:[{id,label,severity}] }
 */
export function grade(service, result, job) {
  const checks = service.rubric.map((r) => {
    let ok;
    try { ok = !!r.check(result, job); }
    catch (e) { ok = false; }               // a check that throws is a failed check
    return { id: r.id, label: r.label, severity: r.severity, ok };
  });

  const failures = checks.filter((c) => !c.ok);
  const requiredFail = failures.filter((c) => c.severity === "required");
  const pass = requiredFail.length === 0;
  const score = checks.length ? +((checks.filter((c) => c.ok).length / checks.length) * 100).toFixed(0) : 100;

  if (job?.id) {
    audit({
      type: pass ? "qa.passed" : "qa.failed",
      jobId: job.id,
      service: service.id,
      score,
      failed: failures.map((f) => f.id),
    });
  }

  return {
    pass,
    score,
    required: checks.filter((c) => c.severity === "required"),
    advisory: checks.filter((c) => c.severity === "advisory"),
    failures,
  };
}

/**
 * Launch gate — the blueprint rule: "10 internal test runs at ≥ 90% QA pass before
 * customers see it." Runs a service's pipeline against a set of test jobs and
 * reports whether it's cleared to go live. No credits, no delivery — pure dry run.
 * @param runOne async (service, testJob) => result   (usually a thin wrapper over the pipeline)
 */
export async function launchGate(service, testJobs, runOne, { threshold = 90, minRuns = 10 } = {}) {
  const runs = [];
  for (const tj of testJobs) {
    const result = await runOne(service, tj);
    const g = grade(service, result, { id: `launchgate:${service.id}:${runs.length}` });
    runs.push({ pass: g.pass, score: g.score, failed: g.failures.map((f) => f.id) });
  }
  const passRate = runs.length ? +((runs.filter((r) => r.pass).length / runs.length) * 100).toFixed(0) : 0;
  const cleared = runs.length >= minRuns && passRate >= threshold;
  return { cleared, passRate, threshold, minRuns, runs };
}
