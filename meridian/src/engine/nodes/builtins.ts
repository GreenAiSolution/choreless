import type { Value } from "../../domain/types.js";
import type { NodeType } from "../context.js";

/**
 * The built-in node catalog. Each entry fully describes itself (ports, config
 * fields, color) so the UI palette and config forms are generated from here —
 * never hard-coded in the frontend.
 *
 * The engine resolves `{{ expressions }}` in a node's config before calling
 * `execute`, so handlers mostly read already-resolved values via `ctx.cfg`.
 */

const CAT = {
  trigger: "Triggers",
  data: "Data",
  logic: "Logic",
  io: "Integrations",
  util: "Utility",
};

/** Entry point. Emits the trigger payload so downstream nodes can consume it. */
const trigger: NodeType = {
  spec: {
    type: "trigger",
    label: "Trigger",
    category: CAT.trigger,
    description:
      "Starts the workflow. Emits the incoming payload (manual body, webhook JSON, or schedule tick).",
    color: "#22c55e",
    inputs: [],
    outputs: [{ name: "out", description: "The trigger payload" }],
    fields: [
      {
        key: "mode",
        label: "Trigger mode",
        type: "string",
        default: "manual",
        help: "manual | webhook | schedule",
      },
      {
        key: "everyMs",
        label: "Schedule interval (ms)",
        type: "number",
        help: "Only used when mode = schedule. Minimum 1000ms.",
      },
    ],
  },
  execute(ctx) {
    return { out: ctx.trigger ?? null };
  },
};

/** A constant/seed value defined in config. Useful for testing and defaults. */
const manualInput: NodeType = {
  spec: {
    type: "manual.input",
    label: "Value",
    category: CAT.data,
    description: "Emits a constant value defined in config. Supports expressions.",
    color: "#38bdf8",
    inputs: [],
    outputs: [{ name: "out" }],
    fields: [
      {
        key: "value",
        label: "Value (JSON or expression)",
        type: "json",
        default: {},
      },
    ],
  },
  execute(ctx) {
    return { out: ctx.cfg("value", null) };
  },
};

/** Reshape data. The `output` config object is resolved with expressions. */
const transform: NodeType = {
  spec: {
    type: "transform",
    label: "Transform",
    category: CAT.data,
    description:
      "Builds a new object from expressions over the input. Each field value may use {{ input.x }}.",
    color: "#a78bfa",
    inputs: [{ name: "in" }],
    outputs: [{ name: "out" }],
    fields: [
      {
        key: "output",
        label: "Output shape (JSON with expressions)",
        type: "json",
        default: { value: "{{ input.in }}" },
      },
    ],
  },
  execute(ctx) {
    // config.output has already been deep-resolved by the engine.
    return { out: ctx.cfg("output", {}) };
  },
};

/** Branch on a boolean expression. Emits on exactly one of true/false. */
const condition: NodeType = {
  spec: {
    type: "condition",
    label: "Condition",
    category: CAT.logic,
    description:
      "Evaluates a boolean expression and routes the input to the 'true' or 'false' output.",
    color: "#f59e0b",
    inputs: [{ name: "in" }],
    outputs: [
      { name: "true", description: "Taken when the expression is truthy" },
      { name: "false", description: "Taken when the expression is falsy" },
    ],
    fields: [
      {
        key: "expression",
        label: "Boolean expression",
        type: "expression",
        required: true,
        default: "input.in == true",
        placeholder: "input.amount > 100",
        help: "Evaluated against input / vars / trigger / nodes.",
      },
    ],
  },
  execute(ctx) {
    const source = String(ctx.cfg("expression", "false"));
    const result = Boolean(ctx.expr(source));
    ctx.log("info", `condition '${source}' => ${result}`);
    const payload = ctx.input["in"] ?? ctx.trigger ?? null;
    // Emit on exactly one branch; the other is pruned downstream.
    return result ? { true: payload } : { false: payload };
  },
};

/** Render a string template. */
const template: NodeType = {
  spec: {
    type: "template",
    label: "Template",
    category: CAT.util,
    description: "Renders a text template with {{ expressions }}.",
    color: "#f472b6",
    inputs: [{ name: "in" }],
    outputs: [{ name: "out" }],
    fields: [
      {
        key: "text",
        label: "Template text",
        type: "text",
        default: "Hello, {{ input.in }}",
      },
    ],
  },
  execute(ctx) {
    return { out: ctx.cfg("text", "") };
  },
};

