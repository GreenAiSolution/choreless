import type { Workflow, Edge } from "../domain/types.js";

/**
 * Graph algorithms over a workflow. Pure functions, no engine state — kept
 * separate so they are trivially testable.
 */

export interface Adjacency {
  /** nodeId -> outgoing edges */
  out: Map<string, Edge[]>;
  /** nodeId -> incoming edges */
  in: Map<string, Edge[]>;
}

export function buildAdjacency(wf: Workflow): Adjacency {
  const out = new Map<string, Edge[]>();
  const inc = new Map<string, Edge[]>();
  for (const n of wf.nodes) {
    out.set(n.id, []);
    inc.set(n.id, []);
  }
  for (const e of wf.edges) {
    out.get(e.from.node)?.push(e);
    inc.get(e.to.node)?.push(e);
  }
  return { out, in: inc };
}

export interface TopoResult {
  /** Node ids in a valid execution order (empty if a cycle exists). */
  order: string[];
  /** Node ids participating in a cycle, if any. */
  cycle: string[];
}

/**
 * Kahn's algorithm. Returns a topological order, or the set of nodes that
 * could not be ordered because they form (or depend on) a cycle.
 */
export function topoSort(wf: Workflow): TopoResult {
  const adj = buildAdjacency(wf);
  const indeg = new Map<string, number>();
  for (const n of wf.nodes) indeg.set(n.id, adj.in.get(n.id)!.length);

  // Deterministic ordering: seed the queue in node declaration order.
  const queue: string[] = wf.nodes
    .filter((n) => (indeg.get(n.id) ?? 0) === 0)
    .map((n) => n.id);

  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const e of adj.out.get(id) ?? []) {
      const d = (indeg.get(e.to.node) ?? 0) - 1;
      indeg.set(e.to.node, d);
      if (d === 0) queue.push(e.to.node);
    }
  }

  if (order.length === wf.nodes.length) return { order, cycle: [] };

  const cycle = wf.nodes
    .map((n) => n.id)
    .filter((id) => (indeg.get(id) ?? 0) > 0);
  return { order: [], cycle };
}

/** All node ids reachable downstream from `startIds` (inclusive of neighbors). */
export function descendants(wf: Workflow, startIds: Iterable<string>): Set<string> {
  const adj = buildAdjacency(wf);
  const seen = new Set<string>();
  const stack = [...startIds];
  while (stack.length) {
    const id = stack.pop()!;
    for (const e of adj.out.get(id) ?? []) {
      if (!seen.has(e.to.node)) {
        seen.add(e.to.node);
        stack.push(e.to.node);
      }
    }
  }
  return seen;
}
