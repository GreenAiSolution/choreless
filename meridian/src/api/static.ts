import { promises as fs } from "node:fs";
import path from "node:path";
import type { Ctx } from "./router.js";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
};

/**
 * Serve files from `root` for non-API requests. Path traversal is blocked by
 * resolving and checking the result stays within root. Unknown paths fall back
 * to index.html so the single-page app can handle client routing.
 */
export function staticHandler(root: string) {
  return async (ctx: Ctx): Promise<void> => {
    const rel = decodeURIComponent(ctx.url.pathname);
    // Unknown API paths are genuine 404s, not SPA routes.
    if (rel.startsWith("/api/")) {
      ctx.send(404, { error: "Not found" });
      return;
    }
    let filePath = path.join(root, rel === "/" ? "/index.html" : rel);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(root))) {
      ctx.send(403, { error: "Forbidden" });
      return;
    }
    try {
      let data = await fs.readFile(resolved);
      let ext = path.extname(resolved);
      if (!ext) {
        // No extension: serve the SPA shell.
        data = await fs.readFile(path.join(root, "index.html"));
        ext = ".html";
      }
      ctx.res.writeHead(200, {
        "content-type": TYPES[ext] ?? "application/octet-stream",
        "content-length": data.length,
        "cache-control": "no-cache",
      });
      ctx.res.end(data);
    } catch {
      // Fall back to the SPA shell for unknown routes.
      try {
        const shell = await fs.readFile(path.join(root, "index.html"));
        ctx.res.writeHead(200, { "content-type": TYPES[".html"]! });
        ctx.res.end(shell);
      } catch {
        ctx.send(404, { error: "Not found" });
      }
    }
  };
}
