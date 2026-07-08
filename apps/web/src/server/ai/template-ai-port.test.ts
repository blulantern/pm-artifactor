import { expect, test } from "vitest";
import { TemplateAIPort, estimateTokens } from "./template-ai-port.js";
import { DailyBriefComposeOutput, StakeholderUpdateOutput } from "@pma/contracts";

const ai = new TemplateAIPort();

test("daily-brief.compose returns a contract-valid grounded output", async () => {
  const input = {
    date: "2026-03-16", manager_name: "Alex",
    suggested_actions: [
      { id: "a1", type: "sprint_end", urgency: "high", text: "Sprint 14 ends Fri", refs: ["s14"] },
      { id: "a2", type: "one_on_one_overdue", urgency: "med", text: "Meet Lin", refs: ["lin"] },
    ],
  };
  const res = await ai.run("daily-brief.compose", input);
  expect(res.groundedOn.length).toBeGreaterThan(0);
  expect(DailyBriefComposeOutput.safeParse({ ...(res.output as object), grounded_on: res.groundedOn, confidence: res.confidence }).success).toBe(true);
  expect(estimateTokens(res.output)).toBeGreaterThan(0);
});

test("stakeholder.update output is a draft (is_draft true) and grounded", async () => {
  const input = {
    stakeholder: { id: "priya", name: "Priya", interest_level: "manage_closely" },
    items: [{ id: "ledger", name: "Ledger Migration", status: "at_risk", reason_invested: "tracks the benefit" }],
  };
  const res = await ai.run("stakeholder.update", input);
  const parsed = StakeholderUpdateOutput.safeParse({ ...(res.output as object), grounded_on: res.groundedOn, confidence: res.confidence });
  expect(parsed.success).toBe(true);
  expect((res.output as any).is_draft).toBe(true);
});

test("an unsupported task throws", async () => {
  await expect(ai.run("nope.task", {})).rejects.toThrow(/unsupported/);
});
