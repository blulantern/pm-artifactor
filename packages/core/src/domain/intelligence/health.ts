import { feature, type AnalyzerResult, type FeatureRecord, type Trend } from "./feature-record.js";

export type DriverName =
  | "schedule_variance" | "cost_variance" | "scope_creep" | "raid_exposure"
  | "dependency_risk" | "benefit_confidence" | "team_health";

export interface HealthDriverInput { name: DriverName; severity: number; trend: Trend; }

export interface HealthComposite {
  entityId: string;
  composite: number;
  drivers: { name: DriverName; severity: number; trend: Trend }[];
  primaryDriver: DriverName | null;
}

export function computeHealth(
  entityId: string,
  drivers: HealthDriverInput[],
  now: Date,
): AnalyzerResult<HealthComposite> {
  const features: FeatureRecord[] = [];
  const mean = drivers.length === 0 ? 0 : drivers.reduce((s, d) => s + d.severity, 0) / drivers.length;
  const composite = Math.round(100 - mean);
  const primary = drivers.length === 0
    ? null
    : drivers.reduce((worst, d) => (d.severity > worst.severity ? d : worst)).name;

  features.push(feature("health.composite", { type: "project", id: entityId }, { kind: "number", number: composite }, now, "health", "1"));
  for (const d of drivers) {
    features.push(feature(`health.driver.${d.name}`, { type: "project", id: entityId }, { kind: "trend", trend: d.trend }, now, "health", "1"));
  }

  return {
    result: { entityId, composite, drivers: drivers.map((d) => ({ name: d.name, severity: d.severity, trend: d.trend })), primaryDriver: primary },
    features,
  };
}
