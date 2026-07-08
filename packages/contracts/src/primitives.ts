import { z } from "zod";

export const CANONICAL_ENTITY_TYPES = [
  "portfolio", "program", "project", "work_item", "release",
  "deployment", "stakeholder", "person", "benefit", "objective",
] as const;

export const CACHE_ENTITY_TYPES = [...CANONICAL_ENTITY_TYPES, "cadence"] as const;

export const INGESTION_SOURCES = [
  "jira", "asana", "monday", "github", "bitbucket", "azure_devops",
  "google_calendar", "outlook_calendar", "gmail", "outlook_mail",
] as const;

/** ISO-8601 date-time (with optional timezone offset), e.g. `2026-03-16T09:00:00Z`. */
export const IsoDateTime = z.string().datetime({ offset: true });
/** ISO-8601 calendar date, e.g. `2026-03-16` (no time component). */
export const IsoDate = z.string().date();

export const GroundedNumber = z.object({
  value: z.number(),
  source: z.enum(["derived", "suggested"]),
  from_field: z.string().nullable().optional(),
});
export type GroundedNumber = z.infer<typeof GroundedNumber>;

export const EntityId = z.string();

export const OutputBase = z.object({
  grounded_on: z.array(EntityId).min(1),
  confidence: z.number().min(0).max(1),
});
export type OutputBase = z.infer<typeof OutputBase>;

export const CanonicalRef = z.object({
  type: z.enum(CANONICAL_ENTITY_TYPES),
  id: z.string(),
});
export type CanonicalRef = z.infer<typeof CanonicalRef>;

export const Provenance = z.object({
  source: z.enum(INGESTION_SOURCES),
  external_id: z.string(),
  external_url: z.string().optional(),
  pulled_at: IsoDateTime,
  mode: z.literal("read_only"),
  raw: z.record(z.string(), z.unknown()).optional(),
});
export type Provenance = z.infer<typeof Provenance>;