/** Record a message into the run log and pass the input through unchanged. */
const log: NodeType = {
  spec: {
    type: "log",
    label: "Log",
    category: CAT.util,
    description: "Writes a message to the run log; passes input through.",
    color: "#94a3b8",
    inputs: [{ name: "in" }],
    outputs: [{ name: "out" }],
    fields: [
      {
        key: "message",
        label: "Message",
        type: "string",
        default: "{{ json(input.in) }}",
      },
      {
        key: "level",
        label: "Level",
        type: "string",
        default: "info",
        help: "debug | info | warn | error",
      },
    ],
  },
  execute(ctx) {
    const level = (ctx.cfg("level", "info") as "info") ?? "info";
    ctx.log(level, String(ctx.cfg("message", "")));
    return { out: ctx.input["in"] ?? null };
  },
};

/** Wait a bounded number of milliseconds, then pass input through. */
const delay: NodeType = {
  spec: {
    type: "delay",
    label: "Delay",
    category: CAT.logic,
    description: "Waits for a bounded interval before continuing.",
    color: "#fbbf24",
    inputs: [{ name: "in" }],
    outputs: [{ name: "out" }],
    fields: [
      { key: "ms", label: "Milliseconds", type: "number", default: 500 },
    ],
  },
  async execute(ctx) {
    const ms = Math.min(Math.max(Number(ctx.cfg("ms", 0)) || 0, 0), 30_000);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      ctx.signal.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new Error("aborted"));
      });
    });
    return { out: ctx.input["in"] ?? null };
  },
};

/** Merge two inbound branches into one object. */
const merge: NodeType = {
  spec: {
    type: "merge",
    label: "Merge",
    category: CAT.logic,
    description: "Combines inputs 'a' and 'b' into a single object { a, b }.",
    color: "#2dd4bf",
    inputs: [{ name: "a" }, { name: "b" }],
    outputs: [{ name: "out" }],
    fields: [],
  },
  execute(ctx) {
    return { out: { a: ctx.input["a"] ?? null, b: ctx.input["b"] ?? null } };
  },
};

/** Compute a named value for use downstream (a labeled transform). */
const setVariable: NodeType = {
  spec: {
    type: "set.variable",
    label: "Set Value",
    category: CAT.data,
    description: "Computes a single named value from an expression.",
    color: "#818cf8",
    inputs: [{ name: "in" }],
    outputs: [{ name: "out" }],
    fields: [
      { key: "name", label: "Name", type: "string", default: "value" },
      {
        key: "value",
        label: "Value (expression)",
        type: "json",
        default: "{{ input.in }}",
      },
    ],
  },
  execute(ctx) {
    const name = String(ctx.cfg("name", "value"));
    return { out: { [name]: ctx.cfg("value", null) } };
  },
};

/** Call an external HTTP API using the platform fetch. */
const httpRequest: NodeType = {
  spec: {
    type: "http.request",
    label: "HTTP Request",
    category: CAT.io,
    description:
      "Performs a real HTTP request. Emits the response on 'out', or the error object on 'error'.",
    color: "#60a5fa",
    inputs: [{ name: "in" }],
    outputs: [
      { name: "out", description: "Successful response { status, body }" },
      { name: "error", description: "Failure { status, message }" },
    ],
    fields: [
      { key: "method", label: "Method", type: "string", default: "GET" },
      {
        key: "url",
        label: "URL",
        type: "string",
        required: true,
        placeholder: "https://api.example.com/{{ input.id }}",
      },
      { key: "headers", label: "Headers (JSON)", type: "json", default: {} },
      { key: "body", label: "Body (JSON)", type: "json" },
    ],
  },
  async execute(ctx) {
    const url = String(ctx.cfg("url", ""));
    const method = String(ctx.cfg("method", "GET")).toUpperCase();
    const headers = (ctx.cfg("headers", {}) as Record<string, string>) ?? {};
    const bodyCfg = ctx.cfg<Value>("body", undefined);
    if (!url) throw new Error("http.request requires a url");

    const init: RequestInit = { method, headers, signal: ctx.signal };
    if (bodyCfg !== undefined && method !== "GET" && method !== "HEAD") {
      init.body =
        typeof bodyCfg === "string" ? bodyCfg : JSON.stringify(bodyCfg);
      if (!("content-type" in lowerKeys(headers))) {
        (init.headers as Record<string, string>)["content-type"] =
          "application/json";
      }
    }

    ctx.log("info", `${method} ${url}`);
    try {
      const res = await fetch(url, init);
      const text = await res.text();
      let body: Value = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* leave as text */
      }
      const response = { status: res.status, ok: res.ok, body };
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
  },
};

function lowerKeys(o: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) out[k.toLowerCase()] = v;
  return out;
}

export const BUILTINS: NodeType[] = [
  trigger,
  manualInput,
  transform,
  condition,
  template,
  log,
  delay,
  merge,
  setVariable,
  httpRequest,
];
