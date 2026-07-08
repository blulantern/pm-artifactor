import Link from "next/link";
import { Panel, Bars, Eyebrow, Tag } from "./primitives.js";
import { healthColor } from "./format.js";
import type { getProjectView } from "@/server/view-models";
import type { DriverName, Trend } from "@pma/core";

type ProjectViewModel = Awaited<ReturnType<typeof getProjectView>>;

const DRIVER_LABELS: Record<DriverName, string> = {
  schedule_variance: "Schedule variance",
  cost_variance: "Cost variance",
  scope_creep: "Scope creep",
  raid_exposure: "RAID exposure",
  dependency_risk: "Dependency risk",
  benefit_confidence: "Benefit confidence",
  team_health: "Team health",
};

const TREND_COLOR: Record<Trend, string> = {
  worsening: "var(--flag)",
  improving: "var(--win)",
  flat: "var(--muted)",
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * `Baseline.snapshot` is freeform JSON text (no schema constrains it — see schema.prisma
 * comment "JSON as text"). We look for a `planned*`/`actual*` key pair, which is the
 * natural shape for a captured baseline, and diff them; anything else falls back to a
 * neutral "captured on" line rather than guessing at unknown fields.
 */
function baselineVariance(
  type: string,
  snapshot: unknown,
): { text: string; color: string } | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const obj = snapshot as Record<string, unknown>;
  const keys = Object.keys(obj);
  const plannedKey = keys.find((k) => /^planned/i.test(k));
  if (!plannedKey) return null;
  const suffix = plannedKey.slice("planned".length);
  const actualKey = keys.find((k) => k.toLowerCase() === `actual${suffix}`.toLowerCase());
  if (!actualKey) return null;
  const planned = obj[plannedKey];
  const actual = obj[actualKey];

  if (typeof planned === "number" && typeof actual === "number") {
    const delta = actual - planned;
    const bad = type === "schedule" || type === "cost" ? delta > 0 : delta > 0;
    const color = delta === 0 ? "var(--muted)" : bad ? "var(--flag)" : "var(--win)";
    const sign = delta >= 0 ? "+" : "";
    if (type === "cost") return { text: `${sign}$${Math.abs(delta).toLocaleString()}`, color };
    if (type === "scope") return { text: `${sign}${delta} items`, color };
    return { text: `${sign}${delta}`, color };
  }
  if (typeof planned === "string" && typeof actual === "string") {
    const plannedMs = Date.parse(planned);
    const actualMs = Date.parse(actual);
    if (!Number.isNaN(plannedMs) && !Number.isNaN(actualMs)) {
      const days = Math.round((actualMs - plannedMs) / 86_400_000);
      const color = days === 0 ? "var(--muted)" : days > 0 ? "var(--flag)" : "var(--win)";
      return { text: `${days >= 0 ? "+" : ""}${days} days`, color };
    }
  }
  return null;
}

function DeliveryForecast({ view }: { view: ProjectViewModel }) {
  // No probabilistic-forecast analyzer exists yet (see packages/core) — SPI/CPI are the
  // deterministic signal we do have, so they stand in for a forecast confidence read.
  const spiPace = view.spi == null ? null : view.spi >= 1 ? "ahead of" : view.spi >= 0.95 ? "on" : "behind";
  return (
    <Panel title="Delivery forecast" sub="SPI/CPI · deterministic">
      <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
        <div>
          <Eyebrow>SPI</Eyebrow>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{view.spi ?? "—"}</div>
        </div>
        <div>
          <Eyebrow>CPI</Eyebrow>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{view.cpi ?? "—"}</div>
        </div>
        <div>
          <Eyebrow>Next</Eyebrow>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{view.next || "—"}</div>
        </div>
      </div>
      {view.spi != null ? (
        <>
          <Bars value={view.spi * 100} max={120} color={view.spi >= 1 ? "var(--win)" : "var(--amber)"} />
          <div
            style={{
              fontSize: 11.5,
              color: "var(--muted)",
              background: "var(--bg)",
              padding: "8px 10px",
              borderRadius: 8,
              marginTop: 8,
            }}
          >
            Tracking {spiPace} planned pace — SPI {view.spi}
            {view.cpi != null ? `, CPI ${view.cpi}` : ""}.
          </div>
        </>
      ) : (
        <div className="sub">No schedule performance data yet.</div>
      )}
    </Panel>
  );
}

