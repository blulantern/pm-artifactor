import OpenAI from "openai";
import type { AIPort } from "@pma/core";
import { GroundedLLMPort } from "./grounded-llm-port.js";

/** Configurable via the settings UI; this is only the fallback when no model is chosen. */
export const DEFAULT_OPENAI_MODEL = "gpt-4o";

/**
 * OpenAI adapter for the generative tail (Chat Completions, JSON mode). Only implements
 * `complete()`; the shared GroundedLLMPort base validates against @pma/contracts, enforces
 * grounding, and falls back to the deterministic template on any failure.
 */
export class OpenAIAIPort extends GroundedLLMPort {
  constructor(
    private readonly client: OpenAI,
    fallback: AIPort,
    model: string = DEFAULT_OPENAI_MODEL,
  ) {
    super(fallback, model);
  }

  protected async complete(system: string, user: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    });
    return completion.choices[0]?.message?.content ?? "";
  }
}
