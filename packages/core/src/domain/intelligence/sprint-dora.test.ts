import { expect, test } from "vitest";
import { computeSprint } from "./sprint.js";
import { computeDora } from "./dora.js";

const now = new Date("2026-03-16");

test("sprint metrics: committed/done/remaining/doneRatio", () => {
  const { result } = computeSprint([
    { status: "done", estimate: 8 },
    { status: "in_progress", estimate: 5 },
    { status: "in_progress", estimate: 3 },
  ], "s14", now);
  expect(result.committed).toBe(16);
  expect(result.done).toBe(8);
  expect(result.remaining).toBe(8);
  expect(result.doneRatio).toBeCloseTo(0.5);
});

test("DORA: change failure rate = rolled_back prod / total prod", () => {
  const { result } = computeDora([
    { environment: "prod", status: "success", leadTimeMinutes: 60, isRollback: false },
    { environment: "prod", status: "rolled_back", leadTimeMinutes: 52, isRollback: false },
    { environment: "prod", status: "success", leadTimeMinutes: 20, isRollback: true },
    { environment: "staging", status: "success", leadTimeMinutes: 45, isRollback: false },
  ], now);
  expect(result.prodDeploys).toBe(3);
  expect(result.changeFailureRate).toBeCloseTo(1 / 3);
  expect(result.mttrMinutes).toBe(20); // the recovery deploy
});
