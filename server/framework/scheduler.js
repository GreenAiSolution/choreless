// THE AUTOPILOT SCHEDULER — the moat item "unprompted scheduled/triggered runs."
// Autopilot-capable services (trigger:"schedule" or "event") run without being
// asked. A customer switches an autopilot ON once; the scheduler enqueues jobs on
// cadence or when an event fires. Jobs still flow through the full runtime spine
// (authorization, QA gate, credits) — autopilot changes WHEN work starts, never
// WHETHER it's checked.
//
// File-backed subscription list; a `tick()` you can run from cron, and an
// `emit(event)` for event-triggered services. In production this is a real cron +
// event bus; the interface is the same.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { enqueue } from "../lib/queue.js";
import { getService } from "./registry.js";
import { audit } from "../lib/audit.js";

const FILE = new URL("../data/autopilots.json", import.meta.url).pathname;
const load = () => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : []);
const save = (a) => { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE, JSON.stringify(a, null, 2)); };

const EVERY_MS = { hourly: 3600e3, daily: 864e5, weekly: 7 * 864e5, monthly: 30 * 864e5 };

// Customer switches an autopilot ON. `input` is the standing intake for each run.
export function enable(customerId, serviceId, input = {}) {
  const list = load();
  const rec = {
    id: randomUUID(), customerId, serviceId, input,
    enabledAt: new Date().toISOString(), lastRunAt: null, active: true,
  };
  list.push(rec);
  save(list);
  audit({ type: "autopilot.enabled", customerId, service: serviceId, autopilotId: rec.id });
  return rec;
}

export function disable(autopilotId) {
  const list = load();
  const rec = list.find((a) => a.id === autopilotId);
  if (rec) { rec.active = false; save(list); audit({ type: "autopilot.disabled", autopilotId }); }
  return rec;
}

// Enqueue one run for an autopilot subscription (shared by tick + emit).
async function fire(rec, why) {
  const service = await getService(rec.serviceId);
  if (!service) return null;
  const job = enqueue({
    customerId: rec.customerId,
    service: service.id,
    adapter: service.adapter?.id ?? null,
    input: rec.input,
    targetBase: rec.input?.targetBase ?? null,   // act-on-behalf adapters read job.targetBase
    source: `autopilot:${why}`,
    autopilotId: rec.id,
  });
  rec.lastRunAt = new Date().toISOString();
  audit({ type: "autopilot.fired", autopilotId: rec.id, service: service.id, jobId: job.id, why });
  return job;
}

/**
 * Cron tick — enqueue jobs for every schedule autopilot that is due.
 * @param now epoch ms (injectable so tests don't wait a week).
 */
export async function tick(now = Date.now()) {
  const list = load();
  const fired = [];
  for (const rec of list) {
    if (!rec.active) continue;
    const service = await getService(rec.serviceId);
    if (!service || service.trigger !== "schedule") continue;
    const period = EVERY_MS[service.schedule?.every] ?? EVERY_MS.weekly;
    const last = rec.lastRunAt ? Date.parse(rec.lastRunAt) : 0;
    if (now - last >= period) {
      const job = await fire(rec, "schedule");
      if (job) fired.push(job);
    }
  }
  save(list);
  return fired;
}

// Event fires (e.g. "review.posted") — enqueue every matching event autopilot.
export async function emit(eventName, payload = {}) {
  const list = load();
  const fired = [];
  for (const rec of list) {
    if (!rec.active) continue;
    const service = await getService(rec.serviceId);
    if (!service || service.trigger !== "event" || service.event !== eventName) continue;
    const job = await fire({ ...rec, input: { ...rec.input, ...payload } }, `event:${eventName}`);
    // persist lastRunAt back onto the real record
    const real = list.find((a) => a.id === rec.id);
    if (real) real.lastRunAt = new Date().toISOString();
    if (job) fired.push(job);
  }
  save(list);
  return fired;
}

export const listAutopilots = () => load();
