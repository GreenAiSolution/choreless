# CHORELESS — Platform Blueprint

**One-liner:** The subscription that does the work, not the talking. Customers drop tasks (or switch on Autopilots); AI agent pipelines with real tool access deliver finished, QA'd work — posts published, invoices chased, videos clipped, paperwork filed.

**The moat vs. any chatbot:** persistent memory of the customer (brand kit, voice, data) · execution inside their real tools · unprompted scheduled/triggered runs · a quality gate so drafts never reach the customer · one-tap approval on anything irreversible.

---

## Service Catalog (launch: 12 services, 3 lanes)

| # | Service | Lane | You get | Credits | Why now |
|---|---|---|---|---|---|
| 1 | Reputation Autopilot ⚡ | Business | Reviews monitored + responses posted weekly, monthly report | 3/run | Reviews decide local business survival |
| 2 | Invoice Chaser ⚡ | Business | Tone-matched overdue chasing, escalation, cash report | 2/run | Late payments = #1 SMB cash killer |
| 3 | Social Autopilot ⚡ | Business | 30-day designed calendar, scheduled after approval | 8 | Consistency without a marketer |
| 4 | Competitor Radar ⚡ | Business | Weekly competitor brief + one counter-move | 2/run | Markets shift weekly now |
| 5 | Clip Factory | Creator | Long video → captioned shorts + thumbnails, retention-scored | 5 | Short-form growth, editing burnout |
| 6 | Repurpose Engine | Creator | One piece → newsletter, thread, LinkedIn, blog in your voice | 3 | Multi-platform is table stakes |
| 7 | Brand Kit Lab | Creator | Thumbnails/banners/templates matched to locked identity | 2 | CTR lives on the thumbnail |
| 8 | Sponsor Kit ⚡ | Creator | Self-updating media kit + sponsor matches + outreach drafts | 4/run | Brand deals, un-systematized |
| 9 | Inbox Concierge ⚡ | Life | Daily triage, drafted replies, unsubscribes, 3-things digest | 3/run | 2.5 hrs/day lost to email |
| 10 | Paperwork Agent | Life | Cancellations, disputes, claims, forms — filed and tracked | 2 | Companies weaponize friction |
| 11 | Career Engine | Life | Tailored resume + cover letter + interview brief per posting | 2 | AI screening kills generic resumes |
| 12 | Life Logistics | Life | Travel itineraries, appointments, gifts, price-drop refunds | 3 | Admin is the tax on modern life |

⚡ = Autopilot-capable (runs on schedule/trigger without being asked)

**Task Drop:** anything not in the catalog gets routed to the closest pipeline; unroutable requests are mined weekly as candidates for service #13+.

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
