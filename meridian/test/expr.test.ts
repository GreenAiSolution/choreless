import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, render, resolveConfig } from "../src/engine/expr.js";

const scope = {
  input: { name: "ada", amount: 250, tags: ["vip", "eu"] },
  vars: { threshold: 100 },
  trigger: { source: "webhook" },
  nodes: { a: { out: 7 } },
};

test("literals and arithmetic", () => {
  assert.equal(evaluate("1 + 2 * 3", {}), 7);
  assert.equal(evaluate("(1 + 2) * 3", {}), 9);
  assert.equal(evaluate("10 % 3", {}), 1);
  assert.equal(evaluate("-5 + 2", {}), -3);
});

test("comparison and logic", () => {
  assert.equal(evaluate("input.amount > vars.threshold", scope), true);
  assert.equal(evaluate("input.amount < 100", scope), false);
  assert.equal(evaluate("input.amount >= 250 && input.name == 'ada'", scope), true);
  assert.equal(evaluate("false || input.amount == 250", scope), true);
  assert.equal(evaluate("!(input.amount == 1)", scope), true);
});

test("member and index access", () => {
  assert.equal(evaluate("input.tags[0]", scope), "vip");
  assert.equal(evaluate("nodes.a.out", scope), 7);
  assert.equal(evaluate("input.missing", scope), undefined);
  assert.equal(evaluate("input.missing.deep", scope), undefined);
});

test("helper functions", () => {
  assert.equal(evaluate("upper(input.name)", scope), "ADA");
  assert.equal(evaluate("len(input.tags)", scope), 2);
  assert.equal(evaluate("default(input.missing, 'fallback')", scope), "fallback");
  assert.equal(evaluate("round(2.6)", {}), 3);
  assert.equal(evaluate("max(1, 9, 4)", {}), 9);
});

test("render: single span returns raw typed value", () => {
  assert.equal(render("{{ input.amount }}", scope), 250);
  assert.deepEqual(render("{{ input.tags }}", scope), ["vip", "eu"]);
  assert.equal(typeof render("{{ input.amount }}", scope), "number");
});

test("render: interpolation coerces to string", () => {
  assert.equal(render("Hi {{ upper(input.name) }}!", scope), "Hi ADA!");
  assert.equal(
    render("{{ input.name }} owes {{ input.amount }}", scope),
    "ada owes 250",
  );
});

test("resolveConfig walks objects and arrays", () => {
  const cfg = {
    url: "https://x/{{ input.name }}",
    n: "{{ input.amount }}",
    nested: { list: ["{{ input.tags[0] }}", "static"] },
    untouched: 5,
  };
  const out = resolveConfig(cfg, scope) as any;
  assert.equal(out.url, "https://x/ada");
  assert.equal(out.n, 250); // raw typed value preserved
  assert.equal(out.nested.list[0], "vip");
  assert.equal(out.untouched, 5);
});

test("no eval: unknown function throws, not executes", () => {
  assert.throws(() => evaluate("danger(1)", {}), /Unknown function/);
  // Method-style calls on objects are not part of the grammar at all.
  assert.throws(() => evaluate("process.exit(1)", {}));
});
