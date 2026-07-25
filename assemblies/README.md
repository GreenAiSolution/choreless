# The Assemblies — paid deliverables. Never public.

This directory is the actual product customers pay for: three pre-designed,
fully-automated bot packages, sized by how busy the business is. **Nothing in
this directory ships to the public site repo.** The public site sells the
outcome; the files live here, and a customer receives a *running system* —
never these files.

| Assembly | Bots | Monthly | Build fee | For |
| --- | --- | --- | --- | --- |
| **III — Assembly of Three** | 3 | $399 | $900 | The single-location shop: answer, book, grow the rating. |
| **VII — Assembly of Seven** | 7 | $899 | $1,800 | The busy floor: four agents + the full night shift. |
| **XV — Assembly of Fifteen** | 15 | $1,299 | $3,500 | The machine: every agent, every automation, every channel. |

The System (application-only, human ops desk, `docs/THE-SYSTEM.md`) still sits
above all three — an assembly is software you own the outcome of; The System is
a department run for you.

## Assembling a customer's package (after payment clears — not before)

```bash
cd assemblies
node deploy-assembly.mjs 7 "Franco's Trattoria"
# seat swap example — Support instead of Reservations in a III:
node deploy-assembly.mjs 3 "Corner Salon" --swap workflow-reservations.json=workflow-customer-support.json
```

Output lands in `assemblies/out/<slug>/` (gitignored):
- every workflow stamped with the business name, import-ready
- `DEPLOY.md` — a wiring checklist generated from what's actually in the files
  (every `YOUR_*` placeholder found, listed per bot), plus the standard go-live
  and cross-tenant-leakage checks from `docs/DEPLOYMENT.md`.

## The paid-only rule

1. **This directory and `omniagent-engine/` must never be pushed to the public
   Pages repo.** The public repo gets site files only (`index.html`, `for/`,
   `hq.html`, the Pages workflow).
2. Assembled bundles (`out/`) are delivered by deploying them onto the
   customer's number — the customer never receives raw JSON.
3. The three channel bots in the XV (Voice / RCS / Checkout) activate only when
   the customer's Twilio / BSP / Stripe accounts are connected — say so in the
   close, before payment, not after.
