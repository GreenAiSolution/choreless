import type { LogEntry, NodeTypeSpec, Value } from "../domain/types.js";
import { nowIso } from "../util/id.js";
import { evaluate, type Scope } from "./expr.js";

/** What a node returns: a map of output-port name -> value. */
export type NodeOutput = Record<string, Value>;

/**
 * The controlled surface a node handler sees. Handlers get their resolved
 * inputs and config, a logger, and an abort signal — nothing else. They cannot
 * reach the store, other nodes, or the graph, which keeps the graph the single
 * source of truth.
 */
export interface ExecutionContext {
  /** Incoming values keyed by input port name. */
  readonly input: Record<string, Value>;
  /** Config with all `{{ expressions }}` already resolved. */
  readonly config: Record<string, Value>;
  /** Workflow variables (read-only reference). */
  readonly vars: Record<string, Value>;
  /** The triggering payload. */
  readonly trigger: Value;
  /** Aborts when the run is canceled or the node times out. */
  readonly signal: AbortSignal;
  /** Append a line to this node's run log. */
  log(level: LogEntry["level"], message: string): void;
  /** Convenience: read a config field with a fallback. */
  cfg<T = Value>(key: string, fallback?: T): T;
  /** Evaluate a raw expression against the standard scope (input/vars/trigger/nodes). */
  expr(source: string): Value;
}

export function makeContext(args: {
  input: Record<string, Value>;
  config: Record<string, Value>;
  vars: Record<string, Value>;
  trigger: Value;
  scope: Scope;
  signal: AbortSignal;
  sink: LogEntry[];
}): ExecutionContext {
  return {
    input: args.input,
    config: args.config,
    vars: args.vars,
    trigger: args.trigger,
    signal: args.signal,
    log(level, message) {
      args.sink.push({ ts: nowIso(), level, message });
    },
    cfg<T = Value>(key: string, fallback?: T): T {
      const v = args.config[key];
      return (v === undefined ? fallback : v) as T;
    },
    expr(source: string): Value {
      return evaluate(source, args.scope);
    },
  };
}

/** A registered node type: its static description plus its behavior. */
export interface NodeType {
  spec: NodeTypeSpec;
  execute(ctx: ExecutionContext): Promise<NodeOutput> | NodeOutput;
}
