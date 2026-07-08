import { expect, test } from "vitest";
import { cacheKey, normalizeInput } from "./cache-key.js";
import { InMemoryAICacheStore } from "./cache-store.js";

test("cacheKey is stable across key order and ignores volatile fields", () => {
  const a = cacheKey("health.explain", { b: 1, a: 2, pulled_at: "2026-01-01" });
  const b = cacheKey("health.explain", { a: 2, b: 1, pulled_at: "2099-12-31" });
  expect(a).toBe(b);
  expect(cacheKey("other.task", { a: 2, b: 1 })).not.toBe(a);
});

test("in-memory store put/get/bumpHit/markStale", async () => {
  const s = new InMemoryAICacheStore();
  await s.put({ keyHash: "k1", taskType: "health.explain", output: { x: 1 }, groundedOn: ["checkout"], tokensUsed: 40, hitCount: 0, stale: false });
  const got = await s.get("k1");
  expect(got?.tokensUsed).toBe(40);
  await s.bumpHit("k1", 40);
  expect((await s.get("k1"))?.hitCount).toBe(1);
  const n = await s.markStaleByEntity("checkout");
  expect(n).toBe(1);
  expect((await s.get("k1"))?.stale).toBe(true);
});
