import type { WorkItemTypeId, WorkflowStateId } from "../shared/ids.js";
import type { StatusCategory, EstimateUnit } from "../shared/enums.js";

export interface WorkItemTypeDef {
  readonly id: WorkItemTypeId;
  readonly name: string;
  readonly hierarchyLevel: number;
  readonly defaultEstimateUnit: EstimateUnit | null;
}
export type WorkItemTypeSet = readonly WorkItemTypeDef[];

export interface WorkflowStateDef {
  readonly id: WorkflowStateId;
  readonly name: string;
  readonly category: StatusCategory;
  readonly order: number;
}

export interface StateTransitionDef {
  readonly fromStateId: WorkflowStateId;
  readonly toStateId: WorkflowStateId;
  readonly name: string;
  readonly requiresApproval?: boolean;
}

export interface WorkflowDefinition {
  readonly states: readonly WorkflowStateDef[];
  readonly transitions: readonly StateTransitionDef[];
}

export interface LifecyclePhaseDef {
  readonly name: string;
  readonly sequence: number;
  readonly gateRequired: boolean;
}
export interface LifecycleDefinition {
  readonly name: string;
  readonly phases: readonly LifecyclePhaseDef[];
}

export function legalNextStates(
  wf: WorkflowDefinition,
  from: WorkflowStateId,
): WorkflowStateDef[] {
  const targets = wf.transitions
    .filter((t) => t.fromStateId === from)
    .map((t) => t.toStateId);
  return wf.states.filter((s) => targets.includes(s.id));
}
