import type { DomainEvent } from "./domain-event.js";
import type { WorkItemId, ProjectId } from "../shared/ids.js";
import type { StatusCategory } from "../shared/enums.js";

export interface WorkItemCreated extends DomainEvent {
  readonly type: "WorkItemCreated";
  readonly workItemId: WorkItemId;
  readonly projectId: ProjectId;
}

export interface WorkItemStatusChanged extends DomainEvent {
  readonly type: "WorkItemStatusChanged";
  readonly workItemId: WorkItemId;
  readonly from: StatusCategory;
  readonly to: StatusCategory;
}

export const workItemCreated = (
  id: WorkItemId,
  project: ProjectId,
  occurredAt: Date,
): WorkItemCreated => ({
  type: "WorkItemCreated",
  occurredAt,
  aggregateId: id,
  workItemId: id,
  projectId: project,
});

export const workItemStatusChanged = (
  id: WorkItemId,
  from: StatusCategory,
  to: StatusCategory,
  occurredAt: Date,
): WorkItemStatusChanged => ({
  type: "WorkItemStatusChanged",
  occurredAt,
  aggregateId: id,
  workItemId: id,
  from,
  to,
});
