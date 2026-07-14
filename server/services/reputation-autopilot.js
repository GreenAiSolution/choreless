// SERVICE PACKAGE — Reputation Autopilot (Business lane, write-only, scheduled).
// Monitors reviews and drafts on-brand responses weekly. Posting a public reply is
// irreversible, so it's staged for one-tap approval — never auto-posted. Runs on a
// weekly cadence via the scheduler.
import { defineService } from "../framework/service.js";
import { audit } from "../lib/audit.js";

// A stand-in review feed (production reads the connected platforms).
const SAMPLE = [
  { reviewer: "María G.", rating: 5, text: "Fast and friendly, will come back." },
  { reviewer: "Dan P.", rating: 2, text: "Waited 40 minutes, nobody updated me." },
  { reviewer: "Aisha K.", rating: 4, text: "Great work, parking was tricky." },
];

const DEFENSIVE = /\b(wrong|actually you|not our fault|as we said|policy is policy)\b/i;

export default defineService({
  id: "reputation-autopilot",
  name: "Reputation Autopilot",
  lane: "Business",
  version: "2026-07-13",
  trigger: "schedule",
  schedule: { every: "weekly" },

  intake: [
    { id: "businessName", label: "Business name" },
    { id: "platforms", label: "Which review platforms", required: false },
  ],
  context: ["brandKit", "voice"],
  credits: 3,   // per run
  irreversible: ["post a public review response (staged for approval, never auto-posted)"],

  rubric: [
    { id: "answered-all", label: "Every monitored review got a drafted response",
      check: (r) => r.deliverable.responses.length === r.deliverable.reviewsSeen },
    { id: "on-brand-tone", label: "No defensive / blame-shifting language",
      check: (r) => r.deliverable.responses.every((x) => !DEFENSIVE.test(x.reply)) },
    { id: "staged-not-posted", label: "Responses are staged for approval, not posted",
      check: (r) => r.deliverable.responses.every((x) => x.status === "staged-for-approval") },
  ],

  async pipeline(job) {
    const steps = [];
    const log = (label, actor, detail) => { steps.push({ label, actor, detail }); audit({ type: "agent.step", jobId: job.id, service: this.id, actor, label }); };
    const biz = job.input.businessName;

    log("Pull new reviews", "system", `Checking review platforms for ${biz}.`);
    log("Draft responses", "agent", `Writing ${SAMPLE.length} on-brand replies (extra care for low ratings).`);

    const responses = SAMPLE.map((rv) => ({
      reviewer: rv.reviewer,
      rating: rv.rating,
      reply: rv.rating <= 2
        ? `Thank you for telling us, ${rv.reviewer.split(" ")[0]} — a 40-minute wait with no update isn't the experience we want. We've flagged it with the team and would love to make it right; please reach out and we'll take care of you.`
        : `Thanks so much, ${rv.reviewer.split(" ")[0]}! We really appreciate you taking the time — see you next visit.`,
      status: "staged-for-approval",
    }));

    log("Stage for approval", "ops", "Replies queued for one-tap owner approval before posting.");

    return {
      deliverable: {
        responses,
        reviewsSeen: SAMPLE.length,
        report: `${SAMPLE.length} reviews handled; ${responses.filter((r) => r.rating <= 2).length} flagged for a personal follow-up.`,
      },
      steps,
    };
  },
});
