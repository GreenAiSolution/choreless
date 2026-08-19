import { NodeRegistry } from "../registry.js";
import { BUILTINS } from "./builtins.js";
import { INTEGRATIONS } from "./integrations.js";

/** Build a registry pre-loaded with the built-in and integration node types. */
export function defaultRegistry(): NodeRegistry {
  const reg = new NodeRegistry();
  for (const t of [...BUILTINS, ...INTEGRATIONS]) reg.register(t);
  return reg;
}

export { BUILTINS, INTEGRATIONS };
