import type { WorkItemRepository } from "../ports/repository.js";
import type { WorkItem } from "../domain/workitem/work-item.js";
import type { WorkItemId, ProjectId } from "../domain/shared/ids.js";

export class InMemoryWorkItemRepository implements WorkItemRepository {
  private readonly items = new Map<string, WorkItem>();
  async findByProject(projectId: ProjectId): Promise<WorkItem[]> {
    return [...this.items.values()].filter((i) => i.toProps().projectId === projectId);
  }
  async findById(id: WorkItemId): Promise<WorkItem | null> {
    return this.items.get(id) ?? null;
  }
  async save(item: WorkItem): Promise<void> {
    this.items.set(item.id, item);
  }
}
