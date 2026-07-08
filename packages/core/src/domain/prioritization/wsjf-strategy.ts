import type { PrioritizationStrategy, ScorableItem, PriorityScore } from "./prioritization-strategy.js";
import type { AnalyzerResult, FeatureRecord } from "../intelligence/feature-record.js";
import { feature } from "../intelligence/feature-record.js";

export class WsjfStrategy implements PrioritizationStrategy {
  readonly key = "WSJF" as const;
  rank(items: ScorableItem[], now: Date): AnalyzerResult<PriorityScore[]> {
    const features: FeatureRecord[] = [];
    const scores = items.map((it) => {
      const w = it.wsjf ?? { userBusinessValue: 0, timeCriticality: 0, riskReduction: 0 };
      const size = it.estimate && it.estimate > 0 ? it.estimate : 1;
      const cod = w.userBusinessValue + w.timeCriticality + w.riskReduction;
      const value = round2(cod / size);
      features.push(feature("prioritization.wsjf", { type: "work_item", id: it.id }, { kind: "number", number: value }, now, "wsjf", "1"));
      return {
        id: it.id, value,
        components: { userBusinessValue: w.userBusinessValue, timeCriticality: w.timeCriticality, riskReduction: w.riskReduction, jobSize: size },
        rationale: `Cost of Delay ${cod} ÷ Job Size ${size}`,
      };
    });
    scores.sort((a, b) => b.value - a.value);
    return { result: scores, features };
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
