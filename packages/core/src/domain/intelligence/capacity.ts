import { feature, type AnalyzerResult, type FeatureRecord } from "./feature-record.js";

export interface AllocationInput { personId: string; pct: number; source: string; }
export interface PersonLoad {
  personId: string;
  totalPct: number;
  overallocated: boolean;
  bySource: { source: string; pct: number }[];
}

export function computeLoads(allocations: AllocationInput[], now: Date): AnalyzerResult<PersonLoad[]> {
  const byPerson = new Map<string, AllocationInput[]>();
  for (const a of allocations) {
    const list = byPerson.get(a.personId) ?? [];
    list.push(a);
    byPerson.set(a.personId, list);
  }
  const features: FeatureRecord[] = [];
  const loads: PersonLoad[] = [...byPerson.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) // ordered by id, never by load
    .map(([personId, allocs]) => {
      const totalPct = allocs.reduce((s, a) => s + a.pct, 0);
      features.push(feature("capacity.load", { type: "person", id: personId }, { kind: "number", number: totalPct }, now, "capacity", "1"));
      return {
        personId,
        totalPct,
        overallocated: totalPct > 100,
        bySource: allocs.map((a) => ({ source: a.source, pct: a.pct })),
      };
    });
  return { result: loads, features };
}
