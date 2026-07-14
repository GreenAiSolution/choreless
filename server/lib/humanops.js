// Human-ops gate — the steps an agent must NOT complete alone. A real deployment
// backs this with a reviewer console; here `autoReview` stands in for the human so
// the demo can run unattended, but the queue, the rules, and the audit trail are real.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { audit } from "./audit.js";

const FILE = new URL("../data/reviews.json", import.meta.url).pathname;
const load = () => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : []);
const save = (r) => { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE, JSON.stringify(r, null, 2)); };

// Returns a reason string if the step must be reviewed by a human, else null.
export function needsHumanOps(step) {
  if (step.movesMoney && (step.amount ?? 0) > 50) return "claim over $50";
  if (step.dispute) return "bank dispute / chargeback";
  if (step.idVerification) return "identity verification";
  if (step.holdout) return "site requires a manual step (call / notarize / postcard)";
  return null;
}

export function submitForReview(jobId, step, reason) {
  const reviews = load();
  const rec = { id: randomUUID(), jobId, step: step.label, reason, status: "pending", createdAt: new Date().toISOString() };
  reviews.push(rec);
  save(reviews);
  audit({ type: "humanops.queued", jobId, step: step.label, reason });
  return rec;
}

// Stand-in for a human reviewer. In production a person clicks approve/reject.
export function autoReview(id, decision = "approved") {
  const reviews = load();
  const rec = reviews.find((x) => x.id === id);
  if (rec) {
    rec.status = decision;
    rec.reviewedAt = new Date().toISOString();
    rec.reviewedBy = "auto-reviewer (demo stand-in for human ops)";
    save(reviews);
    audit({ type: "humanops.reviewed", reviewId: id, jobId: rec.jobId, decision });
  }
  return rec;
}

export const listReviews = () => load();
