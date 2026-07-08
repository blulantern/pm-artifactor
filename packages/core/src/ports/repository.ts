import type { WorkItem } from "../domain/workitem/work-item.js";
import type { WorkItemId, ProjectId } from "../domain/shared/ids.js";

export interface WorkItemRepository {
  findByProject(projectId: ProjectId): Promise<WorkItem[]>;
  findById(id: WorkItemId): Promise<WorkItem | null>;
  save(item: WorkItem): Promise<void>;
}
