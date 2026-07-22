import { createApp } from "./app.js";

/** Server entry point. */
const app = createApp();

app.start().then(({ port, host }) => {
  // eslint-disable-next-line no-console
  console.log(`\n  Meridian running at http://${host}:${port}\n`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    void app.stop().then(() => process.exit(0));
  });
}
