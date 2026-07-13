import { db } from "@/server/db";

export interface ManageOptions {
  organizationId: string;
  portfolios: { id: string; name: string }[];
  programs: { id: string; name: string }[];
  products: { id: string; name: string }[];
  methodologies: { id: string; name: string }[];
  externalSystems: { id: string; vendor: string }[];
}

export async function getManageOptions(): Promise<ManageOptions> {
  const prisma = db();
  const org = await prisma.organization.findFirst();
  const [portfolios, programs, products, methodologies, externalSystems] = await Promise.all([
    prisma.portfolio.findMany({ where: { archivedAt: null }, select: { id: true, name: true } }),
    prisma.program.findMany({ where: { archivedAt: null }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { archivedAt: null }, select: { id: true, name: true } }),
    prisma.methodology.findMany({ select: { id: true, name: true } }),
    prisma.externalSystem.findMany({ select: { id: true, vendor: true } }),
  ]);
  return { organizationId: org?.id ?? "", portfolios, programs, products, methodologies, externalSystems };
}
