import type { MethodologyProfile } from "./methodology-profile.js";
import type { WorkItemTypeSet, WorkflowDefinition, LifecycleDefinition } from "./config.js";
import { EarnedValueMetrics } from "../metrics/earned-value-metrics.js";
import { criticalPathScheduler, type SchedulingStrategy } from "../scheduling/scheduling-strategy.js";
import { workItemTypeId, workflowStateId } from "../shared/ids.js";

export class WaterfallProfile implements MethodologyProfile {
  readonly key = "WATERFALL" as const;
  constructor(
    private readonly types: WorkItemTypeSet = DEFAULT_WF_TYPES,
    private readonly wf: WorkflowDefinition = DEFAULT_WF_WORKFLOW,
    private readonly lc: LifecycleDefinition = DEFAULT_WF_LIFECYCLE,
  ) {}
  workItemTypes(): WorkItemTypeSet { return this.types; }
  workflow(): WorkflowDefinition { return this.wf; }
  lifecycle(): LifecycleDefinition { return this.lc; }
  metrics() { return new EarnedValueMetrics(); }
  scheduler(): SchedulingStrategy { return criticalPathScheduler; }
}

export const DEFAULT_WF_TYPES: WorkItemTypeSet = [
  { id: workItemTypeId("wf-wp"), name: "Work Package", hierarchyLevel: 1, defaultEstimateUnit: "days" },
  { id: workItemTypeId("wf-activity"), name: "Activity", hierarchyLevel: 2, defaultEstimateUnit: "days" },
  { id: workItemTypeId("wf-task"), name: "Task", hierarchyLevel: 3, defaultEstimateUnit: "days" },
];

export const DEFAULT_WF_WORKFLOW: WorkflowDefinition = {
  states: [
    { id: workflowStateId("wf-notstarted"), name: "Not Started", category: "todo", order: 0 },
    { id: workflowStateId("wf-inprogress"), name: "In Progress", category: "in_progress", order: 1 },
    { id: workflowStateId("wf-complete"), name: "Complete", category: "done", order: 2 },
  ],
  transitions: [
    { fromStateId: workflowStateId("wf-notstarted"), toStateId: workflowStateId("wf-inprogress"), name: "begin" },
    { fromStateId: workflowStateId("wf-inprogress"), toStateId: workflowStateId("wf-complete"), name: "complete", requiresApproval: true },
  ],
};

export const DEFAULT_WF_LIFECYCLE: LifecycleDefinition = {
  name: "Waterfall",
  phases: [
    { name: "Initiate", sequence: 0, gateRequired: true },
    { name: "Plan", sequence: 1, gateRequired: true },
    { name: "Execute", sequence: 2, gateRequired: true },
    { name: "Monitor", sequence: 3, gateRequired: false },
    { name: "Close", sequence: 4, gateRequired: true },
  ],
};
