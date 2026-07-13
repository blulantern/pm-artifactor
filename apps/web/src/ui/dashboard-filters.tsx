"use client";

import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import { segment } from "@pma/core";
import type { SegmentOpts, SegmentRow } from "@pma/core";
import type { ProvenanceState } from "@pma/contracts";
import { Tag } from "./primitives.js";

/** Badge color + label per provenance state — mirrors ProvenanceState in @pma/contracts. */
const PROVENANCE_META: Record<ProvenanceState, [string, string]> = {
  manual: ["var(--faint)", "Manual"],
  connected: ["var(--win)", "Connected"],
  formerly_synced: ["var(--amber)", "Formerly synced"],
};

/** Shared provenance badge, reused across every dashboard card. */
export function ProvenanceBadge({ state }: { state: ProvenanceState }) {
  const [color, label] = PROVENANCE_META[state];
  return <Tag style={{ color, borderColor: color }}>{label}</Tag>;
}

/**
 * A dashboard row = the fields `segment` filters/sorts on, plus a stable `key` and the
 * server-rendered card `node`. The node carries the row's own CRUD affordances (Edit/Delete),
 * provenance badge, and parent link — this component only decides which nodes show and in what order.
 */
export type FilterableRow = SegmentRow & { key: string; node: ReactNode };

const SOURCE_OPTS: [SegmentOpts["source"], string][] = [
  ["all", "All sources"],
  ["manual", "Manual"],
  ["connected", "Connected"],
  ["formerly_synced", "Formerly synced"],
];
const PLACEMENT_OPTS: [SegmentOpts["placement"], string][] = [
  ["all", "All placements"],
  ["standalone", "Standalone"],
  ["has_parent", "Has parent"],
];
const SORT_OPTS: [SegmentOpts["sort"], string][] = [
  ["name", "Name"],
  ["status", "Status"],
  ["health", "Health"],
  ["updated", "Recently updated"],
];

const SELECT_STYLE: CSSProperties = { width: "auto", minWidth: 150 };

export function DashboardFilters({
  rows,
  containerClassName,
  containerStyle,
  emptyLabel = "No items match these filters.",
}: {
  rows: FilterableRow[];
  containerClassName?: string;
  containerStyle?: CSSProperties;
  emptyLabel?: string;
}) {
  const [source, setSource] = useState<SegmentOpts["source"]>("all");
  const [placement, setPlacement] = useState<SegmentOpts["placement"]>("all");
  const [sort, setSort] = useState<SegmentOpts["sort"]>("name");

  const filtered = segment(rows, { source, placement, sort });

  // Rollup provenance across the visible rows: one source → that source's label, else "mixed".
  const sources = new Set(filtered.map((r) => r.provenance));
  const first = [...sources][0];
  const rollup = sources.size === 0 ? "—" : sources.size === 1 && first ? PROVENANCE_META[first][1] : "mixed";

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <select
          aria-label="Filter by source"
          style={SELECT_STYLE}
          value={source}
          onChange={(e) => setSource(e.target.value as SegmentOpts["source"])}
        >
          {SOURCE_OPTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by placement"
          style={SELECT_STYLE}
          value={placement}
          onChange={(e) => setPlacement(e.target.value as SegmentOpts["placement"])}
        >
          {PLACEMENT_OPTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort by"
          style={SELECT_STYLE}
          value={sort}
          onChange={(e) => setSort(e.target.value as SegmentOpts["sort"])}
        >
          {SORT_OPTS.map(([v, l]) => (
            <option key={v} value={v}>
              Sort · {l}
            </option>
          ))}
        </select>
        <span className="sub" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span>
            {filtered.length} of {rows.length}
          </span>
          <Tag>{rollup}</Tag>
        </span>
      </div>
      {filtered.length === 0 ? (
        <div className="sub">{emptyLabel}</div>
      ) : (
        <div className={containerClassName} style={containerStyle}>
          {filtered.map((r) => (
            <Fragment key={r.key}>{r.node}</Fragment>
          ))}
        </div>
      )}
    </>
  );
}
