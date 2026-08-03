#!/usr/bin/env node
/**
 * Omniagent — repo MCP server.
 *
 * Exposes the real contents of this repository to MCP clients: the n8n agent
 * catalog in `omniagent-engine/`, each agent's persona and tools, how a
 * specialist differs from the base Concierge workflow, the structure of the
 * marketing site, and the go-to-market docs. Every tool parses the actual
 * files at call time — nothing is cached or hardcoded.
 *
 * Tools:
 *   list_agents        — every workflow*.json with name, model, node/tool counts
 *   get_agent          — one agent's persona (system prompt), model, memory, tools
 *   diff_agent_vs_base — nodes added/removed/changed vs the base workflow.json
 *   get_site_structure — title, meta and section outline of index.html
 *   get_doc            — a repo doc (sales one-pager, deployment runbook, READMEs)
 *   search_repo        — literal search across workflows, docs and the site
 */

import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = join(REPO_ROOT, "omniagent-engine");

const server = new McpServer({ name: "choreless", version: "1.0.0" });

function text(payload) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: "text", text: body }] };
}

async function workflowFiles() {
  const files = await readdir(ENGINE);
  return files.filter((f) => f.startsWith("workflow") && f.endsWith(".json")).sort();
}

async function loadWorkflow(file) {
  return JSON.parse(await readFile(join(ENGINE, file), "utf8"));
}

/** The langchain agent node plus everything wired into it by connection type. */
function analyze(wf) {
  const agentNode = wf.nodes.find((n) => n.type.endsWith(".agent"));
  const wired = { ai_tool: [], ai_memory: [], ai_languageModel: [] };
  if (agentNode) {
    for (const [source, conns] of Object.entries(wf.connections ?? {})) {
      for (const [ctype, groups] of Object.entries(conns)) {
        if (!(ctype in wired)) continue;
        for (const group of groups) {
          for (const target of group ?? []) {
            if (target.node === agentNode.name) wired[ctype].push(source);
          }
        }
      }
    }
  }
  const nodeByName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
  const tools = wired.ai_tool.map((name) => {
    const n = nodeByName[name];
    return {
      name,
      type: n?.type,
      description: n?.parameters?.toolDescription ?? n?.parameters?.description ?? null,
      gated: /GATED|CONFIRM/i.test(n?.parameters?.toolDescription ?? ""),
    };
  });
  const model = wf.nodes.find((n) => n.type.endsWith("lmChatOpenAi"))?.parameters?.model;
  const memory = wf.nodes.find((n) => n.type.endsWith("memoryBufferWindow"))?.parameters;
  return { agentNode, tools, model, memory };
}

/* ------------------------------------------------------------------ */

server.registerTool(
  "list_agents",
  {
    title: "List agents",
    description:
      "The Omniagent catalog: every n8n workflow in omniagent-engine/ with its workflow name, chat model, node count, and the tools wired into its agent — parsed live from the JSON files.",
    inputSchema: {},
  },
  async () => {
    const out = [];
    for (const file of await workflowFiles()) {
      const wf = await loadWorkflow(file);
      const { tools, model } = analyze(wf);
      out.push({
        file: `omniagent-engine/${file}`,
        workflowName: wf.name,
        model: typeof model === "object" ? model?.value ?? model : model,
        nodes: wf.nodes.length,
        tools: tools.map((t) => t.name),
        gatedTools: tools.filter((t) => t.gated).map((t) => t.name),
      });
    }
    return text(out);
  },
);

/* ------------------------------------------------------------------ */

server.registerTool(
  "get_agent",
  {
    title: "Get agent details",
    description:
      "One agent in full: its system prompt (persona), chat model, memory configuration, and every tool with its description and whether writes are CONFIRM-gated. Pass the workflow file name, e.g. 'workflow-quickbooks-specialist.json'.",
    inputSchema: {
      file: z.string().describe("Workflow file name inside omniagent-engine/, e.g. workflow.json"),
    },
  },
  async ({ file }) => {
    const files = await workflowFiles();
    if (!files.includes(file)) return text({ error: `Unknown workflow '${file}'`, available: files });
    const wf = await loadWorkflow(file);
    const { agentNode, tools, model, memory } = analyze(wf);
    return text({
      file: `omniagent-engine/${file}`,
      workflowName: wf.name,
      model: typeof model === "object" ? model?.value ?? model : model,
      memory,
      systemPrompt: agentNode?.parameters?.options?.systemMessage ?? null,
      maxIterations: agentNode?.parameters?.options?.maxIterations ?? null,
      tools,
    });
  },
);

/* ------------------------------------------------------------------ */

