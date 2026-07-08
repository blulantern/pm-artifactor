import { expect, test } from "vitest";
import { makeTestDb } from "@pma/db/src/testing/test-db.js";
import { seedMethodologies } from "@pma/db/prisma/seed-methodologies.js";
import { seedPoc } from "@pma/db/prisma/seed-poc.js";
import { FakeWorkTrackerAdapter, ingestWorkItems } from "./fake-ingestion.js";

test("pull → IngestionSnapshot (provenance) → normalized canonical WorkItem + ExternalLink", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await seedMethodologies(prisma);
    await seedPoc(prisma);
    const sys = await prisma.externalSystem.create({ data: { vendor: "jira" } });
    const conn = await prisma.syncConnection.create({ data: { externalSystemId: sys.id, authRef: "keychain:jira", direction: "inbound" } });

    const envelopes = await new FakeWorkTrackerAdapter().pull();
    expect(envelopes[0]!.provenance.mode).toBe("read_only");

    const before = await prisma.workItem.count();
    const res = await ingestWorkItems(prisma, conn.id, envelopes);
    expect(res.snapshots).toBe(envelopes.length);
    expect(res.created).toBe(envelopes.length);

    // Snapshots carry provenance and are marked normalized.
    const snaps = await prisma.ingestionSnapshot.findMany();
    expect(snaps.every((s) => s.normalized)).toBe(true);
    expect(snaps[0]!.source).toBe("jira");
    // Canonical entities + external links created.
    expect(await prisma.workItem.count()).toBe(before + envelopes.length);
    expect(await prisma.externalLink.count()).toBe(envelopes.length);
  } finally { await cleanup(); }
}, 30000);
