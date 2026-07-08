import { z } from "zod";
import { CACHE_ENTITY_TYPES } from "./primitives.js";

export const EntityRef = z.object({
  type: z.enum(CACHE_ENTITY_TYPES),
  id: z.string(),
});

export const FeatureValue = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("number"), number: z.number() }),
  z.object({ kind: z.literal("band"), band: z.enum(["low", "med", "high"]) }),
  z.object({ kind: z.literal("category"), category: z.string() }),
  z.object({ kind: z.literal("trend"), trend: z.enum(["improving", "flat", "worsening"]) }),
  z.object({ kind: z.literal("vector"), vector: z.array(z.number()) }),
]);
export type FeatureValue = z.infer<typeof FeatureValue>;

export const FeatureRecord = z.object({
  metric: z.string(),
  entity: EntityRef,
  value: FeatureValue,
  computed_at: z.string(),
  deterministic_fn: z.string(),
  fn_version: z.string(),
  inputs_hash: z.string().nullable().optional(),
});
export type FeatureRecord = z.infer<typeof FeatureRecord>;

export const TaskComputationProfile = z.object({
  task_type: z.string(),
  mode: z.enum(["deterministic", "hybrid", "generative"]),
  deterministic_first: z.boolean().optional(),
  feature_metrics: z.array(z.string()).optional(),
  graduation_eligible: z.boolean().optional(),
  min_examples_to_train: z.number().int().min(1).nullable().optional(),
  promotion_agreement: z.number().min(0).max(1).nullable().optional(),
});

export const TrainingExample = z.object({
  task_type: z.string(),
  features: z.array(FeatureRecord),
  served_output: z.record(z.string(), z.unknown()).nullable().optional(),
  served_by: z.enum(["deterministic", "llm", "learned_model"]).nullable().optional(),
  label: z.object({
    verdict: z.enum(["accept", "edit", "dismiss"]),
    corrected_output: z.record(z.string(), z.unknown()).nullable().optional(),
  }).nullable().optional(),
  outcome_ref: EntityRef.optional(),
  outcome_value: z.union([z.number(), z.string(), z.boolean()]).nullable().optional(),
  dataset_version: z.string(),
});

export const ShadowEvaluation = z.object({
  task_type: z.string(),
  learned_model_version: z.string(),
  sample_size: z.number().int().min(1),
  agreement: z.number().min(0).max(1),
  regressions: z.array(z.string()).nullable().optional(),
  recommend_promote: z.boolean().optional(),
  evaluated_at: z.string(),
});
