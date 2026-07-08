import { expect, test } from "vitest";
import { buildDailyBrief } from "./daily-brief.js";

const date = new Date("2026-03-16");
const actions = [
  { type: "one_on_one_overdue", urgency: "med", text: "Meet Lin", refType: "person", refId: "lin" },
  { type: "sprint_end", urgency: "high", text: "Sprint 14 ends Fri", refType: "cadence", refId: "s14" },
  { type: "complex_check_in", urgency: "low", text: "Auth rewrite quiet", refType: "work_item", refId: "auth" },
] as const;

test("ranks by urgency high>med>low, stable within a band", () => {
  const { result } = buildDailyBrief([...actions], date, "Alex");
  expect(result.rankedActions.map((a) => a.urgency)).toEqual(["high", "med", "low"]);
  expect(result.rankedActions[0]!.refId).toBe("s14");
});

test("headline names the manager and the high-urgency count", () => {
  const { result, features } = buildDailyBrief([...actions], date, "Alex");
  expect(result.headline).toContain("Alex");
  expect(result.headline).toContain("1"); // one high-urgency item
  expect(features).toHaveLength(1);
});

test("empty actions => calm headline, no crash", () => {
  const { result } = buildDailyBrief([], date);
  expect(result.rankedActions).toHaveLength(0);
  expect(result.headline.length).toBeGreaterThan(0);
});
