#!/usr/bin/env node
/**
 * MCP server for PHX/GROWTH PLUS.
 *
 * PHX/GROWTH PLUS is the upgrade counter for the agency phxgrowth.com — a
 * single page of specialised add-ons that bolt onto services a client already
 * buys. This server exists so the two things you need away from a laptop are
 * one question away:
 *
 *   1. What does X cost, and what is in it?  (quoting from a phone)
 *   2. Is the enquiry form actually reaching anybody right now?
 *
 * The second one is not hypothetical. The site once told every visitor
 * "cleared for pre-flight" while the enquiry evaporated into a log line,
 * because the production environment stored the mail key under a different
 * name than the code read. Nothing threw. Nobody found out for days. That is
 * why `phxplus_check_lead_path` exists and why it reports bluntly.
 *
 * Everything is read-only. Nothing here can change the site, take a payment,
 * or contact a client.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  SITE_URL,
  SiteError,
  getCatalogue,
  getHealth,
  money,
  priceLine,
  findUpgrade,
  findBundle,
  keyList,
} from "./site.js";
import type { Catalogue } from "./types.js";

const CHARACTER_LIMIT = 25_000;

enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

const FormatField = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for reading aloud, 'json' for machine use");

type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/** One place where a site failure becomes an actionable message. */
function failed(err: unknown): ToolResult {
  const message =
    err instanceof SiteError
      ? `Error: ${err.message}`
      : `Error: unexpected failure: ${err instanceof Error ? err.message : String(err)}`;
  return { content: [{ type: "text", text: message }], isError: true };
}

