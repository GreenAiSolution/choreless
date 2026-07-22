import { EventEmitter } from "node:events";
import type {
  LogEntry,
  Node,
  NodeRun,
  Run,
  TriggerInfo,
  Value,
  Workflow,
} from "../domain/types.js";
import { ValidationError, TimeoutError } from "../util/errors.js";
import { nowIso, shortId } from "../util/id.js";
import { buildAdjacency, topoSort } from "../util/graph.js";
import { resolveConfig, type Scope } from "./expr.js";
import { makeContext, type NodeOutput } from "./context.js";
import type { NodeRegistry } from "./registry.js";
import { hasErrors, validateWorkflow } from "./validate.js";

export interface RunOptions {
  trigger?: TriggerInfo;
  /** Called for each engine event; also emitted on the EventEmitter. */
  onEvent?: (event: RunEvent) => void;
}

export type RunEvent =
  | { type: "run:start"; run: Run }
  | { type: "node:start"; runId: string; nodeId: string }
  | { type: "node:log"; runId: string; nodeId: string; entry: LogEntry }
  | { type: "node:finish"; runId: string; nodeRun: NodeRun }
  | { type: "run:finish"; run: Run };

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 5;

/**
 * The execution engine. Runs a workflow as a dataflow graph:
 *
 *  1. Validate (reject malformed or cyclic graphs before doing anything).
 *  2. Walk nodes in topological order.
 *  3. For each node, gather inbound port values, resolve its config against a
 *     live scope, run its handler with retries/timeout, and record the result.
 *  4. Prune descendants whose inbound ports never fired (this is branching).
 *
 * The engine is an EventEmitter so runs can be observed live (the API turns
 * these events into an SSE stream).
 */
export class Engine extends EventEmitter {
  constructor(private registry: NodeRegistry) {
    super();
  }

  async run(wf: Workflow, opts: RunOptions = {}): Promise<Run> {
    const issues = validateWorkflow(wf, this.registry);
    if (hasErrors(issues)) throw new ValidationError(issues);

    const trigger: TriggerInfo = opts.trigger ?? {
      kind: "manual",
      payload: null,
    };

    const run: Run = {
      id: shortId("run"),
      workflowId: wf.id,
      status: "running",
      trigger,
      startedAt: nowIso(),
      nodeRuns: [],
    };

    const emit = (e: RunEvent) => {
      opts.onEvent?.(e);
      this.emit(e.type, e);
    };
    emit({ type: "run:start", run });

    const adj = buildAdjacency(wf);
    const { order } = topoSort(wf); // validated acyclic above
    const nodeById = new Map(wf.nodes.map((n) => [n.id, n]));

    // Per-node emitted outputs: nodeId -> { port -> value }.
    const outputs = new Map<string, NodeOutput>();
    // Node ids that were pruned (an active branch never reached them).
    const pruned = new Set<string>();
    // `nodes.<id>.<port>` scope, populated as nodes complete.
    const nodesScope: Record<string, Value> = {};

    try {
      for (const nodeId of order) {
        const node = nodeById.get(nodeId)!;
        const inboundEdges = adj.in.get(nodeId) ?? [];

        // A node is pruned if it has inbound edges but none of them carried a
        // value (either the source was pruned, or the source didn't emit that
        // port — e.g. the untaken side of a condition).
        if (inboundEdges.length > 0) {
          const anyLive = inboundEdges.some((e) => {
            if (pruned.has(e.from.node)) return false;
            const srcOut = outputs.get(e.from.node);
            return srcOut !== undefined && e.from.port in srcOut;
          });
          if (!anyLive) {
            pruned.add(nodeId);
            run.nodeRuns.push(skippedRun(node));
            continue;
          }
        }

        // Gather inbound port values.
        const input: Record<string, Value> = {};
        for (const e of inboundEdges) {
          const srcOut = outputs.get(e.from.node);
          if (srcOut && e.from.port in srcOut) {
            input[e.to.port] = srcOut[e.from.port];
          }
        }

        const scope: Scope = {
          input,
          vars: wf.variables,
          trigger: trigger.payload,
          nodes: nodesScope,
        };

        const nodeRun = await this.executeNode(node, input, scope, run.id, emit);
        run.nodeRuns.push(nodeRun);

        if (nodeRun.status === "failed") {
          if ((node.onError ?? "stop") === "stop") {
            run.status = "failed";
            run.error = `Node '${node.name || node.id}' failed: ${nodeRun.error}`;
            run.finishedAt = nowIso();
            emit({ type: "run:finish", run });
            return run;
          }
          // onError=continue: treat as pruned so descendants are skipped.
          pruned.add(nodeId);
          continue;
        }

        outputs.set(nodeId, nodeRun.output ?? {});
        nodesScope[nodeId] = nodeRun.output ?? {};
      }

      run.status = "succeeded";
      run.output = collectTerminalOutputs(wf, outputs);
      run.finishedAt = nowIso();
      emit({ type: "run:finish", run });
      return run;
    } catch (err) {
      run.status = "failed";
      run.error = err instanceof Error ? err.message : String(err);
      run.finishedAt = nowIso();
      emit({ type: "run:finish", run });
      return run;
    }
  }

