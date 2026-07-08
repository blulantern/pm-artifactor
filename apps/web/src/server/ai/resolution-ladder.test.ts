import { expect, test } from "vitest";
import { ResolutionLadder } from "./resolution-ladder.js";
import { InMemoryAICacheStore } from "./cache-store.js";
import type { AIPort, AIResult } from "@pma/core";

const stubDelegate: AIPort = {
  async run(): Promise<AIResult> { return { output: { summary: "hi" }, groundedOn: ["checkout"], confidence: 0.9 }; },
};

test("first call is a miss (llm), second identical call is a hit (exact_cache) with tokens saved", async () => {
  const ladder = new ResolutionLadder(stubDelegate, new InMemoryAICacheStore());
  const input = { entity: { id: "checkout", name: "Checkout" }, composite: 62, drivers: [] };
  const miss = await ladder.resolve("health.explain", input);
  expect(miss.tier).toBe("llm");
  expect(miss.tokensUsed).toBeGreaterThan(0);
  expect(miss.tokensSaved).toBe(0);
  const hit = await ladder.resolve("health.explain", input);
  expect(hit.tier).toBe("exact_cache");
  expect(hit.tokensUsed).toBe(0);
  expect(hit.tokensSaved).toBeGreaterThan(0);
});

test("an output with empty grounded_on is discarded (hallucination guard)", async () => {
  const bad: AIPort = { async run() { return { output: {}, groundedOn: [], confidence: 0.5 }; } };
  const ladder = new ResolutionLadder(bad, new InMemoryAICacheStore());
  await expect(ladder.resolve("health.explain", { entity: { id: "x" } })).rejects.toThrow(/grounded/i);
});
