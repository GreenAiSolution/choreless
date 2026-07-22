import type { Server } from "node:http";
import { loadConfig, type Config } from "./config.js";
import { JsonStore } from "./store/jsonStore.js";
import { defaultRegistry } from "./engine/nodes/index.js";
import { WorkflowService } from "./service.js";
import { buildServer } from "./api/server.js";
import { Scheduler } from "./triggers/scheduler.js";
import { exampleWorkflow } from "./seed.js";

export interface App {
  config: Config;
  service: WorkflowService;
  scheduler: Scheduler;
  server: Server;
  start(): Promise<{ port: number; host: string }>;
  stop(): Promise<void>;
}

/** Compose the application from its parts. Used by both the server and tests. */
export function createApp(overrides: Partial<Config> = {}): App {
  const config = { ...loadConfig(), ...overrides };
  const store = new JsonStore(config.dataDir);
  const registry = defaultRegistry();
  const service = new WorkflowService(store, registry);
  const scheduler = new Scheduler(service);
  const server = buildServer({ service, publicDir: config.publicDir });

  return {
    config,
    service,
    scheduler,
    server,
    async start() {
      // Seed an example workflow on first run so the canvas isn't empty.
      const existing = await service.list();
      if (existing.length === 0) {
        await store.saveWorkflow(exampleWorkflow());
      }
      return new Promise<{ port: number; host: string }>((resolve) => {
        server.listen(config.port, config.host, () => {
          const addr = server.address();
          const port =
            typeof addr === "object" && addr ? addr.port : config.port;
          void scheduler.sync();
          resolve({ port, host: config.host });
        });
      });
    },
    stop() {
      scheduler.stop();
      return new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    },
  };
}
