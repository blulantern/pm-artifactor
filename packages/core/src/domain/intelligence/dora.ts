import { feature, type AnalyzerResult, type FeatureRecord } from "./feature-record.js";

export interface DeploymentInput {
  environment: string;
  status: string;
  leadTimeMinutes: number | null;
  isRollback: boolean;
}
export interface DoraMetrics {
  prodDeploys: number;
  changeFailureRate: number;
  avgLeadTimeMinutes: number | null;
  mttrMinutes: number | null;
}

export function computeDora(deploys: DeploymentInput[], now: Date): AnalyzerResult<DoraMetrics> {
  const prod = deploys.filter((d) => d.environment === "prod");
  const prodDeploys = prod.length;
  const rolledBack = prod.filter((d) => d.status === "rolled_back").length;
  const changeFailureRate = prodDeploys === 0 ? 0 : rolledBack / prodDeploys;

  const successLead = prod.filter((d) => d.status === "success" && d.leadTimeMinutes != null).map((d) => d.leadTimeMinutes!);
  const avgLeadTimeMinutes = successLead.length === 0 ? null : Math.round(successLead.reduce((s, n) => s + n, 0) / successLead.length);

  const recoveries = prod.filter((d) => d.status === "success" && d.isRollback && d.leadTimeMinutes != null).map((d) => d.leadTimeMinutes!);
  const mttrMinutes = recoveries.length === 0 ? null : Math.round(recoveries.reduce((s, n) => s + n, 0) / recoveries.length);

  const features: FeatureRecord[] = [
    feature("dora.change_failure_rate", { type: "project", id: "portfolio" }, { kind: "number", number: changeFailureRate }, now, "dora", "1"),
  ];
  return { result: { prodDeploys, changeFailureRate, avgLeadTimeMinutes, mttrMinutes }, features };
}
