import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WorkflowService } from "../service.js";
import type { Node, TriggerInfo } from "../domain/types.js";
import { hasErrors } from "../engine/validate.js";
import { graphFields, nodeSchema, ResponseFormat } from "./schemas.js";
import {
  ok,
  fail,
  fromError,
  workflowSummary,
  runSummary,
  withBudget,
  catalogMarkdown,
  type ToolResult,
} from "./format.js";

/**
 * Register every Meridian tool on the MCP server. Tools are a comprehensive,
 * composable surface over the automation engine: introspect the building
 * blocks, author workflows (the "map"), validate them, and run them.
 */
export function registerTools(server: McpServer, service: WorkflowService): void {
  // ---- Introspection ----------------------------------------------------
  server.registerTool(
    "meridian_list_node_types",
    {
      title: "List node types",
      description: `List every available node type (the building blocks of an automation).

Call this FIRST when authoring a workflow so you know which node 'type' values exist, what input/output ports each has, and what config fields they take. Node config string values may contain {{ expressions }} (e.g. "{{ input.in.amount > 100 }}") evaluated against input / vars / trigger / nodes.

Args:
  - response_format ('markdown' | 'json'): 'markdown' (default) is easiest to read; 'json' returns the full machine-readable specs.

Returns: the node-type catalog, each with type, label, category, description, inputs[], outputs[], and config fields[].`,
      inputSchema: { response_format: ResponseFormat.default("markdown") },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ response_format }): Promise<ToolResult> => {
      try {
        const catalog = service.catalog();
        if (response_format === "markdown") {
          return {
            content: [{ type: "text", text: catalogMarkdown(catalog) }],
            structuredContent: { count: catalog.length, nodeTypes: catalog },
          };
        }
        return ok({ count: catalog.length, nodeTypes: catalog });
      } catch (err) {
        return fromError(err);
      }
    },
  );

  server.registerTool(
    "meridian_list_workflows",
    {
      title: "List workflows",
      description: `List all automation workflows with summary info (id, name, node/edge counts, last updated).

Use this to discover existing workflows before reading, running, or updating one.

Args:
  - response_format ('markdown' | 'json'): output format (default 'json').

Returns: { count, workflows: [{ id, name, description, nodeCount, edgeCount, updatedAt }] }`,
      inputSchema: { response_format: ResponseFormat.default("json") },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (): Promise<ToolResult> => {
      try {
        const list = await service.list();
        return withBudget(list, (items, truncated) => ({
          count: list.length,
          shown: items.length,
          ...(truncated ? { truncated: true } : {}),
          workflows: items.map(workflowSummary),
        }));
      } catch (err) {
        return fromError(err);
      }
    },
  );

  server.registerTool(
    "meridian_get_workflow",
    {
      title: "Get workflow",
      description: `Get a single workflow in full, including all nodes, edges, and variables.

Args:
  - id (string): the workflow id (from meridian_list_workflows).

Returns: the complete Workflow object. Use this before updating so you can send back a full, correct graph.`,
      inputSchema: { id: z.string().min(1).describe("Workflow id") },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }): Promise<ToolResult> => {
      try {
        const wf = await service.get(id);
        return ok({ workflow: wf });
      } catch (err) {
        return fromError(err);
      }
    },
  );

  // ---- Authoring --------------------------------------------------------
  server.registerTool(
    "meridian_create_workflow",
    {
      title: "Create workflow",
      description: `Create a new automation workflow (a graph of nodes connected by edges).

A workflow models a business process: a 'trigger' or 'manual.input' node starts it, edges carry data from a source node's output port to a target node's input port, and 'condition' nodes branch the flow. Call meridian_list_node_types first to see valid node types and ports.

The response includes a validation report — if 'valid' is false, fix the listed issues with meridian_update_workflow before running.

Args:
  - name (string, required): workflow name.
  - description (string): what the automation does.
  - nodes (Node[]): nodes to add. Each: { id, type, name?, config?, position?, retries?, timeoutMs?, onError? }.
  - edges (Edge[]): connections. Each: { id, from:{node,port}, to:{node,port} }.
  - variables (object): workflow constants referenced as vars.* in expressions.

Returns: { workflow, validation: { valid, issues } }`,
      inputSchema: {
        name: z.string().min(1).describe("Workflow name"),
        description: z.string().optional().describe("What the automation does"),
        ...graphFields,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args): Promise<ToolResult> => {
      try {
        const wf = await service.create({
          name: args.name,
          description: args.description ?? "",
          nodes: args.nodes ? normalizeNodes(args.nodes) : [],
          edges: args.edges ?? [],
          variables: args.variables ?? {},
        });
        const issues = service.validate(wf);
        return ok({
          workflow: wf,
          validation: { valid: !hasErrors(issues), issues },
        });
      } catch (err) {
        return fromError(err);
      }
    },
  );

  server.registerTool(
    "meridian_update_workflow",
    {
      title: "Update workflow",
      description: `Update an existing workflow. Any provided field replaces the current value; omitted fields are left unchanged. To edit a graph, send the FULL nodes/edges arrays (get the current state with meridian_get_workflow first).

The response includes a fresh validation report.

Args:
  - id (string, required): workflow id.
  - name, description (string): optional metadata updates.
  - nodes (Node[]): full replacement node set.
  - edges (Edge[]): full replacement edge set.
  - variables (object): full replacement variables.

Returns: { workflow, validation: { valid, issues } }`,
      inputSchema: {
        id: z.string().min(1).describe("Workflow id"),
        name: z.string().optional().describe("New name"),
        description: z.string().optional().describe("New description"),
        ...graphFields,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args): Promise<ToolResult> => {
      try {
        const wf = await service.update(args.id, {
          ...(args.name !== undefined ? { name: args.name } : {}),
          ...(args.description !== undefined ? { description: args.description } : {}),
          ...(args.nodes !== undefined ? { nodes: normalizeNodes(args.nodes) } : {}),
          ...(args.edges !== undefined ? { edges: args.edges } : {}),
          ...(args.variables !== undefined ? { variables: args.variables } : {}),
        });
        const issues = service.validate(wf);
        return ok({
          workflow: wf,
          validation: { valid: !hasErrors(issues), issues },
        });
      } catch (err) {
        return fromError(err);
      }
    },
  );

  server.registerTool(
    "meridian_delete_workflow",
    {
      title: "Delete workflow",
      description: `Permanently delete a workflow and its run history. This cannot be undone.

Args:
  - id (string, required): workflow id.

Returns: { deleted: true, id }`,
      inputSchema: { id: z.string().min(1).describe("Workflow id to delete") },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }): Promise<ToolResult> => {
      try {
        await service.remove(id);
        return ok({ deleted: true, id }, `Deleted workflow ${id}.`);
      } catch (err) {
        return fromError(err);
      }
    },
  );

  server.registerTool(
    "meridian_validate_workflow",
    {
      title: "Validate workflow",
      description: `Statically validate a workflow without running it: checks that node types exist, edge ports are valid, there are no cycles, and required config is present. Also reports warnings (e.g. orphan nodes).

Args:
  - id (string, required): workflow id.

Returns: { valid, errorCount, warningCount, issues: [{ level, code, message, nodeId?, edgeId? }] }`,
      inputSchema: { id: z.string().min(1).describe("Workflow id") },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }): Promise<ToolResult> => {
      try {
        const wf = await service.get(id);
        const issues = service.validate(wf);
        return ok({
          valid: !hasErrors(issues),
          errorCount: issues.filter((i) => i.level === "error").length,
          warningCount: issues.filter((i) => i.level === "warning").length,
          issues,
        });
      } catch (err) {
        return fromError(err);
      }
    },
  );

  // ---- Execution --------------------------------------------------------
  server.registerTool(
    "meridian_run_workflow",
    {
      title: "Run workflow",
      description: `Execute a workflow now and return the result. The engine validates the graph, runs nodes in dependency order, evaluates conditions to branch, and records each node's outcome. Nodes may call external services (e.g. http.request), so this can have real-world effects.

Args:
  - id (string, required): workflow id.
  - input (any): the trigger payload, available in expressions as 'trigger' and emitted by the trigger node. For example { "amount": 250, "customer": "Acme" }.

Returns: {
  run: { id, status, trigger, startedAt, finishedAt,
         nodeResults: [{ nodeId, name, status, attempts, error? }], error? },
  output: <values of terminal nodes>
}
status is one of succeeded | failed. If it failed, inspect nodeResults for the failing node, or run meridian_validate_workflow.`,
      inputSchema: {
        id: z.string().min(1).describe("Workflow id to run"),
        input: z
          .unknown()
          .optional()
          .describe("Trigger payload passed to the workflow"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ id, input }): Promise<ToolResult> => {
      try {
        const trigger: TriggerInfo = { kind: "manual", payload: input ?? null };
        const run = await service.runById(id, trigger);
        return ok({ run: runSummary(run), output: run.output ?? {} });
      } catch (err) {
        return fromError(err);
      }
    },
  );

  server.registerTool(
    "meridian_list_runs",
    {
      title: "List runs",
      description: `List recent execution runs for a workflow, most recent first.

Args:
  - workflow_id (string, required): the workflow id.
  - limit (number): max runs to return, 1-100 (default 20).

Returns: { count, runs: [{ id, status, trigger, startedAt, finishedAt, nodeResults }] }`,
      inputSchema: {
        workflow_id: z.string().min(1).describe("Workflow id"),
        limit: z.number().int().min(1).max(100).default(20).describe("Max runs"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ workflow_id, limit }): Promise<ToolResult> => {
      try {
        const runs = await service.listRuns(workflow_id, limit);
        return withBudget(runs, (items, truncated) => ({
          count: runs.length,
          shown: items.length,
          ...(truncated ? { truncated: true } : {}),
          runs: items.map(runSummary),
        }));
      } catch (err) {
        return fromError(err);
      }
    },
  );

  server.registerTool(
    "meridian_get_run",
    {
      title: "Get run",
      description: `Get one execution run in full, including every node's input, output, and logs.

Args:
  - id (string, required): the run id (from meridian_run_workflow or meridian_list_runs).

Returns: the complete Run object with per-node detail.`,
      inputSchema: { id: z.string().min(1).describe("Run id") },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }): Promise<ToolResult> => {
      try {
        const run = await service.getRun(id);
        return ok({ run });
      } catch (err) {
        return fromError(err);
      }
    },
  );
}

/** Fill engine-required fields the MCP input treats as optional. */
function normalizeNodes(nodes: z.infer<typeof nodeSchema>[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    name: n.name || n.id,
    config: n.config ?? {},
    position: n.position ?? { x: 0, y: 0 },
    ...(n.retries !== undefined ? { retries: n.retries } : {}),
    ...(n.timeoutMs !== undefined ? { timeoutMs: n.timeoutMs } : {}),
    ...(n.onError !== undefined ? { onError: n.onError } : {}),
  }));
}