function SprintProgress({ view }: { view: ProjectViewModel }) {
  const sprint = view.sprint;
  return (
    <Panel title={sprint ? `${sprint.cadenceName} progress` : "Sprint progress"} sub="methodology-native">
      {sprint ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
            <span>Burndown</span>
            <span className="mono">
              {Math.round(sprint.doneRatio * 100)}% done · {sprint.remaining} pt{sprint.remaining === 1 ? "" : "s"} open
            </span>
          </div>
          <Bars
            value={sprint.doneRatio * 100}
            max={100}
            color={sprint.doneRatio >= 0.75 ? "var(--win)" : sprint.doneRatio >= 0.5 ? "var(--amber)" : "var(--flag)"}
          />
          {sprint.doneRatio < 0.75 ? (
            <div
              style={{
                fontSize: 11.5,
                color: "var(--amber)",
                background: "var(--amber-bg)",
                padding: "8px 10px",
                borderRadius: 8,
                marginTop: 8,
              }}
            >
              Behind pace — {sprint.remaining} of {sprint.committed} committed points still open
            </div>
          ) : (
            <div
              style={{
                fontSize: 11.5,
                color: "var(--win)",
                background: "var(--win-bg)",
                padding: "8px 10px",
                borderRadius: 8,
                marginTop: 8,
              }}
            >
              On pace — {sprint.done} of {sprint.committed} committed points done
            </div>
          )}
        </>
      ) : (
        <div className="sub">No active cadence for this project.</div>
      )}
    </Panel>
  );
}

function HealthDrivers({ view }: { view: ProjectViewModel }) {
  const primary = view.drivers.find((d) => d.name === view.primaryDriver);
  return (
    <Panel title="Health drivers" sub="explainable · deterministic + narration">
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {view.drivers.map((d) => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 130, fontSize: 12.5 }}>{DRIVER_LABELS[d.name]}</div>
            <div style={{ flex: 1 }}>
              <Bars value={d.severity} max={100} color={TREND_COLOR[d.trend]} />
            </div>
            <span className="mono" style={{ fontSize: 10, color: TREND_COLOR[d.trend], width: 66, textAlign: "right" }}>
              {d.trend}
            </span>
          </div>
        ))}
      </div>
      {view.primaryDriver ? (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--muted)",
            background: "var(--bg)",
            padding: "9px 11px",
            borderRadius: 8,
            marginTop: 12,
          }}
        >
          <b>Why {view.health}:</b> {DRIVER_LABELS[view.primaryDriver].toLowerCase()} is the primary driver
          {primary ? ` (severity ${primary.severity})` : ""}.
        </div>
      ) : null}
    </Panel>
  );
}

function BaselineVariancePanel({ view }: { view: ProjectViewModel }) {
  return (
    <Panel title="Baseline variance" sub="current vs baseline">
      {view.baselines.length === 0 ? (
        <div className="sub">No baselines captured for this project yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {view.baselines.map((b) => {
            const variance = baselineVariance(b.type, b.snapshot);
            return (
              <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500, textTransform: "capitalize" }}>{b.type}</span>
                  <div className="mono" style={{ fontSize: 10, color: "var(--faint)" }}>
                    captured {formatDate(b.capturedOn)}
                  </div>
                </div>
                <span className="mono" style={{ fontWeight: 600, color: variance?.color ?? "var(--faint)" }}>
                  {variance?.text ?? "no comparison available"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export function ProjectDetail({ view }: { view: ProjectViewModel }) {
  return (
    <div className="view" style={{ maxWidth: 1000 }}>
      <Link href="/projects" style={{ textDecoration: "none" }}>
        <button className="ghost" style={{ marginBottom: 14 }}>
          ← Projects
        </button>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="h1">{view.name}</div>
            {view.program ? <Tag>{view.program}</Tag> : null}
          </div>
          <div className="sub">
            {view.methodology} · synced from {view.source || "—"} · Next: {view.next || "—"}
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <Eyebrow>Health</Eyebrow>
          <div className="kpi" style={{ color: healthColor(view.health) }}>
            {view.health}
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <DeliveryForecast view={view} />
        <SprintProgress view={view} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
        <HealthDrivers view={view} />
        <BaselineVariancePanel view={view} />
      </div>
    </div>
  );
}
