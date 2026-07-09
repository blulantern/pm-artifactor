import { expect, test } from "vitest";
import type OpenAI from "openai";
import { OpenAIAIPort } from "./openai-ai-port.js";
import { TemplateAIPort } from "./template-ai-port.js";
import { DailyBriefComposeOutput } from "@pma/contracts";

const briefInput = {
  date: "2026-03-16",
  suggested_actions: [{ id: "a1", type: "sprint_end", urgency: "high", text: "Sprint ends", refs: ["s14"] }],
};

const valid = JSON.stringify({
  headline: "One urgent item.",
  ranked_action_ids: ["a1"],
  tips: ["Close the sprint."],
  grounded_on: ["a1", "2026-03-16"],
  confidence: 0.66,
});

/** Fake OpenAI client whose chat.completions.create returns fixed content, or throws. */
function fakeClient(content: string | null | (() => never)): OpenAI {
  return {
    chat: {
      completions: {
        async create() {
          if (typeof content === "function") content();
          return { choices: [{ message: { content } }] };
        },
      },
    },
  } as unknown as OpenAI;
}

test("a valid OpenAI completion validates against the contract", async () => {
  const port = new OpenAIAIPort(fakeClient(valid), new TemplateAIPort());
  const res = await port.run("daily-brief.compose", briefInput);
  expect((res.output as { headline: string }).headline).toBe("One urgent item.");
  expect(res.groundedOn).toEqual(["a1", "2026-03-16"]);
  expect(
    DailyBriefComposeOutput.safeParse({ ...(res.output as object), grounded_on: res.groundedOn, confidence: res.confidence }).success,
  ).toBe(true);
});

test("a null message content falls back to the template", async () => {
  const port = new OpenAIAIPort(fakeClient(null), new TemplateAIPort());
  const res = await port.run("daily-brief.compose", briefInput);
  expect(res).toEqual(await new TemplateAIPort().run("daily-brief.compose", briefInput));
});

test("an API error falls back to the template", async () => {
  const port = new OpenAIAIPort(
    fakeClient(() => {
      throw new Error("429 rate limit");
    }),
    new TemplateAIPort(),
  );
  const res = await port.run("daily-brief.compose", briefInput);
  expect(res).toEqual(await new TemplateAIPort().run("daily-brief.compose", briefInput));
});
