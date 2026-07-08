import { expect, test } from "vitest";
import { DefaultMethodologyRegistry } from "./methodology/methodology-registry.js";
import { WorkflowEngine } from "./workflow/workflow-engine.js";
import { InProcessEventBus } from "../testing/in-process-event-bus.js";
import { WorkItem } from "./workitem/work-item.js";
import { WorkItemTree } from "./workitem/work-item-tree.js";
import { workItemId, projectId, workItemTypeId, workflowStateId } from "./shared/ids.js";

test("a Scrum status change flows through the engine, emits an event, and moves the rollup", async () => {
  const registry = new DefaultMethodologyRegistry();
  const scrum = registry.resolve("SCRUM");
  const engine = new WorkflowEngine(scrum.workflow());
  const bus = new InProcessEventBus();

  const received: string[] = [];
  bus.subscribe("WorkItemStatusChanged", async (e) => { received.push(e.type); });

  const P = projectId("p-1");
  const T = workItemTypeId("scrum-story");
  const story = new WorkItem({
    id: workItemId("s1"), projectId: P, parentId: workItemId("epic"), typeId: T,
    title: "Story", status: "todo", estimate: 5, estimateUnit: "points",
    complexityBand: null, riskBand: null, assigneeId: null,
  });

  const result = engine.apply(story, workflowStateId("scrum-todo"), "start", { now: new Date("2026-03-16") });
  await bus.publish(result.events);
  expect(received).toEqual(["WorkItemStatusChanged"]);

  // After the story starts, the epic's rolled-up status is in_progress.
  const moved = new WorkItem({ ...story.toProps(), status: result.newCategory });
  const epic = new WorkItem({
    id: workItemId("epic"), projectId: P, parentId: null, typeId: workItemTypeId("scrum-epic"),
    title: "Epic", status: "in_progress", estimate: null, estimateUnit: null,
    complexityBand: null, riskBand: null, assigneeId: null,
  });
  const tree = WorkItemTree.fromFlat([epic, moved]);
  expect(tree.rolledUpStatus(workItemId("epic"))).toBe("in_progress");
});
