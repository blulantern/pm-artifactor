import { Panel, Chip, Tag } from "./primitives.js";
import type { getReleasesView } from "@/server/view-models";

type ReleasesViewModel = Awaited<ReturnType<typeof getReleasesView>>;

const STATUS_DOT: Record<string, string> = {
  success: "var(--win)",
  running: "var(--amber)",
  rolled_back: "var(--flag)",
  failed: "var(--flag)",
};

const RELEASE_STATUS_LABEL: Record<string, string> = {
  released: "Released",
  deploying: "Deploying",
  planned: "Planned",
};

const RENDITIONS = ["Customer", "Technical", "Executive", "Ops / runbook"];
const DESTINATIONS = ["Confluence", "Google Doc", "GitHub Release", "Slack", "Email", "In-app"];

export function Releases({ view }: { view: ReleasesViewModel }) {
  return (
    <div className="view" style={{ maxWidth: 920 }}>
      <div className="h1">Release Command Center</div>
      <div className="sub" style={{ margin: "3px 0 16px" }}>
        Cross-tool releases spanning work + code + deploys, monitored read-only from GitHub, Bitbucket and Azure
        Pipelines.
      </div>

      {view.map((r) => {
        const label = RELEASE_STATUS_LABEL[r.status] ?? r.status;
        const isReleased = r.status === "released";
        return (
          <div key={r.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span className="mono" style={{ fontWeight: 700, fontSize: 15 }}>
                {r.version}
              </span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{r.name}</span>
              <Chip
                style={{
                  marginLeft: "auto",
                  background: isReleased ? "var(--win-bg)" : "var(--amber-bg)",
                  color: isReleased ? "var(--win)" : "var(--amber)",
                }}
              >
                {label}
              </Chip>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {r.environments.map((e, i) => (
                <div
                  key={`${e.environment}-${i}`}
                  style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 9, padding: "10px 12px" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span
                      className={e.status === "running" ? "live" : undefined}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: STATUS_DOT[e.status] ?? "var(--faint)",
                      }}
                    />
                    <span style={{ fontWeight: 600, fontSize: 12.5, textTransform: "capitalize" }}>
                      {e.environment}
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--faint)", marginTop: 4 }}>
                    {e.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <Panel title="Release notes · write once, drop anywhere">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {RENDITIONS.map((a, i) => (
            <Chip
              key={a}
              style={i === 0 ? { background: "var(--teal2)", color: "#fff" } : undefined}
            >
              {a} rendition
            </Chip>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {DESTINATIONS.map((t) => (
            <Tag key={t} style={{ padding: "4px 8px" }}>
              → {t}
            </Tag>
          ))}
        </div>
      </Panel>
    </div>
  );
}
