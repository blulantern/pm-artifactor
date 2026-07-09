import { expect, test } from "vitest";
import { delegateFor } from "./warm-intelligence.js";
import { TemplateAIPort } from "./template-ai-port.js";
import { ClaudeAIPort } from "./claude-ai-port.js";
import { ClaudeCodeAIPort } from "./claude-code-ai-port.js";

// delegateFor takes an injected env, so these never touch the real process.env.
test("PMA_AI_PROVIDER=template forces the deterministic template even with a key", () => {
  expect(delegateFor({ PMA_AI_PROVIDER: "template", ANTHROPIC_API_KEY: "sk-test" })).toBeInstanceOf(TemplateAIPort);
});

test("PMA_AI_PROVIDER=claude-code selects the Claude Code CLI adapter (no key needed)", () => {
  expect(delegateFor({ PMA_AI_PROVIDER: "claude-code" })).toBeInstanceOf(ClaudeCodeAIPort);
});

test("PMA_AI_PROVIDER=anthropic with a key selects the metered API adapter", () => {
  expect(delegateFor({ PMA_AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-test" })).toBeInstanceOf(ClaudeAIPort);
});

test("PMA_AI_PROVIDER=anthropic without a key falls back to the template", () => {
  expect(delegateFor({ PMA_AI_PROVIDER: "anthropic" })).toBeInstanceOf(TemplateAIPort);
});

test("unset provider auto-selects the API adapter when a key is present", () => {
  expect(delegateFor({ ANTHROPIC_API_KEY: "sk-test" })).toBeInstanceOf(ClaudeAIPort);
});

test("unset provider with no key auto-selects the template", () => {
  expect(delegateFor({})).toBeInstanceOf(TemplateAIPort);
});

test("an unknown provider name falls back to the template", () => {
  expect(delegateFor({ PMA_AI_PROVIDER: "gemini" })).toBeInstanceOf(TemplateAIPort);
});