  private async executeNode(
    node: Node,
    input: Record<string, Value>,
    scope: Scope,
    runId: string,
    emit: (e: RunEvent) => void,
  ): Promise<NodeRun> {
    const type = this.registry.get(node.type)!; // existence checked in validation
    const logs: LogEntry[] = [];
    const nodeRun: NodeRun = {
      nodeId: node.id,
      type: node.type,
      name: node.name || node.id,
      status: "running",
      attempts: 0,
      startedAt: nowIso(),
      input,
      logs,
    };
    emit({ type: "node:start", runId, nodeId: node.id });

    const retries = clamp(node.retries ?? 0, 0, MAX_RETRIES);
    const timeoutMs = node.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // Resolve config templates against the live scope once per attempt is not
    // necessary — scope is stable for this node — so resolve up front.
    let resolvedConfig: Record<string, Value>;
    try {
      resolvedConfig = resolveConfig(node.config, scope) as Record<string, Value>;
    } catch (err) {
      nodeRun.status = "failed";
      nodeRun.error = `config error: ${errMsg(err)}`;
      nodeRun.finishedAt = nowIso();
      emit({ type: "node:finish", runId, nodeRun });
      return nodeRun;
    }

    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      nodeRun.attempts = attempt + 1;
      const beforeLen = logs.length;
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new TimeoutError(timeoutMs)),
        timeoutMs,
      );
      try {
        const ctx = makeContext({
          input,
          config: resolvedConfig,
          vars: (scope["vars"] as Record<string, Value>) ?? {},
          trigger: scope["trigger"],
          scope,
          signal: controller.signal,
          sink: logs,
        });
        const output = await Promise.resolve(type.execute(ctx));
        clearTimeout(timer);
        // Stream any logs produced this attempt.
        for (let i = beforeLen; i < logs.length; i++) {
          emit({ type: "node:log", runId, nodeId: node.id, entry: logs[i]! });
        }
        nodeRun.status = "succeeded";
        nodeRun.output = output;
        nodeRun.finishedAt = nowIso();
        emit({ type: "node:finish", runId, nodeRun });
        return nodeRun;
      } catch (err) {
        clearTimeout(timer);
        lastErr = controller.signal.aborted ? controller.signal.reason : err;
        for (let i = beforeLen; i < logs.length; i++) {
          emit({ type: "node:log", runId, nodeId: node.id, entry: logs[i]! });
        }
        logs.push({
          ts: nowIso(),
          level: "warn",
          message: `attempt ${attempt + 1} failed: ${errMsg(lastErr)}`,
        });
        if (attempt < retries) {
          await backoff(attempt, controller.signal);
        }
      }
    }

    nodeRun.status = "failed";
    nodeRun.error = errMsg(lastErr);
    nodeRun.finishedAt = nowIso();
    emit({ type: "node:finish", runId, nodeRun });
    return nodeRun;
  }
}

function skippedRun(node: Node): NodeRun {
  return {
    nodeId: node.id,
    type: node.type,
    name: node.name || node.id,
    status: "skipped",
    attempts: 0,
    logs: [],
  };
}

/** Outputs of nodes that have no outgoing edges — the workflow's results. */
function collectTerminalOutputs(
  wf: Workflow,
  outputs: Map<string, NodeOutput>,
): Record<string, Value> {
  const hasOutbound = new Set(wf.edges.map((e) => e.from.node));
  const result: Record<string, Value> = {};
  for (const n of wf.nodes) {
    if (!hasOutbound.has(n.id) && outputs.has(n.id)) {
      result[n.id] = outputs.get(n.id)!;
    }
  }
  return result;
}

function backoff(attempt: number, signal: AbortSignal): Promise<void> {
  const ms = Math.min(100 * 2 ** attempt, 5_000);
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
