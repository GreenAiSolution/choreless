import { promises as fs } from "node:fs";
import path from "node:path";
import type { Run, Workflow } from "../domain/types.js";
import type { Store } from "./store.js";

/**
 * File-backed JSON store with atomic writes (write-temp-then-rename) and an
 * in-memory index for fast reads. No database process required, so the whole
 * app is self-contained. Runs are capped per workflow to keep files bounded.
 */
export class JsonStore implements Store {
  private workflows = new Map<string, Workflow>();
  private runs = new Map<string, Run>();
  private ready: Promise<void>;

  constructor(
    private dir: string,
    private maxRunsPerWorkflow = 200,
  ) {
    this.ready = this.load();
  }

  private wfFile() {
    return path.join(this.dir, "workflows.json");
  }
  private runsFile() {
    return path.join(this.dir, "runs.json");
  }

  private async load(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    this.workflows = new Map(
      (await readJson<Workflow[]>(this.wfFile(), [])).map((w) => [w.id, w]),
    );
    this.runs = new Map(
      (await readJson<Run[]>(this.runsFile(), [])).map((r) => [r.id, r]),
    );
  }

  private async persistWorkflows(): Promise<void> {
    await atomicWrite(this.wfFile(), [...this.workflows.values()]);
  }
  private async persistRuns(): Promise<void> {
    await atomicWrite(this.runsFile(), [...this.runs.values()]);
  }

  async listWorkflows(): Promise<Workflow[]> {
    await this.ready;
    return [...this.workflows.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  async getWorkflow(id: string): Promise<Workflow | undefined> {
    await this.ready;
    return this.workflows.get(id);
  }

  async saveWorkflow(wf: Workflow): Promise<Workflow> {
    await this.ready;
    this.workflows.set(wf.id, wf);
    await this.persistWorkflows();
    return wf;
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    await this.ready;
    const existed = this.workflows.delete(id);
    // Drop associated runs too.
    for (const [rid, r] of this.runs) if (r.workflowId === id) this.runs.delete(rid);
    if (existed) {
      await this.persistWorkflows();
      await this.persistRuns();
    }
    return existed;
  }

  async saveRun(run: Run): Promise<Run> {
    await this.ready;
    this.runs.set(run.id, run);
    this.trim(run.workflowId);
    await this.persistRuns();
    return run;
  }

  async getRun(id: string): Promise<Run | undefined> {
    await this.ready;
    return this.runs.get(id);
  }

  async listRuns(workflowId: string, limit = 50): Promise<Run[]> {
    await this.ready;
    return [...this.runs.values()]
      .filter((r) => r.workflowId === workflowId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  }

  /** Keep only the most recent runs for a workflow. */
  private trim(workflowId: string): void {
    const forWf = [...this.runs.values()]
      .filter((r) => r.workflowId === workflowId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    for (const stale of forWf.slice(this.maxRunsPerWorkflow)) {
      this.runs.delete(stale.id);
    }
  }
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function atomicWrite(file: string, data: unknown): Promise<void> {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}
