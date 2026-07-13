import { expect, test } from "vitest";
import { segment } from "./segment.js";

const rows = [
  { provenance: "manual" as const, hasParent: false, name: "B", status: "on_track", updatedAt: "2026-01-02" },
  { provenance: "connected" as const, hasParent: true, name: "A", status: "planning", updatedAt: "2026-01-01" },
];

test("filters by source + placement and sorts by name", () => {
  expect(segment(rows, { source: "manual", placement: "all", sort: "name" }).map((r) => r.name)).toEqual(["B"]);
  expect(segment(rows, { source: "all", placement: "standalone", sort: "name" }).map((r) => r.name)).toEqual(["B"]);
  expect(segment(rows, { source: "all", placement: "all", sort: "name" }).map((r) => r.name)).toEqual(["A", "B"]);
});
