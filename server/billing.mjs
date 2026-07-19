// Credits ledger (double-entry-ish: append-only deltas, balance derived) and
// Stripe Checkout integration. Without STRIPE_SECRET_KEY the system runs in
// dev-billing mode: checkout grants credits instantly and says so loudly.

import { load, save, audit } from "./store.mjs";
import { PLANS } from "./catalog.mjs";

export function balance(customerId) {
  const db = load();
  return db.ledger.filter((e) => e.customer === customerId).reduce((s, e) => s + e.delta, 0);
}

export function ledgerFor(customerId) {
  return load().ledger.filter((e) => e.customer === customerId);
}

export function credit(customerId, delta, reason, ref = null) {
  const db = load();
  db.ledger.push({ ts: new Date().toISOString(), customer: customerId, delta, reason, ref });
  save();
  audit("ledger", { customer: customerId, delta, reason, ref });
}

export function debitForDelivery(customerId, task) {
  // Credits debit on delivery, not intake — the quality promise is structural.
  credit(customerId, -task.credit_cost, `delivery:${task.service}`, task.id);
}

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";

export async function createCheckout(customer, planId, origin) {
  const plan = PLANS[planId];
  if (!plan) throw new Error("unknown plan");

  if (!STRIPE_KEY) {
    // Dev-billing mode: grant instantly, flag it clearly.
    credit(customer.id, plan.credits, `dev-checkout:${planId}`);
    if (planId !== "topup") {
      const db = load();
      db.customers[customer.id].plan = planId;
      save();
    }
    audit("checkout.dev", { customer: customer.id, plan: planId });
    return { dev_mode: true, granted: plan.credits, plan: planId };
  }

  const params = new URLSearchParams({
    mode: planId === "topup" ? "payment" : "subscription",
    success_url: `${origin}/app?checkout=success`,
    cancel_url: `${origin}/app?checkout=cancelled`,
    client_reference_id: customer.id,
    "metadata[plan]": planId,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(plan.priceUsd * 100),
    "line_items[0][price_data][product_data][name]": `Choreless ${plan.name}`,
  });
  if (planId !== "topup") params.set("line_items[0][price_data][recurring][interval]", "month");

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const session = await res.json();
  if (!res.ok) throw new Error(session.error?.message || "stripe error");
  audit("checkout.created", { customer: customer.id, plan: planId, session: session.id });
  return { url: session.url };
}

// Stripe webhook: on checkout.session.completed, grant the plan's credits.
// With STRIPE_WEBHOOK_SECRET set, verify the signature; without it (dev), accept.
import { createHmac, timingSafeEqual } from "node:crypto";

export function handleStripeWebhook(rawBody, sigHeader) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (secret) {
    const parts = Object.fromEntries((sigHeader || "").split(",").map((p) => p.split("=")));
    const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
    const ok = parts.v1 && expected.length === parts.v1.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
    if (!ok) throw new Error("bad signature");
  }
  const event = JSON.parse(rawBody);
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const planId = s.metadata?.plan;
    const customerId = s.client_reference_id;
    const plan = PLANS[planId];
    if (plan && customerId) {
      credit(customerId, plan.credits, `stripe:${planId}`, s.id);
      if (planId !== "topup") {
        const db = load();
        if (db.customers[customerId]) { db.customers[customerId].plan = planId; save(); }
      }
    }
  }
  return { received: true };
}
