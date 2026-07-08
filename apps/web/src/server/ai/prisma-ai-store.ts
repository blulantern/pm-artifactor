import type { PrismaClient } from "@prisma/client";
import type { AICacheStore, CachedEntry } from "./cache-store.js";
import type { ResolutionOutcome } from "./resolution-ladder.js";

export class PrismaAICacheStore implements AICacheStore {
  constructor(private readonly prisma: PrismaClient) {}

  async get(keyHash: string): Promise<CachedEntry | null> {
    const row = await this.prisma.aiResultCache.findUnique({ where: { keyHash } });
    if (!row) return null;
    return {
      keyHash: row.keyHash, taskType: row.taskType, output: JSON.parse(row.output),
      groundedOn: [], tokensUsed: row.tokensUsed, hitCount: row.hitCount, stale: row.stale,
    };
  }

  async put(entry: CachedEntry): Promise<void> {
    await this.prisma.aiResultCache.upsert({
      where: { keyHash: entry.keyHash },
      create: {
        keyHash: entry.keyHash, taskType: entry.taskType, inputHash: entry.keyHash,
        output: JSON.stringify(entry.output), modelVersion: "template-1", resolutionTier: "llm",
        tokensUsed: entry.tokensUsed, tokensSaved: 0, hitCount: 0, stale: false,
        deps: { create: entry.groundedOn.map((id) => ({ entityType: "unknown", entityId: id })) },
      },
      update: { output: JSON.stringify(entry.output), stale: false },
    });
  }

  async bumpHit(keyHash: string, tokensSaved: number): Promise<void> {
    await this.prisma.aiResultCache.update({
      where: { keyHash },
      data: { hitCount: { increment: 1 }, tokensSaved: { increment: tokensSaved }, lastUsedAt: new Date() },
    });
  }

  async markStaleByEntity(entityId: string): Promise<number> {
    const deps = await this.prisma.aiCacheDep.findMany({ where: { entityId }, select: { cacheId: true } });
    const ids = [...new Set(deps.map((d) => d.cacheId))];
    if (ids.length === 0) return 0;
    const res = await this.prisma.aiResultCache.updateMany({ where: { id: { in: ids }, stale: false }, data: { stale: true } });
    return res.count;
  }
}

export async function logAiTask(prisma: PrismaClient, taskType: string, o: ResolutionOutcome): Promise<void> {
  await prisma.aiTask.create({
    data: {
      taskType, inputHash: "", output: JSON.stringify(o.output), groundedOn: JSON.stringify(o.groundedOn),
      confidence: o.confidence, resolutionTier: o.tier, tokensUsed: o.tokensUsed, tokensSaved: o.tokensSaved,
      humanReviewed: false,
    },
  });
}
