import { test } from "node:test";
import assert from "node:assert/strict";
import { topoSort, descendants } from "../src/util/graph.js";
import type { Workflow } from "../src/domain/types.js";

function wf(nodeIds: string[], edges: [string, string][]): Workflow {
  return {
    id: "w",
    name: "w",
    description: "",
    variables: {},
    createdAt: "",
    updatedAt: "",
    nodes: nodeIds.map((id) => ({
      id,
      type: "log",
      name: id,
      config: {},
      position: { x: 0, y: 0 },
    })),
    edges: edges.map(([f, t], i) => ({
      id: "e" + i,
      from: { node: f, port: "out" },
      to: { node: t, port: "in" },
    })),
  };
}

test("topological order respects dependencies", () => {
  const g = wf(
    ["a", "b", "c", "d"],
    [
      ["a", "b"],
      ["a", "c"],
      ["b", "d"],
      ["c", "d"],
    ],
  );
  const { order, cycle } = topoSort(g);
  assert.equal(cycle.length, 0);
  assert.equal(order.length, 4);
  assert.ok(order.indexOf("a") < order.indexOf("b"));
  assert.ok(order.indexOf("b") < order.indexOf("d"));
  assert.ok(order.indexOf("c") < order.indexOf("d"));
});

test("cycle is detected and reported", () => {
  const g = wf(
    ["a", "b", "c"],
    [
      ["a", "b"],
      ["b", "c"],
      ["c", "a"],
    ],
  );
  const { order, cycle } = topoSort(g);
  assert.equal(order.length, 0);
  assert.deepEqual(new Set(cycle), new Set(["a", "b", "c"]));
});

test("descendants collects everything downstream", () => {
  const g = wf(
    ["a", "b", "c", "d"],
    [
      ["a", "b"],
      ["b", "c"],
      ["a", "d"],
    ],
  );
  assert.deepEqual(descendants(g, ["b"]), new Set(["c"]));
  assert.deepEqual(descendants(g, ["a"]), new Set(["b", "c", "d"]));
});
