import { expect, test } from "vitest";
import { WorkflowEngine } from "./workflow-engine.js";
import { WorkItem } from "../workitem/work-item.js";
import { workflowStateId, workItemId, projectId, workItemTypeId } from "../shared/ids.js";

const wf = {
  states: [
    { id: workflowStateId("todo"), name: "To Do", category: "todo" as const, order: 0 },
    { id: workflowStateId("doing"), name: "Doing", category: "in_progress" as const, order: 1 },
    { id: workflowStateId("review"), name: "Review", category: "in_progress" as const, order: 2 },
    { id: workflowStateId("done"), name: "Done", category: "done" as const, order: 3 },
  ],
  transitions: [
    { fromStateId: workflowStateId("todo"), toStateId: workflowStateId("doing"), name: "start" },
    { fromStateId: workflowStateId("review"), toStateId: workflowStateId("done"), name: "approve", requiresApproval: true },
  ],
};
const item = new WorkItem({
  id: workItemId("wi-1"), projectId: projectId("p"), parentId: null,
  typeId: workItemTypeId("t"), title: "x", status: "todo", estimate: 3,
  estimateUnit: "points", complexityBand: null, riskBand: null, assigneeId: null,
});

test("apply performs a legal transition and emits a status-changed event on category change", () => {
  const eng = new WorkflowEngine(wf);
  const r = eng.apply(item, workflowStateId("todo"), "start", { now: new Date("2026-03-16") });
  expect(r.newCategory).toBe("in_progress");
  expect(r.events).toHaveLength(1);
  expect(r.events[0]!.type).toBe("WorkItemStatusChanged");
});

test("gate transition is blocked without approval", () => {
  const eng = new WorkflowEngine(wf);
  expect(eng.can(workflowStateId("review"), "approve", { now: new Date() })).toBe(false);
  expect(eng.can(workflowStateId("review"), "approve", { now: new Date(), approved: true })).toBe(true);
});

test("illegal transition throws", () => {
  const eng = new WorkflowEngine(wf);
  expect(() => eng.apply(item, workflowStateId("todo"), "approve", { now: new Date() })).toThrow();
});
