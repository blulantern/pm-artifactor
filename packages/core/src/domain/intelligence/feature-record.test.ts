import { expect, test } from "vitest";
import { feature } from "./feature-record.js";

test("feature() builds a FeatureRecord with a discriminated value", () => {
  const at = new Date("2026-03-16");
  const f = feature("sprint.done_ratio", { type: "cadence", id: "s14" }, { kind: "number", number: 0.72 }, at, "sprint.v1", "1");
  expect(f.metric).toBe("sprint.done_ratio");
  expect(f.value).toEqual({ kind: "number", number: 0.72 });
  expect(f.computedAt).toBe(at);
});
