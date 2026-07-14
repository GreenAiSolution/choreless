# Choreless

A chore-outsourcing platform demo — "Work delivered, not chatted. Every task QA'd before it reaches you."

## Contents

| File | What it is |
| --- | --- |
| `App.tsx` | React SPA source (view-state navigation; brand: paper `#FAF7F2` / ink `#141414` / orange `#FF4D00`) |
| `CHORELESS-platform.html` | Self-contained, runnable bundle — open directly in a browser (mounts on `#root`) |
| `CHORELESS-blueprint.md` | Product blueprint |
| `CHORELESS-architecture.md` | System architecture |
| `CHORELESS-operations-playbook.md` | Operations playbook |
| `CHORELESS-financial-model.xlsx` | Financial model |
| `CHORELESS-framework.md` | **The Service Framework** — the runtime spine every service runs through |
| `server/` | Runnable framework: `npm run framework` proves all six services end-to-end |

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

- Live services: **6 focused pipelines** — Clip Factory (lead wedge), Reputation
  Autopilot, Social Autopilot, Refund & Comp Recovery, Digital Footprint Cleaner,
  Hard Conversation Ghostwriter. All six are declarative packages in `server/services/`
  that run through one spine — see `CHORELESS-framework.md` (`cd server && npm run framework`).
- `iris-transition.html` holds the click-anchored iris page transition (a soft tonal
  reveal from the click point), extracted once from the original bundle and re-inlined
  by `build.mjs`. The embedded preview browser never fires WAAPI `onfinish`, so
  animation cleanup uses `setTimeout`.
