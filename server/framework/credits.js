// THE CREDIT LEDGER — the money rule from the blueprint: "credits debit on
// delivery, not intake" and results-priced services "are spent only when the
// service actually recovers money / removes a new listing."
//
// The runtime spine puts a HOLD on credits when a job starts, and only DEBITS on
// successful delivery. If the QA gate blocks the work, the hold is released (free
// revision + credit returned). Results-priced services skip the debit entirely
// unless the outcome met the charge condition.
//
// File-backed, append-only ledger + a per-customer balance cache. Same shape a
// real deployment would back with Stripe usage records.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { audit } from "../lib/audit.js";

const FILE = new URL("../data/credits.json", import.meta.url).pathname;
const blank = () => ({ balances: {}, ledger: [] });
const load = () => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : blank());
const save = (s) => { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE, JSON.stringify(s, null, 2)); };

// Plan → monthly credit grant (mirrors the pricing table in the blueprint/UI).
export const PLAN_CREDITS = { starter: 10, pro: 30, business: 100 };

function post(state, entry) {
  const rec = { id: randomUUID(), at: new Date().toISOString(), ...entry };
  state.ledger.push(rec);
  return rec;
}

// Grant a customer their plan's monthly credits (or an ad-hoc top-up).
export function grant(customerId, amount, note = "monthly plan credits") {
  const s = load();
  s.balances[customerId] = (s.balances[customerId] ?? 0) + amount;
  post(s, { customerId, kind: "grant", amount, note, balance: s.balances[customerId] });
  save(s);
  audit({ type: "credits.granted", customerId, amount, balance: s.balances[customerId] });
  return s.balances[customerId];
}

export const balanceOf = (customerId) => load().balances[customerId] ?? 0;

/**
 * Place a HOLD for a job. Flat-priced services must have the balance now; a hold
 * reserves it. Results-priced services hold 0 up front (you're only charged on
 * outcome). Returns { ok, holdId?, cost, reason? }.
 */
export function hold(customerId, service, jobId) {
  const s = load();
  const cost = service.credits.model === "flat" ? service.credits.amount : 0;
  const bal = s.balances[customerId] ?? 0;

  if (service.credits.model === "flat" && bal < cost) {
    audit({ type: "credits.declined", customerId, jobId, cost, balance: bal });
    return { ok: false, cost, reason: `insufficient credits: need ${cost}, have ${bal}` };
  }

  const holdId = randomUUID();
  post(s, { id: holdId, customerId, jobId, kind: "hold", amount: cost, model: service.credits.model, service: service.id });
  save(s);
  audit({ type: "credits.hold", customerId, jobId, cost, model: service.credits.model });
  return { ok: true, holdId, cost };
}

/**
 * Settle a hold once the job is resolved.
 *   delivered=false            → release the hold, nothing charged (QA fail / error).
 *   flat + delivered           → debit `cost`.
 *   results + chargeWhen(true) → debit the results price (perRun).
 */
export function settle(customerId, service, jobId, holdId, { delivered, result }) {
  const s = load();
  const bal = () => s.balances[customerId] ?? 0;

  if (!delivered) {
    post(s, { customerId, jobId, holdId, kind: "release", amount: 0, note: "not delivered — credit returned", balance: bal() });
    save(s);
    audit({ type: "credits.released", customerId, jobId, reason: "not delivered" });
    return { charged: 0, balance: bal() };
  }

  let charge = 0;
  if (service.credits.model === "flat") {
    charge = service.credits.amount;
  } else if (service.credits.model === "results") {
    charge = service.credits.chargeWhen(result) ? service.credits.perRun : 0;
  }

  s.balances[customerId] = bal() - charge;
  post(s, {
    customerId, jobId, holdId, kind: "debit", amount: charge,
    note: charge ? "debited on delivery" : "results-priced: no chargeable outcome",
    balance: s.balances[customerId],
  });
  save(s);
  audit({ type: "credits.debited", customerId, jobId, amount: charge, balance: s.balances[customerId] });
  return { charged: charge, balance: s.balances[customerId] };
}

export const ledgerOf = (customerId) => load().ledger.filter((e) => e.customerId === customerId);
