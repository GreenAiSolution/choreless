import type { Run, Workflow } from "../domain/types.js";

/**
 * Persistence boundary. The engine and API depend only on this interface, so
 * the default JSON store can be swapped for Postgres/SQLite/etc. without
 * touching business logic.
 */
export interface Store {
  listWorkflows(): Promise<Workflow[]>;
  getWorkflow(id: string): Promise<Workflow | undefined>;
  saveWorkflow(wf: Workflow): Promise<Workflow>;
  deleteWorkflow(id: string): Promise<boolean>;

  saveRun(run: Run): Promise<Run>;
  getRun(id: string): Promise<Run | undefined>;
  listRuns(workflowId: string, limit?: number): Promise<Run[]>;
}
