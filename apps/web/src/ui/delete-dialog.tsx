"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EntityRef } from "@pma/contracts";
import type { ChildChoice, Disposition } from "@pma/core";
import { listChildren, deleteEntity } from "@/app/manage/actions.js";

interface Child {
  ref: EntityRef;
  name: string;
}

/**
 * Confirmation dialog for archiving a Portfolio/Program/Product (soft-delete). Lists the
 * parent's children (from `listChildren`) and lets the user choose, per child, whether it
 * stays standalone (FK detached) or gets archived along with the parent. A childless parent
 * just gets a plain archive confirmation. Modal shell mirrors `note-modal.tsx`.
 */
export function DeleteButton({ parent, label }: { parent: EntityRef; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [children, setChildren] = useState<Child[] | null>(null);
  const [dispositions, setDispositions] = useState<Record<string, Disposition>>({});
  const [pending, startTransition] = useTransition();

  function openDialog() {
    setOpen(true);
    setLoading(true);
    setError(false);
    setChildren(null);
    setDispositions({});
    listChildren(parent)
      .then((kids) => {
        setChildren(kids);
        setDispositions(Object.fromEntries(kids.map((k) => [k.ref.id, "keep" as Disposition])));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  function close() {
    setOpen(false);
    setError(false);
    setChildren(null);
    setDispositions({});
  }

  function setDisposition(id: string, disposition: Disposition) {
    setDispositions((prev) => ({ ...prev, [id]: disposition }));
  }

  function onConfirm() {
    if (error || children === null) return;
    const choices: ChildChoice[] = children.map((child) => ({
      ref: child.ref,
      disposition: dispositions[child.ref.id] ?? "keep",
    }));
    startTransition(async () => {
      await deleteEntity(parent, choices);
      router.refresh();
      close();
    });
  }

  return (
    <>
      <button type="button" className="ghost" onClick={openDialog}>
        {label}
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
              <div className="h2">Archive this {parent.type}?</div>
              <div className="sub" style={{ fontSize: 11.5 }}>
                Archived items are hidden from default views and can be restored.
              </div>
            </div>

            <div style={{ padding: 20 }}>
              {loading ? (
                <div className="sub">Loading children…</div>
              ) : error ? (
                <div className="sub">Couldn't load children — try again.</div>
              ) : children && children.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="sub" style={{ fontSize: 12, marginBottom: 2 }}>
                    This {parent.type} has {children.length} child{children.length === 1 ? "" : "ren"}. Choose what
                    happens to each:
                  </div>
                  {children.map((child) => {
                    const disposition = dispositions[child.ref.id] ?? "keep";
                    return (
                      <div
                        key={child.ref.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "9px 11px",
                          border: "1px solid var(--line)",
                          borderRadius: 9,
                        }}
                      >
                        <div style={{ fontSize: 13 }}>
                          <span style={{ fontWeight: 700 }}>{child.name}</span>{" "}
                          <span className="sub" style={{ fontSize: 11 }}>({child.ref.type})</span>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="chip"
                            onClick={() => setDisposition(child.ref.id, "keep")}
                            style={{
                              cursor: "pointer",
                              border: "1px solid var(--line)",
                              background: disposition === "keep" ? "var(--share-bg)" : "#fff",
                              color: disposition === "keep" ? "var(--teal)" : "var(--muted)",
                            }}
                          >
                            Keep standalone
                          </button>
                          <button
                            type="button"
                            className="chip"
                            onClick={() => setDisposition(child.ref.id, "archive")}
                            style={{
                              cursor: "pointer",
                              border: "1px solid var(--line)",
                              background: disposition === "archive" ? "var(--scratch-bg)" : "#fff",
                              color: disposition === "archive" ? "var(--scratch)" : "var(--muted)",
                            }}
                          >
                            Archive
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : children !== null ? (
                <div className="sub">This {parent.type} has no children.</div>
              ) : null}
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
              <button className="ghost" onClick={close} disabled={pending}>
                Cancel
              </button>
              <button className="btn" onClick={onConfirm} disabled={loading || pending || error || children === null}>
                {pending ? "Archiving…" : "Archive"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
