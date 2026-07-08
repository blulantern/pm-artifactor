import { z } from "zod";
import { GroundedNumber, EntityId, OutputBase, IsoDate } from "./primitives.js";
import { EmailMessageEnvelope } from "./ingestion.js";

// prioritization.suggest
export const PrioritizationSuggestInput = z.object({
  model: z.enum(["WSJF", "RICE"]),
  items: z.array(z.object({
    id: z.string(),
    title: z.string(),
    estimate: z.number().nullable().optional(),
    linked_benefits: z.array(z.string()).optional(),
    linked_risks: z.array(z.string()).optional(),
    deadline: IsoDate.nullable().optional(),
    reach_estimate: z.number().nullable().optional(),
  })),
});
export const PrioritizationSuggestOutput = OutputBase.extend({
  scores: z.array(z.object({
    id: z.string(),
    components: z.record(z.string(), GroundedNumber),
    rationale: z.string(),
  })),
});

// daily-brief.compose
export const DailyBriefComposeInput = z.object({
  date: IsoDate,
  manager_name: z.string().optional(),
  suggested_actions: z.array(z.object({
    id: z.string(),
    type: z.enum([
      "sprint_end", "complex_check_in", "stakeholder_update_due",
      "one_on_one_overdue", "gate_deadline", "deploy_attention", "meeting_prep",
    ]),
    urgency: z.enum(["low", "med", "high"]),
    text: z.string(),
    refs: z.array(EntityId),
  })),
  calendar: z.array(z.object({}).passthrough()).optional(),
});
export const DailyBriefComposeOutput = OutputBase.extend({
  headline: z.string(),
  ranked_action_ids: z.array(EntityId),
  tips: z.array(z.string()),
});

// health.explain
export const HealthExplainInput = z.object({
  entity: z.object({ id: z.string(), type: z.enum(["portfolio", "program", "project"]), name: z.string() }),
  composite: z.number().min(0).max(100),
  drivers: z.array(z.object({
    name: z.enum([
      "schedule_variance", "cost_variance", "scope_creep", "raid_exposure",
      "dependency_risk", "benefit_confidence", "team_health",
    ]),
    value: z.number(),
    trend: z.enum(["improving", "flat", "worsening"]),
  })),
});
export const HealthExplainOutput = OutputBase.extend({
  summary: z.string(),
  primary_driver: z.string(),
  suggested_action: z.string(),
});

// teammate.insight (no ranking fields by design)
export const TeammateInsightInput = z.object({
  person_id: z.string(),
  velocity_samples: z.array(z.object({
    dimension: z.enum(["complexity", "effort", "risk"]),
    band: z.string(),
    throughput: z.number(),
    caveat: z.string().nullable().optional(),
  })),
  skills: z.array(z.object({
    skill: z.string(),
    proficiency: z.number().int().min(1).max(5),
    interest: z.number().int().min(1).max(5),
  })),
  upcoming_demand: z.array(z.string()).optional(),
});
export const TeammateInsightOutput = OutputBase.extend({
  thrives_on: z.string(),
  nudges: z.array(z.string()),
  stretch_candidates: z.array(z.string()).optional(),
});

// email.digest
export const EmailDigestInput = z.object({
  messages: z.array(EmailMessageEnvelope),
});
export const EmailDigestOutput = OutputBase.extend({
  items: z.array(z.object({
    kind: z.enum(["needs_reply", "decision", "risk", "fyi"]),
    summary: z.string(),
    thread_id: z.string(),
    linked_refs: z.array(EntityId).optional(),
  })),
});

// stakeholder.update (draft, is_draft const true)
export const StakeholderUpdateInput = z.object({
  stakeholder: z.object({
    id: z.string(),
    name: z.string(),
    interest_level: z.enum(["manage_closely", "keep_satisfied", "keep_informed", "monitor"]),
  }),
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    reason_invested: z.string().nullable().optional(),
  })),
});
export const StakeholderUpdateOutput = OutputBase.extend({
  draft: z.string(),
  is_draft: z.literal(true),
});

export const AI_TASK_OUTPUT = {
  "prioritization.suggest": PrioritizationSuggestOutput,
  "daily-brief.compose": DailyBriefComposeOutput,
  "health.explain": HealthExplainOutput,
  "teammate.insight": TeammateInsightOutput,
  "email.digest": EmailDigestOutput,
  "stakeholder.update": StakeholderUpdateOutput,
} as const;
export type AiTaskKey = keyof typeof AI_TASK_OUTPUT;
