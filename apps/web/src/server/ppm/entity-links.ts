import type { PrismaClient } from "@prisma/client";
import type { EntityRef, ExternalLinkInput, ProvenanceState } from "@pma/contracts";

/** Creates an ExternalLink for a manual or synced connection to an external item. */
export async function linkExternal(prisma: PrismaClient, input: ExternalLinkInput) {
  // A manual link has no live SyncConnection; find-or-create a link-only connection for the system.
  const conn = await prisma.syncConnection.findFirst({ where: { externalSystemId: input.externalSystemId } })
    ?? (await prisma.syncConnection.create({ data: { externalSystemId: input.externalSystemId, authRef: "manual" } }));
  return prisma.externalLink.create({
    data: {
      syncConnectionId: conn.id,
      internalType: input.ref.type,
      internalId: input.ref.id,
      externalId: input.externalId,
      externalUrl: input.externalUrl ?? null,
    },
  });
}

export async function linksFor(prisma: PrismaClient, ref: EntityRef) {
  return prisma.externalLink.findMany({
    where: { internalType: ref.type, internalId: ref.id, severedAt: null },
  });
}

export async function severLinks(prisma: PrismaClient, ref: EntityRef): Promise<number> {
  const res = await prisma.externalLink.updateMany({
    where: { internalType: ref.type, internalId: ref.id, severedAt: null },
    data: { severedAt: new Date() },
  });
  return res.count;
}

export async function provenanceOf(
  prisma: PrismaClient,
  ref: EntityRef,
): Promise<{ state: ProvenanceState; system: string | null }> {
  const all = await prisma.externalLink.findMany({
    where: { internalType: ref.type, internalId: ref.id },
    include: { syncConnection: { include: { externalSystem: true } } },
  });
  if (all.length === 0) return { state: "manual", system: null };
  const active = all.find((l) => l.severedAt === null);
  // all.length > 0 was checked above, so all[0] is guaranteed to exist here.
  const link = active ?? all[0]!;
  const system = link.syncConnection.externalSystem.vendor;
  return { state: active ? "connected" : "formerly_synced", system };
}
