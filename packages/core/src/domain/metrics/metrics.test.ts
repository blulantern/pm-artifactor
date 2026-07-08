import { expect, test } from "vitest";
import { WorkItem } from "../workitem/work-item.js";
import { WorkItemTree } from "../workitem/work-item-tree.js";
import { VelocityMetrics } from "./velocity-metrics.js";
import { EarnedValueMetrics } from "./earned-value-metrics.js";
import { workItemId, projectId, workItemTypeId } from "../shared/ids.js";

const P = projectId("p-1");
const T = workItemTypeId("t-1");
function wi(id: string, parent: string | null, status: string, est: number | null) {
  return new WorkItem({
    id: workItemId(id), projectId: P, parentId: parent ? workItemId(parent) : null,
    typeId: T, title: id, status: status as any, estimate: est,
    estimateUnit: est === null ? null : "points", complexityBand: null, riskBand: null, assigneeId: null,
  });
}
const tree = WorkItemTree.fromFlat([
  wi("epic", null, "in_progress", null),
  wi("s1", "epic", "done", 6),
  wi("s2", "epic", "in_progress", 2),
]);

test("velocity percentComplete = done points / total points", () => {
  const p = new VelocityMetrics().progress({ tree, rootId: workItemId("epic") });
  expect(p.percentComplete).toBeCloseTo(0.75);
});

test("earned value derives SPI and CPI from planned value and actual cost", () => {
  const p = new EarnedValueMetrics().progress({
    tree, rootId: workItemId("epic"), plannedValue: 100, actualCost: 90,
  });
  expect(p.earnedValue).toBeCloseTo(75);
  expect(p.spi).toBeCloseTo(0.75);
  expect(p.cpi).toBeCloseTo(75 / 90);
});
