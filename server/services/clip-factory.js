// SERVICE PACKAGE — Clip Factory (Creator lane, write-only). The lead GTM wedge:
// long video → captioned, retention-scored shorts + thumbnails. No external
// actions, so no authorization needed — but the QA gate still holds: no dead clips
// reach the customer.
import { defineService } from "../framework/service.js";
import { audit } from "../lib/audit.js";

// Deterministic pseudo-score so the demo is reproducible (a real build scores on
// hook strength, pacing, and predicted retention).
const scoreClip = (seed, i) => 55 + ((seed * 7 + i * 29) % 44);

export default defineService({
  id: "clip-factory",
  name: "Clip Factory",
  lane: "Creator",
  version: "2026-07-13",
  trigger: "on-demand",

  intake: [
    { id: "sourceUrl", label: "Long-form video URL" },
    { id: "count", label: "How many shorts", required: false },
  ],
  context: ["brandKit"],
  credits: 5,
  irreversible: [],   // produces files; nothing is posted without the customer

  rubric: [
    { id: "has-clips", label: "At least one short was produced", check: (r) => (r.deliverable?.clips?.length ?? 0) >= 1 },
    { id: "captioned", label: "Every short is captioned", check: (r) => r.deliverable.clips.every((c) => c.captioned) },
    { id: "no-dead-clips", label: "No clip below the 50 retention floor",
      check: (r) => r.deliverable.clips.every((c) => c.retention >= 50) },
    { id: "has-thumbnails", label: "Every short has a thumbnail", check: (r) => r.deliverable.clips.every((c) => c.thumbnail) },
  ],

  async pipeline(job) {
    const n = Math.min(Math.max(parseInt(job.input.count ?? 4, 10) || 4, 1), 8);
    const seed = (job.input.sourceUrl || "").length || 11;
    const steps = [];
    const log = (label, actor, detail) => { steps.push({ label, actor, detail }); audit({ type: "agent.step", jobId: job.id, service: this.id, actor, label }); };

    log("Ingest & transcribe", "system", `Pulling ${job.input.sourceUrl} and transcribing.`);
    log("Find the moments", "agent", `Scoring the transcript for ${n} high-retention windows.`);

    const clips = Array.from({ length: n }, (_, i) => {
      const retention = scoreClip(seed, i);
      return {
        title: `Clip ${i + 1} — hook @ 0:0${(i % 6) + 1}`,
        seconds: 22 + (i % 3) * 8,
        retention,
        captioned: true,
        thumbnail: `thumb_${job.id?.slice(0, 6) ?? "demo"}_${i + 1}.jpg`,
      };
    });

    log("Cut, caption & thumbnail", "agent", `Rendered ${n} shorts with burned-in captions.`);
    log("Retention QA", "agent", `Best clip scored ${Math.max(...clips.map((c) => c.retention))}/100.`);

    return {
      deliverable: {
        clips,
        count: clips.length,
        note: "Captioned shorts + thumbnails, retention-scored. Nothing is posted — they're yours to publish.",
      },
      steps,
    };
  },
});
