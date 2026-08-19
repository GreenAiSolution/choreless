import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * A minimal, dependency-free router over node:http. Supports path params
 * (`/api/workflows/:id`), JSON body parsing, and typed helpers. Kept tiny on
 * purpose — the app has zero runtime dependencies.
 */

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
  url: URL;
  json<T = unknown>(): Promise<T>;
  send(status: number, body: unknown): void;
  text(status: number, body: string, contentType?: string): void;
}

type Handler = (ctx: Ctx) => void | Promise<void>;
type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface Route {
  method: Method;
  segments: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];
  private fallback?: Handler;

  add(method: Method, pattern: string, handler: Handler): this {
    this.routes.push({ method, segments: split(pattern), handler });
    return this;
  }
  get(p: string, h: Handler) {
    return this.add("GET", p, h);
  }
  post(p: string, h: Handler) {
    return this.add("POST", p, h);
  }
  put(p: string, h: Handler) {
    return this.add("PUT", p, h);
  }
  delete(p: string, h: Handler) {
    return this.add("DELETE", p, h);
  }
  /** Handler used when no route matches (e.g. static files). */
  notFound(h: Handler): this {
    this.fallback = h;
    return this;
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const parts = split(url.pathname);
    const ctx = makeCtx(req, res, url);

    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const params = match(route.segments, parts);
      if (params) {
        ctx.params = params;
        try {
          await route.handler(ctx);
        } catch (err) {
          handleError(ctx, err);
        }
        return;
      }
    }

    if (this.fallback) {
      try {
        await this.fallback(ctx);
      } catch (err) {
        handleError(ctx, err);
      }
    } else {
      ctx.send(404, { error: "Not found" });
    }
  }
}

function split(p: string): string[] {
  return p.split("/").filter(Boolean);
}

function match(
  pattern: string[],
  actual: string[],
): Record<string, string> | null {
  if (pattern.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i]!;
    const a = actual[i]!;
    if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(a);
    else if (p !== a) return null;
  }
  return params;
}

function makeCtx(req: IncomingMessage, res: ServerResponse, url: URL): Ctx {
  return {
    req,
    res,
    params: {},
    query: url.searchParams,
    url,
    async json<T = unknown>(): Promise<T> {
      const raw = await readBody(req);
      if (!raw) return {} as T;
      try {
        return JSON.parse(raw) as T;
      } catch {
        throw new HttpError(400, "Invalid JSON body");
      }
    },
    send(status, body) {
      const payload = JSON.stringify(body);
      res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(payload),
      });
      res.end(payload);
    },
    text(status, body, contentType = "text/plain; charset=utf-8") {
      res.writeHead(status, { "content-type": contentType });
      res.end(body);
    },
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const MAX = 5 * 1024 * 1024; // 5MB guard
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX) {
        reject(new HttpError(413, "Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function handleError(ctx: Ctx, err: unknown): void {
  if (err instanceof HttpError) {
    ctx.send(err.status, { error: err.message });
    return;
  }
  // Domain errors carry recognizable names.
  const name = (err as Error)?.name;
  if (name === "NotFoundError") {
    ctx.send(404, { error: (err as Error).message });
    return;
  }
  if (name === "ValidationError") {
    ctx.send(422, {
      error: (err as Error).message,
      issues: (err as { issues?: unknown }).issues ?? [],
    });
    return;
  }
  // eslint-disable-next-line no-console
  console.error("Unhandled error:", err);
  ctx.send(500, { error: "Internal server error" });
}
