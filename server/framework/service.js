// THE SERVICE CONTRACT — one declarative shape every Choreless service conforms to.
//
// The blueprint's promise is "every service is a versioned skill package — config,
// not code." This is that config, made real. A service package is a plain object;
// `defineService` validates it and fills defaults so the runtime spine can treat
// write-only services (Ghostwriter, Clip Factory) and act-on-behalf services
// (Refund, Footprint) through exactly the same pipeline: intake → authorize →
// meter → run → QA gate → deliver → audit.
//
// Nothing here executes work. It only describes a service well enough that the
// runtime can run ANY service without knowing what it does.

export const LANES = ["Creator", "Business", "Life"];
export const TRIGGERS = ["on-demand", "schedule", "event"];

// A rubric check that always runs on every service — the universal floor.
// Individual services add their own on top. If any required check fails, the
// deliverable never reaches the customer (free revision + credit returned).
const UNIVERSAL_RUBRIC = [
  {
    id: "produced-a-deliverable",
    label: "The pipeline actually produced a deliverable",
    severity: "required",
    check: (result) => !!result && !!result.deliverable,
  },
  {
    id: "no-empty-promises",
    label: "Deliverable is non-empty (not a placeholder)",
    severity: "required",
    check: (result) => {
      const d = result?.deliverable;
      if (!d) return false;
      const text = JSON.stringify(d);
      return text.length > 2 && !/\b(TODO|TBD|lorem ipsum|placeholder)\b/i.test(text);
    },
  },
];

/**
 * Validate + normalize a service package.
 * @returns the frozen, normalized service definition.
 */
export function defineService(def) {
  const errs = [];
  const need = (cond, msg) => { if (!cond) errs.push(msg); };

  need(typeof def.id === "string" && /^[a-z0-9-]+$/.test(def.id), "id must be kebab-case");
  need(typeof def.name === "string" && def.name.length, "name is required");
  need(LANES.includes(def.lane), `lane must be one of ${LANES.join(", ")}`);
  need(TRIGGERS.includes(def.trigger), `trigger must be one of ${TRIGGERS.join(", ")}`);
  need(typeof def.version === "string" && def.version.length, "version is required (versioned skill package)");
  need(typeof def.pipeline === "function", "pipeline(job, ctx) must be a function");

  // Intake: the 3–6 structured inputs the customer provides once.
  const intake = def.intake ?? [];
  need(Array.isArray(intake), "intake must be an array");
  for (const f of intake) need(f.id && f.label, "each intake field needs { id, label }");

  // Credits: a flat number, or a results-priced model that only charges on outcome.
  const credits = normalizeCredits(def.credits, need);

  // Act-on-behalf services must name the consent key the authorization store checks.
  const actsOnBehalf = !!def.actsOnBehalf;
  if (actsOnBehalf) need(typeof def.consentKey === "string" && def.consentKey.length,
    "actsOnBehalf services must declare a consentKey (maps to the authorization store)");

  // Irreversible actions (post / send / file) that need customer or human-ops approval.
  const irreversible = def.irreversible ?? [];
  need(Array.isArray(irreversible), "irreversible must be an array of action labels");

  // Rubric: the QA gate. Universal floor + the service's own checks.
  const rubric = [...UNIVERSAL_RUBRIC, ...(def.rubric ?? [])];
  for (const r of rubric) {
    need(r.id && r.label && typeof r.check === "function", "each rubric check needs { id, label, check }");
    if (r.severity && !["required", "advisory"].includes(r.severity))
      errs.push(`rubric ${r.id}: severity must be 'required' or 'advisory'`);
  }

  if (errs.length) throw new Error(`invalid service "${def.id ?? "?"}":\n  - ${errs.join("\n  - ")}`);

  return Object.freeze({
    id: def.id,
    name: def.name,
    lane: def.lane,
    trigger: def.trigger,
    version: def.version,
    actsOnBehalf,
    consentKey: def.consentKey ?? null,
    intake,
    context: def.context ?? [],          // which parts of the customer profile it reads
    credits,
    sla: def.sla ?? { starter: "48h", pro: "24h", business: "12h" },
    irreversible,
    rubric: rubric.map((r) => ({ severity: "required", ...r })),
    schedule: def.schedule ?? null,      // for trigger:"schedule" — e.g. { every: "weekly" }
    event: def.event ?? null,            // for trigger:"event" — e.g. "review.posted"
    pipeline: def.pipeline,
    // Optional adapter binding for act-on-behalf services (reuses server/adapters/*).
    adapter: def.adapter ?? null,
  });
}

function normalizeCredits(credits, need) {
  if (typeof credits === "number") return { model: "flat", amount: credits };
  if (credits && credits.model === "results") {
    need(typeof credits.perRun === "number", "results-priced credits need a numeric perRun");
    need(typeof credits.chargeWhen === "function", "results-priced credits need chargeWhen(result) => boolean");
    return { model: "results", perRun: credits.perRun, chargeWhen: credits.chargeWhen };
  }
  need(false, "credits must be a number or { model:'results', perRun, chargeWhen }");
  return { model: "flat", amount: 0 };
}

// Validate a customer's intake payload against a service's declared intake fields.
export function validateIntake(service, input = {}) {
  const missing = service.intake
    .filter((f) => f.required !== false && (input[f.id] === undefined || input[f.id] === ""))
    .map((f) => f.id);
  return { ok: missing.length === 0, missing };
}
