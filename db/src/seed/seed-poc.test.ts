import { expect, test } from "vitest";
import { makeTestDb } from "../testing/test-db.js";
import { seedMethodologies } from "../../prisma/seed-methodologies.js";
import { seedPoc } from "../../prisma/seed-poc.js";

test("POC seed creates the portfolio, 3 projects, and the cross-tool overallocation case", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await seedMethodologies(prisma);
    await seedPoc(prisma);

    const portfolio = await prisma.portfolio.findFirst({ where: { name: "Digital Banking Portfolio" } });
    expect(portfolio).not.toBeNull();
    expect(await prisma.project.count()).toBe(3);
    expect(await prisma.stakeholder.count()).toBe(4);
    expect(await prisma.backlogItem.count()).toBe(5);

    // Sam is over 100% once allocations across sources are summed.
    const sam = await prisma.person.findFirst({ where: { name: "Sam Rivera" }, include: { allocations: true } });
    const total = sam!.allocations.reduce((s, a) => s + a.pct, 0);
    expect(total).toBeGreaterThan(100);

    // A rolled-back deployment exists (drives change-failure-rate).
    const rolledBack = await prisma.deployment.count({ where: { status: "rolled_back" } });
    expect(rolledBack).toBeGreaterThanOrEqual(1);

    // Seven suggested actions for the Today page.
    expect(await prisma.suggestedAction.count()).toBe(7);
  } finally {
    await cleanup();
  }
}, 30000);
