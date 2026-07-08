import { expect, test } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { ClaudeAIPort } from "./claude-ai-port.js";
import { TemplateAIPort } from "./template-ai-port.js";
import { DailyBriefComposeOutput, StakeholderUpdateOutput } from "@pma/contracts";

/** A fake Anthropic client whose messages.create returns fixed text, or throws. */
function fakeClient(reply: string | (() => never)): Anthropic {
  return {
    messages: {
      async create() {
        if (typeof reply === "function") reply();
        return { content: [{ type: "text", text: reply as string }] };
      },
    },
  } as unknown as Anthropic;
}

function portReturning(reply: string | (() => never)): ClaudeAIPort {
  return new ClaudeAIPort(fakeClient(reply), new TemplateAIPort());
}

const briefInput = {
  date: "2026-03-16",
  manager_name: "Alex",
  suggested_actions: [
    { id: "a1", type: "sprint_end", urgency: "high", text: "Sprint 14 ends Fri", refs: ["s14"] },
    { id: "a2", type: "one_on_one_overdue", urgency: "med", text: "Meet Lin", refs: ["lin"] },
  ],
};

test("valid Claude output is returned and validates against the contract", async () => {
  const port = portReturning(
    JSON.stringify({
      headline: "Two items today, one urgent.",
      ranked_action_ids: ["a1", "a2"],
      tips: ["Close out Sprint 14 first."],
      grounded_on: ["a1", "a2", "2026-03-16"],
      confidence: 0.72,
    }),
  );
  const res = await port.run("daily-brief.compose", briefInput);
  expect((res.output as { headline: string }).headline).toBe("Two items today, one urgent.");
  expect(res.confidence).toBe(0.72);
  expect(res.groundedOn).toEqual(["a1", "a2", "2026-03-16"]);
  expect(
    DailyBriefComposeOutput.safeParse({ ...(res.output as object), grounded_on: res.groundedOn, confidence: res.confidence }).success,
  ).toBe(true);
});

test("output is stripped of grounded_on/confidence and tolerates a code fence", async () => {
  const port = portReturning(
    "```json\n" +
      JSON.stringify({ headline: "Clear runway.", ranked_action_ids: [], tips: [], grounded_on: ["2026-03-16"], confidence: 0.9 }) +
      "\n```",
  );
  const res = await port.run("daily-brief.compose", briefInput);
  expect(res.output).not.toHaveProperty("grounded_on");
  expect(res.output).not.toHaveProperty("confidence");
  expect(res.groundedOn).toEqual(["2026-03-16"]);
});

test("cited ids not present in the input are dropped from grounding", async () => {
  const port = portReturning(
    JSON.stringify({
      headline: "One item.",
      ranked_action_ids: ["a1"],
      tips: [],
      grounded_on: ["a1", "not-in-input", "a2"],
      confidence: 0.5,
    }),
  );
  const res = await port.run("daily-brief.compose", briefInput);
  expect(res.groundedOn).toEqual(["a1", "a2"]);
});

test("output that cites only fabricated ids falls back to the deterministic template", async () => {
  const port = portReturning(
    JSON.stringify({ headline: "Fabricated.", ranked_action_ids: [], tips: [], grounded_on: ["ghost"], confidence: 0.99 }),
  );
  const res = await port.run("daily-brief.compose", briefInput);
  const template = await new TemplateAIPort().run("daily-brief.compose", briefInput);
  expect(res).toEqual(template);
  expect((res.output as { headline: string }).headline).not.toBe("Fabricated.");
});

test("a contract violation (is_draft not true) falls back to the template draft", async () => {
  const stakeInput = {
    stakeholder: { id: "priya", name: "Priya", interest_level: "manage_closely" },
    items: [{ id: "ledger", name: "Ledger Migration", status: "at_risk", reason_invested: "tracks the benefit" }],
  };
  const port = portReturning(
    JSON.stringify({ draft: "Sent already.", is_draft: false, grounded_on: ["priya"], confidence: 0.8 }),
  );
  const res = await port.run("stakeholder.update", stakeInput);
  const template = await new TemplateAIPort().run("stakeholder.update", stakeInput);
  expect(res).toEqual(template);
  expect(StakeholderUpdateOutput.safeParse({ ...(res.output as object), grounded_on: res.groundedOn, confidence: res.confidence }).success).toBe(true);
});

test("malformed JSON falls back to the template", async () => {
  const port = portReturning("I couldn't produce JSON, sorry!");
  const res = await port.run("daily-brief.compose", briefInput);
  const template = await new TemplateAIPort().run("daily-brief.compose", briefInput);
  expect(res).toEqual(template);
});

test("an API error falls back to the template", async () => {
  const port = portReturning(() => {
    throw new Error("503 overloaded");
  });
  const res = await port.run("daily-brief.compose", briefInput);
  const template = await new TemplateAIPort().run("daily-brief.compose", briefInput);
  expect(res).toEqual(template);
});

test("an unsupported task is delegated to the fallback (which rejects it)", async () => {
  const port = portReturning("{}");
  await expect(port.run("nope.task", {})).rejects.toThrow(/unsupported/);
});
