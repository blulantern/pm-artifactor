import { expect, test } from "vitest";
import { WorkItemEnvelope, DeploymentEnvelope, EmailMessageEnvelope } from "./index.js";

const prov = { source: "jira", external_id: "PMA-1", pulled_at: "2026-03-16T00:00:00Z", mode: "read_only" };

test("WorkItemEnvelope accepts a valid canonical work item", () => {
  const wi = {
    provenance: prov, title: "Apple Pay", canonical_type: "Story", status_category: "in_progress",
    hierarchy_level: 2, estimate: 5, estimate_unit: "points", complexity_band: "high", labels: [], links: [],
  };
  expect(WorkItemEnvelope.safeParse(wi).success).toBe(true);
});

test("WorkItemEnvelope rejects an unknown status_category", () => {
  const wi = { provenance: prov, title: "x", canonical_type: "Story", status_category: "wip" };
  expect(WorkItemEnvelope.safeParse(wi).success).toBe(false);
});

test("DeploymentEnvelope requires environment/status/started_at", () => {
  const ok = { provenance: prov, environment: "prod", status: "success", started_at: "2026-03-16T00:00:00Z" };
  expect(DeploymentEnvelope.safeParse(ok).success).toBe(true);
  expect(DeploymentEnvelope.safeParse({ provenance: prov, environment: "prod" }).success).toBe(false);
});

test("EmailMessageEnvelope requires subject/from_email/received_at/snippet", () => {
  const ok = { provenance: prov, subject: "Ledger", from_email: "a@b.com", received_at: "2026-03-16T00:00:00Z", snippet: "hi" };
  expect(EmailMessageEnvelope.safeParse(ok).success).toBe(true);
});

test("DeploymentEnvelope rejects a date-only started_at (timestamps must be full datetimes)", () => {
  const bad = { provenance: prov, environment: "prod", status: "success", started_at: "2026-03-16" };
  expect(DeploymentEnvelope.safeParse(bad).success).toBe(false);
});
