# Choreless Service Framework

**The core IP.** Choreless isn't six services — it's one framework that runs any
service. Every service, whether it writes a caption or files a refund on a real
website, is a **declarative package** that flows through **one runtime spine** where
the moat is enforced in code: persistent context, authorization, a QA gate so
drafts never reach the customer, results-honest billing, and an immutable audit
trail.

Adding service #7 is a config file in `server/services/` — no worker rewiring.

```
 intake ─▶ AUTHORIZATION ─▶ HOLD credits ─▶ pipeline ─▶ QA RUBRIC GATE ─▶ deliver ─▶ SETTLE
           (act-only)                     (plan→act→                    │            (debit on
                │                          produce)                     ├─pass─▶ delivery / results)
         signed consent                  actor-tagged steps            └─fail─▶ REVISION
         or the job is refused           human-ops checkpoints                  (credit returned,
                                                                                 free revision)
                     └──────────────── every step → immutable hash-chained audit log ───────────────┘
```

Run it: `cd server && npm run framework`

## The service contract (`server/framework/service.js`)

A service package is validated config. The full shape:

```js
export default defineService({
  id, name, lane,          // "Creator" | "Business" | "Life"
  version,                 // versioned skill package
  trigger,                 // "on-demand" | "schedule" | "event"
  schedule, event,         // cadence for schedule / event name for event

  actsOnBehalf, consentKey, adapter,   // act-on-behalf: hard consent gate + safety-bounded adapter

  intake:  [{ id, label, required }],  // 3–6 structured inputs collected once
  context: ["brandKit","voice",…],     // which parts of the customer profile it reads
  credits,                             // flat number OR { model:"results", perRun, chargeWhen(result) }
  sla,                                 // turnaround per tier
  irreversible: ["post response",…],   // actions needing approval

  rubric:  [{ id, label, severity, check(result, job) }],   // the QA gate
  async pipeline(job, ctx) { … return { deliverable, steps } },
});
```

`defineService` prepends a **universal rubric** (a deliverable exists and isn't a
placeholder) to every service, then freezes it.

## The spine (`server/framework/runtime.js`)

`runService(job)` is the only executor. In order: resolve service → validate
intake → **authorization gate** (act-on-behalf) → **hold credits** → run pipeline →
**QA rubric gate** → deliver-or-revise → **settle credits** → audit. One of four
outcomes: `delivered`, `revision` (QA blocked, credit returned), `refused` (no
consent / bad intake — never ran), `failed` (pipeline threw).

## The parts

| Module | Role |
| --- | --- |
| `framework/service.js` | The contract + `defineService` validator + universal rubric |
| `framework/runtime.js` | `runService` — the single spine |
| `framework/rubric.js` | `grade()` (QA verdict) + `launchGate()` (10 runs ≥ 90% before go-live) |
| `framework/credits.js` | Hold on intake, debit on delivery, results-priced on outcome, refund on QA fail |
| `framework/registry.js` | Auto-discovers `services/*.js`; generates the live catalog |
| `framework/scheduler.js` | Autopilots: `tick()` for schedule, `emit()` for events → enqueue jobs |
| `lib/*` (existing) | Audit chain, authorization store, human-ops gate, queue — reused as-is |
| `adapters/*` (existing) | The safety-bounded "act" step for act-on-behalf services |

## The six services (`server/services/`)

| Service | Lane | Trigger | Credits | Acts on behalf |
| --- | --- | --- | --- | --- |
| Clip Factory | Creator | on-demand | 5 | — |
| Reputation Autopilot | Business | schedule (weekly) | 3 | — |
| Social Autopilot | Business | schedule (monthly) | 8 | — |
| Hard Conversation Ghostwriter | Life | on-demand | 2 | — |
| Refund & Comp Recovery | Life | event (`price.dropped`) | 2/run · results-priced | ✓ |
| Digital Footprint Cleaner | Life | schedule (monthly) | 2/run · results-priced | ✓ |

## What the proof demonstrates

`npm run framework` runs all six through the spine and shows, on real state:

- **Config, not code** — the catalog is generated from the files in `services/`.
- **QA gate** — Ghostwriter in `rush` mode skips the follow-up plan; the required
  rubric check fails, delivery is **blocked**, and the credit is **returned**.
- **Credits** — flat services debit on delivery; results-priced services charge
  only when money is recovered / a listing is removed.
- **Authorization gate** — an act-on-behalf job with no signed consent is
  **refused** before the pipeline runs.
- **Autopilots** — the schedule tick and a `price.dropped` event enqueue real jobs
  that run themselves through the full spine.
- **Audit chain** — every consent, step, QA verdict, and charge is one
  hash-chained line; the chain verifies intact.

## Adding a service

1. Drop `server/services/your-service.js` exporting `defineService({...})`.
2. Write the `pipeline` (write-only) or bind an `adapter` (act-on-behalf).
3. Give it a `rubric` — the checks that must pass before a customer sees the work.
4. `launchGate` it: 10 dry runs at ≥ 90% before it goes live.

The registry finds it, the spine runs it, the catalog lists it. No other file changes.
