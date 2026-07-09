import { expect, test } from "vitest";
import type { GoogleGenAI } from "@google/genai";
import { GeminiAIPort } from "./gemini-ai-port.js";
import { TemplateAIPort } from "./template-ai-port.js";
import { DailyBriefComposeOutput } from "@pma/contracts";

const briefInput = {
  date: "2026-03-16",
  suggested_actions: [{ id: "a1", type: "sprint_end", urgency: "high", text: "Sprint ends", refs: ["s14"] }],
};

const valid = JSON.stringify({
  headline: "One urgent item.",
  ranked_action_ids: ["a1"],
  tips: [],
  grounded_on: ["a1", "2026-03-16"],
  confidence: 0.6,
});

/** Fake GoogleGenAI whose models.generateContent returns fixed text, or throws. */
function fakeAi(text: string | undefined | (() => never)): GoogleGenAI {
  return {
    models: {
      async generateContent() {
        if (typeof text === "function") text();
        return { text };
      },
    },
  } as unknown as GoogleGenAI;
}

test("a valid Gemini response validates against the contract", async () => {
  const port = new GeminiAIPort(fakeAi(valid), new TemplateAIPort());
  const res = await port.run("daily-brief.compose", briefInput);
  expect((res.output as { headline: string }).headline).toBe("One urgent item.");
  expect(res.groundedOn).toEqual(["a1", "2026-03-16"]);
  expect(
    DailyBriefComposeOutput.safeParse({ ...(res.output as object), grounded_on: res.groundedOn, confidence: res.confidence }).success,
  ).toBe(true);
});

test("an undefined response text falls back to the template", async () => {
  const port = new GeminiAIPort(fakeAi(undefined), new TemplateAIPort());
  const res = await port.run("daily-brief.compose", briefInput);
  expect(res).toEqual(await new TemplateAIPort().run("daily-brief.compose", briefInput));
});

test("an API error falls back to the template", async () => {
  const port = new GeminiAIPort(
    fakeAi(() => {
      throw new Error("quota exceeded");
    }),
    new TemplateAIPort(),
  );
  const res = await port.run("daily-brief.compose", briefInput);
  expect(res).toEqual(await new TemplateAIPort().run("daily-brief.compose", briefInput));
});
