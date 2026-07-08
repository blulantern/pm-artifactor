import Link from "next/link";
import { Panel, Kpi, Bars, HealthDot } from "./primitives.js";
import { healthColor } from "./format.js";
import type { getPortfolioView } from "@/server/view-models";

type PortfolioViewModel = Awaited<ReturnType<typeof getPortfolioView>>;

/** Color palette cycled across strategic objectives — the POC hardcodes one color per row. */
const ALIGNMENT_COLORS = ["var(--teal2)", "var(--teal3)", "var(--blue)", "var(--flag)", "var(--amber)", "var(--violet)"];

/** Waterfall stage colors — POC uses a fixed 4-stage gradient; we have two real totals. */
const WATERFALL_COLORS = ["var(--line2)", "var(--win)"];

export function Portfolio({ view }: { view: PortfolioViewModel }) {
  const waterfall: [string, number][] = [
    ["Investment", view.invest],
    ["Benefit realized", view.benefitRealized],
  ];
  const wfMax = Math.max(view.invest, view.benefitRealized, 1);
  const wfHeight = 12 + waterfall.length * 34 + 8;

  const alignmentMax = Math.max(50, ...view.objectives.map((o) => o.weightPct));

  return (
    <div className="view">
      <div className="h1">{view.name}</div>
      <div className="sub" style={{ margin: "3px 0 16px" }}>
        Everything the portfolio funds, reconciled across tools into one governance view.
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <Kpi label="Portfolio health" value={view.health} color={healthColor(view.health)} />
        <Kpi label="Total investment" value={`$${view.invest}M`} color="var(--ink)" />
        <Kpi label="Benefit realized" value={`$${view.benefitRealized}M`} color="var(--win)" />
        <Kpi label="Programs / projects" value={`${view.programs.length}`} color="var(--ink)" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
        <Panel title="Portfolio health matrix" sub="explainable · click to decompose">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {view.programs.map((p) => (
              <Link key={p.id} href="/programs" style={{ textDecoration: "none", color: "inherit" }}>
                <div
                  className="row"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: 8, borderRadius: 8, cursor: "pointer" }}
                >
                  <div style={{ width: 120, fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                  <div style={{ flex: 1 }}>
                    <Bars value={p.health} max={100} color={healthColor(p.health)} />
                  </div>
                  <div className="mono" style={{ width: 40, textAlign: "right" }}>
                    {p.health}
                  </div>
                  <HealthDot health={p.health} />
                </div>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Investment vs benefit" sub="waterfall">
          <svg viewBox={`0 0 300 ${wfHeight}`} style={{ width: "100%", height: wfHeight }}>
            {waterfall.map(([label, amount], i) => (
              <g key={label}>
                <rect
                  x={10}
                  y={12 + i * 34}
                  width={Math.max((amount / wfMax) * 240, 2)}
                  height={20}
                  rx={4}
                  fill={WATERFALL_COLORS[i % WATERFALL_COLORS.length] ?? "var(--line2)"}
                  className="bar"
                />
                <text x={14} y={26 + i * 34} fontSize={10} fill="#fff" fontWeight={600}>
                  {label} ${amount}M
                </text>
              </g>
            ))}
          </svg>
        </Panel>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
        <Panel title="Capacity vs demand" sub="true cross-tool utilization">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {view.loads.map((l) => (
              <div key={l.personId}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span>{l.name.split(" ")[0]}</span>
                  <span className="mono" style={{ color: l.overallocated ? "var(--flag)" : "var(--ink)" }}>
                    {l.totalPct}%
                  </span>
                </div>
                <Bars value={l.totalPct} max={100} color={l.overallocated ? "var(--flag)" : "var(--teal2)"} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Strategic alignment" sub="investment weight by objective">
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {view.objectives.map((o, i) => (
              <div key={o.title} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 120, fontSize: 12 }}>{o.title}</div>
                <div style={{ flex: 1 }}>
                  <Bars
                    value={o.weightPct}
                    max={alignmentMax}
                    color={ALIGNMENT_COLORS[i % ALIGNMENT_COLORS.length] ?? "var(--teal2)"}
                  />
                </div>
                <span className="mono" style={{ fontSize: 11, width: 32, textAlign: "right" }}>
                  {o.weightPct}%
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
