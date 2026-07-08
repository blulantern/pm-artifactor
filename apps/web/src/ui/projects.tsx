import Link from "next/link";
import { Tag, HealthDot } from "./primitives.js";
import { healthColor } from "./format.js";
import type { getProjectsView } from "@/server/view-models";

type ProjectsViewModel = Awaited<ReturnType<typeof getProjectsView>>;

export function Projects({ view }: { view: ProjectsViewModel }) {
  return (
    <div className="view">
      <div className="h1">Projects</div>
      <div className="sub" style={{ margin: "3px 0 16px" }}>
        Delivery-facing. Each declares a methodology that configures its lifecycle, types, and workflow.
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {view.map((p, i) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <div
              className="row"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "15px 18px",
                cursor: "pointer",
                borderBottom: i < view.length - 1 ? "1px solid var(--line)" : "none",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{p.name}</div>
                <div className="sub" style={{ marginTop: 2 }}>
                  Next · {p.next}
                </div>
              </div>
              <Tag>{p.methodology}</Tag>
              <Tag>{p.source}</Tag>
              <div style={{ width: 120, textAlign: "right" }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                  SPI {p.spi ?? "—"} · CPI {p.cpi ?? "—"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, width: 80, justifyContent: "end" }}>
                <HealthDot health={p.health} />
                <span style={{ fontSize: 12, fontWeight: 600, color: healthColor(p.health) }}>{p.status}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