function ok(text: string, structured?: Record<string, unknown>): ToolResult {
  const body =
    text.length > CHARACTER_LIMIT
      ? `${text.slice(0, CHARACTER_LIMIT)}\n\n[Truncated. Ask for a narrower slice — filter by service, or request a single upgrade by key.]`
      : text;
  return {
    content: [{ type: "text", text: body }],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

const server = new McpServer({ name: "phxgrowth-plus-mcp-server", version: "1.0.0" });

// ---------------------------------------------------------------------------

const ListInput = z
  .object({
    attaches_to: z
      .enum(["premium-ai-ads", "ai-employees", "website-creation"])
      .optional()
      .describe("Only upgrades that bolt onto this PHX/GROWTH service"),
    include_bundles: z
      .boolean()
      .default(true)
      .describe("Include the deluxe bundles alongside the individual upgrades"),
    response_format: FormatField,
  })
  .strict();

server.registerTool(
  "phxplus_list_offers",
  {
    title: "List PHX/GROWTH PLUS offers",
    description: `List everything PHX/GROWTH PLUS sells — the individual upgrades and the deluxe bundles — with live prices read from the site.

Read this before quoting anything. Prices, names and contents come from the running site, not from memory, and they change on deploy.

Args:
  - attaches_to ('premium-ai-ads' | 'ai-employees' | 'website-creation'): optional filter to one parent service
  - include_bundles (boolean): include deluxe bundles (default: true)
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (JSON format):
  {
    "currency": "USD",
    "priceUnit": "cents",              // every price below is in CENTS
    "entryPrice": number,              // cheapest way in
    "upgrades": [{ "key", "name", "attachesTo", "promise", "fixes",
                   "delivers": string[], "price", "billing", "leading", "apex" }],
    "bundles":  [{ "key", "name", "members": string[], "promise",
                   "price", "listPrice", "saving", "apex" }]
  }

Examples:
  - "What can I add to my AI Employees?" -> attaches_to='ai-employees'
  - "What's the most expensive thing you sell?" -> list all, look for apex=true
  - Don't use when: you want a total for a specific shortlist (use phxplus_quote)

Note on truthfulness: this catalogue makes no outcome claims and cites no
statistics, deliberately. Do not add any when relaying it.`,
    inputSchema: ListInput.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params): Promise<ToolResult> => {
    try {
      const c: Catalogue = await getCatalogue();
      const upgrades = params.attaches_to
        ? c.upgrades.filter((u) => u.attachesTo === params.attaches_to)
        : c.upgrades;

      if (upgrades.length === 0) {
        return ok(
          `No upgrades attach to '${params.attaches_to}'. Services on offer: ${keyList(c.services)}.`,
        );
      }

      const bundles = params.include_bundles ? c.bundles : [];
      const structured = {
        currency: c.currency,
        priceUnit: c.priceUnit,
        entryPrice: c.entryPrice,
        upgrades,
        bundles,
      };

      if (params.response_format === ResponseFormat.JSON) {
        return ok(JSON.stringify(structured, null, 2), structured);
      }

      const lines: string[] = [`# ${c.brand.name}`, "", c.thesis, ""];
      for (const s of c.services) {
        const mine = upgrades.filter((u) => u.attachesTo === s.key);
        if (mine.length === 0) continue;
        lines.push(`## On ${s.name} (${s.priceLabel})`, "");
        for (const u of mine) {
          const tags = [u.leading ? "most taken" : "", u.apex ? "apex" : ""]
            .filter(Boolean)
            .join(", ");
          lines.push(`### ${u.name} — ${priceLine(u)}${tags ? ` _(${tags})_` : ""}`);
          lines.push(`- Fixes: ${u.fixes}`);
          lines.push(`- ${u.promise}`);
          lines.push(`- Delivers: ${u.delivers.join("; ")}`);
          lines.push("");
        }
      }
      if (bundles.length) {
        lines.push("## Deluxe bundles", "");
        for (const b of bundles) {
          const names = b.members.map((k) => findUpgrade(c, k)?.name ?? k);
          lines.push(`### ${b.name} — ${money(b.price)}/mo${b.apex ? " _(apex)_" : ""}`);
          lines.push(`- ${b.promise}`);
          lines.push(`- Includes: ${names.join(", ")}`);
          lines.push(
            `- List price ${money(b.listPrice)}/mo, so it saves ${money(b.saving)}/mo`,
          );
          lines.push("");
        }
      }
      lines.push(`Entry price: ${money(c.entryPrice)}.`);
      return ok(lines.join("\n"), structured);
    } catch (err) {
      return failed(err);
    }
  },
);

// ---------------------------------------------------------------------------

const QuoteInput = z
  .object({
    upgrade_keys: z
      .array(z.string().min(1))
      .max(20)
      .default([])
      .describe("Upgrade keys to total, e.g. ['voice-employee', 'tuning-lab']"),
    bundle_key: z
      .string()
      .min(1)
      .optional()
      .describe("A bundle key. If given it wins outright and upgrade_keys are ignored."),
    response_format: FormatField,
  })
  .strict()
  .refine((v) => v.bundle_key !== undefined || v.upgrade_keys.length > 0, {
    message: "Give at least one upgrade_key, or a bundle_key.",
  });

server.registerTool(
  "phxplus_quote",
  {
    title: "Quote a PHX/GROWTH PLUS selection",
    description: `Total a shortlist of upgrades, or price a bundle, using live catalogue figures.

Use this rather than adding prices up yourself. It applies the same two rules
the site's own checkout applies:
  - A bundle wins outright. Its members are implied, and pricing it as the sum
    of its parts would quote a number HIGHER than the page advertises.
  - Monthly and one-time are totalled separately and never combined.

Args:
  - upgrade_keys (string[]): keys to total (ignored when bundle_key is given)
  - bundle_key (string): a bundle key
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (JSON format):
  {
    "kind": "bundle" | "selection",
    "priceUnit": "cents",
    "items": [{ "key", "name", "price", "billing" }],
    "monthlyTotal": number,
    "oneTimeTotal": number,
    "saving": number | null      // bundles only: vs buying the parts
  }

Examples:
  - "What's the Answer Stack?" -> bundle_key='answer-stack'
  - "Voice Employee plus the Tuning Lab, how much?" -> upgrade_keys=[both]

Error handling:
  - An unknown key returns the full list of valid keys, so a retry succeeds.

This is a quote, not an order. It cannot charge anyone or place anything.`,
    inputSchema: QuoteInput._def.schema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (raw): Promise<ToolResult> => {
    try {
      const parsed = QuoteInput.safeParse(raw);
      if (!parsed.success) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
            },
          ],
          isError: true,
        };
      }
      const params = parsed.data;
      const c = await getCatalogue();

      if (params.bundle_key) {
        const b = findBundle(c, params.bundle_key);
        if (!b) {
          return {
            content: [
              {
                type: "text",
                text: `Error: no bundle named '${params.bundle_key}'. Valid bundles: ${keyList(c.bundles)}.`,
              },
            ],
            isError: true,
          };
        }
        const members = b.members.map((k) => findUpgrade(c, k)).filter((u) => u !== undefined);
        const structured = {
          kind: "bundle" as const,
          priceUnit: c.priceUnit,
          items: members.map((u) => ({
            key: u.key,
            name: u.name,
            price: u.price,
            billing: u.billing,
          })),
          monthlyTotal: b.price,
          oneTimeTotal: 0,
          saving: b.saving,
        };
        if (params.response_format === ResponseFormat.JSON) {
          return ok(JSON.stringify(structured, null, 2), structured);
        }
        return ok(
          [
            `**${b.name}** — ${money(b.price)}/mo`,
            "",
            b.promise,
            "",
            ...members.map((u) => `- ${u.name} (${priceLine(u)} alone)`),
            "",
            `Bought separately that is ${money(b.listPrice)}/mo, so the bundle saves ${money(b.saving)}/mo.`,
            "",
            b.rationale,
          ].join("\n"),
          structured,
        );
      }

      // De-duplicate, exactly as the site's endpoint does.
      const wanted = [...new Set(params.upgrade_keys)];
      const unknown = wanted.filter((k) => !findUpgrade(c, k));
      if (unknown.length) {
        return {
          content: [
            {
              type: "text",
              text: `Error: unknown upgrade key(s): ${unknown.join(", ")}. Valid upgrades: ${keyList(c.upgrades)}.`,
            },
          ],
          isError: true,
        };
      }

      const items = wanted.map((k) => findUpgrade(c, k)!);
      const monthlyTotal = items
        .filter((u) => u.billing === "monthly")
        .reduce((n, u) => n + u.price, 0);
      const oneTimeTotal = items
        .filter((u) => u.billing === "one_time")
        .reduce((n, u) => n + u.price, 0);

      // If this exact set is a bundle, say so — quoting à la carte when a
      // cheaper bundle covers it is overcharging by omission.
      const asBundle = c.bundles.find(
        (b) =>
          b.members.length === items.length && b.members.every((k) => wanted.includes(k)),
      );

      const structured = {
        kind: "selection" as const,
        priceUnit: c.priceUnit,
        items: items.map((u) => ({
          key: u.key,
          name: u.name,
          price: u.price,
          billing: u.billing,
        })),
        monthlyTotal,
        oneTimeTotal,
        saving: null,
        ...(asBundle ? { cheaperAsBundle: { key: asBundle.key, price: asBundle.price } } : {}),
      };

      if (params.response_format === ResponseFormat.JSON) {
        return ok(JSON.stringify(structured, null, 2), structured);
      }

      const lines = items.map((u) => `- ${u.name} — ${priceLine(u)}`);
      if (monthlyTotal > 0) lines.push("", `**Monthly: ${money(monthlyTotal)}**`);
      if (oneTimeTotal > 0) lines.push(`**One-time: ${money(oneTimeTotal)}**`);
      if (asBundle) {
        lines.push(
          "",
          `Those exact ${items.length} are the **${asBundle.name}** bundle at ${money(asBundle.price)}/mo — ${money(asBundle.saving)}/mo cheaper. Quote the bundle.`,
        );
      }
      return ok(lines.join("\n"), structured);
    } catch (err) {
      return failed(err);
    }
  },
);

