import type { PrismaClient } from "@prisma/client";
import type { EventBus, DomainEvent } from "@pma/core";

/** Local-tier EventBus: synchronous in-process dispatch + durable outbox record. */
export class SqliteEventBus implements EventBus {
  private readonly handlers = new Map<string, ((e: DomainEvent) => Promise<void>)[]>();
  constructor(private readonly prisma: PrismaClient) {}

  subscribe(type: string, handler: (e: DomainEvent) => Promise<void>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  async publish(events: DomainEvent[]): Promise<void> {
    for (const e of events) {
      await this.prisma.outboxEntry.create({
        data: { type: e.type, payload: JSON.stringify(e), status: "pending" },
      });
      for (const h of this.handlers.get(e.type) ?? []) await h(e);
    }
  }

  async pendingCount(): Promise<number> {
    return this.prisma.outboxEntry.count({ where: { status: "pending" } });
  }
}
