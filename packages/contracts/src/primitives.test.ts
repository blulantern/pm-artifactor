import { expect, test } from "vitest";
import { GroundedNumber, OutputBase, Provenance } from "./index.js";

test("GroundedNumber requires a source enum", () => {
  expect(GroundedNumber.safeParse({ value: 3, source: "derived" }).success).toBe(true);
  expect(GroundedNumber.safeParse({ value: 3, source: "guessed" }).success).toBe(false);
});

test("OutputBase rejects empty grounding (hallucination)", () => {
  expect(OutputBase.safeParse({ grounded_on: ["e1"], confidence: 0.9 }).success).toBe(true);
  expect(OutputBase.safeParse({ grounded_on: [], confidence: 0.9 }).success).toBe(false);
  expect(OutputBase.safeParse({ grounded_on: ["e1"], confidence: 1.4 }).success).toBe(false);
});

test("Provenance pins mode to read_only", () => {
  const base = { source: "jira", external_id: "X-1", pulled_at: "2026-03-16T00:00:00Z" };
  expect(Provenance.safeParse({ ...base, mode: "read_only" }).success).toBe(true);
  expect(Provenance.safeParse({ ...base, mode: "write" }).success).toBe(false);
});

test("IsoDateTime accepts full ISO datetimes and rejects date-only/garbage", async () => {
  const { IsoDateTime, IsoDate } = await import("./index.js");
  expect(IsoDateTime.safeParse("2026-03-16T09:00:00Z").success).toBe(true);
  expect(IsoDateTime.safeParse("2026-03-16T09:00:00.000Z").success).toBe(true);
  expect(IsoDateTime.safeParse("2026-03-16").success).toBe(false); // date-only not a datetime
  expect(IsoDateTime.safeParse("not a date").success).toBe(false);
  // IsoDate is the inverse: calendar date only.
  expect(IsoDate.safeParse("2026-03-16").success).toBe(true);
  expect(IsoDate.safeParse("2026-03-16T09:00:00Z").success).toBe(false);
});
