"use server";

import { revalidatePath } from "next/cache";
import {
  writeStoredConfig,
  PROVIDER_META,
  type StoredAiConfig,
  type AiProvider,
  type AiKeyName,
} from "@/server/ai/ai-config-store";

const PROVIDER_IDS = PROVIDER_META.map((p) => p.id);
const KEY_NAMES: AiKeyName[] = ["anthropic", "openai", "gemini"];

export interface SaveAiSettingsInput {
  provider: string;
  model: string | null;
  /** Only the keys the user touched: a value sets/replaces it, "" clears it. */
  keys?: Partial<Record<AiKeyName, string>>;
}

/**
 * Persists the AI provider choice + model, and any keys the user entered, to the
 * gitignored on-disk config. Keys are write-only here — they are never read back to
 * the client (the settings view exposes presence only).
 */
export async function saveAiSettings(input: SaveAiSettingsInput): Promise<void> {
  const provider: AiProvider = (PROVIDER_IDS as string[]).includes(input.provider)
    ? (input.provider as AiProvider)
    : "template";
  const patch: StoredAiConfig = { provider, model: input.model?.trim() || null };

  if (input.keys) {
    const keys: Partial<Record<AiKeyName, string>> = {};
    for (const name of KEY_NAMES) {
      if (name in input.keys) keys[name] = input.keys[name] ?? "";
    }
    patch.keys = keys;
  }

  writeStoredConfig(patch);
  revalidatePath("/settings");
}
