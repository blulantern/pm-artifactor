import type { PrioritizationStrategy, ScorableItem, PriorityScore } from "./prioritization-strategy.js";
import type { AnalyzerResult, FeatureRecord } from "../intelligence/feature-record.js";
import { feature } from "../intelligence/feature-record.js";

export class RiceStrategy implements PrioritizationStrategy {
  readonly key = "RICE" as const;
  rank(items: ScorableItem[], now: Date): AnalyzerResult<PriorityScore[]> {
    const features: FeatureRecord[] = [];
    const scores = items.map((it) => {
      const r = it.rice ?? { reach: 0, impact: 0, confidence: 0, effort: 1 };
      const effort = r.effort > 0 ? r.effort : 1;
      const value = round2((r.reach * r.impact * (r.confidence / 100)) / effort);
      features.push(feature("prioritization.rice", { type: "work_item", id: it.id }, { kind: "number", number: value }, now, "rice", "1"));
      return {
        id: it.id, value,
        components: { reach: r.reach, impact: r.impact, confidence: r.confidence, effort },
        rationale: `(Reach ${r.reach} × Impact ${r.impact} × Confidence ${r.confidence}%) ÷ Effort ${effort}`,
      };
    });
    scores.sort((a, b) => b.value - a.value);
    return { result: scores, features };
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
