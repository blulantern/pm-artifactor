import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DEFAULT_MODEL } from "./claude-ai-port.js";
import { DEFAULT_OPENAI_MODEL } from "./openai-ai-port.js";
import { DEFAULT_GEMINI_MODEL } from "./gemini-ai-port.js";

export type AiProvider = "template" | "claude-code" | "anthropic" | "openai" | "gemini";
export type AiKeyName = "anthropic" | "openai" | "gemini";

/** Provider catalogue for the settings UI. `keyName: null` ⇒ no API key needed. */
export const PROVIDER_META: {
  id: AiProvider;
  label: string;
  keyName: AiKeyName | null;
  defaultModel: string | null;
  note?: string;
}[] = [
  { id: "template", label: "Deterministic (no AI)", keyName: null, defaultModel: null, note: "Grounded templates, no model calls." },
  { id: "anthropic", label: "Anthropic API (Claude)", keyName: "anthropic", defaultModel: DEFAULT_MODEL },
  { id: "openai", label: "OpenAI", keyName: "openai", defaultModel: DEFAULT_OPENAI_MODEL },
  { id: "gemini", label: "Google Gemini", keyName: "gemini", defaultModel: DEFAULT_GEMINI_MODEL },
  { id: "claude-code", label: "Claude Code CLI", keyName: null, defaultModel: null, note: "Uses your Claude Code subscription — local/dev only." },
];

const PROVIDER_IDS = PROVIDER_META.map((p) => p.id);
const KEY_NAMES: AiKeyName[] = ["anthropic", "openai", "gemini"];
const ENV_KEY: Record<AiKeyName, string[]> = {
  anthropic: ["ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
};

/** What's persisted to the gitignored on-disk file (may be partial). */
export interface StoredAiConfig {
  provider?: AiProvider;
  model?: string | null;
  keys?: Partial<Record<AiKeyName, string>>;
}

/** Fully-resolved config (file layered over env) used to build the delegate. */
export interface ResolvedAiConfig {
  provider: AiProvider;
  model: string | null;
  keys: Partial<Record<AiKeyName, string>>;
}

/**
 * Location of the plaintext config. Server-only, gitignored (.pma/), and OUTSIDE the
 * SQLite domain DB. Override with PMA_AI_CONFIG_PATH (used by tests). Defaults under the
 * app's cwd (apps/web) when run via `pnpm --filter @pma/web`.
 */
function configPath(env: Record<string, string | undefined>): string {
  return env.PMA_AI_CONFIG_PATH ?? join(process.cwd(), ".pma", "ai-config.json");
}

export function readStoredConfig(env: Record<string, string | undefined> = process.env): StoredAiConfig {
  try {
    const parsed = JSON.parse(readFileSync(configPath(env), "utf8"));
    if (parsed && typeof parsed === "object") return parsed as StoredAiConfig;
  } catch {
    // missing or corrupt → empty config
  }
  return {};
}

/** Merges a patch into the stored config and writes it. Empty-string keys are cleared. */
export function writeStoredConfig(
  patch: StoredAiConfig,
  env: Record<string, string | undefined> = process.env,
): StoredAiConfig {
  const current = readStoredConfig(env);
  const next: StoredAiConfig = { ...current, ...patch };
  if (patch.keys) {
    const keys = { ...(current.keys ?? {}) };
    for (const name of KEY_NAMES) {
      if (!(name in patch.keys)) continue;
      const value = patch.keys[name];
      if (value) keys[name] = value;
      else delete keys[name];
    }
    next.keys = keys;
  }
  const file = configPath(env);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

/** Resolves the effective config: stored file first, then env vars as fallback. */
export function resolveAiConfig(env: Record<string, string | undefined> = process.env): ResolvedAiConfig {
  const stored = readStoredConfig(env);
  const keys: Partial<Record<AiKeyName, string>> = {};
  for (const name of KEY_NAMES) {
    const value = stored.keys?.[name] || ENV_KEY[name].map((v) => env[v]).find(Boolean);
    if (value) keys[name] = value;
  }
  const raw = stored.provider || env.PMA_AI_PROVIDER || undefined;
  return { provider: pickProvider(raw, keys), model: stored.model ?? null, keys };
}

function pickProvider(raw: string | undefined, keys: Partial<Record<AiKeyName, string>>): AiProvider {
  if (!raw) return keys.anthropic ? "anthropic" : "template"; // back-compat default
  const p = raw.toLowerCase();
  return (PROVIDER_IDS as string[]).includes(p) ? (p as AiProvider) : "template";
}

export interface AiSettingsView {
  provider: AiProvider;
  model: string | null;
  providers: typeof PROVIDER_META;
  /** Per-key presence and where it came from — NEVER the key value. */
  keys: { name: AiKeyName; present: boolean; source: "file" | "env" | null }[];
}

/** Read-only view for the settings page. Deliberately omits every secret value. */
export function getAiSettingsView(env: Record<string, string | undefined> = process.env): AiSettingsView {
  const stored = readStoredConfig(env);
  const resolved = resolveAiConfig(env);
  const keys = KEY_NAMES.map((name) => {
    const inFile = Boolean(stored.keys?.[name]);
    const inEnv = ENV_KEY[name].some((v) => env[v]);
    return { name, present: inFile || inEnv, source: inFile ? ("file" as const) : inEnv ? ("env" as const) : null };
  });
  return { provider: resolved.provider, model: resolved.model, providers: PROVIDER_META, keys };
}
