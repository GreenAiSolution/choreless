# Choreless Execution Engine — the "AI decides, we act" services

Two services don't just generate text; they **act on the customer's behalf** on
third-party websites: **Refund & Comp Recovery** and **Digital Footprint Cleaner**.
Acting for someone needs three things the write-only services (Ghostwriter,
Clip Factory, etc.) never touch:

1. **Legal authorization** — you cannot file a claim or a deletion request *as*
   someone without their signed, specific consent.
2. **Agentic browser automation** — logging into external sites and submitting
   forms via a headless browser fleet.
3. **Human-ops checkpoints** — the steps a bot must not do alone: anything that
   moves money, ID verification, and "holdout" sites that require a phone call,
   notarization, or a mailed postcard.

The flow is modeled end-to-end in the product today (`ServiceRunner` in `App.tsx`,
`EXECUTION` config): **intake → authorization + payment → agentic pipeline →
live result ledger**, with each pipeline step tagged 🤖 AI-agent / 🧑‍💼 human-ops /
⚖️ legal.

## Demo vs. production — read this before selling it

The GitHub Pages site is a **static demo**. It simulates the pipeline (steps run
client-side, "recovered $" and broker rows are representative) so the *product
and the correct workflow* can be shown and tested. It does **not** log into real
accounts, move real money, or take real card payments — a static page physically
can't, and it must not pretend to. Everything below is what a real deployment
requires.

## Production architecture

```
customer ──▶ Next.js app ──▶ API (auth, Stripe) ──▶ job queue ──▶ worker fleet
                                    │                                │
                            authorization store              headless browsers
                            (signed consent, LPOA)          (Playwright, per-site
                                    │                         adapters + CAPTCHA
                            human-ops console ◀── review ───  + retry policy)
                                    │                                │
                            audit log (every action, immutable) ◀────┘
```

| Layer | Build | Notes |
| --- | --- | --- |
| **Payments** | Stripe subscriptions + usage/success-based charges | Refund is success-priced (charge a % of recovered $); Footprint is flat sweep + monthly. Never charge before authorization is captured. |
| **Authorization store** | Signed consent per service, versioned & timestamped | Footprint = **authorized-agent designation** (CCPA §1798.135 / GDPR Art. 17). Refund = **limited authorization** to request refunds/credits; explicit per-claim approval before any dispute/chargeback. Store the exact consent text the user agreed to. |
| **Agent workers** | Playwright on a headless fleet, one adapter per target site | Idempotent, ret/retry with backoff, screenshot every submission for the audit log. Respect each site's ToS and rate limits. Detect CAPTCHAs → route to human-ops, never auto-solve. |
| **Human-ops console** | Queue + reviewer UI | Mandatory review gate for: any claim > $50, anything touching a dispute, ID-verification steps, and holdout sites. One-click approve/reject, feeds back into the audit log. |
| **Customer approval loop** | Push/email + one-tap approve | For money-moving or ID steps the customer must confirm. |
| **Audit log** | Append-only, immutable | Who authorized what, which agent did what, every screenshot. This is the legal spine — build it first. |

## Legal care (not a code task — get counsel before launch)

- **Refund/Comp**: acting as the customer on merchant/airline flows and bank
  disputes has real ToS and fraud-liability exposure. Get an authorization
  framework and a per-claim approval gate reviewed by counsel. Chargebacks go
  through the customer's bank — assist, don't impersonate.
- **Footprint**: handling PII (names, addresses, sometimes ID) triggers privacy
  law and data-security obligations. The authorized-agent mechanism is real and
  legal — but never upload government ID without explicit per-request approval.
- **Insurance + ToS + a clear customer agreement** are prerequisites, not
  nice-to-haves.

## Build order

1. Audit log + authorization store (the legal spine).
2. Stripe + the authorization/payment gate (already modeled in the UI).
3. One agent adapter end-to-end for the highest-volume target (e.g. a single
   airline price-adjustment, or Spokeo opt-out) + human-ops review.
4. Expand adapters; add the monthly re-scan scheduler for Footprint.
