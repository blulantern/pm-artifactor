import { expect, test } from "vitest";
import { makeTestDb } from "@pma/db/src/testing/test-db.js";
import { createEntity, updateEntity, childrenOf, applyDeleteResolution } from "./ppm-store.js";
import { resolveDelete } from "@pma/core";

test("create standalone, update tracks manual edit, delete detaches kept child", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const org = await prisma.organization.create({ data: { name: "WS" } });
    const method = await prisma.methodology.create({ data: { key: "SCRUM", name: "Scrum", family: "agile" } });
    const portfolio = await createEntity(prisma, "portfolio", { name: "Port", organizationId: org.id });
    const program = await createEntity(prisma, "program", { name: "Prog", organizationId: org.id, portfolioId: portfolio.id });

    const updated = await updateEntity(prisma, "program", program.id, { name: "Prog2" });
    expect(updated.name).toBe("Prog2");
    expect(updated.overriddenFields).toBeNull(); // manual entity: no override tracking

    const kids = await childrenOf(prisma, { type: "portfolio", id: portfolio.id });
    expect(kids.map((k) => k.ref.id)).toContain(program.id);

    await applyDeleteResolution(
      prisma,
      resolveDelete({ type: "portfolio", id: portfolio.id }, [{ ref: { type: "program", id: program.id }, disposition: "keep" }]),
    );
    const port = await prisma.portfolio.findUnique({ where: { id: portfolio.id } });
    const prog = await prisma.program.findUnique({ where: { id: program.id } });
    expect(port?.archivedAt).not.toBeNull();       // parent archived
    expect(prog?.archivedAt).toBeNull();            // kept child stays active…
    expect(prog?.portfolioId).toBeNull();           // …detached to standalone
  } finally {
    await cleanup();
  }
}, 30000);

test("delete detaches kept child only from the parent being deleted, preserving its other parent links", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const org = await prisma.organization.create({ data: { name: "WS2" } });
    const method = await prisma.methodology.create({ data: { key: "SCRUM", name: "Scrum", family: "agile" } });
    const portfolio = await createEntity(prisma, "portfolio", { name: "Port", organizationId: org.id });
    const program = await createEntity(prisma, "program", { name: "Prog", organizationId: org.id, portfolioId: portfolio.id });
    const project = await createEntity(prisma, "project", {
      name: "Proj",
      organizationId: org.id,
      methodologyId: method.id,
      portfolioId: portfolio.id,
      programId: program.id,
    });

    await applyDeleteResolution(
      prisma,
      resolveDelete({ type: "program", id: program.id }, [{ ref: { type: "project", id: project.id }, disposition: "keep" }]),
    );

    const prog = await prisma.program.findUnique({ where: { id: program.id } });
    const proj = await prisma.project.findUnique({ where: { id: project.id } });
    expect(prog?.archivedAt).not.toBeNull();        // parent archived
    expect(proj?.archivedAt).toBeNull();             // kept child stays active
    expect(proj?.programId).toBeNull();               // …detached from the deleted parent (program)…
    expect(proj?.portfolioId).toBe(portfolio.id);     // …but its unrelated portfolio link survives
  } finally {
    await cleanup();
  }
}, 30000);
