"use client";

import { useState } from "react";

/**
 * Presentational note-taking modal ported from the POC's `noteModal()`. Nothing here
 * persists — "Save note" just closes the dialog. Wiring this to a real mutation is a
 * later phase's job; this phase only needs the faithful UI + the "written to be seen"
 * framing (shareable vs. private-scratch, evidence links) that the PEOPLE RED LINES call for.
 */
export function AddNoteButton() {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"share" | "scratch">("share");

  function close() {
    setOpen(false);
    setScope("share");
  }

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        ＋ Add note
      </button>
      {open ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,23,.42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={close}
        >
          <div
            style={{
              width: 500,
              maxWidth: "94vw",
              background: "#fff",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 24px 70px rgba(0,0,0,.28)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
              <div className="h2">Add note</div>
              <div className="sub" style={{ fontSize: 11.5 }}>
                Written to be seen — describe what happened, not who they are
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  className="card"
                  onClick={() => setScope("share")}
                  style={{
                    padding: 11,
                    textAlign: "left",
                    cursor: "pointer",
                    borderColor: scope === "share" ? "var(--teal2)" : "var(--line)",
                    background: scope === "share" ? "var(--share-bg)" : "#fff",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--teal)" }}>◆ Shareable</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                    Evidence-linked. Safe in a 1:1.
                  </div>
                </button>
                <button
                  type="button"
                  className="card"
                  onClick={() => setScope("scratch")}
                  style={{
                    padding: 11,
                    textAlign: "left",
                    cursor: "pointer",
                    borderColor: scope === "scratch" ? "var(--scratch)" : "var(--line)",
                    background: scope === "scratch" ? "var(--scratch-bg)" : "#fff",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>✎ Private scratch</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                    Auto-deletes in 30 days.
                  </div>
                </button>
              </div>
              <div style={{ marginBottom: 11 }}>
                <label>What I observed</label>
                <textarea rows={2} placeholder="Describe the behavior or outcome, with evidence." />
              </div>
              <div style={{ marginBottom: 11 }}>
                <label>Why it matters / how I&rsquo;ll support</label>
                <input placeholder="How you'll follow up or support them." />
              </div>
              <label>Link evidence</label>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <span className="chip" style={{ background: "var(--bg)", color: "var(--muted)" }}>
                  ⛓ Link a PR, ticket, or doc…
                </span>
              </div>
            </div>
            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid var(--line)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button className="ghost" onClick={close}>
                Cancel
              </button>
              <button className="btn" onClick={close}>
                Save note
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
