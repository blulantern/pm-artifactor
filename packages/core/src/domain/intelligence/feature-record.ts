import type { Band } from "../shared/enums.js";

export type Trend = "improving" | "flat" | "worsening";

export type FeatureValue =
  | { kind: "number"; number: number }
  | { kind: "band"; band: Band }
  | { kind: "category"; category: string }
  | { kind: "trend"; trend: Trend }
  | { kind: "vector"; vector: number[] };

export interface FeatureEntity { type: string; id: string; }

export interface FeatureRecord {
  metric: string;
  entity: FeatureEntity;
  value: FeatureValue;
  computedAt: Date;
  deterministicFn: string;
  fnVersion: string;
}

export interface AnalyzerResult<T> {
  result: T;
  features: FeatureRecord[];
}

export function feature(
  metric: string,
  entity: FeatureEntity,
  value: FeatureValue,
  computedAt: Date,
  deterministicFn: string,
  fnVersion: string,
): FeatureRecord {
  return { metric, entity, value, computedAt, deterministicFn, fnVersion };
}
