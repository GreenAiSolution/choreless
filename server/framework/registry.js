// THE REGISTRY — turns a directory of declarative service packages into a live
// catalog. Adding service #7 means dropping a file in server/services/; the
// runtime discovers it here. No worker rewiring, no switch statements.
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const SERVICES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "services");

let _cache = null;

// Load every *.js in server/services as a service package (default export).
export async function loadServices() {
  if (_cache) return _cache;
  const files = readdirSync(SERVICES_DIR).filter((f) => f.endsWith(".js"));
  const map = new Map();
  for (const f of files) {
    const mod = await import(pathToFileURL(join(SERVICES_DIR, f)).href);
    const svc = mod.default;
    if (!svc?.id) throw new Error(`${f} has no default-exported service (use defineService)`);
    if (map.has(svc.id)) throw new Error(`duplicate service id "${svc.id}" (${f})`);
    map.set(svc.id, svc);
  }
  _cache = map;
  return map;
}

export async function getService(id) {
  return (await loadServices()).get(id) ?? null;
}

export async function listServices() {
  return [...(await loadServices()).values()];
}

// Human-readable catalog — the same table the marketing site renders, generated
// from the actual running services so the two can never drift.
export async function catalog() {
  return (await listServices()).map((s) => ({
    id: s.id,
    name: s.name,
    lane: s.lane,
    trigger: s.trigger,
    autopilot: s.trigger !== "on-demand",
    actsOnBehalf: s.actsOnBehalf,
    credits: s.credits.model === "flat" ? `${s.credits.amount}` : `${s.credits.perRun}/run (results-priced)`,
    version: s.version,
  }));
}
