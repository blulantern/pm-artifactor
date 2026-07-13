import Link from "next/link";
import { Tag, HealthDot } from "./primitives.js";
import { healthColor } from "./format.js";
import { EntityFormDisclosure } from "./entity-form-disclosure.js";
import { DeleteButton } from "./delete-dialog.js";
import { DashboardFilters, ProvenanceBadge, type FilterableRow } from "./dashboard-filters.js";
import type { ManageOptions } from "@/server/ppm/manage-view.js";
import type { getProjectsView } from "@/server/view-models";

type ProjectsViewModel = Awaited<ReturnType<typeof getProjectsView>>;
type ProjectRow = ProjectsViewModel[number];

/** The most-specific spine parent a project hangs off, as a nav target — or null when standalone. */
function parentLink(p: ProjectRow): { href: string; label: string } | null {
  if (p.programId) return { href: "/programs", label: "In program" };
  if (p.productId) return { href: "/products", label: "In product" };
  if (p.portfolioId) return { href: "/portfolio", label: "In portfolio" };
  return null;
}

export function Projects({ view, options }: { view: ProjectsViewModel; options: ManageOptions }) {
  const rows: FilterableRow[] = view.map((p) => {
    const parent = parentLink(p);
    return {
      provenance: p.provenance,
      hasParent: p.hasParent,
      name: p.name,
      status: p.status,
      health: p.health,
      updatedAt: p.updatedAt,
      key: p.id,
      node: (
        <div style={{ borderBottom: "1px solid var(--line)" }}>
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
            {parent ? (
              <Link href={parent.href} style={{ textDecoration: "none" }}>
                <Tag style={{ color: "var(--teal)", borderColor: "var(--teal)" }}>{parent.label}</Tag>
              </Link>
            ) : (
              <Tag>Standalone</Tag>
            )}
            <ProvenanceBadge state={p.provenance} />
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
      ),
    };
  });

  return (
    <div className="view">
      <div className="h1">Projects</div>
      <div className="sub" style={{ margin: "3px 0 16px" }}>
        Delivery-facing. Each declares a methodology that configures its lifecycle, types, and workflow.
      </div>

      <div style={{ marginBottom: 16 }}>
        <EntityFormDisclosure type="project" options={options} label="＋ New project" openLabel="Cancel" />
      </div>

      <DashboardFilters rows={rows} containerClassName="card" containerStyle={{ overflow: "hidden" }} />
    </div>
  );
}
