import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readStoredConfig,
  writeStoredConfig,
  resolveAiConfig,
  getAiSettingsView,
} from "./ai-config-store.js";

let dir: string;
let env: Record<string, string | undefined>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pma-ai-"));
  env = { PMA_AI_CONFIG_PATH: join(dir, "ai-config.json") };
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test("missing config reads as empty and resolves to the template", () => {
  expect(readStoredConfig(env)).toEqual({});
  expect(resolveAiConfig(env).provider).toBe("template");
});

test("write/read round-trips provider, model, and keys", () => {
  writeStoredConfig({ provider: "openai", model: "gpt-x", keys: { openai: "sk-o" } }, env);
  const stored = readStoredConfig(env);
  expect(stored.provider).toBe("openai");
  expect(stored.model).toBe("gpt-x");
  expect(stored.keys?.openai).toBe("sk-o");
});

test("stored config takes precedence over env for provider and keys", () => {
  writeStoredConfig({ provider: "gemini", keys: { gemini: "file-key" } }, env);
  const resolved = resolveAiConfig({ ...env, PMA_AI_PROVIDER: "anthropic", GEMINI_API_KEY: "env-key" });
  expect(resolved.provider).toBe("gemini");
  expect(resolved.keys.gemini).toBe("file-key");
});

test("env supplies keys and provider when the file is empty (back-compat)", () => {
  expect(resolveAiConfig({ ...env, ANTHROPIC_API_KEY: "sk-a" }).provider).toBe("anthropic");
  expect(resolveAiConfig({ ...env, PMA_AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-o" })).toMatchObject({
    provider: "openai",
    keys: { openai: "sk-o" },
  });
});

test("an empty-string key clears a previously stored key", () => {
  writeStoredConfig({ keys: { openai: "sk-o" } }, env);
  writeStoredConfig({ keys: { openai: "" } }, env);
  expect(readStoredConfig(env).keys?.openai).toBeUndefined();
});

test("an unknown provider resolves to the template", () => {
  writeStoredConfig({ provider: "copilot" as never }, env);
  expect(resolveAiConfig(env).provider).toBe("template");
});

test("the settings view reports key presence + source but never the key value", () => {
  writeStoredConfig({ provider: "openai", keys: { openai: "super-secret" } }, env);
  const view = getAiSettingsView({ ...env, ANTHROPIC_API_KEY: "sk-a" });
  expect(JSON.stringify(view)).not.toContain("super-secret");
  const openai = view.keys.find((k) => k.name === "openai");
  const anthropic = view.keys.find((k) => k.name === "anthropic");
  const gemini = view.keys.find((k) => k.name === "gemini");
  expect(openai).toMatchObject({ present: true, source: "file" });
  expect(anthropic).toMatchObject({ present: true, source: "env" });
  expect(gemini).toMatchObject({ present: false, source: null });
  expect(view.provider).toBe("openai");
});
