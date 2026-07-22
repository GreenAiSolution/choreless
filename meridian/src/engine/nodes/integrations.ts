import type { Value } from "../../domain/types.js";
import type { ExecutionContext, NodeType } from "../context.js";

/**
 * Integration nodes — the ones that *act on the world*. Each performs a real
 * network call via the built-in `fetch` (no dependencies), exposes an `out`
 * port for success and an `error` port for failure so flows can branch on
 * outcome, and reads secrets from config first, then the environment, so an
 * agent never has to embed credentials in a workflow it authors.
 */

const CAT = { io: "Integrations", ai: "AI" };

/** Resolve a secret: explicit config value wins, else the named env var. */
function secret(ctx: ExecutionContext, key: string, envVar: string): string {
  const fromCfg = ctx.cfg<string | undefined>(key, undefined);
  return (fromCfg && String(fromCfg)) || process.env[envVar] || "";
}

/** Generic outbound webhook: POST a JSON payload to any URL. */
const webhookSend: NodeType = {
  spec: {
    type: "webhook.send",
    label: "Send Webhook",
    category: CAT.io,
    description:
      "POSTs a JSON payload to any URL. Emits the response on 'out', or the failure on 'error'.",
    color: "#38bdf8",
    inputs: [{ name: "in" }],
    outputs: [{ name: "out" }, { name: "error" }],
    fields: [
      { key: "url", label: "URL", type: "string", required: true, placeholder: "https://hooks.example.com/..." },
      { key: "payload", label: "JSON payload", type: "json", default: { message: "{{ input.in }}" } },
      { key: "headers", label: "Headers (JSON)", type: "json", default: {} },
    ],
  },
  async execute(ctx) {
    const url = String(ctx.cfg("url", ""));
    if (!url) throw new Error("webhook.send requires a url");
    const headers = {
      "content-type": "application/json",
      ...((ctx.cfg("headers", {}) as Record<string, string>) ?? {}),
    };
    return postJson(ctx, url, headers, ctx.cfg<Value>("payload", {}));
  },
};

/** Post a message to a Slack Incoming Webhook. */
const slackMessage: NodeType = {
  spec: {
    type: "slack.message",
    label: "Slack Message",
    category: CAT.io,
    description:
      "Posts a message to a Slack Incoming Webhook URL. Set the webhook in config or via SLACK_WEBHOOK_URL.",
    color: "#4a154b",
    inputs: [{ name: "in" }],
    outputs: [{ name: "out" }, { name: "error" }],
    fields: [
      { key: "webhookUrl", label: "Webhook URL", type: "string", placeholder: "https://hooks.slack.com/services/...", help: "Falls back to SLACK_WEBHOOK_URL." },
      { key: "text", label: "Message text", type: "text", required: true, default: "{{ input.in }}" },
    ],
  },
  async execute(ctx) {
    const url = secret(ctx, "webhookUrl", "SLACK_WEBHOOK_URL");
    if (!url) {
      ctx.log("error", "no Slack webhook configured");
      return { error: { message: "Set a Slack Incoming Webhook URL in config or SLACK_WEBHOOK_URL." } };
    }
    return postJson(ctx, url, { "content-type": "application/json" }, {
      text: String(ctx.cfg("text", "")),
    });
  },
};

