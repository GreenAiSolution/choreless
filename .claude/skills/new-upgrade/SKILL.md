---
name: new-upgrade
description: Add, reprice, re-scope or retire an upgrade or a deluxe bundle in the PHX/GROWTH PLUS catalogue. Use whenever the client asks for a new add-on, offer, upsell or bundle, or wants an existing one changed or removed. Covers the data model, the constraints that are test-enforced, and the surfaces that must be updated in the same change.
---

# Changing the PHX/GROWTH PLUS catalogue

Everything the site sells lives in one file:
`nexus-growth-platform/src/lib/upgrades.ts`. Read it before writing anything.

## First: is this genuinely additive?

Route the proposal through the `additive-auditor` agent before writing code.
Every buyer is already a phxgrowth.com client, so an upgrade that duplicates
existing work is not a weak offer — it is an invoice for something already on
their bill, discovered on the kickoff call.

Historically twelve upgrades were proposed and **seven were cut**, every cut
caught by a machine check reading the parent's own published copy. If you are
about to add a sixth or seventh upgrade, the base rate says it is a duplicate.

## The shape

```ts
{
  key: "kebab-case-stable-id",   // travels over the wire; never reuse or rename lightly
  name: "The Something",
  attachesTo: "premium-ai-ads" | "ai-employees" | "website-creation",
  price: 190000,                 // cents
  billing: "monthly" | "one_time",
  leading?: true,                // exactly one per service
  apex?: true,                   // exactly one across the whole site
  // plus the promise / what-you-get fields — copy the shape of a neighbour
}
```

## Constraints the tests enforce

These are not style preferences. `src/lib/upgrades.test.ts` fails on each.

- Keys and names unique.
- Every upgrade `attachesTo` a real service, and every service has at least
  one upgrade. (The per-service floor was lowered 3 → 2 → 1 rather than
  inventing work to fill it. Do not invent work to fill it.)
- **Priced below the parent service it attaches to.** An upgrade dearer than
  the thing it upgrades is a replacement wearing an upgrade's name.
- Each service lists **most expensive first** — full descending order, not
  just a correct first element. A real bug hid behind the weaker assertion.
- Exactly one `leading` per service; exactly one `apex` on the site.
- No upgrade name borrows a word from the `FLAGSHIP` engagement's vocabulary.
- **No outcome claims, no invented statistics.** The only percentages allowed
  are the parent's real performance-fee rates from `FLIGHT_PLANS`.
- Additive against the parent service's `includes`, the ten `OPERATORS`, the
  twelve-item `MANIFEST`, the `REVENUE_LEVERS`, the `AUTOMATION_LOOPS` and
  `FLAGSHIP` — measured as distinctive-word overlap (≤3 vs the roster, ≤2 vs
  the Manifest and levers).

## Bundles

```ts
{ key, name, members: [upgradeKey, ...], price, promise, rationale, apex? }
```

- At least two real members.
- **Cheaper than the sum of its parts** (or it is not a bundle) and **dearer
  than its dearest single member** (or it is a discount on that member).
- Exactly one `apex` bundle, and it must be the largest ticket on the site.
- The `rationale` must argue why the members *compound*, not just list them.
- Every upgrade should appear in at least one bundle.

## What else changes in the same commit

Adding an upgrade is never a one-file change. Miss one of these and the site
contradicts itself:

| Surface | File | What breaks if you skip it |
|---|---|---|
| Gap Finder | `src/components/marketing/gap-finder.tsx` | Each question maps to one upgrade via `gapWhen`. It **throws at module load** on an unknown key — deliberately, so this is caught in dev and never in production. |
| Coverage Map | `src/components/marketing/coverage-map.tsx` | The literal count in the copy ("26 covered. 5 not.") stops matching the catalogue. |
| Thesis | `THESIS.body` in `upgrades.ts` | Interpolates `UPGRADES.length` — do not spell the number, it is test-checked. |
| Bundles | `BUNDLES` | An orphaned upgrade in no bundle fails the coverage test. |

## Pricing is server-side, always

The browser posts **keys**. `/api/reserve` recomputes every figure from
`UPGRADES` and `BUNDLES`. A posted price is user input. A bundle key wins
outright over a loose selection and is priced from its own `price` field —
pricing it as the sum of its members would quote a number higher than the page
advertised.

## Then

```bash
cd nexus-growth-platform && npx vitest run src/lib/upgrades.test.ts
```

When a check fails, the finding is almost always about the **upgrade**, not
the check. Cut or re-scope it. Loosening a threshold to accommodate a new
offer removes the only thing standing between this site and billing a client
twice.

Finish with `/ship-plus`.
