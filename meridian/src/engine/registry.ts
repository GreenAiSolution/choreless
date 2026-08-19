import type { NodeTypeSpec } from "../domain/types.js";
import type { NodeType } from "./context.js";

/**
 * The registry is the product's extension point: every capability is a
 * NodeType registered here. The engine and API only ever talk to the registry,
 * so adding a feature never means editing the engine.
 */
export class NodeRegistry {
  private types = new Map<string, NodeType>();

  register(type: NodeType): this {
    if (this.types.has(type.spec.type)) {
      throw new Error(`Node type already registered: ${type.spec.type}`);
    }
    this.types.set(type.spec.type, type);
    return this;
  }

  get(type: string): NodeType | undefined {
    return this.types.get(type);
  }

  has(type: string): boolean {
    return this.types.has(type);
  }

  /** The catalog the UI uses to build its palette and config forms. */
  catalog(): NodeTypeSpec[] {
    return [...this.types.values()].map((t) => t.spec);
  }
}
