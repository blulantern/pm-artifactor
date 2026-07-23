import { timeAgo } from "./format.js";
import type { getConnectionsView } from "@/server/view-models";
import { AtlassianCard } from "./atlassian-card.js";
import type { AtlassianView } from "@/server/view-models";

type ConnectionsViewModel = Awaited<ReturnType<typeof getConnectionsView>>;

/** Known integration vendors and their category label, matching the ExternalSystem.vendor codes in schema. */
const CATALOG: { vendor: string; label: string; kind: string }[] = [
  { vendor: "jira", label: "Jira", kind: "WorkTracker" },
  { vendor: "github", label: "GitHub", kind: "SourceControl · CICD" },
  { vendor: "azure_devops", label: "Azure DevOps", kind: "Boards · Repos · Pipelines" },
  { vendor: "bitbucket", label: "Bitbucket", kind: "SourceControl · CICD" },
  { vendor: "google_calendar", label: "Google Calendar", kind: "Calendar" },
  { vendor: "gmail", label: "Gmail", kind: "Mail" },
  { vendor: "monday", label: "Monday", kind: "WorkTracker" },
  { vendor: "confluence", label: "Confluence", kind: "KnowledgeBase" },
];

function SourceCard({ label, kind, system }: { label: string; kind: string; system: ConnectionsViewModel[number] | null }) {
  const connection = system?.connections[0] ?? null;
  return (
    <div className="card" style={{ padding: 15 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "var(--bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            color: "var(--teal)",
          }}
        >
          {label[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{label}</div>
          <div className="mono" style={{ fontSize: 9, color: "var(--faint)" }}>
            {kind}
          </div>
        </div>
      </div>
      {connection ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--teal)", fontWeight: 600 }}>
            <span className="live" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--teal3)" }} />
            Read-only · pulled {timeAgo(connection.lastPulledAt)}
          </div>
          {connection.snapshotCount > 0 ? (
            <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 4 }}>
              {connection.snapshotCount} snapshot{connection.snapshotCount === 1 ? "" : "s"} ingested
              {connection.linkCount > 0 ? ` · ${connection.linkCount} linked` : ""}
            </div>
          ) : null}
        </div>
      ) : (
        <button className="ghost" style={{ width: "100%" }}>
          Connect
        </button>
      )}
    </div>
  );
}

export function Connections({
  view,
  atlassian,
  notice,
}: {
  view: ConnectionsViewModel;
  atlassian: AtlassianView;
  notice?: string;
}) {
  const byVendor = new Map(view.map((s) => [s.vendor.toLowerCase(), s]));
  const catalogVendors = new Set(CATALOG.map((c) => c.vendor));
  const extras = view.filter((s) => !catalogVendors.has(s.vendor.toLowerCase()));

  return (
    <div className="view" style={{ maxWidth: 820 }}>
      <div className="h1">Connections</div>
      <div className="sub" style={{ margin: "3px 0 16px" }}>
        Your own accounts, read-only. Pulled to enrich the canonical model — nothing is written back, nothing leaves
        this device.
      </div>
      <AtlassianCard view={atlassian} notice={notice} />
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {CATALOG.map((c) => (
          <SourceCard key={c.vendor} label={c.label} kind={c.kind} system={byVendor.get(c.vendor) ?? null} />
        ))}
        {extras.map((s) => (
          <SourceCard
            key={s.id}
            label={s.vendor[0]!.toUpperCase() + s.vendor.slice(1)}
            kind={s.connections[0]?.direction ?? ""}
            system={s}
          />
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 14 }}>
        ⊘ Pull-only by design. GitHub/Bitbucket monitoring stays read-only permanently.
      </div>
    </div>
  );
}
