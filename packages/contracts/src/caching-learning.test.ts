import { expect, test } from "vitest";
import { CacheEntry, AIFeedback, FeatureRecord, FeatureValue } from "./index.js";

test("FeatureValue is a discriminated union on kind", () => {
  expect(FeatureValue.safeParse({ kind: "number", number: 3 }).success).toBe(true);
  expect(FeatureValue.safeParse({ kind: "band", band: "high" }).success).toBe(true);
  expect(FeatureValue.safeParse({ kind: "band", band: "extreme" }).success).toBe(false);
  expect(FeatureValue.safeParse({ kind: "number", band: "high" }).success).toBe(false);
});

test("FeatureRecord requires metric/entity/value/fn", () => {
  const ok = {
    metric: "velocity.throughput.complexity.high",
    entity: { type: "person", id: "11111111-1111-1111-1111-111111111111" },
    value: { kind: "number", number: 1.15 },
    computed_at: "2026-03-16T00:00:00Z", deterministic_fn: "velocity.v1", fn_version: "1",
  };
  expect(FeatureRecord.safeParse(ok).success).toBe(true);
});

test("AIFeedback verdict is accept|edit|dismiss", () => {
  const ok = { ai_task_id: "11111111-1111-1111-1111-111111111111", task_type: "daily-brief.compose", verdict: "accept", at: "2026-03-16T00:00:00Z" };
  expect(AIFeedback.safeParse(ok).success).toBe(true);
  expect(AIFeedback.safeParse({ ...ok, verdict: "ignore" }).success).toBe(false);
});

test("CacheEntry requires key_hash/task_type/output/tier", () => {
  const ok = { key_hash: "h", task_type: "health.explain", input_hash: "ih", output: {}, model_version: "v1", resolution_tier: "exact_cache", created_at: "2026-03-16T00:00:00Z", stale: false };
  expect(CacheEntry.safeParse(ok).success).toBe(true);
  expect(CacheEntry.safeParse({ ...ok, resolution_tier: "magic" }).success).toBe(false);
});
