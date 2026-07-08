import type { WorkItemId } from "../shared/ids.js";

export interface ScheduleItem { readonly id: WorkItemId; readonly estimate: number; }
export interface DependencyEdge {
  readonly predecessorId: WorkItemId;
  readonly successorId: WorkItemId;
  readonly lagDays: number;
}
export interface Schedule { readonly orderedIds: WorkItemId[]; readonly totalDurationDays: number; }

export type SchedulingStrategy = (
  items: ScheduleItem[],
  deps: DependencyEdge[],
  capacityPerDay: number,
) => Schedule;

export const sprintCapacityScheduler: SchedulingStrategy = (items, _deps, capacityPerDay) => {
  const total = items.reduce((s, i) => s + i.estimate, 0);
  const cap = capacityPerDay <= 0 ? 1 : capacityPerDay;
  return { orderedIds: items.map((i) => i.id), totalDurationDays: Math.ceil(total / cap) };
};

export const criticalPathScheduler: SchedulingStrategy = (items, deps, _capacityPerDay) => {
  const est = new Map(items.map((i) => [i.id as string, i.estimate]));
  const successors = new Map<string, { to: string; lag: number }[]>();
  const indegree = new Map<string, number>();
  for (const i of items) { successors.set(i.id, []); indegree.set(i.id, 0); }
  for (const d of deps) {
    successors.get(d.predecessorId)!.push({ to: d.successorId, lag: d.lagDays });
    indegree.set(d.successorId, (indegree.get(d.successorId) ?? 0) + 1);
  }
  // Kahn topological sort.
  const queue = items.filter((i) => (indegree.get(i.id) ?? 0) === 0).map((i) => i.id as string);
  const ordered: string[] = [];
  const longest = new Map<string, number>(items.map((i) => [i.id, est.get(i.id) ?? 0]));
  while (queue.length) {
    const n = queue.shift()!;
    ordered.push(n);
    for (const { to, lag } of successors.get(n) ?? []) {
      const candidate = (longest.get(n) ?? 0) + lag + (est.get(to) ?? 0);
      if (candidate > (longest.get(to) ?? 0)) longest.set(to, candidate);
      indegree.set(to, (indegree.get(to) ?? 0) - 1);
      if ((indegree.get(to) ?? 0) === 0) queue.push(to);
    }
  }
  const total = Math.max(0, ...[...longest.values()]);
  return { orderedIds: ordered as unknown as WorkItemId[], totalDurationDays: total };
};
