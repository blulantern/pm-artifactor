import { z } from "zod";
import { Provenance, CanonicalRef, IsoDateTime, IsoDate } from "./primitives.js";

export const WorkItemEnvelope = z.object({
  provenance: Provenance,
  title: z.string(),
  canonical_type: z.string(),
  status_category: z.enum(["todo", "in_progress", "done", "blocked"]),
  hierarchy_level: z.number().int().min(1).optional(),
  parent_external_id: z.string().nullable().optional(),
  status_raw: z.string().optional(),
  assignee_email: z.string().email().nullable().optional(),
  estimate: z.number().nullable().optional(),
  estimate_unit: z.enum(["points", "hours", "days", "tshirt"]).nullable().optional(),
  complexity_band: z.enum(["low", "med", "high"]).nullable().optional(),
  risk_band: z.enum(["low", "med", "high"]).nullable().optional(),
  labels: z.array(z.string()).optional(),
  sprint_external_id: z.string().nullable().optional(),
  created_at: IsoDateTime.optional(),
  updated_at: IsoDateTime.optional(),
  last_status_change_at: IsoDateTime.nullable().optional(),
  links: z.array(CanonicalRef).optional(),
});
export type WorkItemEnvelope = z.infer<typeof WorkItemEnvelope>;

export const PersonEnvelope = z.object({
  provenance: Provenance,
  name: z.string(),
  email: z.string().email(),
  role: z.string().nullable().optional(),
  team_external_id: z.string().nullable().optional(),
  active: z.boolean().optional(),
});
export type PersonEnvelope = z.infer<typeof PersonEnvelope>;

export const SprintEnvelope = z.object({
  provenance: Provenance,
  name: z.string(),
  kind: z.enum(["sprint", "iteration", "pi", "phase_window", "release"]),
  start_date: IsoDate,
  end_date: IsoDate,
  goal: z.string().nullable().optional(),
  state: z.enum(["future", "active", "closed"]).optional(),
  committed_points: z.number().nullable().optional(),
});
export type SprintEnvelope = z.infer<typeof SprintEnvelope>;

export const DeploymentEnvelope = z.object({
  provenance: Provenance,
  environment: z.enum(["dev", "staging", "prod", "other"]),
  status: z.enum(["running", "success", "failed", "rolled_back"]),
  started_at: IsoDateTime,
  build_ref: z.string().nullable().optional(),
  commit_sha: z.string().nullable().optional(),
  is_rollback: z.boolean().optional(),
  finished_at: IsoDateTime.nullable().optional(),
  pr_external_ids: z.array(z.string()).optional(),
  work_item_links: z.array(CanonicalRef).optional(),
});
export type DeploymentEnvelope = z.infer<typeof DeploymentEnvelope>;

export const CalendarEventEnvelope = z.object({
  provenance: Provenance,
  title: z.string(),
  start: IsoDateTime,
  end: IsoDateTime,
  attendee_emails: z.array(z.string().email()).optional(),
  is_free_time: z.boolean().optional(),
  links: z.array(CanonicalRef).optional(),
});
export type CalendarEventEnvelope = z.infer<typeof CalendarEventEnvelope>;

export const EmailMessageEnvelope = z.object({
  provenance: Provenance,
  thread_id: z.string().optional(),
  subject: z.string(),
  from_email: z.string().email(),
  to_emails: z.array(z.string().email()).optional(),
  received_at: IsoDateTime,
  snippet: z.string(),
  is_unread: z.boolean().optional(),
  links: z.array(CanonicalRef).optional(),
});
export type EmailMessageEnvelope = z.infer<typeof EmailMessageEnvelope>;

export const IngestionEnvelope = z.union([
  WorkItemEnvelope, PersonEnvelope, SprintEnvelope,
  DeploymentEnvelope, CalendarEventEnvelope, EmailMessageEnvelope,
]);
export type IngestionEnvelope = z.infer<typeof IngestionEnvelope>;
