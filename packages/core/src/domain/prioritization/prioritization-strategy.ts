import type { AnalyzerResult } from "../intelligence/feature-record.js";

export interface ScorableItem {
  id: string;
  title: string;
  estimate: number | null;
  wsjf?: { userBusinessValue: number; timeCriticality: number; riskReduction: number };
  rice?: { reach: number; impact: number; confidence: number; effort: number };
}

export interface PriorityScore {
  id: string;
  value: number;
  components: Record<string, number>;
  rationale: string;
}

export interface PrioritizationStrategy {
  readonly key: "WSJF" | "RICE";
  rank(items: ScorableItem[], now: Date): AnalyzerResult<PriorityScore[]>;
}
