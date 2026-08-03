# Omniagent — MCP Server

A stdio [Model Context Protocol](https://modelcontextprotocol.io) server that lets an AI
assistant explore this repository through structured tools: the n8n agent catalog, each
agent's persona and tools, the marketing site, and the go-to-market docs.

Every tool parses the actual repo files at call time — nothing is cached or hardcoded.

## Tools

| Tool | What it returns |
| --- | --- |
| `list_agents` | Every `workflow*.json` in `omniagent-engine/` with workflow name, chat model, node count, wired-in tools, and which tools are CONFIRM-gated. |
| `get_agent` | One agent in full: system prompt (persona), model, memory config, and each tool with its description and gating. |
| `diff_agent_vs_base` | Nodes added/removed/changed vs the base Concierge (`workflow.json`) — proof that a new agent is configuration, not a rebuild. |
| `get_site_structure` | Title, meta description and section outline of `index.html` (the page GitHub Pages serves). |
| `get_doc` | A repo document verbatim: `sales-onepager`, `deployment-runbook`, `engine-readme`, or `readme`. |
| `search_repo` | Case-insensitive literal search across workflows, docs, the build script and the site. |

## Setup

```bash
cd mcp-server
npm install
```

Add it to Claude Code:

```bash
claude mcp add choreless -- node mcp-server/server.mjs
```

Or use the repo's root `.mcp.json`, which registers it automatically for tools that
support project-scoped MCP config.

## Smoke test

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' | node server.mjs
```

You should get back an `initialize` result naming the server `choreless`.
