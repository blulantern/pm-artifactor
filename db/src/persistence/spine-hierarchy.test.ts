import { expect, test } from "vitest";
import { makeTestDb } from "../testing/test-db.js";

test("programs, products, and projects can be standalone and cross-linked", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const org = await prisma.organization.create({ data: { name: "WS" } });
    const method = await prisma.methodology.create({ data: { key: "SCRUM", name: "Scrum", family: "agile" } });

    // standalone program (no portfolio) + standalone product
    const program = await prisma.program.create({ data: { organizationId: org.id, name: "P1" } });
    const product = await prisma.product.create({ data: { organizationId: org.id, name: "Prod1" } });

    // standalone project delivering the product, no portfolio/program
    const project = await prisma.project.create({
      data: { organizationId: org.id, name: "Proj1", methodologyId: method.id, productId: product.id },
    });

    expect(program.portfolioId).toBeNull();
    expect(product.portfolioId).toBeNull();
    expect(project.portfolioId).toBeNull();
    expect(project.programId).toBeNull();
    expect(project.productId).toBe(product.id);
    expect(project.overriddenFields).toBeNull();
    expect(project.archivedAt).toBeNull();
  } finally {
    await cleanup();
  }
}, 30000);
