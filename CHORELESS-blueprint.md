# CHORELESS — Platform Blueprint

**One-liner:** The subscription that does the work, not the talking. Customers drop tasks (or switch on Autopilots); AI agent pipelines with real tool access deliver finished, QA'd work — shorts cut, reviews answered, money recovered, the hard email written, your data scrubbed.

**The moat vs. any chatbot:** persistent memory of the customer (brand kit, voice, data) · execution inside their real tools · unprompted scheduled/triggered runs · a quality gate so drafts never reach the customer · one-tap approval on anything irreversible.

---

## Service Catalog (launch: 6 focused services, 3 lanes)

Deliberately narrowed from a broad 12 to **6 rare-but-needed services** — each one either sells itself visually (Clip Factory), recovers real money (Refund & Comp Recovery), or removes an acute pain almost nobody else productizes (Digital Footprint Cleaner, Hard Conversation Ghostwriter). "Does one thing undeniably" beats "does everything" for an unknown brand.

| # | Service | Lane | You get | Credits | Why now |
|---|---|---|---|---|---|
| 1 | Clip Factory | Creator | Long video → captioned shorts + thumbnails, retention-scored | 5 | **Lead GTM wedge** — output is the ad; short-form growth, editing burnout |
| 2 | Reputation Autopilot ⚡ | Business | Reviews monitored + responses posted weekly, monthly report | 3/run | Reviews decide local business survival |
| 3 | Social Autopilot ⚡ | Business | 30-day designed calendar, scheduled after approval | 8 | Consistency without a marketer |
| 4 | Refund & Comp Recovery ⚡ | Life | Price-drop, delay, outage & wrong-charge claims filed for you | 2/run † | It pays for itself; every company banks on you never claiming |
| 5 | Digital Footprint Cleaner ⚡ | Life | Data-broker removal, deletion requests, zombie accounts, monthly re-scan | 6 → 2/mo † | Privacy dread peaking; recurring by nature (brokers re-list you) |
| 6 | Hard Conversation Ghostwriter | Life | The dreaded message (fire a client, chase money, ask a raise) written right, with follow-up | 2 | Nobody offers it; the pain costs people sleep |

⚡ = Autopilot-capable (runs on schedule/trigger without being asked)
† = **Results-priced** — credits are spent only when the service actually recovers money / removes a new listing.

**Task Drop:** anything not in the catalog gets routed to the closest pipeline; unroutable requests are mined weekly as candidates for the next service.

## Premium Studio: Choreless Ads

Done-for-you ad campaigns, priced separately from credits — the high-margin premium wedge. Agencies charge $5–15k/mo with weeks-long creative rounds; Choreless Ads produces dozens of variants in days, launches on Meta/Google/TikTok after approval, and reallocates budget to winners weekly. This is the one product line with a human strategist in the happy path by design.

| Plan | Price | Ad spend | Includes |
|---|---|---|---|
| Launch | $499/mo | up to $5k/mo | 1 campaign, 14+ variants, one channel, weekly optimization |
| Growth ★ | $1,249/mo | up to $25k/mo | 3 campaigns, 30+ variants, all channels, 2×/wk optimization, landing pages, strategist review |
| Scale | $2,999/mo | $25k+/mo | Unlimited campaigns, full-funnel creative, daily optimization, dedicated strategist |

Ad spend bills directly to the customer's ad accounts — Choreless never touches budget. Every launch requires customer approval.

## Pricing

| | Starter $29/mo | Pro $79/mo ★ | Business $199/mo |
|---|---|---|---|
| Credits | 10 | 30 | 100 |
| Turnaround | 48h | 24h | 12h |
| Autopilots | 2 | 5 | Unlimited |
| Extras | rollover 1 mo | free revision, voice/brand training, priority | human QA on request, success manager, 5 seats |

Quality promise: work that misses the brief → free revision + credit returned. Credits debit on delivery, not intake.

---

## New-Service Template (how service #13+ gets built)

Every service is a versioned **skill package** — config, not code. To launch one, fill this in:

```yaml
name:            # e.g. "Menu Engineer"
lane:            # Business | Creator | Life
trigger:         # on-demand | schedule | event (e.g. "new review posted")
intake_fields:   # the 3-6 structured inputs the customer provides once
context_used:    # which parts of the customer profile it reads
pipeline_steps:  # plan → act (which tool integrations) → produce → self-check
deliverable:     # exact artifact(s) + destination
irreversible:    # actions requiring approval (post/send/file)
rubric:          # pass/fail QA checks (brand, format, factual, safety)
credits:         # priced at ≤20% fulfillment cost of credit revenue
sla:             # turnaround per tier
demand_evidence: # Task Drop clusters / churn interviews that justify it
```

Launch gate: 10 internal test runs at ≥ 90% QA pass before customers see it.

---

## Conversion machinery (built into the prototype)

- **Task Drop composer** — visitors type any task on the landing page and watch it get routed live with a credit quote. The product demos itself before signup.
- **ROI calculator** — sliders for tasks/month and hourly worth show hours reclaimed, dollar value, and the multiple on the subscription price.
- **3-step onboarding** — connect tools → 3 links + 5 questions builds the brand/voice profile → first task free while the system learns you.
- **Outcomes wall** — receipts, not promises: every claim on the homepage is a delivered task with a number attached.

## Deliverables in this package

1. `CHORELESS-platform.html` — clickable prototype (landing w/ live Task Drop + outcomes wall, catalog, Choreless Ads studio, pricing w/ ROI calculator, onboarding flow, dashboard demo)
2. `CHORELESS-architecture.md` — agent-orchestration system design
3. `CHORELESS-operations-playbook.md` — fulfillment process, SLAs, bottlenecks, scaling plan
4. `CHORELESS-financial-model.xlsx` — 24-month model: subscribers, credit economics, ads revenue, break-even
5. `CHORELESS-blueprint.md` — this file
