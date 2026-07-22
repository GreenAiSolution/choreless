import type { Workflow } from "./domain/types.js";
import { nowIso, uuid } from "./util/id.js";

/**
 * A ready-to-run example so the canvas isn't empty on first launch:
 * an order-triage automation. A sample order is branched on its amount;
 * high-value orders get an escalation message, others a standard one, and
 * both paths are logged.
 */
export function exampleWorkflow(): Workflow {
  const now = nowIso();
  return {
    id: uuid(),
    name: "Order triage (example)",
    description: "Branch an incoming order on its value and route a message.",
    variables: { threshold: 100 },
    nodes: [
      {
        id: "order",
        type: "manual.input",
        name: "New order",
        config: { value: { customer: "Acme Co", amount: 250 } },
        position: { x: 80, y: 120 },
      },
      {
        id: "check",
        type: "condition",
        name: "High value?",
        config: { expression: "input.in.amount > vars.threshold" },
        position: { x: 320, y: 120 },
      },
      {
        id: "escalate",
        type: "template",
        name: "Escalation note",
        config: {
          text: "⚠ High-value order (${{ input.in.amount }}) from {{ input.in.customer }} — route to a human.",
        },
        position: { x: 600, y: 40 },
      },
      {
        id: "standard",
        type: "template",
        name: "Standard note",
        config: {
          text: "Order from {{ input.in.customer }} auto-approved.",
        },
        position: { x: 600, y: 220 },
      },
      {
        id: "record",
        type: "log",
        name: "Record",
        config: { message: "{{ input.in }}", level: "info" },
        position: { x: 880, y: 130 },
      },
    ],
    edges: [
      edge("order", "out", "check", "in"),
      edge("check", "true", "escalate", "in"),
      edge("check", "false", "standard", "in"),
      edge("escalate", "out", "record", "in"),
      edge("standard", "out", "record", "in"),
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function edge(fn: string, fp: string, tn: string, tp: string) {
  return {
    id: `e_${fn}_${fp}_${tn}`,
    from: { node: fn, port: fp },
    to: { node: tn, port: tp },
  };
}