/** Send email via the Resend API (https://resend.com). */
const emailSend: NodeType = {
  spec: {
    type: "email.send",
    label: "Send Email",
    category: CAT.io,
    description:
      "Sends an email via the Resend API. Set the API key in config or via RESEND_API_KEY.",
    color: "#f97316",
    inputs: [{ name: "in" }],
    outputs: [{ name: "out" }, { name: "error" }],
    fields: [
      { key: "apiKey", label: "Resend API key", type: "string", help: "Falls back to RESEND_API_KEY." },
      { key: "from", label: "From", type: "string", required: true, placeholder: "you@yourdomain.com" },
      { key: "to", label: "To", type: "string", required: true, placeholder: "someone@example.com" },
      { key: "subject", label: "Subject", type: "string", required: true },
      { key: "html", label: "HTML body", type: "text", default: "<p>{{ input.in }}</p>" },
    ],
  },
  async execute(ctx) {
    const apiKey = secret(ctx, "apiKey", "RESEND_API_KEY");
    if (!apiKey) {
      ctx.log("error", "no Resend API key configured");
      return { error: { message: "Set a Resend API key in config or RESEND_API_KEY." } };
    }
    const to = String(ctx.cfg("to", ""));
    return postJson(
      ctx,
      "https://api.resend.com/emails",
      { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      {
        from: String(ctx.cfg("from", "")),
        to: to.includes(",") ? to.split(",").map((s) => s.trim()) : to,
        subject: String(ctx.cfg("subject", "")),
        html: String(ctx.cfg("html", "")),
      },
    );
  },
};

/** Call an LLM (Anthropic Messages API) — puts AI in the automation loop. */
const llmComplete: NodeType = {
  spec: {
    type: "llm.complete",
    label: "LLM Complete",
    category: CAT.ai,
    description:
      "Calls an Anthropic model with a prompt and returns the text. Set the key in config or via ANTHROPIC_API_KEY. Use it to classify, extract, summarize, or draft inside a workflow.",
    color: "#d97757",
    inputs: [{ name: "in" }],
    outputs: [
      { name: "out", description: "{ text, model }" },
      { name: "error" },
    ],
    fields: [
      { key: "apiKey", label: "Anthropic API key", type: "string", help: "Falls back to ANTHROPIC_API_KEY." },
      { key: "model", label: "Model", type: "string", default: "claude-haiku-4-5-20251001" },
      { key: "system", label: "System prompt", type: "text", default: "" },
      { key: "prompt", label: "Prompt", type: "text", required: true, default: "{{ input.in }}" },
      { key: "maxTokens", label: "Max tokens", type: "number", default: 1024 },
    ],
  },
  async execute(ctx) {
    const apiKey = secret(ctx, "apiKey", "ANTHROPIC_API_KEY");
    if (!apiKey) {
      ctx.log("error", "no Anthropic API key configured");
      return { error: { message: "Set an Anthropic API key in config or ANTHROPIC_API_KEY." } };
    }
    const model = String(ctx.cfg("model", "claude-haiku-4-5-20251001"));
    const system = String(ctx.cfg("system", ""));
    const prompt = String(ctx.cfg("prompt", ""));
    const maxTokens = Math.max(1, Number(ctx.cfg("maxTokens", 1024)) || 1024);

    ctx.log("info", `llm.complete → ${model}`);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          ...(system ? { system } : {}),
          messages: [{ role: "user", content: prompt }],
        }),
        signal: ctx.signal,
      });
      const data = (await res.json()) as {
        content?: { text?: string }[];
        error?: { message?: string };
      };
      if (!res.ok) {
        const message = data.error?.message ?? `HTTP ${res.status}`;
        ctx.log("error", `llm error: ${message}`);
        return { error: { status: res.status, message } };
      }
      const text = (data.content ?? []).map((c) => c.text ?? "").join("");
      return { out: { text, model } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.log("error", `llm request failed: ${message}`);
      return { error: { message } };
    }
  },
};

/** Shared POST-JSON helper: returns { out } on 2xx, { error } otherwise. */
async function postJson(
  ctx: ExecutionContext,
  url: string,
  headers: Record<string, string>,
  body: Value,
) {
  ctx.log("info", `POST ${url}`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
      signal: ctx.signal,
    });
    const text = await res.text();
    let parsed: Value = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep as text */
    }
    const response = { status: res.status, ok: res.ok, body: parsed };
    if (!res.ok) {
      ctx.log("warn", `response ${res.status}`);
      return { error: response };
    }
    return { out: response };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.log("error", `request failed: ${message}`);
    return { error: { status: 0, message } };
  }
}

export const INTEGRATIONS: NodeType[] = [
  webhookSend,
  slackMessage,
  emailSend,
  llmComplete,
];
