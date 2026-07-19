// JSON-file persistence with atomic writes + append-only audit log.
// Deliberately boring: one db.json, one audit.jsonl. Swap for Postgres when
// the business outgrows a single node — the API surface here won't change.

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const DATA_DIR = process.env.CHORELESS_DATA_DIR || join(new URL(".", import.meta.url).pathname, "..", "data");
const DB_PATH = join(DATA_DIR, "db.json");
const AUDIT_PATH = join(DATA_DIR, "audit.jsonl");

const EMPTY = { customers: {}, tokens: {}, tasks: {}, ledger: [], autopilots: {}, seq: 0 };

let db = null;

export function load() {
  if (db) return db;
  mkdirSync(DATA_DIR, { recursive: true });
  db = existsSync(DB_PATH) ? JSON.parse(readFileSync(DB_PATH, "utf8")) : structuredClone(EMPTY);
  return db;
}

export function save() {
  const tmp = DB_PATH + ".tmp";
  writeFileSync(tmp, JSON.stringify(db, null, 1));
  renameSync(tmp, DB_PATH);
}

export function id(prefix) {
  load();
  db.seq += 1;
  return `${prefix}_${db.seq.toString(36)}${randomBytes(4).toString("hex")}`;
}

// Append-only audit log — the legal spine. Every state change lands here.
export function audit(event, detail) {
  mkdirSync(DATA_DIR, { recursive: true });
  appendFileSync(AUDIT_PATH, JSON.stringify({ ts: new Date().toISOString(), event, ...detail }) + "\n");
}

export function auditTail(n = 100) {
  if (!existsSync(AUDIT_PATH)) return [];
  const lines = readFileSync(AUDIT_PATH, "utf8").trim().split("\n");
  return lines.slice(-n).map((l) => JSON.parse(l));
}
