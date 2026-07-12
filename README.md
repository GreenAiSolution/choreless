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

## Running

`CHORELESS-platform.html` is fully self-contained — no build step. Open it in any
browser. `App.tsx` is the readable source of truth; keep the two in sync when editing.

## Notes

- The bundle appends enhancements (transitions, styles) as raw `<style>`/`<script>`
  at the end of the file since there is no build setup.
- Navigation uses a subtle click-anchored iris transition (a soft tonal reveal from
  the click point). The embedded preview browser never fires WAAPI `onfinish`, so
  animation cleanup uses `setTimeout`.
