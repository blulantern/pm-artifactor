import Link from "next/link";
import { Tag, Bars, Eyebrow } from "./primitives.js";
import { healthColor } from "./format.js";
import { EntityFormDisclosure } from "./entity-form-disclosure.js";
import { DeleteButton } from "./delete-dialog.js";
import { DashboardFilters, ProvenanceBadge, type FilterableRow } from "./dashboard-filters.js";
import type { ManageOptions } from "@/server/ppm/manage-view.js";
import type { getProgramsView } from "@/server/view-models";

type ProgramsViewModel = Awaited<ReturnType<typeof getProgramsView>>;

/** Dashboard panels the program page promises but doesn't yet build — POC's "available panels" strip. */
const DASHBOARD_PANELS = [
  "Benefits Realization Tracker",
  "RAID Command (quantitative)",
  "Program EVM / Financials",
  "Cross-project Ripple",
  "Change Control Queue",
  "Methodology-translated Roadmap",
];

export function Programs({ view, options }: { view: ProgramsViewModel; options: ManageOptions }) {
  const rows: FilterableRow[] = view.map((p) => ({
    provenance: p.provenance,
    hasParent: p.hasParent,
    name: p.name,
    status: p.status,
    health: p.health,
    updatedAt: p.updatedAt,
    key: p.id,
    node: (
      <div className="card" style={{ padding: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div className="h2">{p.name}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <ProvenanceBadge state={p.provenance} />
            <Tag>{p.methodology}</Tag>
          </div>
        </div>

        <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
          {p.portfolio ? (
            <Link href="/portfolio" style={{ color: "var(--teal)", textDecoration: "none" }}>
              {p.portfolio}
            </Link>
          ) : (
            <span className="sub">Standalone</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
          <div>
            <Eyebrow>Health</Eyebrow>
            <div className="kpi" style={{ color: healthColor(p.health), fontSize: 19 }}>
              {p.health}
            </div>
          </div>
          <div>
            <Eyebrow>Benefit</Eyebrow>
            <div className="kpi" style={{ fontSize: 19 }}>
              {p.benefitPct}%
            </div>
          </div>
          <div>
            <Eyebrow>Projects</Eyebrow>
            <div className="kpi" style={{ fontSize: 19 }}>
              {p.projectCount}
            </div>
          </div>
        </div>

        <Eyebrow style={{ marginBottom: 6 }}>Benefit realization</Eyebrow>
        <Bars value={p.benefitPct} max={100} color="var(--win)" />

        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {p.projects.map((proj) => (
            <Link key={proj.id} href={`/projects/${proj.id}`} style={{ textDecoration: "none" }}>
              <button className="ghost" style={{ fontSize: 12 }}>
                {proj.name}
              </button>
            </Link>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid var(--line)",
          }}
        >
          <EntityFormDisclosure
            type="program"
            options={options}
            label="Edit"
            initial={{ id: p.id, name: p.name, status: p.status, portfolioId: p.portfolioId }}
          />
          <DeleteButton parent={{ type: "program", id: p.id }} label="Delete" />
        </div>
      </div>
    ),
  }));

  return (
    <div className="view">
      <div className="h1">Programs</div>
      <div className="sub" style={{ margin: "3px 0 16px" }}>
        Benefit-facing coordination. Each rolls up its projects and owns its benefits.
      </div>

      <div style={{ marginBottom: 16 }}>
        <EntityFormDisclosure type="program" options={options} label="＋ New program" openLabel="Cancel" />
      </div>

      <DashboardFilters rows={rows} containerClassName="grid" containerStyle={{ gridTemplateColumns: "1fr 1fr" }} />

      <div style={{ marginTop: 16 }} className="card">
        <div style={{ padding: "14px 16px" }} className="h2">
          Program dashboard panels available
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", padding: "0 16px 16px", gap: 10 }}>
          {DASHBOARD_PANELS.map((x) => (
            <div key={x} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 11, fontSize: 12.5, fontWeight: 500 }}>
              {x}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
