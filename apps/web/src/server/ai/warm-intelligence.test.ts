import { expect, test } from "vitest";
import { makeTestDb } from "@pma/db/src/testing/test-db.js";
import { seedMethodologies } from "@pma/db/prisma/seed-methodologies.js";
import { seedPoc } from "@pma/db/prisma/seed-poc.js";
import { warmIntelligence } from "./warm-intelligence.js";

test("warmIntelligence persists features and logs mixed-tier AiTasks (miss then hit)", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await seedMethodologies(prisma);
    await seedPoc(prisma);
    const res = await warmIntelligence(prisma);
    expect(res.features).toBeGreaterThan(0);
    expect(res.aiTasks).toBeGreaterThan(0);
    // Real feature corpus persisted.
    expect(await prisma.featureRecord.count()).toBe(res.features);
    // Both tiers represented (each task run twice → at least one llm + one exact_cache).
    const llm = await prisma.aiTask.count({ where: { resolutionTier: "llm" } });
    const hits = await prisma.aiTask.count({ where: { resolutionTier: "exact_cache" } });
    expect(llm).toBeGreaterThan(0);
    expect(hits).toBeGreaterThan(0);
    // Tokens were actually saved on the hits.
    const saved = await prisma.aiTask.aggregate({ _sum: { tokensSaved: true } });
    expect(saved._sum.tokensSaved ?? 0).toBeGreaterThan(0);
  } finally { await cleanup(); }
}, 60000);
