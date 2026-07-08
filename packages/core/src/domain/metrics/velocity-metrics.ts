import { type MetricsStrategy, type MetricsInput, type Progress, doneFraction } from "./metrics-strategy.js";

export class VelocityMetrics implements MetricsStrategy {
  readonly key = "VELOCITY";
  progress(input: MetricsInput): Progress {
    return { percentComplete: doneFraction(input) };
  }
}
