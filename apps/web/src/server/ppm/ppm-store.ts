import type { PrismaClient } from "@prisma/client";
import type { EntityRef, SpineType } from "@pma/contracts";
import { applyEdit, type DeleteResolution } from "@pma/core";
import { provenanceOf } from "./entity-links.js";

type Delegate = {
  create(a: { data: Record<string, unknown> }): Promise<any>;
  findUnique(a: { where: { id: string } }): Promise<any>;
  update(a: { where: { id: string }; data: Record<string, unknown> }): Promise<any>;
  delete(a: { where: { id: string } }): Promise<any>;
};
const delegate = (prisma: PrismaClient, type: SpineType): Delegate =>
  ({ portfolio: prisma.portfolio, program: prisma.program, product: prisma.product, project: prisma.project }[type] as unknown as Delegate);

export function createEntity(prisma: PrismaClient, type: SpineType, input: Record<string, unknown>) {
  return delegate(prisma, type).create({ data: input });
}

export async function updateEntity(prisma: PrismaClient, type: SpineType, id: string, patch: Record<string, unknown>) {
  const current = await delegate(prisma, type).findUnique({ where: { id } });
  const prov = await provenanceOf(prisma, { type, id });
  const overriddenFields: string[] = current.overriddenFields ? JSON.parse(current.overriddenFields) : [];
  const r = applyEdit(current, patch, { connected: prov.state === "connected", overriddenFields });
  return delegate(prisma, type).update({
    where: { id },
    data: { ...patch, overriddenFields: r.overriddenFields.length ? JSON.stringify(r.overriddenFields) : null },
  });
}

/** PPM children to offer in the delete dialog: portfolio→programs+products+direct projects; program→projects; product→delivering projects. Projects have none. */
export async function childrenOf(prisma: PrismaClient, ref: EntityRef): Promise<{ ref: EntityRef; name: string }[]> {
  const out: { ref: EntityRef; name: string }[] = [];
  const push = (type: SpineType, rows: { id: string; name: string }[]) => rows.forEach((r) => out.push({ ref: { type, id: r.id }, name: r.name }));
  if (ref.type === "portfolio") {
    push("program", await prisma.program.findMany({ where: { portfolioId: ref.id, archivedAt: null } }));
    push("product", await prisma.product.findMany({ where: { portfolioId: ref.id, archivedAt: null } }));
    push("project", await prisma.project.findMany({ where: { portfolioId: ref.id, archivedAt: null } }));
  } else if (ref.type === "program") {
    push("project", await prisma.project.findMany({ where: { programId: ref.id, archivedAt: null } }));
  } else if (ref.type === "product") {
    push("project", await prisma.project.findMany({ where: { productId: ref.id, archivedAt: null } }));
  }
  return out;
}

// The single FK column on a child that points at a given parent type. Detach must null only the
// FK pointing at the parent being deleted, not every parent FK the child happens to declare —
// otherwise a kept child gets silently unlinked from unrelated parents it's still connected to.
const PARENT_FK_FOR: Record<SpineType, string | null> = {
  portfolio: "portfolioId",
  program: "programId",
  product: "productId",
  project: null,
};

export async function applyDeleteResolution(prisma: PrismaClient, resolution: DeleteResolution): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const ref of resolution.archive) {
      await delegate(tx as unknown as PrismaClient, ref.type).update({ where: { id: ref.id }, data: { archivedAt: new Date() } });
    }
    const parent = resolution.archive[0]; // resolveDelete puts the parent first
    const fk = parent ? PARENT_FK_FOR[parent.type] : null;
    if (fk) {
      for (const ref of resolution.detach) {
        await delegate(tx as unknown as PrismaClient, ref.type).update({ where: { id: ref.id }, data: { [fk]: null } });
      }
    }
  });
}

export function restore(prisma: PrismaClient, ref: EntityRef) {
  return delegate(prisma, ref.type).update({ where: { id: ref.id }, data: { archivedAt: null } });
}
export function hardDelete(prisma: PrismaClient, ref: EntityRef) {
  return delegate(prisma, ref.type).delete({ where: { id: ref.id } });
}
