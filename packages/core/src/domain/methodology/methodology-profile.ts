import type { MethodologyKey } from "../shared/enums.js";
import type { WorkItemTypeSet, WorkflowDefinition, LifecycleDefinition } from "./config.js";
import type { MetricsStrategy } from "../metrics/metrics-strategy.js";
import type { SchedulingStrategy } from "../scheduling/scheduling-strategy.js";

export interface MethodologyProfile {
  readonly key: MethodologyKey;
  workItemTypes(): WorkItemTypeSet;
  workflow(): WorkflowDefinition;
  lifecycle(): LifecycleDefinition;
  metrics(): MetricsStrategy;
  scheduler(): SchedulingStrategy;
}