server.registerTool(
  "diff_agent_vs_base",
  {
    title: "Diff agent vs base",
    description:
      "How a specialist differs from the base Concierge (workflow.json): nodes added, nodes removed, and shared nodes whose parameters changed. Demonstrates the repo's claim that a new agent is configuration, not a rebuild.",
    inputSchema: {
      file: z.string().describe("Specialist workflow file name, e.g. workflow-reservations.json"),
    },
  },
  async ({ file }) => {
    const files = await workflowFiles();
    if (!files.includes(file)) return text({ error: `Unknown workflow '${file}'`, available: files });
    const base = await loadWorkflow("workflow.json");
    const spec = await loadWorkflow(file);
    const baseNodes = new Map(base.nodes.map((n) => [n.name, n]));
    const specNodes = new Map(spec.nodes.map((n) => [n.name, n]));
    const added = [...specNodes.keys()].filter((n) => !baseNodes.has(n));
    const removed = [...baseNodes.keys()].filter((n) => !specNodes.has(n));
    const changed = [...specNodes.keys()].filter((n) => {
      if (!baseNodes.has(n)) return false;
      return (
        JSON.stringify(specNodes.get(n).parameters) !== JSON.stringify(baseNodes.get(n).parameters)
      );
    });
    return text({
      base: "omniagent-engine/workflow.json",
      specialist: `omniagent-engine/${file}`,
      nodesAdded: added,
      nodesRemoved: removed,
      nodesWithChangedParameters: changed,
      sharedUnchanged: spec.nodes.length - added.length - changed.length,
    });
  },
);

/* ------------------------------------------------------------------ */

server.registerTool(
  "get_site_structure",
  {
    title: "Site structure",
    description:
      "The marketing site (index.html) as an outline: page title, meta description, and every section id with its headings — parsed live from the file GitHub Pages serves.",
    inputSchema: {},
  },
  async () => {
    const html = await readFile(join(REPO_ROOT, "index.html"), "utf8");
    const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? null;
    const description =
      html.match(/<meta name="description" content="([\s\S]*?)"/)?.[1]?.trim() ?? null;
    const sections = [];
    const secRe = /<section[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g;
    let m;
    while ((m = secRe.exec(html)) !== null) {
      const headings = [...m[2].matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/g)].map((h) =>
        h[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
      );
      sections.push({ id: m[1], headings });
    }
    return text({ title, description, sizeBytes: html.length, sections });
  },
);

/* ------------------------------------------------------------------ */

const DOCS = {
  "sales-onepager": "docs/SALES-ONEPAGER.md",
  "deployment-runbook": "docs/DEPLOYMENT.md",
  "engine-readme": "omniagent-engine/README.md",
  readme: "README.md",
};

server.registerTool(
  "get_doc",
  {
    title: "Get document",
    description: `Return one of the repo's documents verbatim. Keys: ${Object.keys(DOCS).join(", ")}.`,
    inputSchema: {
      doc: z.enum(Object.keys(DOCS)).describe("Which document to fetch."),
    },
  },
  async ({ doc }) => text(await readFile(join(REPO_ROOT, DOCS[doc]), "utf8")),
);

/* ------------------------------------------------------------------ */

server.registerTool(
  "search_repo",
  {
    title: "Search repo",
    description:
      "Case-insensitive literal search across the workflows, docs, build script and index.html. Returns file, line and matching text, capped at 50 hits.",
    inputSchema: {
      query: z.string().min(2).describe("Literal text to find."),
      limit: z.number().int().min(1).max(50).optional().describe("Max results (default 30)."),
    },
  },
  async ({ query, limit }) => {
    const cap = limit ?? 30;
    const needle = query.toLowerCase();
    const targets = [
      "README.md",
      "index.html",
      "docs/SALES-ONEPAGER.md",
      "docs/DEPLOYMENT.md",
      "omniagent-engine/README.md",
      "omniagent-engine/build-variants.mjs",
      "omniagent-engine/ingest-knowledge-base.json",
      ...(await workflowFiles()).map((f) => `omniagent-engine/${f}`),
    ];
    const hits = [];
    outer: for (const rel of targets) {
      let src;
      try {
        src = await readFile(join(REPO_ROOT, rel), "utf8");
      } catch {
        continue;
      }
      if (!src.toLowerCase().includes(needle)) continue;
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(needle)) {
          hits.push({ file: rel, line: i + 1, text: lines[i].trim().slice(0, 200) });
          if (hits.length >= cap) break outer;
        }
      }
    }
    return text({ query, matches: hits.length, hits });
  },
);

/* ------------------------------------------------------------------ */

const transport = new StdioServerTransport();
await server.connect(transport);
