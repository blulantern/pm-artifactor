"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AiSettingsView, AiKeyName } from "@/server/ai/ai-config-store";
import { saveAiSettings } from "@/app/settings/actions";

const KEY_LABEL: Record<AiKeyName, string> = {
  anthropic: "Anthropic API key",
  openai: "OpenAI API key",
  gemini: "Google Gemini API key",
};

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 13,
  background: "#fff",
} as const;

export function AiSettings({ view }: { view: AiSettingsView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [provider, setProvider] = useState(view.provider);
  const [model, setModel] = useState(view.model ?? "");
  const [keyInputs, setKeyInputs] = useState<Record<AiKeyName, string>>({ anthropic: "", openai: "", gemini: "" });
  const [clear, setClear] = useState<Record<AiKeyName, boolean>>({ anthropic: false, openai: false, gemini: false });

  const selected = view.providers.find((p) => p.id === provider);
  const modelPlaceholder = selected?.defaultModel ?? "provider default";
  const needsKey = selected?.keyName ?? null;
  const missingKey =
    needsKey != null && !keyInputs[needsKey] && !view.keys.find((k) => k.name === needsKey)?.present;

  function onSave() {
    setSaved(false);
    const keys: Partial<Record<AiKeyName, string>> = {};
    for (const name of ["anthropic", "openai", "gemini"] as AiKeyName[]) {
      if (keyInputs[name]) keys[name] = keyInputs[name];
      else if (clear[name]) keys[name] = "";
    }
    startTransition(async () => {
      await saveAiSettings({
        provider,
        model: model.trim() || null,
        keys: Object.keys(keys).length ? keys : undefined,
      });
      setKeyInputs({ anthropic: "", openai: "", gemini: "" });
      setClear({ anthropic: false, openai: false, gemini: false });
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div style={{ maxWidth: 620 }}>
      <div className="card" style={{ padding: 18 }}>
        <div className="h2">AI provider</div>
        <div className="sub" style={{ marginBottom: 14 }}>
          Choose which model powers the generative tail (daily brief, health explainers, stakeholder &amp; email drafts).
          Every provider falls back to the deterministic template if it fails or has no key.
        </div>

        <label>Provider</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as AiSettingsView["provider"])}
          style={inputStyle}
        >
          {view.providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {selected?.note ? (
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 5 }}>{selected.note}</div>
        ) : null}

        <div style={{ marginTop: 14 }}>
          <label>Model {needsKey == null ? <span style={{ color: "var(--muted)" }}>(n/a)</span> : null}</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={modelPlaceholder}
            disabled={needsKey == null}
            style={{ ...inputStyle, opacity: needsKey == null ? 0.55 : 1 }}
          />
        </div>

        {missingKey ? (
          <div
            className="chip"
            style={{ marginTop: 10, background: "var(--scratch-bg)", color: "var(--scratch)" }}
          >
            ⚠ No {needsKey} key yet — set one below or this provider will fall back to the template.
          </div>
        ) : null}
      </div>

      <div className="card" style={{ padding: 18, marginTop: 16 }}>
        <div className="h2">API keys</div>
        <div className="sub" style={{ marginBottom: 6 }}>
          Stored locally in a gitignored file (<span className="mono">.pma/ai-config.json</span>), never in the database
          and never sent back to this page. Plaintext on disk — fine for local dev, don&rsquo;t use for shipping.
        </div>
        {view.keys.map((k) => (
          <div key={k.name} style={{ marginTop: 12 }}>
            <label>
              {KEY_LABEL[k.name]}{" "}
              <span
                className="chip"
                style={{
                  marginLeft: 4,
                  background: k.present ? "var(--share-bg)" : "var(--bg)",
                  color: k.present ? "var(--teal)" : "var(--muted)",
                }}
              >
                {k.present ? `set · ${k.source}` : "not set"}
              </span>
            </label>
            <input
              type="password"
              autoComplete="off"
              value={keyInputs[k.name]}
              onChange={(e) => setKeyInputs((s) => ({ ...s, [k.name]: e.target.value }))}
              placeholder={k.present ? "Enter a new value to replace" : "Paste key to set"}
              style={inputStyle}
            />
            {k.present && k.source === "file" ? (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, marginTop: 5 }}>
                <input
                  type="checkbox"
                  checked={clear[k.name]}
                  onChange={(e) => setClear((s) => ({ ...s, [k.name]: e.target.checked }))}
                  style={{ width: "auto" }}
                />
                Clear the saved {k.name} key
              </label>
            ) : null}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button className="btn" onClick={onSave} disabled={pending}>
          {pending ? "Saving…" : "Save AI settings"}
        </button>
        {saved && !pending ? <span style={{ color: "var(--teal)", fontSize: 13, fontWeight: 600 }}>✓ Saved</span> : null}
      </div>
    </div>
  );
}
