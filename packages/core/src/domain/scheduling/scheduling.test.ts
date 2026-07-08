import { expect, test } from "vitest";
import { sprintCapacityScheduler, criticalPathScheduler } from "./scheduling-strategy.js";
import { workItemId } from "../shared/ids.js";

const a = workItemId("a"), b = workItemId("b"), c = workItemId("c");

test("sprint capacity scheduler divides total estimate by capacity", () => {
  const s = sprintCapacityScheduler(
    [{ id: a, estimate: 5 }, { id: b, estimate: 5 }], [], 4,
  );
  expect(s.totalDurationDays).toBe(3); // ceil(10/4)
  expect(s.orderedIds).toEqual([a, b]);
});

test("critical path scheduler topologically orders and sums the longest path", () => {
  const s = criticalPathScheduler(
    [{ id: a, estimate: 2 }, { id: b, estimate: 3 }, { id: c, estimate: 1 }],
    [{ predecessorId: a, successorId: b, lagDays: 0 }, { predecessorId: b, successorId: c, lagDays: 1 }],
    1,
  );
  expect(s.orderedIds).toEqual([a, b, c]);
  expect(s.totalDurationDays).toBe(2 + 3 + 1 + 1); // estimates + lag
});
