// Minimal file-backed job queue. In production this is a real queue (SQS/BullMQ)
// feeding a worker fleet; the interface is intentionally the same shape.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

const FILE = new URL("../data/jobs.json", import.meta.url).pathname;
const load = () => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : []);
const save = (j) => { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE, JSON.stringify(j, null, 2)); };

export function enqueue(job) {
  const jobs = load();
  const rec = { id: randomUUID(), status: "queued", createdAt: new Date().toISOString(), ...job };
  jobs.push(rec);
  save(jobs);
  return rec;
}

export function claimNext() {
  const jobs = load();
  const rec = jobs.find((x) => x.status === "queued");
  if (!rec) return null;
  rec.status = "running";
  save(jobs);
  return rec;
}

export function update(id, patch) {
  const jobs = load();
  const rec = jobs.find((x) => x.id === id);
  if (rec) { Object.assign(rec, patch); save(jobs); }
  return rec;
}

export const get = (id) => load().find((x) => x.id === id) || null;
export const list = () => load();
