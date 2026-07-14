// Append-only, tamper-evident audit log — the legal spine of the engine.
// Every consent capture, every agent action, every human-ops decision lands here
// as a hash-chained line. Build this first; everything else references it.
import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";

const FILE = new URL("../data/audit.log.jsonl", import.meta.url).pathname;

function lastHash() {
  if (!existsSync(FILE)) return "GENESIS";
  const lines = readFileSync(FILE, "utf8").trim().split("\n").filter(Boolean);
  if (!lines.length) return "GENESIS";
  try { return JSON.parse(lines.at(-1)).hash; } catch { return "GENESIS"; }
}

export function audit(event) {
  mkdirSync(dirname(FILE), { recursive: true });
  const body = { ts: new Date().toISOString(), prev: lastHash(), ...event };
  const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 16);
  const entry = { ...body, hash };
  appendFileSync(FILE, JSON.stringify(entry) + "\n");
  return entry;
}

export function readAudit() {
  if (!existsSync(FILE)) return [];
  return readFileSync(FILE, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// Recompute the chain — any edit to a past line breaks it.
export function verifyChain() {
  let prev = "GENESIS", ok = true, count = 0;
  for (const e of readAudit()) {
    const { hash, ...bodyWithoutHash } = e;
    const expect = createHash("sha256").update(JSON.stringify(bodyWithoutHash)).digest("hex").slice(0, 16);
    if (e.prev !== prev || expect !== hash) ok = false;
    prev = hash; count++;
  }
  return { ok, count };
}
