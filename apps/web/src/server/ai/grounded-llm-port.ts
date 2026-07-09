import type { AIPort, AIResult } from "@pma/core";
import { AI_TASK_OUTPUT, type AiTaskKey, type OutputBase } from "@pma/contracts";

/**
 * Provider-agnostic base for grounded LLM adapters (Template Method).
 *
 * The base owns everything that must be identical across providers: the task gate,
 * the prompt, JSON extraction, contract validation against @pma/contracts, the
 * grounding guard (every cited id must appear in the input), and the deterministic
 * fallback on any failure. A concrete provider implements only `complete()` — the
 * single call that turns a (system, user) prompt into raw model text. This is what
 * makes the AI layer interchangeable: Anthropic API, Claude Code CLI, or (later)
 * OpenAI are each just a different `complete()`.
 */
export abstract class GroundedLLMPort implements AIPort {
  protected constructor(
    protected readonly fallback: AIPort,
    protected readonly model: string,
  ) {}

  async run(task: string, input: unknown): Promise<AIResult> {
    if (!SUPPORTED.has(task as AiTaskKey)) return this.fallback.run(task, input);
    try {
      const { system, user } = buildPrompt(task as AiTaskKey, input);
      const text = await this.complete(system, user);
      return finalizeGrounded(task as AiTaskKey, input, text);
    } catch {
      // Deterministic, always-grounded fallback keeps output correct on any provider/validation failure.
      return this.fallback.run(task, input);
    }
  }

  /** Turn a (system, user) prompt into the model's raw text response. */
  protected abstract complete(system: string, user: string): Promise<string>;
}

/** The generative tail routed through the AIPort — the same tasks TemplateAIPort handles. */
export const SUPPORTED = new Set<AiTaskKey>([
  "daily-brief.compose",
  "health.explain",
  "stakeholder.update",
  "email.digest",
]);

const SYSTEM_PROMPT = `You are the grounded portfolio/program/project copilot inside PM Artifactor.

Hard rules:
- Use ONLY facts present in the JSON input. Never invent entities, ids, numbers, dates, names, or statuses.
- "grounded_on" MUST list the input ids your output draws on. Every value must be an id that literally appears in the input JSON. Never fabricate an id.
- "confidence" is a number from 0 to 1 reflecting how well the input supports your output.
- Write concise, manager-ready prose. No preamble, no markdown headings, no emoji.
- A stakeholder update is always a DRAFT for the manager to review before sending — never address it as if already sent.
- Respond with ONLY a single JSON object matching the requested shape. No markdown fences, no commentary.`;

/** Per-task shape guidance appended to the input. Keeps the model on the contract shape. */
const TASK_SPEC: Record<AiTaskKey, string> = {
  "daily-brief.compose":
    'Return {"headline": string, "ranked_action_ids": string[] (the input action ids, most urgent first), "tips": string[] (0-3 short coaching lines), "grounded_on": string[], "confidence": number}.',
  "health.explain":
    'Return {"summary": string, "primary_driver": string (the dominant driver name), "suggested_action": string, "grounded_on": string[], "confidence": number}.',
  "stakeholder.update":
    'Return {"draft": string (a short stakeholder-ready status update body), "is_draft": true, "grounded_on": string[], "confidence": number}.',
  "email.digest":
    'Return {"items": [{"kind": "needs_reply"|"decision"|"risk"|"fyi", "summary": string, "thread_id": string, "linked_refs"?: string[]}] (one item per input message), "grounded_on": string[], "confidence": number}.',
  // Not routed through this adapter (deterministic analyzers own them); present for exhaustiveness.
  "prioritization.suggest": "",
  "teammate.insight": "",
};

/** Builds the (system, user) prompt pair for a task. */
export function buildPrompt(task: AiTaskKey, input: unknown): { system: string; user: string } {
  return {
    system: SYSTEM_PROMPT,
    user: `Task: ${task}\n${TASK_SPEC[task]}\n\nInput JSON:\n${JSON.stringify(input)}`,
  };
}

/** Minimal structural view of a Zod schema — avoids importing zod (and its v3/v4 split) here. */
type Validator = {
  safeParse(value: unknown):
    | { success: true; data: unknown }
    | { success: false; error: unknown };
};

/**
 * Validates raw model text against the task's contract and enforces grounding.
 * Throws on any failure so the caller can fall back to the deterministic template.
 */
export function finalizeGrounded(task: AiTaskKey, input: unknown, text: string): AIResult {
  const schema = AI_TASK_OUTPUT[task] as unknown as Validator;
  const parsed = schema.safeParse(extractJson(text));
  if (!parsed.success) throw new Error(`AI output for '${task}' failed contract validation`);

  const data = parsed.data as OutputBase & Record<string, unknown>;
  const groundedOn = groundedSubset(data.grounded_on, input);
  if (groundedOn.length === 0) {
    throw new Error(`AI output for '${task}' cited no ids present in the input`);
  }

  const { grounded_on: _g, confidence, ...output } = data;
  return { output, groundedOn, confidence };
}

/** Parses the first JSON object out of the model text, tolerating an accidental code fence. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse((fenced?.[1] ?? text).trim());
}

/** Keeps only cited ids that literally appear as a string somewhere in the input (dedup, order-preserving). */
function groundedSubset(ids: unknown, input: unknown): string[] {
  const present = new Set<string>();
  collectStrings(input, present);
  const out: string[] = [];
  if (Array.isArray(ids)) {
    for (const id of ids) {
      if (typeof id === "string" && present.has(id) && !out.includes(id)) out.push(id);
    }
  }
  return out;
}

function collectStrings(value: unknown, acc: Set<string>): void {
  if (typeof value === "string") acc.add(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, acc);
  else if (value && typeof value === "object") for (const v of Object.values(value)) collectStrings(v, acc);
}
