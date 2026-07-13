"use client";

import { useState } from "react";
import type { SpineType } from "@pma/contracts";
import type { ManageOptions } from "@/server/ppm/manage-view.js";
import { EntityForm, type EntityFormInitial } from "./entity-form.js";

/**
 * Toggle-to-reveal wrapper around <EntityForm>. Renders a ghost button ("＋ New product",
 * "Edit", …) that discloses the create/edit form inline. Keeps the four dashboards visually
 * calm — the form only appears when the user asks for it — while reusing one form component.
 */
export function EntityFormDisclosure({
  type,
  initial,
  options,
  label,
  openLabel = "Close",
}: {
  type: SpineType;
  initial?: EntityFormInitial;
  options: ManageOptions;
  label: string;
  openLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="ghost" onClick={() => setOpen((o) => !o)}>
        {open ? openLabel : label}
      </button>
      {open ? (
        <div style={{ marginTop: 12 }}>
          <EntityForm type={type} initial={initial} options={options} />
        </div>
      ) : null}
    </>
  );
}
