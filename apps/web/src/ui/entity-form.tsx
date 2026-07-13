"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SpineType } from "@pma/contracts";
import type { ManageOptions } from "@/server/ppm/manage-view.js";
import { saveEntity, linkEntity, severEntity } from "@/app/manage/actions.js";

/**
 * Status option lists, defined locally (not imported from @pma/contracts) so this
 * client component never pulls zod into the browser bundle.
 */
const STATUS_OPTIONS: Record<SpineType, readonly string[]> = {
  portfolio: ["active", "on_hold", "done"],
  program: ["planning", "on_track", "at_risk", "done"],
  project: ["planning", "on_track", "at_risk", "done"],
  product: ["discovery", "active", "maintenance", "sunset"],
};

/** Per-type field config: which extra selects/inputs render beyond name + status. */
const FIELDS: Record<SpineType, { portfolioId?: boolean; programId?: boolean; productId?: boolean; methodologyId?: boolean; vision?: boolean }> = {
  portfolio: { vision: true },
  program: { portfolioId: true },
  product: { portfolioId: true, vision: true },
  project: { programId: true, productId: true, methodologyId: true },
};

export interface EntityFormInitial {
  id: string;
  name: string;
  status?: string;
  portfolioId?: string | null;
  programId?: string | null;
  productId?: string | null;
  methodologyId?: string;
  vision?: string | null;
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 13,
  background: "#fff",
} as const;

export function EntityForm({
  type,
  initial,
  options,
}: {
  type: SpineType;
  initial?: EntityFormInitial;
  options: ManageOptions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const fields = FIELDS[type];
  const statuses = STATUS_OPTIONS[type];

  const [name, setName] = useState(initial?.name ?? "");
  const [status, setStatus] = useState(initial?.status ?? statuses[0] ?? "");
  const [portfolioId, setPortfolioId] = useState(initial?.portfolioId ?? "");
  const [programId, setProgramId] = useState(initial?.programId ?? "");
  const [productId, setProductId] = useState(initial?.productId ?? "");
  const [methodologyId, setMethodologyId] = useState(initial?.methodologyId ?? "");
  const [vision, setVision] = useState(initial?.vision ?? "");

  const [linkOpen, setLinkOpen] = useState(false);
  const [externalSystemId, setExternalSystemId] = useState(options.externalSystems[0]?.id ?? "");
  const [externalId, setExternalId] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [linkPending, startLinkTransition] = useTransition();
  const [severPending, startSeverTransition] = useTransition();

  function onSave() {
    setSaved(false);
    const values: Record<string, unknown> = {
      organizationId: options.organizationId,
      name,
      status,
    };
    if (fields.portfolioId) values.portfolioId = portfolioId || null;
    if (fields.programId) values.programId = programId || null;
    if (fields.productId) values.productId = productId || null;
    if (fields.methodologyId) values.methodologyId = methodologyId;
    if (fields.vision) values.vision = vision || null;

    startTransition(async () => {
      await saveEntity(type, initial?.id ?? null, values);
      setSaved(true);
      router.refresh();
    });
  }

  function onLink() {
    if (!initial?.id) return;
    startLinkTransition(async () => {
      await linkEntity({
        ref: { type, id: initial.id },
        externalSystemId,
        externalId,
        externalUrl: externalUrl || null,
      });
      setExternalId("");
      setExternalUrl("");
      router.refresh();
    });
  }

  function onSever() {
    if (!initial?.id) return;
    startSeverTransition(async () => {
      await severEntity({ type, id: initial.id });
      router.refresh();
    });
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ marginBottom: 11 }}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} required />
        </div>

        <div style={{ marginBottom: 11 }}>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {fields.portfolioId ? (
          <div style={{ marginBottom: 11 }}>
            <label>Portfolio</label>
            <select value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)} style={inputStyle}>
              <option value="">— none (standalone) —</option>
              {options.portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {fields.programId ? (
          <div style={{ marginBottom: 11 }}>
            <label>Program</label>
            <select value={programId} onChange={(e) => setProgramId(e.target.value)} style={inputStyle}>
              <option value="">— none —</option>
              {options.programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {fields.productId ? (
          <div style={{ marginBottom: 11 }}>
            <label>Product</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} style={inputStyle}>
              <option value="">— none —</option>
              {options.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {fields.methodologyId ? (
          <div style={{ marginBottom: 11 }}>
            <label>Methodology</label>
            <select
              value={methodologyId}
              onChange={(e) => setMethodologyId(e.target.value)}
              style={inputStyle}
              required
            >
              <option value="" disabled>
                Choose a methodology…
              </option>
              {options.methodologies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {fields.vision ? (
          <div style={{ marginBottom: 11 }}>
            <label>Vision</label>
            <textarea
              rows={3}
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button className="btn" onClick={onSave} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && !pending ? <span style={{ color: "var(--teal)", fontSize: 13, fontWeight: 600 }}>✓ Saved</span> : null}
      </div>

      {initial?.id ? (
        <div className="card" style={{ padding: 18, marginTop: 16 }}>
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
            onClick={() => setLinkOpen((o) => !o)}
          >
            <div className="h2">External link</div>
            <span className="ghost" style={{ fontSize: 11.5 }}>
              {linkOpen ? "Hide ▲" : "Show ▼"}
            </span>
          </div>
          {linkOpen ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 11 }}>
                <label>System</label>
                <select
                  value={externalSystemId}
                  onChange={(e) => setExternalSystemId(e.target.value)}
                  style={inputStyle}
                >
                  {options.externalSystems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.vendor}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 11 }}>
                <label>External ID</label>
                <input value={externalId} onChange={(e) => setExternalId(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ marginBottom: 11 }}>
                <label>External URL (optional)</label>
                <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn"
                  onClick={onLink}
                  disabled={linkPending || !externalSystemId || !externalId}
                >
                  {linkPending ? "Linking…" : "Link"}
                </button>
                <button className="ghost" onClick={onSever} disabled={severPending}>
                  {severPending ? "Severing…" : "Sever connection"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
