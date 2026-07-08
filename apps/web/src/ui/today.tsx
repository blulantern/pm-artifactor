import Link from "next/link";
import { Panel, Chip } from "./primitives.js";
import { URGENCY_COLOR } from "./format.js";
import type { getTodayView } from "@/server/view-models";
import type { SuggestedAction } from "@pma/core";

type TodayViewModel = Awaited<ReturnType<typeof getTodayView>>;

/** Where a suggested action's `refType` naturally points in the workspace nav. */
const REF_HREF: Record<string, string> = {
  project: "/projects",
  release: "/releases",
  stakeholder: "/stakeholders",
  person: "/team",
};

const WALKTHROUGH_TILES: [string, string, string, string][] = [
  ["/portfolio", "◆", "Portfolio", "health, benefits, capacity"],
  ["/prioritize", "⇅", "Prioritize", "WSJF · RICE"],
  ["/projects", "▤", "A project", "sprint · forecast · health"],
  ["/stakeholders", "⌘", "Stakeholders", "power-interest grid"],
  ["/releases", "⛴", "Releases", "deploy + notes"],
  ["/team", "◇", "Team", "thrive analysis"],
  ["/inbox", "✉", "Inbox", "email digest"],
  ["/intelligence", "❖", "Intelligence", "the 3-layer engine"],
];

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function ActionRow({ action }: { action: SuggestedAction }) {
  const href = REF_HREF[action.refType];
  const content = (
    <div
      className="row"
      style={{
        display: "flex",
        gap: 12,
        alignItems: "start",
        padding: "12px 14px",
        borderBottom: "1px solid var(--line)",
        cursor: href ? "pointer" : "default",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: URGENCY_COLOR[action.urgency],
          flex: "none",
          marginTop: 5,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, lineHeight: 1.4 }}>{action.text}</div>
        <div className="mono" style={{ fontSize: 9.5, color: "var(--faint)", marginTop: 3 }}>
          {action.type.replaceAll("_", " ")} · {action.urgency} priority
        </div>
      </div>
      <span style={{ fontSize: 16, color: "var(--line2)" }}>›</span>
    </div>
  );
  return href ? (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      {content}
    </Link>
  ) : (
    content
  );
}

export function Today({ view }: { view: TodayViewModel }) {
  const now = new Date();
  const eyebrow = now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="view">
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", marginBottom: 6 }}>
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <div className="h1" style={{ marginTop: 3 }}>
            {greeting(now)}, {view.managerName}
          </div>
        </div>
        <Chip style={{ background: "var(--violet-bg)", color: "var(--violet)" }}>
          ❖ brief composed · deterministic + AI narration
        </Chip>
      </div>

      <div
        className="card"
        style={{ padding: "16px 18px", margin: "14px 0", background: "linear-gradient(120deg,#f0fdfa,#fff)" }}
      >
        <div style={{ fontSize: 14.5, lineHeight: 1.55, fontWeight: 500 }}>{view.brief.headline}</div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <div className="card" style={{ overflow: "hidden" }}>
          <div
            style={{
              padding: "13px 16px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div className="h2">Your shifting task list</div>
            <span className="mono" style={{ fontSize: 10, color: "var(--faint)" }}>
              re-ranks through the day
            </span>
          </div>
          {view.actions.map((action, i) => (
            <ActionRow key={`${action.type}-${action.refId}-${i}`} action={action} />
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel title="Today's calendar" sub="read-only">
            {view.meetings.map((m) => (
              <div
                key={m.id}
                style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)" }}
              >
                <span className="mono" style={{ fontSize: 11, color: "var(--teal)", width: 42 }}>
                  {m.start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </span>
                <span style={{ fontSize: 12.5 }}>{m.title}</span>
              </div>
            ))}
          </Panel>

          <Panel title="Suggested">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/stakeholders" style={{ textDecoration: "none" }}>
                <button className="ghost" style={{ textAlign: "left", width: "100%" }}>
                  ✎ Draft Priya&apos;s update
                </button>
              </Link>
              <Link href="/team" style={{ textDecoration: "none" }}>
                <button className="ghost" style={{ textAlign: "left", width: "100%" }}>
                  ◈ Schedule 1:1 with Lin (11:30 open)
                </button>
              </Link>
              <Link href="/team" style={{ textDecoration: "none" }}>
                <button className="ghost" style={{ textAlign: "left", width: "100%" }}>
                  ▦ Rebalance Sam&apos;s load
                </button>
              </Link>
            </div>
          </Panel>
        </div>
      </div>

      <div style={{ marginTop: 16 }} className="card">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }} className="h2">
          Walk through the workspace
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", padding: 14, gap: 12 }}>
          {WALKTHROUGH_TILES.map(([href, icon, label, sub]) => (
            <Link key={href} href={href} style={{ textDecoration: "none", color: "inherit" }}>
              <div
                className="row"
                style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, cursor: "pointer" }}
              >
                <div style={{ fontSize: 18, color: "var(--teal)" }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, marginTop: 6 }}>{label}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
