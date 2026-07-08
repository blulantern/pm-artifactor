import { type MetricsStrategy, type MetricsInput, type Progress, doneFraction } from "./metrics-strategy.js";

export class EarnedValueMetrics implements MetricsStrategy {
  readonly key = "EARNED_VALUE";
  progress(input: MetricsInput): Progress {
    const pct = doneFraction(input);
    const pv = input.plannedValue ?? 0;
    const ac = input.actualCost ?? 0;
    const ev = pct * pv;
    return {
      percentComplete: pct,
      earnedValue: ev,
      spi: pv === 0 ? 0 : ev / pv,
      cpi: ac === 0 ? 0 : ev / ac,
    };
  }
}
