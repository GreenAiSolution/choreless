# Choreless — System Architecture

**Platform:** Subscription service where AI agent pipelines complete real tasks end-to-end. Customers never prompt; they drop tasks or enable Autopilots, and finished deliverables arrive.

---

## 1. Requirements

**Functional**
- Task intake via web form, email forward, voice note, and recurring Autopilots (scheduled/triggered runs)
- Route each task to the right service pipeline (12 launch services across Business / Creator / Life lanes)
- Execute multi-step agent pipelines with real tool access (email send, social posting, design generation, form filing)
- Persistent customer context: brand kit, voice profile, business data, connected accounts
- QA gate before delivery; customer approval step for irreversible actions (posting, sending, filing)
- Credit-based metering tied to subscription tiers; rollover; revision requests
- Delivery to customer's tools (Drive, inbox, scheduler) plus in-app dashboard

**Non-functional**
- Turnaround SLA: 12h (Business tier) / 24h (Pro) / 48h (Starter) — this is a *throughput* business, not a latency one
- Availability 99.9% on intake and dashboard; pipelines can queue
- Cost ceiling: model + tool spend per task must stay under ~20% of the credit's revenue value
- Auditability: every agent action logged and replayable (customers' real accounts are touched)

**Constraints:** small team at launch → managed services, one deployable monolith + workers, no premature microservices.

---

## 2. High-Level Design

```
 Intake (web / email / voice / Autopilot scheduler)
        │
        ▼
 ┌─────────────┐    ┌──────────────┐
 │  Task API    │───▶│  Task Router │  classifies → service pipeline + priority
 └─────────────┘    └──────┬───────┘
        │                  ▼
        │           ┌──────────────┐     ┌───────────────────┐
        │           │  Job Queue    │◀───▶│ Context Store      │
        │           │ (per-pipeline │     │ brand kit, voice,  │
        │           │  priority)    │     │ integrations, memory│
        │           └──────┬───────┘     └───────────────────┘
        │                  ▼
        │           ┌──────────────────────────────┐
        │           │  Pipeline Workers (agent runs) │
        │           │  plan → act(tools) → self-check│
        │           └──────┬───────────────────────┘
        │                  ▼
        │           ┌──────────────┐  fail  ┌─────────────┐
        │           │   QA Gate     │───────▶│ Exception    │
        │           │ (auto checks) │        │ Queue (human)│
        │           └──────┬───────┘        └─────────────┘
        ▼                  ▼ pass
 ┌─────────────────────────────────┐
 │ Delivery Service                 │ → dashboard, email, customer tools
 │ + Approval flow for live actions │
 └─────────────────────────────────┘
        │
        ▼
 Billing/Credits (Stripe) ── ledger debits on delivery, not intake
```

**Core components**

| Component | Role | Tech (launch) |
|---|---|---|
| Task API | Intake, validation, status | Node/TS or Python, Postgres |
| Task Router | LLM classifier + rules → pipeline, credit cost, SLA clock | Small model call + rule table |
| Job Queue | Priority queues per pipeline, retries, dead-letter | SQS or Redis/BullMQ |
| Pipeline Workers | Agent runs: plan → tool calls → artifact → self-critique | Claude Agent SDK, containerized workers |
| Context Store | Customer memory: brand kit, voice profile, OAuth tokens, past deliverables | Postgres + object storage; tokens in KMS-encrypted vault |
| QA Gate | Automated rubric checks (schema, brand compliance, factuality spot-check, second-model review) | LLM-as-judge + deterministic validators |
| Exception Queue | Failed QA or low-confidence → human operator UI | Simple internal review app |
| Delivery Service | Renders deliverable, requests approval for irreversible actions, pushes to destinations | Webhooks + integration adapters |
| Credit Ledger | Double-entry credit accounting, rollover, refunds | Postgres, Stripe for money |

---

## 3. Deep Dive

### Data model (core tables)
- `customers` (tier, credits_balance, sla_class)
- `context_profiles` (customer_id, brand_kit, voice_profile jsonb, updated_at)
- `integrations` (customer_id, provider, encrypted_token, scopes)
- `tasks` (id, customer_id, pipeline, status, credit_cost, sla_deadline, source)
- `runs` (task_id, attempt, agent_trace_ref, cost_usd, qa_score)
- `deliverables` (task_id, artifact_uri, version, approved_at, delivered_at)
- `credit_ledger` (customer_id, delta, reason, task_id) — append-only
- `autopilots` (customer_id, pipeline, schedule/trigger, config)

### Task lifecycle (state machine)
`received → routed → queued → running → qa → (exception → rework)* → awaiting_approval? → delivered → closed`
Revisions create a child run on the same task; credits debit once, at first delivery.

### Pipeline anatomy (every service is the same skeleton)
1. **Hydrate** — load context profile + task inputs
2. **Plan** — agent produces step plan; cost/step budget enforced
3. **Act** — tool calls through the Integration Layer only (no raw network from agents); every call logged
4. **Produce** — artifact(s) written to object storage
5. **Self-check** — agent critiques against service rubric
6. **QA Gate** — independent judge model + deterministic validators (file opens, links resolve, brand colors match, no PII leaks)
7. **Deliver / Approve** — read-only deliverables auto-ship; irreversible actions (post, send, file) require one-tap customer approval unless pre-authorized

New services = new pipeline config (rubric, tools, prompts), not new code. Internally these are versioned **skill packages** — adding service #13 is a content change shipped like data.

### Queue & retry
- Per-pipeline priority queues; tier sets priority
- Retries: 2 automatic with backoff; then Exception Queue
- Idempotency keys on all tool calls (never double-post/double-send)
- SLA monitor promotes jobs approaching deadline

### API surface (customer)
- `POST /tasks` — create task (or email-in adapter creates it)
- `GET /tasks/:id` — status + deliverables
- `POST /tasks/:id/approve | /revise`
- `POST /autopilots`, `GET /usage`

---

## 4. Scale & Reliability

**Load estimate (12 months):** 5,000 subscribers × ~15 tasks/mo ≈ 75k tasks/mo ≈ 2,500/day. At ~5 min agent-compute each that's ~210 concurrent-worker-hours/day — a few dozen autoscaled workers. Small.

- Workers stateless → horizontal autoscaling on queue depth
- Postgres single primary + replica is ample well past 100k tasks/mo
- Failure isolation: one integration outage (e.g., Instagram API) pauses only that pipeline's queue
- Observability: per-run trace (every prompt, tool call, cost), dashboards on QA pass-rate, cost/task, SLA hit-rate, exception rate — these four numbers are the business

**Safety rails**
- Agents act only through allowlisted integration adapters with scoped tokens
- Irreversible-action approval flow; per-customer daily action caps
- Full audit log; one-click rollback where the target API supports it (delete post, recall draft)

---

## 5. Trade-offs & Revisit Later

| Decision | Chosen | Trade-off | Revisit when |
|---|---|---|---|
| Monolith + workers vs microservices | Monolith | Simpler ops, some coupling | >10 engineers |
| Credits vs unlimited | Credits | Metering friction vs cost control | Never fully; unlimited invites abuse |
| Debit on delivery vs intake | Delivery | Revenue recognition later, but aligns incentive with quality | — |
| LLM judge QA vs human-on-everything | Auto QA + exception queue | ~2–5% escape rate | If refund rate >3%, add human QA sampling per pipeline |
| Buy integrations (Zapier/Composio) vs build | Buy at launch | Per-call cost, less control | Top 5 integrations by volume → build native |
| One agent framework | Claude Agent SDK | Vendor coupling | Abstract behind pipeline interface from day 1 |

**Biggest risk:** QA escape on irreversible actions (a bad post on a customer's account). Mitigation: approval-by-default for live actions in a customer's first 30 days, then earned auto-pilot trust per pipeline.
