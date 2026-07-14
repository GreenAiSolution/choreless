// Authorization store — you cannot act as a customer without their signed,
// specific consent. This captures the EXACT consent text they agreed to,
// versioned and timestamped, and is the thing the worker checks before any
// adapter runs. Mirrors the consent gate in the product UI (App.tsx / EXECUTION).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { audit } from "./audit.js";

const FILE = new URL("../data/authorizations.json", import.meta.url).pathname;
const load = () => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : []);
const save = (a) => { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE, JSON.stringify(a, null, 2)); };

// The legal basis + exact language per service. Keep in lockstep with the UI.
export const CONSENT = {
  "refund-comp": {
    version: "2026-07-12",
    scope: "request refunds, price adjustments and credits on the customer's behalf; NO bank dispute/chargeback without explicit per-claim approval",
    items: [
      { id: "act", label: "I authorize Choreless to contact merchants, airlines and providers on my behalf to request the refunds, price adjustments and credits I'm owed." },
      { id: "dispute", label: "I understand Choreless never opens a bank chargeback or formal dispute without my explicit, per-claim approval." },
      { id: "data", label: "I grant read-only access to the receipts and order data I connect, used solely to detect recoverable money." },
    ],
  },
  footprint: {
    version: "2026-07-12",
    scope: "authorized agent for data-deletion and opt-out requests (CCPA §1798.135 / GDPR Art. 17); no government ID upload without per-request approval",
    items: [
      { id: "agent", label: "I appoint Choreless as my authorized agent to submit data-deletion and opt-out requests on my behalf (CCPA §1798.135 / GDPR Art. 17)." },
      { id: "process", label: "I consent to Choreless processing the identity details I provide solely to locate and remove my records." },
      { id: "id", label: "I understand some brokers require identity verification I complete myself; Choreless never uploads government ID without my per-request approval." },
    ],
  },
};

export function captureConsent(customerId, service, agreedItemIds) {
  const def = CONSENT[service];
  if (!def) throw new Error(`unknown service: ${service}`);
  const required = def.items.map((i) => i.id);
  if (!required.every((id) => agreedItemIds.includes(id))) {
    throw new Error("all consent items are required before authorization can be captured");
  }
  const record = {
    id: randomUUID(),
    customerId,
    service,
    version: def.version,
    scope: def.scope,
    items: def.items,
    agreedItemIds,
    agreedAt: new Date().toISOString(),
  };
  const all = load();
  all.push(record);
  save(all);
  audit({ type: "consent.captured", customerId, service, authorizationId: record.id, version: def.version });
  return record;
}

// Most recent authorization for this customer + service, or null.
export function getAuthorization(customerId, service) {
  return [...load()].reverse().find((r) => r.customerId === customerId && r.service === service) || null;
}
