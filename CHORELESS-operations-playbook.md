# Choreless — Operations Playbook

How work flows through the platform, where it can jam, and how it scales. Companion to `CHORELESS-architecture.md`.

---

## 1. The Fulfillment Process (end-to-end)

```
Intake ──▶ Route ──▶ Queue ──▶ Agent Run ──▶ QA Gate ──▶ Deliver ──▶ Close
 (auto)    (auto)    (SLA-      (auto,       (auto;      (auto or    (feedback
                      aware)     budgeted)    2–5% →      approval)   loop)
                                              human)
```

| Stage | Owner | Target time | Failure path |
|---|---|---|---|
| Intake (form / email / voice / Autopilot trigger) | System | < 1 min to acknowledged | Malformed → auto-clarify message to customer |
| Routing (classify → pipeline + credit quote) | System | < 2 min | Low confidence → "confirm scope" card to customer |
| Queueing | System | Per-tier SLA clock starts | SLA-risk promoter re-prioritizes |
| Agent run | System | 5–30 min compute | 2 auto-retries → Exception Queue |
| QA Gate (validators + judge model) | System | < 5 min | Fail → 1 auto-rework → Exception Queue |
| Human exception review | Ops operator | < 2h during coverage hours | Can't fix → refund credit + apology + incident tag |
| Delivery / approval | System + customer | Instant on QA pass | Approval idle 48h → reminder → auto-park |
| Close & learn | System | — | Low rating → transcript flagged for pipeline tuning |

**SLA by tier:** Business 12h · Pro 24h · Starter 48h — measured intake → delivery (approval wait excluded).

---

## 2. Where the Waste Will Be (pre-mortem bottleneck analysis)

| Bottleneck | Signal | Countermeasure |
|---|---|---|
| **Exception Queue (the only human step)** | Exception rate > 5% or review latency > 2h | This is THE constraint. Track exceptions *per pipeline*; any pipeline > 8% gets its rubric/prompts fixed that week. Staff to peak: 1 operator per ~1,500 tasks/mo at 3% exception rate. |
| Ambiguous intake → clarification ping-pong | > 1 clarify round per task | Front-load: structured intake per service (not a blank box); voice/email adapter extracts fields; default assumptions stated in deliverable rather than asked |
| Customer approval stalls | Median approval > 12h | Batch approvals into one daily digest; pre-authorization option per pipeline; auto-park after 48h so it doesn't poison SLA stats |
| Rework loops (QA fail → rework → fail) | > 1 rework per task avg | Cap at 1 auto-rework then human; feed every fail reason back into pipeline rubric weekly |
| Integration flakiness (3rd-party APIs) | Tool-call error rate > 2% | Circuit breaker pauses only that pipeline; queued jobs notify customers proactively with revised ETA |
| Onboarding drag (brand kit / voice profile setup) | Time-to-first-deliverable > 24h | "First task free while we learn you" — run onboarding as a task; profile built from 3 links + 5 questions, refined by usage |

**Design principle: one human touchpoint.** Every process change is judged by whether it keeps humans out of the happy path and inside the exception path only.

---

## 3. Quality Operations

- **Rubrics per service** — each of the 12 pipelines has a written pass/fail rubric (brand match, factual checks, format validity, no-PII, link resolution). Rubrics are versioned; QA judge scores against them.
- **Escape handling** — customer flags a bad deliverable → credit auto-returned, revision jumps queue, escape logged against pipeline version. Escape rate > 2% on any pipeline = feature-freeze that pipeline until fixed.
- **Trust ladder for live actions** — new customers: approval required on all irreversible actions. After 10 approved runs with zero edits on a pipeline, offer pre-authorization. Trust is per-pipeline, revocable, and capped (daily action limits).
- **Weekly quality review (30 min)** — the four numbers: QA pass-rate, exception rate, escape rate, cost/task. Each pipeline owner (a person, even if part-time) states one fix shipped.

---

## 4. Daily / Weekly Operating Rhythm

**Daily (automated dashboard, human scan ~10 min)**
- SLA at-risk queue (jobs within 25% of deadline)
- Exception Queue depth + oldest item age
- Overnight Autopilot run summary (success/fail counts)
- Cost anomalies (any task > 3× its pipeline's median cost)

**Weekly**
- Quality review (above)
- Task Drop mining: cluster the "we couldn't do this" requests → candidate service #13+
- Credit economics: revenue per credit vs. fulfillment cost per credit (target ≤ 20%)

**Monthly**
- SLA report to customers on Business tier
- Rubric + prompt version audit; retire stale pipeline versions
- Churn interviews: every cancellation gets one "what task did we fail you on?" question

---

## 5. Scaling Plan

| Stage | Subscribers | Ops shape |
|---|---|---|
| 0 → 500 | Founder-ops | Founders staff the Exception Queue themselves — fastest possible learning loop. Every exception read by a human who can change the pipeline same-day. |
| 500 → 2,500 | First ops hire | 1 full-time operator + coverage hours published (exceptions outside hours get +4h SLA). Pipeline owners assigned. |
| 2,500 → 10,000 | Ops pod | 3–4 operators in follow-the-sun shifts; QA sampling program (human-review 2% of *passing* tasks to catch judge blind spots); dedicated integrations engineer. |
| 10,000+ | Platform | Per-pipeline ops metrics own headcount; marketplace consideration (vetted specialists handle premium human-QA tier); regional data residency. |

**Scaling rule:** hire only when exception volume, not task volume, demands it. Task volume scales with compute; exceptions scale with quality debt — fix the pipeline before hiring the person.

---

## 6. KPIs (the whole business on one line)

`SLA hit-rate ≥ 97% · QA pass-rate ≥ 92% · escape rate ≤ 2% · exception rate ≤ 5% · fulfillment cost ≤ 20% of credit revenue · time-to-first-deliverable ≤ 24h`
