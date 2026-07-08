import { expect, test } from "vitest";
import { WorkItem } from "./work-item.js";
import { WorkItemTree } from "./work-item-tree.js";
import { workItemId, projectId, workItemTypeId } from "../shared/ids.js";

const P = projectId("p-1");
const T = workItemTypeId("t-1");

function wi(id: string, parent: string | null, status: string, est: number | null) {
  return new WorkItem({
    id: workItemId(id),
    projectId: P,
    parentId: parent ? workItemId(parent) : null,
    typeId: T,
    title: id,
    status: status as any,
    estimate: est,
    estimateUnit: est === null ? null : "points",
    complexityBand: null,
    riskBand: null,
    assigneeId: null,
  });
}

test("rolls up estimate over the subtree", () => {
  const tree = WorkItemTree.fromFlat([
    wi("epic", null, "in_progress", null),
    wi("s1", "epic", "done", 5),
    wi("s2", "epic", "in_progress", 3),
  ]);
  expect(tree.rolledUpEstimate(workItemId("epic"))).toBe(8);
});

test("rolls up status: blocked child dominates", () => {
  const tree = WorkItemTree.fromFlat([
    wi("epic", null, "in_progress", null),
    wi("s1", "epic", "done", 5),
    wi("s2", "epic", "blocked", 3),
  ]);
  expect(tree.rolledUpStatus(workItemId("epic"))).toBe("blocked");
});

test("rolls up status: all done => done", () => {
  const tree = WorkItemTree.fromFlat([
    wi("epic", null, "in_progress", null),
    wi("s1", "epic", "done", 5),
    wi("s2", "epic", "done", 3),
  ]);
  expect(tree.rolledUpStatus(workItemId("epic"))).toBe("done");
});
