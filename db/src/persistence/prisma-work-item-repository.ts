import type { PrismaClient } from "@prisma/client";
import type { WorkItemRepository, WorkItem, WorkItemId, ProjectId } from "@pma/core";
import { toDomain, toCreateInput, type WorkItemRow } from "./work-item-mapper.js";

export class PrismaWorkItemRepository implements WorkItemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByProject(projectId: ProjectId): Promise<WorkItem[]> {
    const rows = await this.prisma.workItem.findMany({ where: { projectId: projectId as string } });
    return rows.map((r) => toDomain(r as unknown as WorkItemRow));
  }

  async findById(id: WorkItemId): Promise<WorkItem | null> {
    const row = await this.prisma.workItem.findUnique({ where: { id: id as string } });
    return row ? toDomain(row as unknown as WorkItemRow) : null;
  }

  async save(item: WorkItem): Promise<void> {
    const data = toCreateInput(item);
    await this.prisma.workItem.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }
}
