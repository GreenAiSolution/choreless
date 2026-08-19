import type { Workflow } from "../domain/types.js";
import type { NodeRegistry } from "./registry.js";
import type { ValidationIssue } from "../util/errors.js";
import { topoSort } from "../util/graph.js";

/**
 * Static validation of a workflow against the node registry. This runs before
 * any execution and before persistence, so a malformed map can never start a
 * run. Returns a full issue list (errors + warnings) rather than throwing, so
 * the UI can show everything at once.
 */
export function validateWorkflow(
  wf: Workflow,
  registry: NodeRegistry,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeById = new Map(wf.nodes.map((n) => [n.id, n]));

  // Duplicate node ids.
  const seen = new Set<string>();
  for (const n of wf.nodes) {
    if (seen.has(n.id)) {
      issues.push({
        level: "error",
        code: "DUP_NODE_ID",
        message: `Duplicate node id '${n.id}'`,
        nodeId: n.id,
      });
    }
    seen.add(n.id);
  }

  // Node types + port existence.
  for (const n of wf.nodes) {
    const type = registry.get(n.type);
    if (!type) {
      issues.push({
        level: "error",
        code: "UNKNOWN_TYPE",
        message: `Unknown node type '${n.type}'`,
        nodeId: n.id,
      });
      continue;
    }
    for (const f of type.spec.fields) {
      if (
        f.required &&
        (n.config[f.key] === undefined ||
          n.config[f.key] === null ||
          n.config[f.key] === "")
      ) {
        issues.push({
          level: "error",
          code: "MISSING_CONFIG",
          message: `Node '${n.name || n.id}' is missing required field '${f.key}'`,
          nodeId: n.id,
        });
      }
    }
  }

  // Edge integrity.
  for (const e of wf.edges) {
    const from = nodeById.get(e.from.node);
    const to = nodeById.get(e.to.node);
    if (!from) {
      issues.push({
        level: "error",
        code: "EDGE_BAD_SOURCE",
        message: `Edge '${e.id}' references missing source node '${e.from.node}'`,
        edgeId: e.id,
      });
    } else {
      const t = registry.get(from.type);
      if (t && !t.spec.outputs.some((p) => p.name === e.from.port)) {
        issues.push({
          level: "error",
          code: "EDGE_BAD_SOURCE_PORT",
          message: `Node '${from.name || from.id}' has no output port '${e.from.port}'`,
          edgeId: e.id,
          nodeId: from.id,
        });
      }
    }
    if (!to) {
      issues.push({
        level: "error",
        code: "EDGE_BAD_TARGET",
        message: `Edge '${e.id}' references missing target node '${e.to.node}'`,
        edgeId: e.id,
      });
    } else {
      const t = registry.get(to.type);
      if (t && !t.spec.inputs.some((p) => p.name === e.to.port)) {
        issues.push({
          level: "error",
          code: "EDGE_BAD_TARGET_PORT",
          message: `Node '${to.name || to.id}' has no input port '${e.to.port}'`,
          edgeId: e.id,
          nodeId: to.id,
        });
      }
    }
  }

  // Acyclicity.
  const topo = topoSort(wf);
  if (topo.cycle.length > 0) {
    issues.push({
      level: "error",
      code: "CYCLE",
      message: `Workflow contains a cycle involving: ${topo.cycle.join(", ")}`,
    });
  }

  // Warnings: unreachable nodes with no inbound edge that are not entry points.
  const hasInbound = new Set(wf.edges.map((e) => e.to.node));
  for (const n of wf.nodes) {
    const t = registry.get(n.type);
    const isEntry = t ? t.spec.inputs.length === 0 : false;
    if (!isEntry && !hasInbound.has(n.id)) {
      issues.push({
        level: "warning",
        code: "ORPHAN",
        message: `Node '${n.name || n.id}' has no incoming connection and will not run.`,
        nodeId: n.id,
      });
    }
  }

  return issues;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}
