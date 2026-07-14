// SERVICE PACKAGE — Hard Conversation Ghostwriter (Life lane, write-only).
// Writes the dreaded message (fire a client, chase money, ask a raise) and the
// follow-up. Nothing is sent — the customer sends it themselves — so no
// authorization is needed, but the QA gate is strict: a hard message that hedges
// or ships without a follow-up plan is a failed deliverable and never reaches the
// customer (free revision + credit returned).
import { defineService } from "../framework/service.js";
import { audit } from "../lib/audit.js";

const HEDGING = /\b(just wanted to|sorry to bother|no worries if not|whenever you get a chance|i totally understand if)\b/i;

export default defineService({
  id: "ghostwriter",
  name: "Hard Conversation Ghostwriter",
  lane: "Life",
  version: "2026-07-13",
  trigger: "on-demand",

  intake: [
    { id: "situation", label: "What's the situation" },
    { id: "tone", label: "How firm (kind / direct / firm)", required: false },
  ],
  context: ["voice"],
  credits: 2,
  irreversible: [],

  rubric: [
    { id: "has-message", label: "A message was written", check: (r) => !!r.deliverable?.message },
    { id: "no-hedging", label: "The message doesn't hedge or over-apologize",
      check: (r) => !HEDGING.test(r.deliverable.message) },
    { id: "has-follow-up", label: "A follow-up plan is included (the whole point)",
      check: (r) => !!r.deliverable.followUp && r.deliverable.followUp.length > 10 },
  ],

  async pipeline(job) {
    const { situation, tone = "direct" } = job.input;
    const steps = [];
    const log = (label, actor, detail) => { steps.push({ label, actor, detail }); audit({ type: "agent.step", jobId: job.id, service: this.id, actor, label }); };

    log("Understand the stakes", "system", `Situation: ${situation} · tone: ${tone}.`);
    log("Draft the message", "agent", "Writing it clear, kind, and final — no hedging.");

    const message =
      `Hi — I need to be straight with you about ${situation}. ` +
      `Here's where things stand and what I've decided, and I want to handle it respectfully and clearly. ` +
      `I've thought this through and this is the right call for both of us.`;

    // The follow-up plan is what makes this worth paying for. `rush` mode skips it —
    // which is exactly what the QA gate is there to catch.
    const followUp = job.input.rush
      ? ""
      : `If there's no reply in 3 days, send a one-line nudge: "Following up on my note about ${situation} — happy to talk it through live." Keep the same firm-but-kind tone.`;

    log("Add the follow-up plan", "agent", followUp ? "Included a 3-day follow-up nudge." : "Skipped follow-up (rush mode).");

    return {
      deliverable: { message, followUp, tone },
      steps,
    };
  },
});
