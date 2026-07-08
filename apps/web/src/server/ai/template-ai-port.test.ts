import { expect, test } from "vitest";
import { TemplateAIPort, estimateTokens } from "./template-ai-port.js";
import { DailyBriefComposeOutput, StakeholderUpdateOutput, HealthExplainOutput, EmailDigestOutput } from "@pma/contracts";

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

test("daily-brief.compose with no actions stays grounded on the date", async () => {
  const input = { date: "2026-03-16", manager_name: "Alex", suggested_actions: [] };
  const res = await ai.run("daily-brief.compose", input);
  expect(res.groundedOn.length).toBeGreaterThanOrEqual(1);
  expect(DailyBriefComposeOutput.safeParse({ ...(res.output as object), grounded_on: res.groundedOn, confidence: res.confidence }).success).toBe(true);
});

test("email.digest rejects an empty message list", async () => {
  await expect(ai.run("email.digest", { messages: [] })).rejects.toThrow(/at least one message/);
});

test("health.explain returns a contract-valid grounded output", async () => {
  const input = {
    entity: { id: "prog-1", type: "program", name: "Ledger Program" },
    composite: 62,
    drivers: [
      { name: "schedule_variance", value: 18, trend: "worsening" },
      { name: "team_health", value: 5, trend: "flat" },
    ],
  };
  const res = await ai.run("health.explain", input);
  expect(res.groundedOn.length).toBeGreaterThan(0);
  expect(HealthExplainOutput.safeParse({ ...(res.output as object), grounded_on: res.groundedOn, confidence: res.confidence }).success).toBe(true);
});

test("email.digest returns a contract-valid grounded output", async () => {
  const input = {
    messages: [
      {
        provenance: { source: "gmail", external_id: "msg-1", pulled_at: "2026-03-16T09:00:00Z", mode: "read_only" },
        subject: "Please confirm the sign-off?",
        from_email: "priya@example.com",
        received_at: "2026-03-16T08:59:00Z",
        snippet: "Can you confirm the go-live date?",
        links: [{ type: "project", id: "ledger" }],
      },
    ],
  };
  const res = await ai.run("email.digest", input);
  expect(res.groundedOn.length).toBeGreaterThan(0);
  expect(EmailDigestOutput.safeParse({ ...(res.output as object), grounded_on: res.groundedOn, confidence: res.confidence }).success).toBe(true);
});

test("an unsupported task throws", async () => {
  await expect(ai.run("nope.task", {})).rejects.toThrow(/unsupported/);
});
