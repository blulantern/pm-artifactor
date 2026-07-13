import Link from "next/link";
import { Tag, HealthDot } from "./primitives.js";
import { healthColor } from "./format.js";
import { EntityFormDisclosure } from "./entity-form-disclosure.js";
import { DeleteButton } from "./delete-dialog.js";
import type { ManageOptions } from "@/server/ppm/manage-view.js";
import type { getProjectsView } from "@/server/view-models";

type ProjectsViewModel = Awaited<ReturnType<typeof getProjectsView>>;

export function Projects({ view, options }: { view: ProjectsViewModel; options: ManageOptions }) {
  return (
    <div className="view">
      <div className="h1">Projects</div>
      <div className="sub" style={{ margin: "3px 0 16px" }}>
        Delivery-facing. Each declares a methodology that configures its lifecycle, types, and workflow.
      </div>

      <div style={{ marginBottom: 16 }}>
        <EntityFormDisclosure type="project" options={options} label="＋ New project" openLabel="Cancel" />
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {view.map((p, i) => (
          <div key={p.id} style={{ borderBottom: i < view.length - 1 ? "1px solid var(--line)" : "none" }}>
            <div className="row" style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px 6px" }}>
              <Link
                href={`/projects/${p.id}`}
                style={{ textDecoration: "none", color: "inherit", flex: 1, display: "block" }}
              >
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{p.name}</div>
                <div className="sub" style={{ marginTop: 2 }}>
                  Next · {p.next}
                </div>
              </Link>
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
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 18px 12px" }}>
              <EntityFormDisclosure
                type="project"
                options={options}
                label="Edit"
                initial={{
                  id: p.id,
                  name: p.name,
                  status: p.status,
                  methodologyId: p.methodologyId,
                  programId: p.programId,
                  productId: p.productId,
                }}
              />
              <DeleteButton parent={{ type: "project", id: p.id }} label="Delete" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
