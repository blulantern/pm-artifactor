import { Panel, Eyebrow } from "./primitives.js";
import type { getDoraView } from "@/server/view-models";

type DoraViewModel = Awaited<ReturnType<typeof getDoraView>>;

/** Illustrative bar heights only — no trailing-week deploy history is tracked yet, so this
 * shape is not derived from real data. The KPI cards above carry the real computed numbers. */
const ILLUSTRATIVE_WEEKS = [2, 3, 2, 4, 3, 5, 3, 4];

export function Dora({ view }: { view: DoraViewModel }) {
  const kpis: { label: string; value: string; color: string }[] = [
    { label: "Deploy frequency", value: `${view.prodDeploys} prod deploys`, color: "var(--win)" },
    {
      label: "Lead time",
      value: view.avgLeadTimeMinutes != null ? `${view.avgLeadTimeMinutes}m` : "—",
      color: "var(--teal)",
    },
    { label: "Change failure", value: `${Math.round(view.changeFailureRate * 100)}%`, color: "var(--amber)" },
    { label: "MTTR", value: view.mttrMinutes != null ? `${view.mttrMinutes}m` : "—", color: "var(--teal)" },
  ];

  return (
    <div className="view" style={{ maxWidth: 820 }}>
      <div className="h1">Deployment Health</div>
      <div className="sub" style={{ margin: "3px 0 16px" }}>
        DORA metrics computed across GitHub + Bitbucket + Azure pipelines in one view — the payoff of linking
        deploys to work in the canonical model.
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        {kpis.map((k) => (
          <div key={k.label} className="card" style={{ padding: 16 }}>
            <Eyebrow>{k.label}</Eyebrow>
            <div className="kpi" style={{ color: k.color, marginTop: 4 }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel
          title="Deploy frequency · illustrative"
          sub="Shape only — no trailing-week deploy history is tracked yet; the real count is above"
        >
          <svg viewBox="0 0 600 130" style={{ width: "100%", height: 130 }}>
            {ILLUSTRATIVE_WEEKS.map((v, i) => (
              <rect
                key={i}
                className="bar"
                x={20 + i * 70}
                y={120 - v * 20}
                width={44}
                height={v * 20}
                rx={4}
                fill="var(--teal2)"
                opacity={0.55}
              />
            ))}
          </svg>
        </Panel>
      </div>
    </div>
  );
}
