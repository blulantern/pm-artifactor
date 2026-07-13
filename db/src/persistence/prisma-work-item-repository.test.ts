import { expect, test } from "vitest";
import { makeTestDb } from "../testing/test-db.js";
import { PrismaWorkItemRepository } from "./prisma-work-item-repository.js";
import { WorkItem, workItemId, projectId, workItemTypeId, WorkItemTree } from "@pma/core";

async function seedProjectAndType(prisma: any) {
  const org = await prisma.organization.create({ data: { name: "Org" } });
  const pf = await prisma.portfolio.create({ data: { name: "PF", organizationId: org.id } });
  const meth = await prisma.methodology.create({ data: { key: "SCRUM", name: "Scrum", family: "agile" } });
  const type = await prisma.workItemType.create({ data: { methodologyId: meth.id, name: "Story", hierarchyLevel: 2 } });
  const proj = await prisma.project.create({ data: { name: "Proj", organizationId: org.id, portfolioId: pf.id, methodologyId: meth.id } });
  return { projectId: proj.id as string, typeId: type.id as string };
}

test("saves a work item and reads it back by project with correct rollup", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const ids = await seedProjectAndType(prisma);
    const repo = new PrismaWorkItemRepository(prisma);
    const P = projectId(ids.projectId);
    const T = workItemTypeId(ids.typeId);

    const epic = new WorkItem({
      id: workItemId("epic-1"), projectId: P, parentId: null, typeId: T,
      title: "Epic", status: "in_progress", estimate: null, estimateUnit: null,
      complexityBand: null, riskBand: null, assigneeId: null,
    });
    const story = new WorkItem({
      id: workItemId("story-1"), projectId: P, parentId: workItemId("epic-1"), typeId: T,
      title: "Story", status: "done", estimate: 5, estimateUnit: "points",
      complexityBand: "high", riskBand: null, assigneeId: null,
    });
    await repo.save(epic);
    await repo.save(story);

    const items = await repo.findByProject(P);
    expect(items).toHaveLength(2);
    const tree = WorkItemTree.fromFlat(items);
    expect(tree.rolledUpEstimate(workItemId("epic-1"))).toBe(5);
    expect(tree.rolledUpStatus(workItemId("epic-1"))).toBe("done");

    const one = await repo.findById(workItemId("story-1"));
    expect(one?.complexityBand).toBe("high");
  } finally {
    await cleanup();
  }
}, 30000);
