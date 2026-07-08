import { WorkItem, workItemId, projectId, workItemTypeId, personId } from "@pma/core";
import type { WorkItemProps } from "@pma/core";
import type { StatusCategory, Band, EstimateUnit } from "@pma/core";

export interface WorkItemRow {
  id: string;
  projectId: string;
  parentId: string | null;
  workItemTypeId: string;
  assigneeId: string | null;
  title: string;
  status: string;
  estimate: number | null;
  estimateUnit: string | null;
  complexityBand: string | null;
  riskBand: string | null;
}

export function toDomain(row: WorkItemRow): WorkItem {
  const props: WorkItemProps = {
    id: workItemId(row.id),
    projectId: projectId(row.projectId),
    parentId: row.parentId ? workItemId(row.parentId) : null,
    typeId: workItemTypeId(row.workItemTypeId),
    title: row.title,
    status: row.status as StatusCategory,
    estimate: row.estimate,
    estimateUnit: (row.estimateUnit as EstimateUnit | null) ?? null,
    complexityBand: (row.complexityBand as Band | null) ?? null,
    riskBand: (row.riskBand as Band | null) ?? null,
    assigneeId: row.assigneeId ? personId(row.assigneeId) : null,
  };
  return new WorkItem(props);
}

export function toCreateInput(item: WorkItem) {
  const p = item.toProps();
  return {
    id: p.id,
    projectId: p.projectId,
    parentId: p.parentId,
    workItemTypeId: p.typeId,
    assigneeId: p.assigneeId,
    title: p.title,
    status: p.status,
    estimate: p.estimate,
    estimateUnit: p.estimateUnit,
    complexityBand: p.complexityBand,
    riskBand: p.riskBand,
    rank: 0,
  };
}
