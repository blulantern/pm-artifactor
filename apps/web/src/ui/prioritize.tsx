import Link from "next/link";
import { Bars } from "./primitives.js";
import type { getPrioritizeView } from "@/server/view-models";

type PrioritizeViewModel = Awaited<ReturnType<typeof getPrioritizeView>>;

const MODELS = ["WSJF", "RICE"] as const;

const FORMULA: Record<(typeof MODELS)[number], string> = {
  WSJF: "(BizValue + TimeCrit + RiskRed) ÷ Size",
  RICE: "(Reach × Impact × Confidence) ÷ Effort",
};

/** Per-column max used to scale each component's bar — mirrors the POC's `bars(c[1],c[2],...)` calls. */
const COMPONENTS: Record<(typeof MODELS)[number], { key: string; label: string; max: number }[]> = {
  WSJF: [
    { key: "userBusinessValue", label: "Biz value", max: 13 },
    { key: "timeCriticality", label: "Time crit", max: 13 },
    { key: "riskReduction", label: "Risk red", max: 13 },
    { key: "jobSize", label: "Size", max: 13 },
  ],
  RICE: [
    { key: "reach", label: "Reach", max: 5000 },
    { key: "impact", label: "Impact", max: 3 },
    { key: "confidence", label: "Confidence", max: 100 },
    { key: "effort", label: "Effort", max: 8 },
  ],
};

export function Prioritize({ view }: { view: PrioritizeViewModel }) {
  const { model, rows } = view;
  const components = COMPONENTS[model];

  return (
    <div className="view" style={{ maxWidth: 960 }}>
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between" }}>
        <div>
          <div className="h1">Prioritize</div>
          <div className="sub" style={{ marginTop: 3 }}>
            Rank any backlog with a swappable model. Scores are computed deterministically; AI only proposes the
            subjective inputs.
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, background: "var(--bg)", padding: 4, borderRadius: 10 }}>
          {MODELS.map((m) => (
            <Link key={m} href={`?model=${m}`} style={{ textDecoration: "none" }}>
              <button
                className={m === model ? "btn" : "ghost"}
                style={{ border: "none", ...(m !== model ? { background: "transparent" } : {}) }}
              >
                {m}
              </button>
            </Link>
          ))}
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden", marginTop: 16 }}>
        <div
          style={{
            padding: "11px 16px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div className="h2">{model} ranking</div>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
            {FORMULA[model]}
          </span>
        </div>
        {rows.map((row, i) => (
          <div
            key={row.id}
            className="row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "13px 16px",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div className="mono" style={{ width: 20, color: "var(--faint)" }}>
              {i + 1}
            </div>
            <div style={{ width: 170, fontWeight: 600, fontSize: 13.5 }}>{row.title}</div>
            <div style={{ flex: 1, display: "flex", gap: 14 }}>
              {components.map((c) => (
                <div key={c.key} style={{ flex: 1 }}>
                  <div
                    className="mono"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 9.5,
                      color: "var(--faint)",
                      marginBottom: 3,
                    }}
                  >
                    <span>{c.label}</span>
                    <span>{row.components[c.key] ?? 0}</span>
                  </div>
                  <Bars value={row.components[c.key] ?? 0} max={c.max} color="var(--teal3)" />
                </div>
              ))}
            </div>
            <div style={{ width: 60, textAlign: "right" }}>
              <div className="mono" style={{ fontWeight: 700, fontSize: 15, color: "var(--teal)" }}>
                {row.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 12 }}>
        ⇅ Switch models to see where they disagree — WSJF favors time-critical work, RICE favors reach. Both are
        pure computation (no tokens).
      </div>
    </div>
  );
}
