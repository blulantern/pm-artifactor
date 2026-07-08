import { Avatar, Panel } from "./primitives.js";
import type { getStakeholdersView } from "@/server/view-models";

type StakeholdersViewModel = Awaited<ReturnType<typeof getStakeholdersView>>;

function quadrant(influence: number, interest: number): string {
  if (influence >= 4 && interest >= 4) return "Manage closely";
  if (influence >= 4) return "Keep satisfied";
  if (interest >= 4) return "Keep informed";
  return "Monitor";
}

function stanceColor(stance: string): string {
  return stance === "supporter" ? "var(--win)" : stance === "skeptic" ? "var(--flag)" : "var(--faint)";
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function PowerInterestGrid({ view }: { view: StakeholdersViewModel }) {
  const QUADRANT_LABELS: { label: string; x: number; y: number }[] = [
    { label: "Keep satisfied", x: 52, y: 36 },
    { label: "Manage closely", x: 175, y: 36 },
    { label: "Monitor", x: 52, y: 145 },
    { label: "Keep informed", x: 175, y: 145 },
  ];
  return (
    <svg viewBox="0 0 300 260" style={{ width: "100%", height: 260 }}>
      <line x1={40} y1={20} x2={40} y2={230} stroke="var(--line2)" />
      <line x1={40} y1={230} x2={290} y2={230} stroke="var(--line2)" />
      <line x1={165} y1={20} x2={165} y2={230} stroke="var(--line)" strokeDasharray="3 3" />
      <line x1={40} y1={125} x2={290} y2={125} stroke="var(--line)" strokeDasharray="3 3" />
      <text x={8} y={130} fontSize={9} fill="#9aa1ab" transform="rotate(-90 12 125)">
        Influence →
      </text>
      <text x={150} y={248} fontSize={9} fill="#9aa1ab">
        Interest →
      </text>
      {QUADRANT_LABELS.map((q) => (
        <text key={q.label} x={q.x} y={q.y} fontSize={8} fill="#c3c9d0" fontWeight={600}>
          {q.label}
        </text>
      ))}
      {view.map((s) => {
        const cx = 40 + s.interest * 46;
        const cy = 230 - s.influence * 40;
        return (
          <g key={s.id}>
            <circle cx={cx} cy={cy} r={9} fill={stanceColor(s.stance)} opacity={0.85} />
            <text x={cx} y={cy - 13} fontSize={9} textAnchor="middle" fill="#1a1d23" fontWeight={600}>
              {s.name.split(" ")[0]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function StakeholderCard({ s }: { s: StakeholdersViewModel[number] }) {
  return (
    <div className="card row" style={{ padding: 14, cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <Avatar name={s.name} size={34} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{s.name}</div>
          <div className="sub" style={{ fontSize: 11 }}>
            {s.role}
          </div>
        </div>
        <span
          style={{ width: 8, height: 8, borderRadius: "50%", background: stanceColor(s.stance) }}
        />
      </div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>
        Invested in: <b style={{ color: "var(--ink)" }}>{s.caresAbout || "—"}</b>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid var(--line)",
          paddingTop: 9,
        }}
      >
        <span className="tag">{quadrant(s.influence, s.interest)}</span>
        <span className="mono" style={{ fontSize: 10, color: "var(--amber)" }}>
          {s.updateCadence || "—"}
        </span>
      </div>
    </div>
  );
}

/** The stakeholder with the soonest upcoming update — surfaced as an action, not a ranking. */
function DraftUpdateAffordance({ view }: { view: StakeholdersViewModel }) {
  const due = view
    .filter((s) => s.nextDue != null)
    .sort((a, b) => a.nextDue!.getTime() - b.nextDue!.getTime())[0];
  if (!due) return null;
  const cadenceLabel = (due.updateCadence?.split("·")[0]?.trim() || "next").toLowerCase();
  return (
    <div className="card" style={{ padding: 15, marginTop: 16, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ flex: 1 }}>
        <div className="h2">
          {due.name.split(" ")[0]}&rsquo;s {cadenceLabel} update is due {formatDate(due.nextDue)}
        </div>
        <div className="sub">
          Auto-assembled from what {due.name.split(" ")[0]} cares about
          {due.caresAbout ? ` (${due.caresAbout})` : ""} — AI drafts, you send.
        </div>
      </div>
      <button className="btn">✎ Draft update</button>
    </div>
  );
}

export function Stakeholders({ view }: { view: StakeholdersViewModel }) {
  return (
    <div className="view">
      <div className="h1">Stakeholders</div>
      <div className="sub" style={{ margin: "3px 0 16px" }}>
        The mirror of the team directory, pointed outward — profiles, cadence, and what each is invested in.
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
        <Panel title="Power–interest grid" sub="teal=supporter · red=skeptic">
          <PowerInterestGrid view={view} />
        </Panel>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignContent: "start" }}>
          {view.map((s) => (
            <StakeholderCard key={s.id} s={s} />
          ))}
        </div>
      </div>
      <DraftUpdateAffordance view={view} />
    </div>
  );
}
