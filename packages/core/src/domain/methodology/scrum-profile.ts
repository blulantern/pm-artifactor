import type { MethodologyProfile } from "./methodology-profile.js";
import type { WorkItemTypeSet, WorkflowDefinition, LifecycleDefinition } from "./config.js";
import { VelocityMetrics } from "../metrics/velocity-metrics.js";
import { sprintCapacityScheduler, type SchedulingStrategy } from "../scheduling/scheduling-strategy.js";
import { workItemTypeId, workflowStateId } from "../shared/ids.js";

/** Structural products default to the seeded Scrum bundle; overridable via constructor for config-as-data. */
export class ScrumProfile implements MethodologyProfile {
  readonly key = "SCRUM" as const;
  constructor(
    private readonly types: WorkItemTypeSet = DEFAULT_SCRUM_TYPES,
    private readonly wf: WorkflowDefinition = DEFAULT_SCRUM_WORKFLOW,
    private readonly lc: LifecycleDefinition = DEFAULT_SCRUM_LIFECYCLE,
  ) {}
  workItemTypes(): WorkItemTypeSet { return this.types; }
  workflow(): WorkflowDefinition { return this.wf; }
  lifecycle(): LifecycleDefinition { return this.lc; }
  metrics() { return new VelocityMetrics(); }
  scheduler(): SchedulingStrategy { return sprintCapacityScheduler; }
}

export const DEFAULT_SCRUM_TYPES: WorkItemTypeSet = [
  { id: workItemTypeId("scrum-epic"), name: "Epic", hierarchyLevel: 1, defaultEstimateUnit: "points" },
  { id: workItemTypeId("scrum-story"), name: "Story", hierarchyLevel: 2, defaultEstimateUnit: "points" },
  { id: workItemTypeId("scrum-task"), name: "Task", hierarchyLevel: 3, defaultEstimateUnit: "points" },
];

export const DEFAULT_SCRUM_WORKFLOW: WorkflowDefinition = {
  states: [
    { id: workflowStateId("scrum-todo"), name: "To Do", category: "todo", order: 0 },
    { id: workflowStateId("scrum-doing"), name: "In Progress", category: "in_progress", order: 1 },
    { id: workflowStateId("scrum-done"), name: "Done", category: "done", order: 2 },
  ],
  transitions: [
    { fromStateId: workflowStateId("scrum-todo"), toStateId: workflowStateId("scrum-doing"), name: "start" },
    { fromStateId: workflowStateId("scrum-doing"), toStateId: workflowStateId("scrum-done"), name: "finish" },
  ],
};

export const DEFAULT_SCRUM_LIFECYCLE: LifecycleDefinition = {
  name: "Scrum",
  phases: [{ name: "Sprint", sequence: 0, gateRequired: false }],
};
