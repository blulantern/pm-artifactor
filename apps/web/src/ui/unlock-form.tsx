"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unlockVault } from "@/app/vault/actions";

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 13,
  background: "#fff",
} as const;

export function UnlockForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await unlockVault(passphrase);
      if (result.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError(result.error ?? "Incorrect passphrase.");
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
      <div className="card" style={{ padding: 22, width: "100%", maxWidth: 380 }}>
        <div className="h2">🔒 Vault locked — enter your passphrase</div>
        <div className="sub" style={{ marginTop: 4, marginBottom: 16 }}>
          Your credentials stay encrypted on this machine until you unlock the vault.
        </div>

        <label>Passphrase</label>
        <input
          type="password"
          autoComplete="current-password"
          autoFocus
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && passphrase && !pending) onSubmit();
          }}
          style={inputStyle}
        />

        {error ? (
          <div style={{ color: "#c0392b", fontSize: 12.5, marginTop: 8 }}>{error}</div>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={onSubmit} disabled={pending || !passphrase} style={{ width: "100%" }}>
            {pending ? "Unlocking…" : "Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}
