import { expect, test } from "vitest";
import { makeTestDb } from "@pma/db/src/testing/test-db.js";
import { linkExternal, severLinks, provenanceOf } from "./entity-links.js";

test("link → connected, sever → formerly_synced, unlinked → manual", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const org = await prisma.organization.create({ data: { name: "WS" } });
    const sys = await prisma.externalSystem.create({ data: { vendor: "jira" } });
    const conn = await prisma.syncConnection.create({ data: { externalSystemId: sys.id, authRef: "kc:1" } });
    const prog = await prisma.program.create({ data: { organizationId: org.id, name: "P" } });
    const ref = { type: "program" as const, id: prog.id };

    expect((await provenanceOf(prisma, ref)).state).toBe("manual");
    await linkExternal(prisma, { ref, externalSystemId: sys.id, externalId: "JIRA-1", externalUrl: null });
    // entity-links uses a connection when present; create one link via connection:
    await prisma.externalLink.updateMany({ where: { internalId: prog.id }, data: { syncConnectionId: conn.id } });
    expect((await provenanceOf(prisma, ref)).state).toBe("connected");
    await severLinks(prisma, ref);
    expect((await provenanceOf(prisma, ref)).state).toBe("formerly_synced");
  } finally {
    await cleanup();
  }
}, 30000);
