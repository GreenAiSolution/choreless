import type { WorkflowService } from "../service.js";
import type { Workflow } from "../domain/types.js";

/**
 * In-process scheduler for `schedule`-mode trigger nodes. Each workflow whose
 * trigger node declares `{ mode: "schedule", everyMs }` gets a repeating timer
 * that fires a run. Kept intentionally simple (fixed interval, single process);
 * a production deployment would swap this for a durable queue behind the same
 * `sync` call.
 */
export class Scheduler {
  private timers = new Map<string, NodeJS.Timeout>();
  private minIntervalMs = 1000;

  constructor(private service: WorkflowService) {}

  /** Reconcile timers with the current set of workflows. */
  async sync(): Promise<void> {
    const workflows = await this.service.list();
    const desired = new Map<string, number>();
    for (const wf of workflows) {
      const everyMs = scheduleInterval(wf);
      if (everyMs) desired.set(wf.id, Math.max(everyMs, this.minIntervalMs));
    }

    // Remove timers no longer wanted or whose interval changed.
    for (const [id, timer] of this.timers) {
      if (!desired.has(id)) {
        clearInterval(timer);
        this.timers.delete(id);
      }
    }
    // Add timers for newly-scheduled workflows.
    for (const [id, everyMs] of desired) {
      if (this.timers.has(id)) continue;
      const timer = setInterval(() => {
        void this.fire(id);
      }, everyMs);
      // Don't keep the process alive solely for schedules.
      timer.unref?.();
      this.timers.set(id, timer);
    }
  }

  private async fire(workflowId: string): Promise<void> {
    try {
      await this.service.runById(workflowId, {
        kind: "schedule",
        payload: { firedAt: new Date().toISOString() },
      });
    } catch {
      // A failing scheduled run is recorded as a failed Run; nothing to do here.
    }
  }

  stop(): void {
    for (const t of this.timers.values()) clearInterval(t);
    this.timers.clear();
  }
}

function scheduleInterval(wf: Workflow): number | undefined {
  const node = wf.nodes.find((n) => n.type === "trigger");
  if (!node) return undefined;
  if (node.config["mode"] !== "schedule") return undefined;
  const everyMs = Number(node.config["everyMs"]);
  return Number.isFinite(everyMs) && everyMs > 0 ? everyMs : undefined;
}
