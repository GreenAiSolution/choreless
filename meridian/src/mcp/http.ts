import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "../config.js";
import { JsonStore } from "../store/jsonStore.js";
import { defaultRegistry } from "../engine/nodes/index.js";
import { WorkflowService } from "../service.js";
import { registerTools } from "./tools.js";

/**
 * Remote MCP transport: exposes the same tools over **Streamable HTTP** so the
 * server can be hosted and reached by remote clients, not just spawned locally
 * over stdio.
 *
 * It runs **stateless** (no server-side sessions): each POST gets a fresh
 * McpServer + transport that share the one long-lived WorkflowService (and thus
 * the same store). Stateless is simpler to scale and matches MCP best practice
 * for remote servers. GET/DELETE are rejected since there is no session stream.
 */
export function buildMcpHttpServer(): http.Server {
  const config = loadConfig();
  const store = new JsonStore(config.dataDir);
  const registry = defaultRegistry();
  const service = new WorkflowService(store, registry);

  return http.createServer((req, res) => {
    void handle(req, res, service).catch((err) => {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          }),
        );
      }
      process.stderr.write(`mcp-http error: ${String(err)}\n`);
    });
  });
}

async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  service: WorkflowService,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (url.pathname !== "/mcp") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Not found. POST JSON-RPC to /mcp." }));
    return;
  }

  // Stateless: sessions are not supported, so only POST carries requests.
  if (req.method !== "POST") {
    res.writeHead(405, {
      "content-type": "application/json",
      allow: "POST",
    });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed. Use POST /mcp." },
        id: null,
      }),
    );
    return;
  }

  const body = await readJson(req);

  // Fresh server + transport per request; share the service/store.
  const server = new McpServer({ name: "meridian-mcp-server", version: "0.1.0" });
  registerTools(server, service);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const MAX = 5 * 1024 * 1024;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(undefined);
      }
    });
    req.on("error", reject);
  });
}

/** Entry point for `npm run mcp:http`. */
export async function main(): Promise<void> {
  const server = buildMcpHttpServer();
  const port = Number(process.env.MCP_PORT ?? 8788);
  const host = process.env.HOST ?? "0.0.0.0";
  server.listen(port, host, () => {
    process.stderr.write(
      `meridian-mcp-server (Streamable HTTP) on http://${host}:${port}/mcp\n`,
    );
  });
}
