import { NodeRegistry } from "../registry.js";
import { BUILTINS } from "./builtins.js";

/** Build a registry pre-loaded with the built-in node types. */
export function defaultRegistry(): NodeRegistry {
  const reg = new NodeRegistry();
  for (const t of BUILTINS) reg.register(t);
  return reg;
}

export { BUILTINS };
