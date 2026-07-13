import type { ProvenanceState } from "@pma/contracts";

export interface SegmentRow {
  provenance: ProvenanceState;
  hasParent: boolean;
  name: string;
  status: string;
  health?: number;
  updatedAt: string;
}
export interface SegmentOpts {
  source: "all" | ProvenanceState;
  placement: "all" | "standalone" | "has_parent";
  sort: "name" | "status" | "health" | "updated";
}

export function segment<T extends SegmentRow>(rows: T[], opts: SegmentOpts): T[] {
  const filtered = rows.filter((r) =>
    (opts.source === "all" || r.provenance === opts.source) &&
    (opts.placement === "all" || (opts.placement === "standalone" ? !r.hasParent : r.hasParent)),
  );
  const cmp: Record<SegmentOpts["sort"], (a: T, b: T) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    status: (a, b) => a.status.localeCompare(b.status),
    health: (a, b) => (b.health ?? 0) - (a.health ?? 0),
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  };
  return [...filtered].sort(cmp[opts.sort]);
}
