import type { WorkItemId, ProjectId, WorkItemTypeId, PersonId } from "../shared/ids.js";
import type { StatusCategory, Band, EstimateUnit } from "../shared/enums.js";

export interface WorkItemProps {
  readonly id: WorkItemId;
  readonly projectId: ProjectId;
  readonly parentId: WorkItemId | null;
  readonly typeId: WorkItemTypeId;
  readonly title: string;
  readonly status: StatusCategory;
  readonly estimate: number | null;
  readonly estimateUnit: EstimateUnit | null;
  readonly complexityBand: Band | null;
  readonly riskBand: Band | null;
  readonly assigneeId: PersonId | null;
}

export class WorkItem {
  constructor(private readonly props: WorkItemProps) {}
  get id(): WorkItemId { return this.props.id; }
  get parentId(): WorkItemId | null { return this.props.parentId; }
  get status(): StatusCategory { return this.props.status; }
  get estimate(): number | null { return this.props.estimate; }
  get complexityBand(): Band | null { return this.props.complexityBand; }
  get riskBand(): Band | null { return this.props.riskBand; }
  get assigneeId(): PersonId | null { return this.props.assigneeId; }
  get title(): string { return this.props.title; }
  toProps(): WorkItemProps { return this.props; }
}
