# Choreless

A chore-outsourcing platform — "Work delivered, not chatted. Every task QA'd before it reaches you."

## Run the real system

```bash
npm install && npm test && npm start   # → http://localhost:8787/app
```

The **selling system** (`server/`) is a fully functioning platform: accounts,
credit billing (Stripe-ready), task intake with routing, a Claude-powered
execution engine with an independent QA judge, customer approvals, autopilots,
an ops console, and an append-only audit log. See
[`SELLING-SYSTEM.md`](SELLING-SYSTEM.md). Without an `ANTHROPIC_API_KEY` it
runs in watermarked simulation mode so everything is testable for free.

## Contents

| File | What it is |
| --- | --- |
| `server/` | **The selling system** — API + engine + product app (`/app`) + ops console (`/ops`) |
| `SELLING-SYSTEM.md` | How to run, modes, task lifecycle, API surface |
| `App.tsx` | React SPA source (view-state navigation; brand: paper `#FAF7F2` / ink `#141414` / orange `#FF4D00`) |
| `CHORELESS-platform.html` | Self-contained, runnable bundle — open directly in a browser (mounts on `#root`) |
| `CHORELESS-blueprint.md` | Product blueprint |
| `CHORELESS-architecture.md` | System architecture |
| `CHORELESS-operations-playbook.md` | Operations playbook |
| `CHORELESS-financial-model.xlsx` | Financial model |

## Editing & building

`App.tsx` is the single source of truth. After editing it, run:

```
node build.mjs
```

This transpiles `App.tsx` with esbuild and writes a self-contained `index.html`
(and an identical `CHORELESS-platform.html`) that loads React + Tailwind from CDN,
inlines the app, and re-appends the iris page-transition enhancement. `index.html`
is what GitHub Pages serves. The build is idempotent — run it as many times as you like.

## Notes

- Live services: **7 focused pipelines** — ★ Before You Sign (new flagship:
  contract/lease/offer trap-mapping before you commit — nobody productizes it),
  Clip Factory (lead wedge), Reputation Autopilot, Social Autopilot, Refund &
  Comp Recovery, Digital Footprint Cleaner, Hard Conversation Ghostwriter.
  All seven are executable end-to-end by the engine in `server/`.
- `iris-transition.html` holds the click-anchored iris page transition (a soft tonal
  reveal from the click point), extracted once from the original bundle and re-inlined
  by `build.mjs`. The embedded preview browser never fires WAAPI `onfinish`, so
  animation cleanup uses `setTimeout`.
