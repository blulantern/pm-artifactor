import { expect, test } from "vitest";
import { delegateFor } from "./warm-intelligence.js";
import type { ResolvedAiConfig } from "./ai-config-store.js";
import { TemplateAIPort } from "./template-ai-port.js";
import { ClaudeAIPort } from "./claude-ai-port.js";
import { ClaudeCodeAIPort } from "./claude-code-ai-port.js";
import { OpenAIAIPort } from "./openai-ai-port.js";
import { GeminiAIPort } from "./gemini-ai-port.js";

const cfg = (over: Partial<ResolvedAiConfig>): ResolvedAiConfig => ({
  provider: "template",
  model: null,
  keys: {},
  ...over,
});

test("template provider selects the deterministic template", () => {
  expect(delegateFor(cfg({ provider: "template" }))).toBeInstanceOf(TemplateAIPort);
});

test("claude-code selects the CLI adapter (no key needed)", () => {
  expect(delegateFor(cfg({ provider: "claude-code" }))).toBeInstanceOf(ClaudeCodeAIPort);
});

test("anthropic with a key selects the Claude API adapter", () => {
  expect(delegateFor(cfg({ provider: "anthropic", keys: { anthropic: "sk-a" } }))).toBeInstanceOf(ClaudeAIPort);
});

test("openai with a key selects the OpenAI adapter", () => {
  expect(delegateFor(cfg({ provider: "openai", keys: { openai: "sk-o" } }))).toBeInstanceOf(OpenAIAIPort);
});

test("gemini with a key selects the Gemini adapter", () => {
  expect(delegateFor(cfg({ provider: "gemini", keys: { gemini: "sk-g" } }))).toBeInstanceOf(GeminiAIPort);
});

test("a provider selected without its key falls back to the template", () => {
  expect(delegateFor(cfg({ provider: "openai", keys: {} }))).toBeInstanceOf(TemplateAIPort);
  expect(delegateFor(cfg({ provider: "gemini", keys: {} }))).toBeInstanceOf(TemplateAIPort);
  expect(delegateFor(cfg({ provider: "anthropic", keys: {} }))).toBeInstanceOf(TemplateAIPort);
});
