/** A validation problem found in a workflow graph before execution. */
export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export class ValidationError extends Error {
  issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super(
      `Workflow validation failed with ${issues.filter((i) => i.level === "error").length} error(s)`,
    );
    this.name = "ValidationError";
    this.issues = issues;
  }
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

/** Thrown by the engine when a node exceeds its configured timeout. */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Node exceeded timeout of ${ms}ms`);
    this.name = "TimeoutError";
  }
}
