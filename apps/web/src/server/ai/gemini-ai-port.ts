import { GoogleGenAI } from "@google/genai";
import type { AIPort } from "@pma/core";
import { GroundedLLMPort } from "./grounded-llm-port.js";

/** Configurable via the settings UI; this is only the fallback when no model is chosen. */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Google Gemini adapter for the generative tail (JSON response MIME type). Only implements
 * `complete()`; the shared GroundedLLMPort base validates against @pma/contracts, enforces
 * grounding, and falls back to the deterministic template on any failure.
 */
export class GeminiAIPort extends GroundedLLMPort {
  constructor(
    private readonly ai: GoogleGenAI,
    fallback: AIPort,
    model: string = DEFAULT_GEMINI_MODEL,
  ) {
    super(fallback, model);
  }

  protected async complete(system: string, user: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: user,
      config: { systemInstruction: system, responseMimeType: "application/json" },
    });
    return response.text ?? "";
  }
}
