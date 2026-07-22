import { z } from "zod";

/**
 * Zod schemas mirroring the engine's domain, used to validate tool inputs at
 * the MCP boundary. Kept as reusable pieces; tools compose them into raw
 * input shapes (the shape the SDK's registerTool expects).
 */

export const ResponseFormat = z.enum(["markdown", "json"]);

export const positionSchema = z
  .object({
    x: z.number().describe("Canvas X coordinate"),
    y: z.number().describe("Canvas Y coordinate"),
  })
  .describe("Optional canvas position for the node");

export const nodeSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe("Unique node id within the workflow (e.g. 'check_amount')"),
  type: z
    .string()
    .min(1)
    .describe("A registered node type (see meridian_list_node_types)"),
  name: z.string().default("").describe("Human-readable label"),
  config: z
    .record(z.string(), z.unknown())
    .default({})
    .describe(
      "Per-node settings. String values may contain {{ expressions }} evaluated against input/vars/trigger/nodes.",
    ),
  position: positionSchema.optional(),
  retries: z
    .number()
    .int()
    .min(0)
    .max(5)
    .optional()
    .describe("Retry attempts on failure (exponential backoff)"),
  timeoutMs: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Per-node timeout in milliseconds"),
  onError: z
    .enum(["stop", "continue"])
    .optional()
    .describe("stop = fail the run; continue = skip this node's descendants"),
});

export const edgeSchema = z.object({
  id: z.string().min(1).describe("Unique edge id"),
  from: z
    .object({
      node: z.string().describe("Source node id"),
      port: z.string().describe("Source output port name"),
    })
    .describe("Edge source"),
  to: z
    .object({
      node: z.string().describe("Target node id"),
      port: z.string().describe("Target input port name"),
    })
    .describe("Edge target"),
});

export type NodeInput = z.infer<typeof nodeSchema>;
export type EdgeInput = z.infer<typeof edgeSchema>;

/** Reusable field: how a workflow's graph is provided to create/update. */
export const graphFields = {
  nodes: z
    .array(nodeSchema)
    .optional()
    .describe("The workflow's nodes. Replaces the existing set when provided."),
  edges: z
    .array(edgeSchema)
    .optional()
    .describe(
      "Directed connections between node ports. Replaces the existing set when provided.",
    ),
  variables: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Workflow-scoped constants, referenced in expressions as vars.*"),
};
