import type { AIPort, AIResult } from "@pma/core";

/** Rough token estimate for the compute-economy panel (no real tokenizer this phase). */
export const estimateTokens = (output: unknown): number =>
  Math.max(1, Math.ceil(JSON.stringify(output).length / 4));

/**
 * Deterministic, grounded template composer standing in for the LLM adapter.
 * Every output is assembled from the already-grounded input, so grounded_on is
 * never empty and nothing is invented. The real Claude adapter drops in behind
 * this exact AIPort later.
 */
export class TemplateAIPort implements AIPort {
  async run(task: string, input: unknown): Promise<AIResult> {
    switch (task) {
      case "daily-brief.compose": return this.dailyBrief(input as DailyBriefInput);
      case "health.explain": return this.healthExplain(input as HealthInput);
      case "stakeholder.update": return this.stakeholderUpdate(input as StakeholderInput);
      case "email.digest": return this.emailDigest(input as EmailInput);
      default: throw new Error(`unsupported AI task: ${task}`);
    }
  }

  private dailyBrief(input: DailyBriefInput): AIResult {
    const actions = input.suggested_actions ?? [];
    const high = actions.filter((a) => a.urgency === "high");
    const who = input.manager_name ? `${input.manager_name}, ` : "";
    const headline = actions.length === 0
      ? `${who}a clear runway today.`
      : `${who}${high.length} high-priority item${high.length === 1 ? "" : "s"} today; ${actions.length} to review.`;
    const output = {
      headline,
      ranked_action_ids: actions.map((a) => a.id),
      tips: high.slice(0, 3).map((a) => a.text),
    };
    const grounded = [...new Set(actions.flatMap((a) => [a.id, ...(a.refs ?? [])]))];
    return { output, groundedOn: grounded, confidence: 0.9 };
  }

  private healthExplain(input: HealthInput): AIResult {
    const primary = [...input.drivers].sort((a, b) => b.value - a.value)[0];
    const output = {
      summary: `${input.entity.name} is at ${input.composite}/100; ${primary ? primary.name.replace(/_/g, " ") : "no driver"} is the main pressure.`,
      primary_driver: primary?.name ?? "none",
      suggested_action: primary ? `Address ${primary.name.replace(/_/g, " ")} first.` : "Hold steady.",
    };
    return { output, groundedOn: [input.entity.id], confidence: 0.85 };
  }

  private stakeholderUpdate(input: StakeholderInput): AIResult {
    const lines = input.items.map((i) => `• ${i.name}: ${i.status}${i.reason_invested ? ` (${i.reason_invested})` : ""}`).join("\n");
    const output = {
      draft: `Hi ${input.stakeholder.name},\n\nHere is where things stand:\n${lines}\n\nHappy to discuss.`,
      is_draft: true as const,
    };
    const grounded = [input.stakeholder.id, ...input.items.map((i) => i.id)];
    return { output, groundedOn: grounded, confidence: 0.8 };
  }

  private emailDigest(input: EmailInput): AIResult {
    const items = input.messages.map((m) => ({
      kind: classify(m.subject, m.snippet),
      summary: m.snippet,
      thread_id: m.thread_id ?? m.provenance.external_id,
      linked_refs: (m.links ?? []).map((l) => l.id),
    }));
    const output = { items };
    const grounded = [...new Set(input.messages.flatMap((m) => [m.provenance.external_id, ...(m.links ?? []).map((l) => l.id)]))];
    return { output, groundedOn: grounded, confidence: 0.75 };
  }
}

function classify(subject: string, snippet: string): "needs_reply" | "decision" | "risk" | "fyi" {
  const t = `${subject} ${snippet}`.toLowerCase();
  if (t.includes("confirm") || t.includes("?")) return "needs_reply";
  if (t.includes("sign-off") || t.includes("decision") || t.includes("approve")) return "decision";
  if (t.includes("overlap") || t.includes("risk") || t.includes("maintenance")) return "risk";
  return "fyi";
}

interface DailyBriefInput { date: string; manager_name?: string; suggested_actions?: { id: string; urgency: string; text: string; refs?: string[] }[] }
interface HealthInput { entity: { id: string; name: string }; composite: number; drivers: { name: string; value: number }[] }
interface StakeholderInput { stakeholder: { id: string; name: string }; items: { id: string; name: string; status: string; reason_invested?: string | null }[] }
interface EmailInput { messages: { subject: string; snippet: string; thread_id?: string; provenance: { external_id: string }; links?: { id: string }[] }[] }
