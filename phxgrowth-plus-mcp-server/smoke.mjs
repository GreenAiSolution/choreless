#!/usr/bin/env node
/**
 * Smoke test: drives every tool over a real stdio MCP session.
 *
 * WHY THIS RATHER THAN AN EVAL SET
 *   The usual artifact here is a file of question/answer pairs. That format
 *   needs answers that stay true over time, and every interesting answer this
 *   server gives is a price — which changes on deploy, by design, because the
 *   whole point is that the server carries no copy of the price list. Pinning
 *   prices into a fixture would create the second source of truth this server
 *   exists to avoid, and it would go stale silently.
 *
 *   So this checks the things that must hold whatever the catalogue says: the
 *   tools are reachable, a bundle prices below its parts, an unknown key comes
 *   back with the valid keys listed, and the lead-path check reports honestly.
 *
 * Usage:
 *   PHX_PLUS_URL=http://localhost:3000 node smoke.mjs
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const target = process.env.PHX_PLUS_URL ?? "http://localhost:3000";
let failures = 0;

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: { ...process.env, PHX_PLUS_URL: target },
});
const client = new Client({ name: "smoke", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);

console.log(`\nphxgrowth-plus-mcp-server smoke test against ${target}\n`);

const { tools } = await client.listTools();
const names = tools.map((t) => t.name);
check("all three tools are exposed", names.length === 3, names.join(", "));
for (const n of ["phxplus_list_offers", "phxplus_quote", "phxplus_check_lead_path"]) {
  check(`${n} is registered`, names.includes(n));
}
check(
  "every tool documents its arguments",
  tools.every((t) => (t.description ?? "").includes("Args:") || t.name.endsWith("lead_path")),
);

const list = await client.callTool({
  name: "phxplus_list_offers",
  arguments: { response_format: "json" },
});
const cat = list.structuredContent;
check("the catalogue loads", !list.isError && Array.isArray(cat?.upgrades));
check("prices are declared as cents", cat?.priceUnit === "cents");
check("there is exactly one apex upgrade", cat.upgrades.filter((u) => u.apex).length === 1);

// A bundle must beat its parts, or it is not a bundle.
for (const b of cat.bundles) {
  const quote = await client.callTool({
    name: "phxplus_quote",
    arguments: { bundle_key: b.key, response_format: "json" },
  });
  const q = quote.structuredContent;
  check(`${b.key} prices below its parts`, q.monthlyTotal < b.listPrice, `${q.monthlyTotal} vs ${b.listPrice}`);
  check(`${b.key} reports a positive saving`, q.saving > 0);
}

// An unknown key must teach the caller the valid ones, or it costs five retries.
const bad = await client.callTool({
  name: "phxplus_quote",
  arguments: { upgrade_keys: ["definitely-not-real"] },
});
check("an unknown key is an error", bad.isError === true);
check(
  "an unknown key lists the valid keys",
  cat.upgrades.every((u) => bad.content[0].text.includes(u.key)),
);

// Nothing selected is a user error, not a crash.
const empty = await client.callTool({ name: "phxplus_quote", arguments: {} });
check("an empty selection is rejected cleanly", empty.isError === true);

// The one that matters most: it must never claim delivery it cannot show.
const health = await client.callTool({ name: "phxplus_check_lead_path", arguments: {} });
const h = health.structuredContent;
check("the lead path reports a boolean verdict", typeof h?.reachingAHuman === "boolean");
check(
  "a dead channel always carries a fix",
  h.channels.every((c) => c.live || typeof c.fix === "string"),
);
check(
  "the verdict matches the channels",
  h.reachingAHuman === h.channels.some((c) => c.live),
);

await client.close();

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
