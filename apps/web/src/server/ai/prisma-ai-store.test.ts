import { expect, test } from "vitest";
import { makeTestDb } from "@pma/db/src/testing/test-db.js";
import { PrismaAICacheStore, logAiTask } from "./prisma-ai-store.js";

test("prisma cache store persists, hits, and invalidates by entity", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const store = new PrismaAICacheStore(prisma);
    await store.put({ keyHash: "k1", taskType: "health.explain", output: { s: 1 }, groundedOn: ["checkout", "ledger"], tokensUsed: 50, hitCount: 0, stale: false });
    expect((await store.get("k1"))?.tokensUsed).toBe(50);
    expect(await prisma.aiCacheDep.count()).toBe(2);
    await store.bumpHit("k1", 50);
    expect((await store.get("k1"))?.hitCount).toBe(1);
    const n = await store.markStaleByEntity("ledger");
    expect(n).toBe(1);
    expect((await store.get("k1"))?.stale).toBe(true);
  } finally { await cleanup(); }
}, 30000);

test("logAiTask writes an AiTask row with the resolution tier", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await logAiTask(prisma, "daily-brief.compose", { output: { h: "x" }, groundedOn: ["a1"], confidence: 0.9, tier: "llm", tokensUsed: 30, tokensSaved: 0 });
    const row = await prisma.aiTask.findFirst();
    expect(row?.resolutionTier).toBe("llm");
    expect(row?.tokensUsed).toBe(30);
  } finally { await cleanup(); }
}, 30000);
