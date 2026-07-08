import { feature, type AnalyzerResult, type FeatureRecord } from "./feature-record.js";
import type { SuggestedAction, Urgency } from "./suggested-action.js";

const RANK: Record<Urgency, number> = { high: 0, med: 1, low: 2 };

export interface DailyBrief {
  date: Date;
  headline: string;
  rankedActions: SuggestedAction[];
  tips: string[];
}

export function buildDailyBrief(
  actions: SuggestedAction[],
  date: Date,
  managerName?: string,
): AnalyzerResult<DailyBrief> {
  const ranked = actions
    .map((a, i) => ({ a, i }))
    .sort((x, y) => RANK[x.a.urgency] - RANK[y.a.urgency] || x.i - y.i) // stable within band
    .map(({ a }) => a);

  const highCount = ranked.filter((a) => a.urgency === "high").length;
  const who = managerName ? `${managerName}, ` : "";
  const headline = ranked.length === 0
    ? `${who}a clear runway today — nothing urgent flagged.`
    : `${who}${highCount} high-priority item${highCount === 1 ? "" : "s"} today; ${ranked.length} to review.`;

  const tips = ranked.filter((a) => a.urgency === "high").slice(0, 3).map((a) => a.text);

  const features: FeatureRecord[] = [
    feature("brief.action_count", { type: "objective", id: "daily" }, { kind: "number", number: ranked.length }, date, "daily-brief", "1"),
  ];

  return { result: { date, headline, rankedActions: ranked, tips }, features };
}
