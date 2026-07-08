import { z } from "zod";
import { CACHE_ENTITY_TYPES } from "./primitives.js";

export const ResolutionTier = z.enum([
  "exact_cache", "semantic_cache", "incremental", "learned_model", "llm",
]);

export const CacheDependency = z.object({
  entity_type: z.enum(CACHE_ENTITY_TYPES),
  entity_id: z.string(),
  field: z.string().nullable().optional(),
  version: z.union([z.number().int(), z.string()]).nullable().optional(),
});

export const CacheEntry = z.object({
  key_hash: z.string(),
  task_type: z.string(),
  grain: z.string().nullable().optional(),
  input_hash: z.string(),
  output: z.record(z.string(), z.unknown()),
  model_version: z.string(),
  resolution_tier: ResolutionTier,
  dependencies: z.array(CacheDependency).optional(),
  embedding: z.array(z.number()).nullable().optional(),
  tokens_used: z.number().int().min(0).optional(),
  tokens_saved: z.number().int().min(0).optional(),
  hit_count: z.number().int().min(0).optional(),
  created_at: z.string(),
  last_used_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  stale: z.boolean(),
});

export const CachePolicy = z.object({
  task_type: z.string(),
  tiers_enabled: z.array(ResolutionTier),
  ttl_seconds: z.number().int().min(0).nullable().optional(),
  semantic_threshold: z.number().min(0).max(1).nullable().optional(),
  decompose_grain: z.string().nullable().optional(),
  decision_bearing: z.boolean().optional(),
});

export const AIFeedback = z.object({
  ai_task_id: z.string(),
  task_type: z.string(),
  verdict: z.enum(["accept", "edit", "dismiss"]),
  edited_output: z.record(z.string(), z.unknown()).nullable().optional(),
  at: z.string(),
});

export const LearnedModel = z.object({
  task_type: z.string(),
  kind: z.enum(["regression", "classifier", "preference"]),
  version: z.string(),
  artifact_ref: z.string().optional(),
  trained_on: z.number().int().nullable().optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
  confidence_floor: z.number().min(0).max(1).nullable().optional(),
  active: z.boolean(),
  trained_at: z.string(),
});

export const ResolutionResult = z.object({
  task_type: z.string(),
  resolution_tier: ResolutionTier,
  cache_key: z.string().nullable().optional(),
  learned_model_version: z.string().nullable().optional(),
  escalated_to_llm: z.boolean().optional(),
  tokens_used: z.number().int().min(0),
  tokens_saved: z.number().int().min(0),
});
