import { expect, test } from "vitest";
import { computeHealth } from "./health.js";

const now = new Date("2026-03-16");

test("composite = 100 - mean(severity); primary driver is the worst", () => {
  const { result, features } = computeHealth("checkout", [
    { name: "schedule_variance", severity: 75, trend: "worsening" },
    { name: "cost_variance", severity: 45, trend: "flat" },
    { name: "team_health", severity: 60, trend: "worsening" },
  ], now);
  expect(result.composite).toBe(40); // 100 - mean(75,45,60)=100-60
  expect(result.primaryDriver).toBe("schedule_variance");
  // 1 composite feature + 3 driver features
  expect(features).toHaveLength(4);
});

test("empty drivers => composite 100, no primary crash", () => {
  const { result } = computeHealth("x", [], now);
  expect(result.composite).toBe(100);
});
