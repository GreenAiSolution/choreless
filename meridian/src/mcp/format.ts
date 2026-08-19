import type { Run, Workflow } from "../domain/types.js";
import type { ValidationIssue } from "../util/errors.js";

/** Maximum response size before we truncate list payloads. */
export const CHARACTER_LIMIT = 25_000;

export type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/** A successful tool result carrying both text and structured data. */
export function ok(
  structured: Record<string, unknown>,
  text?: string,
): ToolResult {
  return {
    content: [{ type: "text", text: text ?? JSON.stringify(structured, null, 2) }],
    structuredContent: structured,
  };
}

/** An error result with an actionable message. */
export function fail(message: string, extra?: Record<string, unknown>): ToolResult {
  const structured = { error: message, ...(extra ?? {}) };
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    structuredContent: structured,
    isError: true,
  };
}

/**
 * Turn any thrown error into an actionable tool result. Recognizes the domain
 * error types so the agent gets specific guidance (and validation issues).
 */
export function fromError(err: unknown): ToolResult {
  const name = (err as Error)?.name;
  const message = err instanceof Error ? err.message : String(err);
  if (name === "NotFoundError") {
    return fail(
      `${message}. List available workflows with meridian_list_workflows, or create one with meridian_create_workflow.`,
    );
  }
  if (name === "ValidationError") {
    const issues = ((err as { issues?: ValidationIssue[] }).issues ?? []).filter(
      (i) => i.level === "error",
    );
    return fail(
      `Workflow is invalid and cannot run. Fix these issues, then retry: ${issues
        .map((i) => `[${i.code}] ${i.message}`)
        .join("; ")}`,
      { issues },
    );
  }
  return fail(message);
}

/** Compact projection of a workflow for list views. */
export function workflowSummary(wf: Workflow) {
  return {
    id: wf.id,
    name: wf.name,
    description: wf.description,
    nodeCount: wf.nodes.length,
    edgeCount: wf.edges.length,
    updatedAt: wf.updatedAt,
  };
}

/** Compact projection of a run. */
export function runSummary(run: Run) {
  return {
    id: run.id,
    workflowId: run.workflowId,
    status: run.status,
    trigger: run.trigger.kind,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    nodeResults: run.nodeRuns.map((n) => ({
      nodeId: n.nodeId,
      name: n.name,
      status: n.status,
      attempts: n.attempts,
      ...(n.error ? { error: n.error } : {}),
    })),
    ...(run.error ? { error: run.error } : {}),
  };
}

/** Enforce the response character budget by halving list items if needed. */
export function withBudget<T>(
  items: T[],
  build: (items: T[], truncated: boolean) => Record<string, unknown>,
): ToolResult {
  let current = items;
  let truncated = false;
  let payload = build(current, truncated);
  while (
    JSON.stringify(payload).length > CHARACTER_LIMIT &&
    current.length > 1
  ) {
    current = current.slice(0, Math.max(1, Math.floor(current.length / 2)));
    truncated = true;
    payload = build(current, truncated);
  }
  return ok(payload);
}

/** Render the node-type catalog as readable markdown. */
export function catalogMarkdown(catalog: import("../domain/types.js").NodeTypeSpec[]): string {
  const byCat = new Map<string, typeof catalog>();
  for (const t of catalog) {
    const arr = byCat.get(t.category) ?? [];
    arr.push(t);
    byCat.set(t.category, arr);
  }
  const lines = ["# Meridian node types", ""];
  for (const [cat, types] of byCat) {
    lines.push(`## ${cat}`);
    for (const t of types) {
      const ins = t.inputs.map((p) => p.name).join(", ") || "—";
      const outs = t.outputs.map((p) => p.name).join(", ") || "—";
      lines.push(`- **${t.type}** (${t.label}): ${t.description}`);
      lines.push(`  - inputs: ${ins} → outputs: ${outs}`);
      if (t.fields.length) {
        lines.push(
          `  - config: ${t.fields
            .map((f) => `${f.key}${f.required ? "*" : ""}:${f.type}`)
            .join(", ")}`,
        );
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}
