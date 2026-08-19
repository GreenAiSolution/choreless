import { main } from "./http.js";

main().catch((err) => {
  process.stderr.write(
    `meridian-mcp-server (HTTP) failed to start: ${err instanceof Error ? err.stack : String(err)}\n`,
  );
  process.exit(1);
});
