import { Eyebrow } from "./primitives.js";
import { timeAgo } from "./format.js";
import type { getVaultView } from "@/server/view-models";

type VaultViewModel = Awaited<ReturnType<typeof getVaultView>>;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{value}</div>
    </div>
  );
}

export function Vault({ view }: { view: VaultViewModel }) {
  return (
    <div className="view" style={{ maxWidth: 720 }}>
      <div className="h1">Your Vault</div>
      <div className="sub" style={{ margin: "3px 0 16px" }}>
        One encrypted file on this machine. Export, move, or wipe any part of it anytime.
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
          <Stat label="Location" value={view.path} />
          <Stat label="Records" value={`${view.recordCount}`} />
          <Stat label="Encryption" value={view.encrypted ? "On · AES-256" : "Off"} />
          <Stat label="Last enriched" value={view.lastEnriched ? timeAgo(view.lastEnriched) : "Not yet"} />
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="h2" style={{ marginBottom: 4 }}>
            Back up / export
          </div>
          <div className="sub" style={{ marginBottom: 12 }}>
            A single portable file you control.
          </div>
          <button className="ghost">⭳ Export vault</button>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="h2" style={{ marginBottom: 4 }}>
            Per-teammate data
          </div>
          <div className="sub" style={{ marginBottom: 12 }}>
            Export or delete everything about one person.
          </div>
          <button className="ghost">Manage</button>
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 14, lineHeight: 1.5 }}>
        Notes about people carry data-protection weight even when private. Behavioral, evidence-linked notes +
        honored export/delete keep this fair and defensible.
      </div>
    </div>
  );
}
