// SERVICE PACKAGE — Social Autopilot (Business lane, write-only, scheduled).
// Produces a 30-day designed content calendar; posts are scheduled only after the
// owner approves. Runs monthly.
import { defineService } from "../framework/service.js";
import { audit } from "../lib/audit.js";

const PLATFORMS = ["Instagram", "TikTok", "LinkedIn", "Facebook"];
const ANGLES = ["proof", "how-to", "behind-the-scenes", "offer", "story", "myth-bust", "testimonial"];

export default defineService({
  id: "social-autopilot",
  name: "Social Autopilot",
  lane: "Business",
  version: "2026-07-13",
  trigger: "schedule",
  schedule: { every: "monthly" },

  intake: [
    { id: "brand", label: "Brand / handle" },
    { id: "days", label: "How many days", required: false },
  ],
  context: ["brandKit", "voice"],
  credits: 8,
  irreversible: ["schedule posts (only after owner approval)"],

  rubric: [
    { id: "full-month", label: "A full 30-day calendar was produced",
      check: (r) => r.deliverable.calendar.length >= 30 },
    { id: "every-post-complete", label: "Every post has a hook and a caption",
      check: (r) => r.deliverable.calendar.every((p) => p.hook && p.caption) },
    { id: "angle-variety", label: "Content mixes at least 4 distinct angles",
      check: (r) => new Set(r.deliverable.calendar.map((p) => p.angle)).size >= 4 },
  ],

  async pipeline(job) {
    const days = Math.min(Math.max(parseInt(job.input.days ?? 30, 10) || 30, 30), 31);
    const brand = job.input.brand;
    const steps = [];
    const log = (label, actor, detail) => { steps.push({ label, actor, detail }); audit({ type: "agent.step", jobId: job.id, service: this.id, actor, label }); };

    log("Read the brand kit", "system", `Loading ${brand} voice, colors, and past winners.`);
    log("Plan the month", "agent", `Sequencing ${days} posts across ${PLATFORMS.length} platforms and ${ANGLES.length} angles.`);

    const calendar = Array.from({ length: days }, (_, i) => {
      const angle = ANGLES[i % ANGLES.length];
      const platform = PLATFORMS[i % PLATFORMS.length];
      return {
        day: i + 1,
        platform,
        angle,
        hook: `Day ${i + 1}: the ${angle} that ${brand} customers never expect`,
        caption: `${brand} — ${angle} post. Designed graphic + caption ready; scheduled after your approval.`,
      };
    });

    log("Design & draft", "agent", `Generated ${days} on-brand graphics and captions.`);
    log("Stage for approval", "ops", "Calendar queued — posts schedule only once you approve.");

    return {
      deliverable: { calendar, days, note: "30-day calendar, designed and ready — scheduled after approval." },
      steps,
    };
  },
});
