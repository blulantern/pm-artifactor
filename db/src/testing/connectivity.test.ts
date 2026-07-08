import { expect, test } from "vitest";
import { makeTestDb } from "./test-db.js";

test("a fresh test DB accepts and reads back an organization", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const found = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(found?.name).toBe("Acme");
  } finally {
    await cleanup();
  }
}, 30000);
