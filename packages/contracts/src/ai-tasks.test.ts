import { expect, test } from "vitest";
import {
  DailyBriefComposeOutput, StakeholderUpdateOutput, HealthExplainOutput,
} from "./index.js";

test("daily-brief output requires non-empty grounded_on", () => {
  const ok = { headline: "Busy day", ranked_action_ids: ["a1"], tips: ["breathe"], grounded_on: ["a1"], confidence: 0.8 };
  expect(DailyBriefComposeOutput.safeParse(ok).success).toBe(true);
  expect(DailyBriefComposeOutput.safeParse({ ...ok, grounded_on: [] }).success).toBe(false);
});

test("stakeholder update output pins is_draft to true", () => {
  const base = { draft: "Hello Priya", grounded_on: ["ledger"], confidence: 0.7 };
  expect(StakeholderUpdateOutput.safeParse({ ...base, is_draft: true }).success).toBe(true);
  expect(StakeholderUpdateOutput.safeParse({ ...base, is_draft: false }).success).toBe(false);
});

test("health explain output requires summary/primary_driver/suggested_action", () => {
  const ok = { summary: "Schedule slipping", primary_driver: "schedule_variance", suggested_action: "rebalance", grounded_on: ["checkout"], confidence: 0.9 };
  expect(HealthExplainOutput.safeParse(ok).success).toBe(true);
  expect(HealthExplainOutput.safeParse({ ...ok, summary: undefined }).success).toBe(false);
});
