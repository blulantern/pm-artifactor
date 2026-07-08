import type { PrismaClient } from "@prisma/client";
import type { FeatureRecord } from "@pma/core";

/** Writes deterministic-analyzer output to the FeatureRecord table. Returns the count written. */
export async function persistFeatures(prisma: PrismaClient, records: FeatureRecord[]): Promise<number> {
  if (records.length === 0) return 0;
  await prisma.featureRecord.createMany({
    data: records.map((r) => ({
      metric: r.metric,
      entityType: r.entity.type,
      entityId: r.entity.id,
      value: JSON.stringify(r.value),
      computedAt: r.computedAt,
      deterministicFn: r.deterministicFn,
      fnVersion: r.fnVersion,
    })),
  });
  return records.length;
}
