import { randomUUID, randomBytes } from "node:crypto";

/** RFC4122 v4 id, used for entity ids. */
export function uuid(): string {
  return randomUUID();
}

/**
 * Short, url-safe, sortable-ish id for runs/nodes where a full uuid is noisy.
 * Prefix keeps ids self-describing in logs.
 */
export function shortId(prefix = ""): string {
  const s = randomBytes(6).toString("base64url");
  return prefix ? `${prefix}_${s}` : s;
}

export function nowIso(): string {
  return new Date().toISOString();
}
