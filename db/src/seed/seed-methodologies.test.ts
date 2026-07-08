import { expect, test } from "vitest";
import { makeTestDb } from "../testing/test-db.js";
import { seedMethodologies } from "../../prisma/seed-methodologies.js";

test("seeds the four methodology bundles with types and workflow states", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await seedMethodologies(prisma);
    const keys = (await prisma.methodology.findMany()).map((m) => m.key).sort();
    expect(keys).toEqual(["DMAIC", "SAFE", "SCRUM", "WATERFALL"]);

    const scrum = await prisma.methodology.findUnique({
      where: { key: "SCRUM" },
      include: { workItemTypes: true, workflows: { include: { states: true } } },
    });
    expect(scrum!.workItemTypes.map((t) => t.name)).toContain("Story");
    expect(scrum!.workflows[0]!.states.length).toBeGreaterThanOrEqual(3);

    // Idempotent: running twice does not duplicate.
    await seedMethodologies(prisma);
    expect(await prisma.methodology.count()).toBe(4);
  } finally {
    await cleanup();
  }
}, 30000);
