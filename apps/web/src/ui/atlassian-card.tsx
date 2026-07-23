"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AtlassianView } from "@/server/view-models";
import { saveAtlassianClient, startAtlassianConnect, chooseAtlassianSite, disconnectAtlassian } from "@/app/connections/actions";

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 13,
  background: "#fff",
} as const;

const STATE_LABEL: Record<string, string> = {
  connected: "Connected",
  expired: "Refreshing on next use",
  needs_reconsent: "Reconnect required",
};

export function AtlassianCard({ view, notice }: { view: AtlassianView; notice?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await saveAtlassianClient({ clientId, clientSecret });
      if (r.ok) {
        setClientSecret("");
        router.refresh();
      } else setError(r.error ?? "Could not save.");
    });
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 16 }}>
      <div className="h2">Atlassian · Jira + Confluence</div>
      <div className="sub" style={{ marginTop: 4 }}>
        Read-only. One consent covers both products on a site.
      </div>

      {notice ? <div style={{ color: "#c0392b", fontSize: 12.5, marginTop: 8 }}>{notice}</div> : null}
      {error ? <div style={{ color: "#c0392b", fontSize: 12.5, marginTop: 8 }}>{error}</div> : null}

      {view.vaultStatus !== "unlocked" ? (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          {view.vaultStatus === "unconfigured" ? (
            <>Connecting stores tokens in the vault. <a href="/vault/setup">Secure this vault</a> to continue.</>
          ) : (
            <>The vault is locked. <a href="/unlock">Unlock it</a> to connect.</>
          )}
        </div>
      ) : (
        <>
          {view.connections.map((c) => (
            <div
              key={c.cloudId}
              style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{c.siteName}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{c.siteUrl}</div>
              </div>
              <span className="tag">{STATE_LABEL[c.state] ?? c.state}</span>
              <button
                className="ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await disconnectAtlassian(c.cloudId);
                    if (r.ok) router.refresh();
                    else setError(r.error ?? "Could not disconnect.");
                  })
                }
              >
                Disconnect
              </button>
            </div>
          ))}

          {view.pendingSites.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Pick a site to connect</div>
              {view.pendingSites.map((s) => (
                <button
                  key={s.cloudId}
                  className="btn"
                  disabled={pending}
                  style={{ marginRight: 8, marginBottom: 8 }}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await chooseAtlassianSite(s);
                      if (r.ok) router.refresh();
                      else setError(r.error ?? "Could not attach that site.");
                    })
                  }
                >
                  {s.siteName}
                </button>
              ))}
            </div>
          ) : null}

          {view.hasClient ? (
            <form action={startAtlassianConnect} style={{ marginTop: 14 }}>
              <button className="btn" type="submit" disabled={pending}>
                {view.connections.length ? "Connect another site" : "Connect Atlassian"}
              </button>
            </form>
          ) : (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>
                Register an OAuth 2.0 (3LO) app at developer.atlassian.com with callback{" "}
                <code>http://localhost:3000/api/atlassian/callback</code>, then paste its credentials here. They are
                stored encrypted in your vault and never shown again.
              </div>
              <label>Client ID</label>
              <input style={inputStyle} value={clientId} onChange={(e) => setClientId(e.target.value)} />
              <label style={{ marginTop: 8, display: "block" }}>Client secret</label>
              <input
                type="password"
                autoComplete="off"
                style={inputStyle}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
              <button
                className="btn"
                style={{ marginTop: 10 }}
                disabled={pending || !clientId || !clientSecret}
                onClick={save}
              >
                Save credentials
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
