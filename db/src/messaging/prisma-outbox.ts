import type { PrismaClient } from "@prisma/client";
import type { OutboxPort } from "@pma/core";

export class PrismaOutbox implements OutboxPort {
  constructor(private readonly prisma: PrismaClient) {}
  async enqueue(command: { type: string; payload: unknown }): Promise<void> {
    await this.prisma.outboxEntry.create({
      data: { type: command.type, payload: JSON.stringify(command.payload), status: "pending" },
    });
  }
}
