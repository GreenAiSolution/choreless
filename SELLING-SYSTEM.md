# Choreless Selling System — run the business, not a demo

The static site (`index.html`) *sells* the services. This system **takes the
money and does the work**: accounts, credits, Stripe-ready billing, task
intake with routing, a real Claude execution engine with an independent QA
judge, one-tap approvals for outward-facing work, autopilots, an ops console,
and an append-only audit log.

## Quick start

```bash
npm install
npm test        # 27-check end-to-end smoke test (simulation mode)
npm start       # http://localhost:8787
```

| URL | What |
| --- | --- |
| `/` | Marketing site (the existing GitHub Pages page) |
| `/app` | The product: signup → drop tasks → watch the pipeline → approve → deliverables |
| `/ops` | Ops console: metrics, exception queue, audit log (key: `OPS_KEY`, default `choreless-ops-dev`) |

## Modes

The system runs in three progressively-real configurations — same code path,
flipped by environment variables:

| Env var | Absent | Present |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | **Simulation mode** — deliverables are watermarked templates so the whole flow can be tested for free | **Live fulfillment** — `claude-opus-4-8` (override: `CHORELESS_MODEL`) produces the work with adaptive thinking; an independent judge call scores it against the service rubric via structured outputs |
| `STRIPE_SECRET_KEY` | **Dev billing** — checkout grants credits instantly and says so | **Real Stripe Checkout** — subscriptions + top-ups; webhook at `/api/stripe/webhook` grants credits (`STRIPE_WEBHOOK_SECRET` enables signature verification) |
| `OPS_KEY` | default dev key | your ops key |

## How a task flows

```
intake (validated per service) ──▶ queued ──▶ produce (Claude, adaptive thinking)
   ──▶ QA judge (independent call, JSON verdict vs rubric, pass ≥ 80)
        ├─ fail → one automatic rework with the judge's fix instructions → re-judge
        │         └─ fail again → exception queue (human ops: release / retry / refund)
        ├─ pass + outward-facing service → awaiting_approval (one-tap customer approve)
        └─ pass → delivered  →  credits debit HERE (never at intake)
revision → free, credit returned, pipeline reruns with the customer's notes
```

Every state change is appended to `data/audit.jsonl` — the legal spine.

## The catalog is config, not code

`server/catalog.mjs` defines all 7 services — intake fields, credit price,
the execution prompt, and the QA rubric. Launching service #8 is adding one
object. The flagship addition:

**Before You Sign** ★ — paste any lease / job offer / contract / quote /
ToS *before* committing; get a trap map of clauses ranked by worst-case
dollar cost, what's missing, what's negotiable, and a ready-to-send
negotiation email. 2 credits. Nobody productizes this.

## API surface

```
POST /api/signup /api/login            GET /api/me         POST /api/profile
GET  /api/catalog                      POST /api/route     (public task-drop router)
POST /api/checkout                     POST /api/stripe/webhook
POST /api/tasks   GET /api/tasks[/:id] POST /api/tasks/:id/approve | /revise
POST /api/autopilots  GET /api/autopilots  DELETE /api/autopilots/:id
GET  /api/ops/overview  POST /api/ops/tasks/:id/resolve      (X-Ops-Key header)
```

## What production still needs (deliberately out of scope here)

Per `CHORELESS-execution-engine.md`: the browser-automation fleet + signed
customer authorizations for the two act-on-your-behalf services (Refund
Recovery filing, Footprint Cleaner opt-outs) — today those services produce
*filing-ready packets* behind the approval gate instead of filing directly.
Also: Postgres instead of the JSON store, real email delivery, and counsel
review of the authorization framework before acting as customers on third-
party sites.
