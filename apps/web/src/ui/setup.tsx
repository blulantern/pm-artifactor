import Link from "next/link";

/**
 * First-run / Setup screen. Ports the POC `setup()` function: a full-bleed,
 * two-column screen (no Shell) — teal marketing panel on the left, a
 * presentational "Open your workspace" form on the right. No real vault
 * creation happens here; "Enter workspace" just navigates to `/`.
 */
export function Setup() {
  return (
    <div className="view" style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1.05fr 1fr" }}>
      <div
        style={{
          background: "linear-gradient(155deg,#0f766e,#0d9488 55%,#14b8a6)",
          color: "#fff",
          padding: "52px 56px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
            opacity: 0.5,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 11, position: "relative" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "rgba(255,255,255,.16)",
              border: "1px solid rgba(255,255,255,.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            A
          </div>
          <span style={{ fontWeight: 700, fontSize: 18 }}>PM Artifactor</span>
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: ".13em",
              color: "rgba(255,255,255,.7)",
              border: "1px solid rgba(255,255,255,.3)",
              padding: "2px 7px",
              borderRadius: 20,
            }}
          >
            FULL POC
          </span>
        </div>
        <div style={{ position: "relative", maxWidth: 460 }}>
          <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.13, letterSpacing: "-.02em", marginBottom: 16 }}>
            One canonical model over every tool — with a copilot that reads all of it.
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: "rgba(255,255,255,.85)" }}>
            Portfolio to program to project to work item to commit to deploy — federated read-only from Jira, Azure
            DevOps, GitHub and Monday, or authored standalone. Prioritization, stakeholders, sprint analytics, health
            checks, and a daily command center. Deterministic where it can be, AI only where it must, learning over
            time.
          </div>
        </div>
        <div
          className="mono"
          style={{
            position: "relative",
            fontSize: 11,
            color: "rgba(255,255,255,.65)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399" }} />
          LOCAL-FIRST · READ-ONLY INTEGRATIONS · ON THIS DEVICE
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            First run · no sign-in
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Open your workspace</div>
          <div className="sub" style={{ marginBottom: 20 }}>
            Everything is stored in one encrypted file on this machine. Explore the POC with sample data.
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Your name</label>
            <input defaultValue="Alex Morgan" />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label>Vault location</label>
            <input className="mono" style={{ fontSize: 12 }} defaultValue="~/PM-Vault/workspace.vault" />
          </div>
          <Link href="/" style={{ textDecoration: "none" }}>
            <button className="btn" style={{ width: "100%", padding: 11 }}>
              Enter workspace →
            </button>
          </Link>
          <div style={{ textAlign: "center", fontSize: 11, color: "var(--faint)", marginTop: 12 }}>
            Runs as a desktop app · macOS · Windows · Linux
          </div>
        </div>
      </div>
    </div>
  );
}
