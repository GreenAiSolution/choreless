import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "../config.js";
import { JsonStore } from "../store/jsonStore.js";
import { defaultRegistry } from "../engine/nodes/index.js";
import { WorkflowService } from "../service.js";
import { registerTools } from "./tools.js";

/**
 * meridian-mcp-server — exposes the Meridian automation engine to any MCP
 * client (Claude, IDEs, agents) over stdio. The server runs the engine
 * in-process against the same JSON store the HTTP app uses, so an agent and a
 * human can collaborate on the same workflows.
 */
export async function createMcpServer(): Promise<McpServer> {
  const config = loadConfig();
  const store = new JsonStore(config.dataDir);
  const registry = defaultRegistry();
  const service = new WorkflowService(store, registry);

  const server = new McpServer({
    name: "meridian-mcp-server",
    version: "0.1.0",
  });

  registerTools(server, service);
  return server;
}

/** Start the server on stdio. */
export async function main(): Promise<void> {
  const server = await createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Never log to stdout on stdio transport — it corrupts the JSON-RPC stream.
  process.stderr.write("meridian-mcp-server ready on stdio\n");
}
