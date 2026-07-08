import { Bars, Eyebrow, Kpi, Panel } from "./primitives.js";
import type { getIntelView } from "@/server/view-models";

type IntelViewModel = Awaited<ReturnType<typeof getIntelView>>;

/** Display label + color for each AiTask/AiResultCache resolutionTier code, cheapest-first. */
const TIER_META: Record<string, [string, string]> = {
  deterministic: ["Deterministic", "var(--teal)"],
  exact_cache: ["Exact cache", "var(--teal3)"],
  semantic_cache: ["Semantic", "var(--blue)"],
  incremental: ["Incremental", "var(--teal2)"],
  learned_model: ["Learned", "var(--violet)"],
  llm: ["LLM", "var(--amber)"],
};
const TIER_ORDER = Object.keys(TIER_META);

/** Designed target distribution — illustrative only, shown while no AiTask rows have been logged. */
const PROJECTED_TIERS: [string, number, string][] = [
  ["Deterministic", 57, "var(--teal)"],
  ["Exact cache", 22, "var(--teal3)"],
  ["Semantic", 6, "var(--blue)"],
  ["Learned", 4, "var(--violet)"],
  ["LLM", 11, "var(--amber)"],
];

const PIPELINE_STAGES = [
  "Sources (read-only)",
  "Deterministic compute",
  "Feature records",
  "Generative (LLM)",
  "Human accept/edit",
  "Training corpus",
  "Learned models",
];

function Ladder({ rows, max }: { rows: [string, number, string][]; max: number }) {
  return (
    <div>
      {rows.map(([label, value, color]) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 9 }}>
          <div style={{ width: 100, fontSize: 12.5, fontWeight: 500 }}>{label}</div>
          <div style={{ flex: 1 }}>
            <Bars value={value} max={max} color={color} />
          </div>
          <span className="mono" style={{ fontSize: 11, width: 34, textAlign: "right" }}>
            {value}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function Intel({ view }: { view: IntelViewModel }) {
  const total = view.cacheEntryCount;
  const liveRows: [string, number, string][] = TIER_ORDER.filter((code) =>
    view.resolutionTiers.some((t) => t.tier === code && t.count > 0),
  ).map((code) => {
    const [label, color] = TIER_META[code] ?? [code, "var(--faint)"];
    const count = view.resolutionTiers.find((t) => t.tier === code)?.count ?? 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return [label, pct, color];
  });

  return (
    <div className="view" style={{ maxWidth: 920 }}>
      <div className="h1">System Intelligence</div>
      <div className="sub" style={{ margin: "3px 0 16px" }}>
        The three-layer engine: compute what you can, generate only what you must, learn over time. This panel is
        the dial.
      </div>

      {!view.hasLiveData ? (
        <div
          className="card"
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            background: "var(--amber-bg)",
            border: "1px solid var(--amber)",
            fontSize: 12.5,
            color: "var(--ink)",
            fontWeight: 500,
          }}
        >
          Projected — no live AI calls logged yet ({view.aiTaskCount} AiTask rows). The AI layer ships in a later
          phase; the ladder and pipeline below show the designed architecture, not measured traffic.
        </div>
      ) : null}

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <Kpi value={view.aiTaskCount} label="AI tasks logged" color="var(--teal)" />
        <Kpi value={view.featureRecordCount} label="Feature records" color="var(--teal)" />
        <Kpi value={view.cacheEntryCount} label="Cache entries" color="var(--teal)" />
        <Kpi value={view.hasLiveData ? view.tokensSaved.toLocaleString() : "—"} label="Tokens saved" color="var(--win)" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Panel
          title="Resolution ladder · where requests are served"
          sub={view.hasLiveData ? "cheapest correct tier first" : "designed target — not yet measured"}
        >
          {view.hasLiveData ? (
            liveRows.length > 0 ? (
              <Ladder rows={liveRows} max={100} />
            ) : (
              <div className="sub">No cache entries logged yet.</div>
            )
          ) : (
            <Ladder rows={PROJECTED_TIERS} max={60} />
          )}
        </Panel>

        <Panel title="Learning layer · maturity" sub="shadow before serve · LLM as fallback">
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
            Models graduate from <b>shadow</b> (logging predictions without serving them) to <b>live</b> once they
            prove accuracy against the deterministic/cache baseline, with the LLM tier as fallback for whatever
            neither layer can resolve.
            {view.hasLiveData
              ? " Per-model promotion status will appear here once the model registry is wired up."
              : " No AiTask rows exist yet, so no model has entered shadow mode — there is nothing to report per-model."}
          </div>
        </Panel>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <div className="h2" style={{ marginBottom: 10 }}>
          The pipeline{!view.hasLiveData ? <Eyebrow style={{ display: "inline", marginLeft: 8 }}>designed</Eyebrow> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 12 }}>
          {PIPELINE_STAGES.map((s, i) => (
            <span key={s} style={{ display: "contents" }}>
              <span style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 11px", fontWeight: 500 }}>
                {s}
              </span>
              {i < PIPELINE_STAGES.length - 1 ? <span style={{ color: "var(--teal3)" }}>→</span> : null}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 12 }}>
          Every deterministic result is a feature; every human verdict is a label. The corpus trains the learned
          tier, which graduates tasks off the LLM as it proves itself in shadow.
        </div>
      </div>
    </div>
  );
}
