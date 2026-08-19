import { main } from "./server.js";

main().catch((err) => {
  process.stderr.write(
    `meridian-mcp-server failed to start: ${err instanceof Error ? err.stack : String(err)}\n`,
  );
  process.exit(1);
});
