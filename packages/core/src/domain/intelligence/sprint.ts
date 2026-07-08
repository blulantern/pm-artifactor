import { feature, type AnalyzerResult, type FeatureRecord } from "./feature-record.js";

export interface SprintItemInput { status: string; estimate: number | null; }
export interface SprintMetrics { committed: number; done: number; remaining: number; doneRatio: number; }

export function computeSprint(
  items: SprintItemInput[],
  cadenceId: string,
  now: Date,
): AnalyzerResult<SprintMetrics> {
  const committed = items.reduce((s, i) => s + (i.estimate ?? 0), 0);
  const done = items.filter((i) => i.status === "done").reduce((s, i) => s + (i.estimate ?? 0), 0);
  const remaining = committed - done;
  const doneRatio = committed === 0 ? 0 : done / committed;
  const features: FeatureRecord[] = [
    feature("sprint.done_ratio", { type: "cadence", id: cadenceId }, { kind: "number", number: doneRatio }, now, "sprint", "1"),
  ];
  return { result: { committed, done, remaining, doneRatio }, features };
}
