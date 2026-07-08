import { createHash } from "node:crypto";

const DROP = new Set(["pulled_at", "created_at", "updated_at"]);

export function normalizeInput(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(normalizeInput);
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(input as Record<string, unknown>).sort()) {
      if (DROP.has(key)) continue;
      out[key] = normalizeInput((input as Record<string, unknown>)[key]);
    }
    return out;
  }
  return input;
}

export function cacheKey(taskType: string, input: unknown): string {
  return createHash("sha256").update(taskType + JSON.stringify(normalizeInput(input))).digest("hex");
}
