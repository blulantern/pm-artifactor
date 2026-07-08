import type { PrismaClient } from "@prisma/client";
import { WorkItemEnvelope } from "@pma/contracts";

/**
 * Fake, read-only work-tracker adapter. Simulates a `pull()` from Jira
 * without ever touching a network — deterministic fixtures only, validated
 * against the WorkItemEnvelope contract before being handed off.
 *
 * Note: this exposes `pull()` rather than the `WorkTrackerPort.fetchWorkItems`
 * signature from `@pma/core` (which takes a connectionId and returns
 * `unknown[]`); once that port is upgraded to typed envelopes this adapter
 * should implement it directly.
 */
export class FakeWorkTrackerAdapter {
  readonly capability = "work_tracker" as const;

  async pull(): Promise<WorkItemEnvelope[]> {
    const raw = [
      {
        provenance: {
          source: "jira" as const,
          external_id: "JIRA-999",
          external_url: "https://northwind.atlassian.net/browse/JIRA-999",
          pulled_at: "2026-03-16T00:00:00Z",
          mode: "read_only" as const,
        },
        title: "Add biometric re-auth to checkout",
        canonical_type: "Story",
        status_category: "todo" as const,
        estimate: 5,
        estimate_unit: "points" as const,
        complexity_band: "med" as const,
      },
      {
        provenance: {
          source: "jira" as const,
          external_id: "JIRA-1000",
          external_url: "https://northwind.atlassian.net/browse/JIRA-1000",
          pulled_at: "2026-03-16T00:00:00Z",
          mode: "read_only" as const,
        },
        title: "Fix double-charge on retry",
        canonical_type: "Story",
        status_category: "in_progress" as const,
        estimate: 3,
        estimate_unit: "points" as const,
        complexity_band: "high" as const,
      },
    ];

    return raw.map((env) => WorkItemEnvelope.parse(env));
  }

  /** Read-only: no write-back method exists on this adapter by design. */
}

export async function ingestWorkItems(
  prisma: PrismaClient,
  connectionId: string,
  envelopes: WorkItemEnvelope[],
): Promise<{ snapshots: number; created: number }> {
  let snapshots = 0;
  let created = 0;

  const project = await prisma.project.findFirstOrThrow({ where: { name: "Mobile Checkout Revamp" } });
  const storyType = await prisma.workItemType.findFirstOrThrow({
    where: { name: "Story", methodology: { key: "SCRUM" } },
  });

  for (const raw of envelopes) {
    const env = WorkItemEnvelope.parse(raw);

    const snapshot = await prisma.ingestionSnapshot.create({
      data: {
        syncConnectionId: connectionId,
        source: env.provenance.source,
        raw: JSON.stringify(env),
        normalized: false,
      },
    });
    snapshots += 1;

    const workItem = await prisma.workItem.create({
      data: {
        projectId: project.id,
        workItemTypeId: storyType.id,
        title: env.title,
        status: env.status_category,
        estimate: env.estimate ?? undefined,
        estimateUnit: env.estimate_unit ?? undefined,
        complexityBand: env.complexity_band ?? undefined,
        riskBand: env.risk_band ?? undefined,
      },
    });
    created += 1;

    await prisma.externalLink.create({
      data: {
        syncConnectionId: connectionId,
        internalType: "work_item",
        internalId: workItem.id,
        workItemId: workItem.id,
        externalId: env.provenance.external_id,
        externalUrl: env.provenance.external_url ?? null,
      },
    });

    await prisma.ingestionSnapshot.update({
      where: { id: snapshot.id },
      data: { normalized: true },
    });
  }

  return { snapshots, created };
}
