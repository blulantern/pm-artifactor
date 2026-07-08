import { expect, test } from "vitest";
import { InMemoryWorkItemRepository } from "./in-memory-work-item-repository.js";
import { InProcessEventBus } from "./in-process-event-bus.js";
import { WorkItem } from "../domain/workitem/work-item.js";
import { workItemId, projectId, workItemTypeId } from "../domain/shared/ids.js";

test("in-memory repo saves and finds by project", async () => {
  const repo = new InMemoryWorkItemRepository();
  const P = projectId("p-1");
  await repo.save(new WorkItem({
    id: workItemId("wi-1"), projectId: P, parentId: null, typeId: workItemTypeId("t"),
    title: "x", status: "todo", estimate: 1, estimateUnit: "points",
    complexityBand: null, riskBand: null, assigneeId: null,
  }));
  const found = await repo.findByProject(P);
  expect(found).toHaveLength(1);
  expect(await repo.findById(workItemId("wi-1"))).not.toBeNull();
});

test("in-process event bus dispatches synchronously to subscribers", async () => {
  const bus = new InProcessEventBus();
  const seen: string[] = [];
  bus.subscribe("WorkItemStatusChanged", async (e) => { seen.push(e.aggregateId); });
  await bus.publish([{ type: "WorkItemStatusChanged", occurredAt: new Date(), aggregateId: "wi-1" }]);
  expect(seen).toEqual(["wi-1"]);
});
