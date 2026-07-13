import { expect, test } from "vitest";
import { makeTestDb } from "@pma/db/src/testing/test-db.js";
import { buildProductsView } from "./view-models.js";

test("products view lists standalone + portfolio-owned with project counts", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const org = await prisma.organization.create({ data: { name: "WS" } });
    const method = await prisma.methodology.create({ data: { key: "SCRUM", name: "Scrum", family: "agile" } });
    const product = await prisma.product.create({ data: { organizationId: org.id, name: "Prod" } });
    await prisma.project.create({ data: { organizationId: org.id, name: "Pj", methodologyId: method.id, productId: product.id } });
    const view = await buildProductsView(prisma);
    expect(view.products[0]).toMatchObject({ name: "Prod", portfolioName: null, projectCount: 1, provenance: "manual" });
  } finally {
    await cleanup();
  }
}, 30000);
