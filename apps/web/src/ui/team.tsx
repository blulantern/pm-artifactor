import Link from "next/link";
import { Avatar } from "./primitives.js";
import type { getTeamView } from "@/server/view-models";

type TeamViewModel = Awaited<ReturnType<typeof getTeamView>>;

function formatDate(d: Date | null): string {
  if (!d) return "no 1:1 logged";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function Team({ view }: { view: TeamViewModel }) {
  return (
    <div className="view">
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div className="h1">Team</div>
          <div className="sub" style={{ marginTop: 3 }}>
            Private notes + cross-tool analytics. Growth-framed, never a ranking.
          </div>
        </div>
        <Link href="/prioritize" style={{ textDecoration: "none" }}>
          <button className="ghost">⇄ Work matching</button>
        </Link>
      </div>

      {/* Members render in the order the server returns them (alphabetical) — never
          re-sorted by load or velocity, so this list can't read as a leaderboard. */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
        {view.map((t) => (
          <Link key={t.id} href={`/team/${t.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card row" style={{ padding: 16, cursor: "pointer" }}>
              <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
                <Avatar name={t.name} size={40} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                  <div className="sub" style={{ fontSize: 11.5 }}>
                    {t.role}
                  </div>
                </div>
              </div>
              <div style={{ margin: "12px 0 10px", fontSize: 11.5, color: "var(--muted)" }}>
                Flows on <b style={{ color: "var(--ink)" }}>{t.flowNote || "—"}</b>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderTop: "1px solid var(--line)",
                  paddingTop: 10,
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 11, color: t.totalPct > 100 ? "var(--flag)" : "var(--muted)" }}
                >
                  {t.totalPct}% load
                </span>
                <span className="mono" style={{ fontSize: 9.5, color: "var(--faint)" }}>
                  1:1 · {formatDate(t.lastOneOnOne)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
