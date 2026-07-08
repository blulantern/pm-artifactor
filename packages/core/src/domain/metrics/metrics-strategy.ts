import type { WorkItemTree } from "../workitem/work-item-tree.js";
import type { WorkItemId } from "../shared/ids.js";

export interface Progress {
  readonly percentComplete: number;
  readonly earnedValue?: number;
  readonly spi?: number;
  readonly cpi?: number;
}

export interface MetricsInput {
  readonly tree: WorkItemTree;
  readonly rootId: WorkItemId;
  readonly plannedValue?: number;
  readonly actualCost?: number;
}

export interface MetricsStrategy {
  readonly key: string;
  progress(input: MetricsInput): Progress;
}

/** Shared helper: fraction of leaf estimate that is done. */
export function doneFraction(input: MetricsInput): number {
  const leaves = collectLeaves(input.tree, input.rootId);
  const total = leaves.reduce((s, l) => s + (l.estimate ?? 0), 0);
  if (total === 0) return 0;
  const done = leaves
    .filter((l) => l.status === "done")
    .reduce((s, l) => s + (l.estimate ?? 0), 0);
  return done / total;
}

function collectLeaves(tree: WorkItemTree, rootId: WorkItemId) {
  return tree.leavesOf(rootId).map((l) => ({ estimate: l.estimate, status: l.status }));
}
