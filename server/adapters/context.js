// The execution context handed to every adapter. Its whole job is to be the
// safety boundary: an adapter can ONLY reach hosts on its allowlist, and unless
// the operator has explicitly flipped LIVE mode on (with legal sign-off), the
// allowlist is forced to localhost — so a stray real hostname simply cannot be hit.
import { audit } from "../lib/audit.js";

const LIVE = process.env.CHORELESS_LIVE === "1" && process.env.I_HAVE_LEGAL_AUTHORIZATION === "1";

function hostOf(u) { try { return new URL(u).hostname; } catch { return ""; } }
const isLocal = (h) => h === "127.0.0.1" || h === "localhost";

export function makeContext(adapter, job) {
  const dryRun = process.env.DRY_RUN !== "0"; // dry-run by default

  async function fetchTarget(url, opts = {}) {
    const host = hostOf(url);
    const allowed = isLocal(host) || (LIVE && adapter.allowlist.includes(host));
    if (!allowed) {
      const why = LIVE ? `host not on ${adapter.id} allowlist` : "LIVE mode is off — only localhost is reachable";
      audit({ type: "target.blocked", jobId: job.id, adapter: adapter.id, host, reason: why });
      throw new Error(`blocked target ${host}: ${why}`);
    }
    audit({ type: "target.request", jobId: job.id, adapter: adapter.id, host, method: opts.method || "GET", dryRun });
    const res = await fetch(url, opts);
    return res.json();
  }

  return { dryRun, live: LIVE, fetchTarget, job };
}
