---
name: phx-align
description: Ingest a page of phxgrowth.com — from a screen recording, screenshots, or pasted copy — into the PHX/GROWTH PLUS source of truth, then re-check the whole catalogue against the parent's new copy. Use when the client sends a recording or screenshots of the main site, when phxgrowth.com has changed, or when an upgrade needs verifying against parent copy the repo does not yet hold.
---

# Aligning PHX/GROWTH PLUS to phxgrowth.com

PHX/GROWTH PLUS only works if it knows exactly what the parent agency already
sells. The parent's copy lives in this repo as data, and this is how it gets
there.

## Before anything: you cannot fetch phxgrowth.com

The agent proxy denies it — `curl` returns `CONNECT tunnel failed, response
403`, and that is policy, not a transient error. **Do not burn turns retrying,
and never reconstruct the parent's copy from memory.** Guessing at the
parent's bullets is precisely how a duplicate upgrade ships.

If the copy you need is not in the repo and not in what the client sent, say
which page you need and stop.

## Step 1 — Get frames out of the recording

Recordings arrive as HEVC/H.265 `.mov` or `.mp4`. **Playwright's bundled ffmpeg
cannot decode them** — it lacks the H.265 decoder and the `mov` demuxer, and
fails with "Invalid data found when processing input". That error looks like a
corrupt file and is not.

Install a real ffmpeg into the scratchpad, not the project:

```bash
cd "$SCRATCHPAD" && npm i ffmpeg-static
FFMPEG="$SCRATCHPAD/node_modules/ffmpeg-static/ffmpeg"
"$FFMPEG" -i recording.mov -vf fps=1/2 -q:v 2 "$SCRATCHPAD/frames/f-%03d.jpg"
```

Then Read the frames. One frame every two seconds is usually enough; go to
`fps=1` for a fast scroll.

If Playwright is needed for anything else afterwards and the scratchpad now
has its own `node_modules`, its module resolution will break — import from the
absolute path `/opt/node22/lib/node_modules/playwright/index.mjs`.

## Step 2 — Transcribe verbatim, not in summary

Everything lands in `nexus-growth-platform/src/lib/upgrades.ts`. Which
structure depends on the page:

| Page on phxgrowth.com | Where it goes |
|---|---|
| Pricing | `PARENT_SERVICES[].priceLabel`, `FLIGHT_PLANS` (tiers + fee rates) |
| A service page | `PARENT_SERVICES[].includes` — **verbatim bullets** |
| AI Employees | `OPERATORS` — every named operator and what it `covers` |
| Automation | `AUTOMATION_LOOPS`, `FLAGSHIP` |
| Results | `RESULTS_WORK` |
| Homepage | `HOME_CLAIMS`, `HOUSE_STRIP`, `MANIFEST`, `REVENUE_LEVERS` |

**Transcribe the parent's wording exactly.** These fields exist to be read by
the additive checks. A tidied-up paraphrase is a check reading your prose
instead of the parent's, which is the same as no check.

## Step 3 — Re-run the additive checks against the new copy

```bash
cd nexus-growth-platform && npx vitest run src/lib/upgrades.test.ts
```

New parent copy can retroactively invalidate an upgrade that was additive
last week. **That is the point of doing this.** When a check goes red, the
finding is that the *upgrade* now duplicates the parent — cut or re-scope the
upgrade. Never loosen the threshold to accommodate it.

Twelve upgrades were proposed over the catalogue's life; seven were cut. Every
cut came from a check reading the parent's own published copy. None came from
anyone's judgement — judgement kept passing them.

## Step 4 — Prove the check still fires

Widening or narrowing a check's scope can make it vacuous without any visible
sign. This has already happened here once: re-injecting a previously-cut
upgrade **passed** the Manifest check, because Manifest item 07 is terse while
the detail that killed the upgrade lives in `REVENUE_LEVERS`. Adding
`REVENUE_LEVERS` to the checked scope made the probe fail on five shared words,
as it always should have.

So: after any scope change, re-inject a known-bad upgrade, watch the check go
red, remove it. Do not skip this because the suite is green — green is exactly
what a vacuous check looks like.

## Step 5 — Design alignment

The palette is sampled from phxgrowth.com and lives in
`src/app/globals.css`: `--hud-cyan`, `--hud-gold`, `--hud-green`, plus the
house classes `.eyebrow`, `.phx-card`, `.pill-primary`, `.pill-gold`,
`.pill-ghost`, `.chip`. Any motion added on top (`.aurora`, `.grain`, `.lift`,
`.text-kinetic`, `.marquee-*`) must stand down under
`prefers-reduced-motion` — this is already wired; keep it that way.

The site is currently **0 axe-core violations at WCAG 2.1 AA**, verified at
1280px and 390px. Do not regress it. To re-check:

```bash
cd "$SCRATCHPAD" && npm i axe-core
# drive with Playwright from /opt/node22/lib/node_modules/playwright/index.mjs
```

## Step 6 — Finish

Run `/ship-plus`. Alignment work is not done until it is on the deploy repo.
