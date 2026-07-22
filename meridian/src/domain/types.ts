/**
 * Core domain types for Meridian.
 *
 * A Workflow is pure data: a directed graph of typed nodes and the edges that
 * carry data between them. The engine gives the graph behavior.
 */

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

/** A value flowing through the graph. Kept as `unknown` at boundaries. */
export type Value = unknown;

export interface Position {
  x: number;
  y: number;
}

/** An endpoint of an edge: a specific port on a specific node. */
export interface Port {
  node: string;
  port: string;
}

export interface Edge {
  id: string;
  from: Port;
  to: Port;
}

export interface Node {
  id: string;
  type: string;
  name: string;
  config: Record<string, Value>;
  position: Position;
  /** Optional per-node reliability overrides. */
  retries?: number;
  timeoutMs?: number;
  onError?: "stop" | "continue";
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  variables: Record<string, Value>;
  createdAt: string;
  updatedAt: string;
}

export type RunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export type NodeRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

export interface LogEntry {
  ts: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
}

export interface NodeRun {
  nodeId: string;
  type: string;
  name: string;
  status: NodeRunStatus;
  attempts: number;
  startedAt?: string;
  finishedAt?: string;
  input?: Record<string, Value>;
  /** Map of output port -> value emitted by the node. */
  output?: Record<string, Value>;
  logs: LogEntry[];
  error?: string;
}

export interface TriggerInfo {
  kind: "manual" | "webhook" | "schedule";
  payload: Value;
}

export interface Run {
  id: string;
  workflowId: string;
  status: RunStatus;
  trigger: TriggerInfo;
  startedAt: string;
  finishedAt?: string;
  nodeRuns: NodeRun[];
  output?: Record<string, Value>;
  error?: string;
}

/** Describes a port for the UI palette and validation. */
export interface PortSpec {
  name: string;
  description?: string;
}

/** A config field descriptor, used to render forms in the UI. */
export interface ConfigField {
  key: string;
  label: string;
  type: "string" | "text" | "number" | "boolean" | "json" | "expression";
  required?: boolean;
  default?: Value;
  placeholder?: string;
  help?: string;
}

/** Static description of a node type, exposed via the API for the palette. */
export interface NodeTypeSpec {
  type: string;
  label: string;
  category: string;
  description: string;
  color: string;
  inputs: PortSpec[];
  outputs: PortSpec[];
  fields: ConfigField[];
}
