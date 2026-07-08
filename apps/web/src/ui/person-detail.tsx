import Link from "next/link";
import { Avatar, Bars, Chip, Panel } from "./primitives.js";
import { AddNoteButton } from "./note-modal.js";
import type { getPersonView } from "@/server/view-models";

type PersonViewModel = Awaited<ReturnType<typeof getPersonView>>;

// TeammateNote.category is a free-text field documented as one of:
// recognition | strength | growth | motivation | goal | general (see schema.prisma).
// The growth-framing red line requires "growth" notes to always render as support,
// never a verdict — so that bucket alone gets the "How I support" treatment.
const BAND_LABELS: Record<number, string> = { 0: "Low", 1: "Med", 2: "High" };
const VELOCITY_MAX = 1.3;

function Strengths({ view }: { view: PersonViewModel }) {
  const strengths = view.notes.filter((n) => n.category === "strength");
  return (
    <Panel title="Strengths">
      {strengths.length === 0 ? (
        <div className="sub">No strengths captured yet.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {strengths.map((s) => (
            <Chip key={s.id}>{s.content}</Chip>
          ))}
        </div>
      )}
    </Panel>
  );
}

function GrowthArea({ view }: { view: PersonViewModel }) {
  const growthNotes = view.notes.filter((n) => n.category === "growth");
  return (
    <Panel title="Growth area" sub="support, not a verdict">
      {growthNotes.length === 0 ? (
        <div className="sub">No growth area on record.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {growthNotes.map((growth) => (
            <div key={growth.id} style={{ background: "var(--bg)", borderRadius: 9, padding: 11 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{growth.content}</div>
              {growth.howToSupport ? (
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                  <b style={{ color: "var(--teal)" }}>How I support:</b> {growth.howToSupport}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Motivations({ view }: { view: PersonViewModel }) {
  const motivations = view.notes.filter((n) => n.category === "motivation");
  return (
    <Panel title="Motivations">
      {motivations.length === 0 ? (
        <div className="sub">No motivations captured yet.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {motivations.map((m) => (
            <Chip key={m.id} style={{ background: "#eef2f7", color: "#475569" }}>
              {m.content}
            </Chip>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Skills({ view }: { view: PersonViewModel }) {
  return (
    <Panel title="Skills — proficiency vs interest" sub="good at vs wants to do">
      {view.skills.length === 0 ? (
        <div className="sub">No skill observations yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {view.skills.map((s) => (
            <div key={s.skill}>
              <div style={{ fontSize: 12.5, marginBottom: 5, fontWeight: 500 }}>{s.skill}</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 3,
                }}
              >
                <span className="mono" style={{ fontSize: 9, color: "var(--faint)" }}>
                  SKILL
                </span>
                <Bars value={s.proficiency} max={5} color="var(--teal2)" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 8, alignItems: "center" }}>
                <span className="mono" style={{ fontSize: 9, color: "var(--faint)" }}>
                  INTEREST
                </span>
                <Bars value={s.interest} max={5} color="var(--teal3)" />
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: "var(--faint)" }}>big gap = stretch opportunity</div>
        </div>
      )}
    </Panel>
  );
}

/**
 * "Where they flow" — velocity by complexity band. This is a planning aid for matching
 * work to strengths, NEVER a ranking or performance score. The caveat is load-bearing:
 * it must render whenever the bands render (PEOPLE RED LINE).
 */
function WhereTheyFlow({ view }: { view: PersonViewModel }) {
  const insights = view.velocityInsights;
  const specificCaveats = insights.map((v) => v.caveat).filter((c): c is string => Boolean(c));

  return (
    <Panel title="Where they flow" sub="deterministic · statistical">
      {insights.length === 0 ? (
        <div className="sub">No velocity data yet.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            {insights.map((v, i) => {
              const pct = Math.min((v.throughput / VELOCITY_MAX) * 100, 100);
              return (
                <div key={`${v.dimension}-${i}`} style={{ flex: 1, textAlign: "center" }}>
                  <div
                    style={{
                      height: 50,
                      display: "flex",
                      alignItems: "end",
                      background: "var(--bg)",
                      borderRadius: 6,
                      padding: 3,
                    }}
                  >
                    <div
                      className="bar"
                      style={{
                        width: "100%",
                        height: `${pct}%`,
                        background: v.throughput >= 1 ? "var(--teal2)" : "var(--line2)",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                    {BAND_LABELS[v.band] ?? `Band ${v.band}`} {v.dimension}
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--muted)",
              background: "var(--bg)",
              padding: "9px 11px",
              borderRadius: 8,
              marginTop: 10,
            }}
          >
            {specificCaveats.length > 0 ? `${specificCaveats.join(" ")} ` : ""}
            A planning aid — never a performance score.
          </div>
        </>
      )}
    </Panel>
  );
}

function OtherNotes({ view }: { view: PersonViewModel }) {
  const other = view.notes.filter((n) => !["strength", "growth", "motivation"].includes(n.category));
  if (other.length === 0) return null;
  return (
    <Panel title="Other notes" sub="written to be seen">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {other.map((n) => (
          <div key={n.id} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span className="tag" style={{ textTransform: "capitalize" }}>
                {n.category}
              </span>
              {n.sensitive ? (
                <span className="tag" style={{ color: "var(--scratch)", borderColor: "var(--scratch)" }}>
                  private scratch
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 13 }}>{n.content}</div>
            {n.howToSupport ? (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                <b style={{ color: "var(--teal)" }}>How I support:</b> {n.howToSupport}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function PersonDetail({ view }: { view: PersonViewModel }) {
  return (
    <div className="view" style={{ maxWidth: 960 }}>
      <Link href="/team" style={{ textDecoration: "none" }}>
        <button className="ghost" style={{ marginBottom: 14 }}>
          ← Team
        </button>
      </Link>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}>
        <Avatar name={view.name} size={54} />
        <div style={{ flex: 1 }}>
          <div className="h1">{view.name}</div>
          <div className="sub">
            {view.role}
            {view.team ? ` · ${view.team}` : ""}
          </div>
        </div>
        <AddNoteButton />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.3fr" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Strengths view={view} />
          <GrowthArea view={view} />
          <Motivations view={view} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Skills view={view} />
          <WhereTheyFlow view={view} />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <OtherNotes view={view} />
      </div>
    </div>
  );
}
