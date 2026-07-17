"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setupVault } from "@/app/vault/actions";

const MIN_LEN = 8;

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 13,
  background: "#fff",
} as const;

export function VaultSetupForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const longEnough = passphrase.length >= MIN_LEN;
  const matches = passphrase.length > 0 && passphrase === confirm;
  const canSave = longEnough && matches && !pending;

  function onSubmit() {
    if (!canSave) return;
    setError(null);
    startTransition(async () => {
      const result = await setupVault(passphrase);
      if (result.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError(result.error ?? "Could not set up the vault.");
      }
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 22,
      }}
    >
      <div className="card" style={{ padding: 22, width: "100%", maxWidth: 420 }}>
        <div className="h2">Set a vault passphrase</div>
        <div className="sub" style={{ marginTop: 4, marginBottom: 16 }}>
          It encrypts your stored credentials and gates the app. There&rsquo;s no recovery if you lose it.
        </div>

        <label>Passphrase</label>
        <input
          type="password"
          autoComplete="new-password"
          autoFocus
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          style={inputStyle}
        />

        <div style={{ marginTop: 12 }}>
          <label>Confirm passphrase</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) onSubmit();
            }}
            style={inputStyle}
          />
        </div>

        {!longEnough && passphrase.length > 0 ? (
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>
            At least {MIN_LEN} characters.
          </div>
        ) : null}
        {longEnough && confirm.length > 0 && !matches ? (
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>Passphrases don&rsquo;t match.</div>
        ) : null}

        {error ? (
          <div style={{ color: "#c0392b", fontSize: 12.5, marginTop: 8 }}>{error}</div>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={onSubmit} disabled={!canSave} style={{ width: "100%" }}>
            {pending ? "Saving…" : "Set passphrase"}
          </button>
        </div>
      </div>
    </div>
  );
}
