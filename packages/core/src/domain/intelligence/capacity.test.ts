import { expect, test } from "vitest";
import { computeLoads } from "./capacity.js";

const now = new Date("2026-03-16");

test("sums allocation across sources and flags >100% (the Sam case)", () => {
  const { result, features } = computeLoads([
    { personId: "sam", pct: 70, source: "Jira" },
    { personId: "sam", pct: 52, source: "Monday" },
    { personId: "dana", pct: 68, source: "Jira" },
  ], now);
  const sam = result.find((r) => r.personId === "sam")!;
  expect(sam.totalPct).toBe(122);
  expect(sam.overallocated).toBe(true);
  expect(sam.bySource).toHaveLength(2);
  const dana = result.find((r) => r.personId === "dana")!;
  expect(dana.overallocated).toBe(false);
  expect(features).toHaveLength(2); // one per person
});

test("result is ordered by personId, not by load (no leaderboard)", () => {
  const { result } = computeLoads([
    { personId: "b", pct: 50, source: "Jira" },
    { personId: "a", pct: 99, source: "Jira" },
  ], now);
  expect(result.map((r) => r.personId)).toEqual(["a", "b"]);
});
