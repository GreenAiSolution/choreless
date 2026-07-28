# phxgrowth-plus-mcp-server

An MCP server for **PHX/GROWTH PLUS** — the upgrade counter for the agency
[phxgrowth.com](https://phxgrowth.com).

It answers the two questions you need away from a laptop:

1. **What does this cost and what's in it?** — quote any upgrade or bundle from
   Slack, your phone, anywhere, with live figures.
2. **Is the enquiry form reaching anybody right now?** — the check that would
   have caught the days the site silently dropped every lead.

Read-only. It cannot change the site, take a payment, or contact a client.

## Tools

| Tool | What it does |
|---|---|
| `phxplus_list_offers` | Every upgrade and bundle, optionally filtered to one parent service. |
| `phxplus_quote` | Totals a shortlist or prices a bundle. Flags when a shortlist is cheaper bought as a bundle. |
| `phxplus_check_lead_path` | Asks the live site whether an enquiry submitted now reaches a human, and names the exact env var to set when it doesn't. |

## Why it holds no data of its own

Everything comes from the live site over HTTP — `/api/catalogue` and
`/api/health`. There is deliberately **no local copy of the price list**. Two
copies of a price means one of them is eventually stale, and the stale one is
the one somebody quotes out loud on a call.

That also means the single source of truth stays where it belongs:
`nexus-growth-platform/src/lib/upgrades.ts`, where the additive-rule test suite
guards it.

## Why `phxplus_check_lead_path` exists

`/api/reserve` once returned `{ok: true}` to every visitor while the notify
layer beneath it returned `{status: "skipped"}` and dropped the enquiry into a
log line. The production environment stored the mail key as `resend` while the
code read `RESEND_API_KEY`. Nothing threw. Nothing was logged as an error.
Prospects asking to spend four figures a month saw "Cleared for pre-flight" and
were never contacted.

The bug was invisible because *"no transport configured" is indistinguishable
from "configured correctly"* unless something goes looking. This tool is the
thing that goes looking, and it reports bluntly on purpose.

## Install

```bash
npm install
npm run build
```

## Configure

| Variable | Default | Notes |
|---|---|---|
| `PHX_PLUS_URL` | `https://plus.phxgrowth.com` | Point at `http://localhost:3000` to work against a dev server. |

No API key. Every endpoint it reads is public.

### Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "phxgrowth-plus": {
      "command": "node",
      "args": ["/absolute/path/to/phxgrowth-plus-mcp-server/dist/index.js"],
      "env": { "PHX_PLUS_URL": "https://plus.phxgrowth.com" }
    }
  }
}
```

## Verify

```bash
# against a local dev server
PHX_PLUS_URL=http://localhost:3000 node smoke.mjs
```

The smoke test drives every tool over a real stdio session and asserts the
things that must hold whatever the catalogue currently says — bundles beat
their parts, an unknown key returns the valid keys, the health verdict matches
its own channel list.

There is no fixed question/answer eval set, and that is a decision rather than
an omission: every interesting answer here is a price, prices change on deploy
by design, and pinning them into a fixture would recreate the second source of
truth this server exists to avoid.

## A note on relaying what it returns

The PHX/GROWTH PLUS catalogue makes **no outcome claims and cites no
statistics**, deliberately and under test. The site says out loud that there
are no results to show yet. When relaying anything from these tools, don't add
numbers that aren't there.
