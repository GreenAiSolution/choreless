import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export interface Config {
  port: number;
  host: string;
  dataDir: string;
  publicDir: string;
}

export function loadConfig(): Config {
  const root = path.resolve(here, "..");
  return {
    port: Number(process.env.PORT ?? 8787),
    host: process.env.HOST ?? "0.0.0.0",
    dataDir: process.env.DATA_DIR ?? path.join(root, "data"),
    publicDir: process.env.PUBLIC_DIR ?? path.join(root, "public"),
  };
}
