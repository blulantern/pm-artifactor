import Anthropic from "@anthropic-ai/sdk";
import type { AIPort } from "@pma/core";
import { GroundedLLMPort } from "./grounded-llm-port.js";

/** Opus 4.8 is the default per the claude-api guidance; override via ClaudeAIPort's ctor. */
export const DEFAULT_MODEL = "claude-opus-4-8";

/**
 * Live Claude adapter for the generative tail, over the Anthropic Messages API (a
 * metered API key). Only implements `complete()` — the shared GroundedLLMPort base
 * validates against @pma/contracts, enforces grounding, and falls back to the
 * deterministic template on any failure.
 */
export class ClaudeAIPort extends GroundedLLMPort {
  constructor(
    private readonly client: Anthropic,
    fallback: AIPort,
    model: string = DEFAULT_MODEL,
  ) {
    super(fallback, model);
  }

  protected async complete(system: string, user: string): Promise<string> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: user }],
    });
    return message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");
  }
}
