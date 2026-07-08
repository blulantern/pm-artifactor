import { expect, test } from "vitest";
import { makeTestDb } from "../testing/test-db.js";
import { SqliteEventBus } from "./sqlite-event-bus.js";
import { PrismaOutbox } from "./prisma-outbox.js";

test("event bus dispatches synchronously and records to the outbox", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const bus = new SqliteEventBus(prisma);
    const seen: string[] = [];
    bus.subscribe("WorkItemStatusChanged", async (e) => { seen.push(e.aggregateId); });
    await bus.publish([{ type: "WorkItemStatusChanged", occurredAt: new Date(), aggregateId: "wi-1" }]);
    expect(seen).toEqual(["wi-1"]);
    expect(await bus.pendingCount()).toBe(1);
  } finally {
    await cleanup();
  }
}, 30000);

test("outbox enqueue writes a pending entry", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const outbox = new PrismaOutbox(prisma);
    await outbox.enqueue({ type: "PushWorkItem", payload: { id: "wi-1" } });
    const rows = await prisma.outboxEntry.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("pending");
  } finally {
    await cleanup();
  }
}, 30000);