// ---------------------------------------------------------------------------

server.registerTool(
  "phxplus_check_lead_path",
  {
    title: "Check whether enquiries are reaching a human",
    description: `Ask the live site whether an enquiry submitted right now would actually reach anybody.

Use this before pointing anyone at the site, after any deploy, and any time
somebody says "I filled the form in and never heard back".

This exists because the site once reported success to every visitor while
silently dropping every enquiry — the production environment stored the mail
key under a different name than the code read, so "nothing configured" looked
exactly like "working". This tool asks the question that distinguishes them,
and names which environment variable actually supplied each value.

Args: none.

Returns:
  {
    "reachingAHuman": boolean,   // the one thing that matters
    "status": "ok" | "degraded",
    "channels": [{ "name", "live", "configuredAs"?, "fix"? }],
    "siteUrl": string,           // what the site believes its own address is
    "knowsItsOwnAddress": boolean,
    "checkedAt": string
  }

If reachingAHuman is false, relay the per-channel 'fix' text verbatim — it
names the exact variable to set. Do not soften it. A degraded lead path is an
outage even when the homepage looks perfect.`,
    inputSchema: z.object({}).strict().shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async (): Promise<ToolResult> => {
    try {
      const h = await getHealth();
      const structured = {
        reachingAHuman: h.enquiriesReachAHuman,
        status: h.status,
        channels: h.channels,
        siteUrl: h.siteUrl,
        knowsItsOwnAddress: h.knowsItsOwnAddress,
        checkedAt: h.checkedAt,
      };

      const lines = h.enquiriesReachAHuman
        ? [`✅ Enquiries are reaching a human. Checked ${h.checkedAt}.`, ""]
        : [
            `🚨 **Enquiries are NOT reaching anybody.** Anyone filling in the form right now is being lost.`,
            "",
          ];

      for (const c of h.channels) {
        lines.push(
          c.live
            ? `- ${c.name}: live (configured as \`${c.configuredAs}\`)`
            : `- ${c.name}: DOWN — ${c.fix ?? "no fix reported"}`,
        );
      }
      if (!h.knowsItsOwnAddress) {
        lines.push(
          "",
          `⚠️ The site does not know its own public address (currently \`${h.siteUrl}\`), so sitemap, canonical tags and share previews are wrong.`,
        );
      }
      lines.push("", `Checked against ${SITE_URL}.`);
      return ok(lines.join("\n"), structured);
    } catch (err) {
      return failed(err);
    }
  },
);

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr: stdout is the protocol channel and must carry nothing else.
  console.error(`phxgrowth-plus-mcp-server running against ${SITE_URL}`);
}

main().catch((error: unknown) => {
  console.error("Server error:", error);
  process.exit(1);
});
