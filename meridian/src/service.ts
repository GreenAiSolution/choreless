import type { Run, TriggerInfo, Value, Workflow } from "./domain/types.js";
import type { Store } from "./store/store.js";
import { Engine, type RunEvent } from "./engine/engine.js";
import type { NodeRegistry } from "./engine/registry.js";
import { validateWorkflow } from "./engine/validate.js";
import type { ValidationIssue } from "./util/errors.js";
import { NotFoundError } from "./util/errors.js";
import { nowIso, uuid } from "./util/id.js";

export interface WorkflowInput {
  name?: string;
  description?: string;
  nodes?: Workflow["nodes"];
  edges?: Workflow["edges"];
  variables?: Record<string, Value>;
}

/**
 * Application service: the single place the API calls into. Coordinates the
 * store, the engine, and validation, and owns id/timestamp assignment so those
 * concerns never leak into the HTTP layer.
 */
export class WorkflowService {
  readonly engine: Engine;

  constructor(
    private store: Store,
    private registry: NodeRegistry,
  ) {
    this.engine = new Engine(registry);
  }

  list(): Promise<Workflow[]> {
    return this.store.listWorkflows();
  }

  async get(id: string): Promise<Workflow> {
    const wf = await this.store.getWorkflow(id);
    if (!wf) throw new NotFoundError(`Workflow '${id}'`);
    return wf;
  }

  async create(input: WorkflowInput): Promise<Workflow> {
    const now = nowIso();
    const wf: Workflow = {
      id: uuid(),
      name: input.name?.trim() || "Untitled workflow",
      description: input.description ?? "",
      nodes: input.nodes ?? [],
      edges: input.edges ?? [],
      variables: input.variables ?? {},
      createdAt: now,
      updatedAt: now,
    };
    return this.store.saveWorkflow(wf);
  }

  async update(id: string, input: WorkflowInput): Promise<Workflow> {
    const existing = await this.get(id);
    const updated: Workflow = {
      ...existing,
      name: input.name?.trim() || existing.name,
      description: input.description ?? existing.description,
      nodes: input.nodes ?? existing.nodes,
      edges: input.edges ?? existing.edges,
      variables: input.variables ?? existing.variables,
      updatedAt: nowIso(),
    };
    return this.store.saveWorkflow(updated);
  }

  async remove(id: string): Promise<void> {
    const ok = await this.store.deleteWorkflow(id);
    if (!ok) throw new NotFoundError(`Workflow '${id}'`);
  }

  validate(wf: Workflow): ValidationIssue[] {
    return validateWorkflow(wf, this.registry);
  }

  async runById(
    id: string,
    trigger: TriggerInfo,
    onEvent?: (e: RunEvent) => void,
  ): Promise<Run> {
    const wf = await this.get(id);
    const run = await this.engine.run(wf, { trigger, onEvent });
    await this.store.saveRun(run);
    return run;
  }

  listRuns(workflowId: string, limit?: number): Promise<Run[]> {
    return this.store.listRuns(workflowId, limit);
  }

  async getRun(id: string): Promise<Run> {
    const run = await this.store.getRun(id);
    if (!run) throw new NotFoundError(`Run '${id}'`);
    return run;
  }

  catalog() {
    return this.registry.catalog();
  }
}
