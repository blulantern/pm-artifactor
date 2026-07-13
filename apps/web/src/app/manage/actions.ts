"use server";

import { revalidatePath } from "next/cache";
import type { EntityRef, SpineType } from "@pma/contracts";
import { ExternalLinkInput } from "@pma/contracts";
import { resolveDelete, type ChildChoice } from "@pma/core";
import { db } from "@/server/db";
import { createEntity, updateEntity, applyDeleteResolution, restore, hardDelete, childrenOf } from "@/server/ppm/ppm-store";
import { linkExternal, severLinks } from "@/server/ppm/entity-links";
import { INPUT_FOR } from "./inputs.js";

const PAGES = ["/portfolio", "/programs", "/projects", "/products"];
function revalidateAll() {
  for (const p of PAGES) revalidatePath(p);
}

export async function saveEntity(type: SpineType, id: string | null, raw: unknown) {
  const input = INPUT_FOR[type].parse(raw);
  const row = id ? await updateEntity(db(), type, id, input) : await createEntity(db(), type, input);
  revalidateAll();
  return { id: row.id };
}

export async function listChildren(parent: EntityRef) {
  return childrenOf(db(), parent);
}

export async function deleteEntity(parent: EntityRef, choices: ChildChoice[]) {
  await applyDeleteResolution(db(), resolveDelete(parent, choices));
  revalidateAll();
}

export async function restoreEntity(ref: EntityRef) {
  await restore(db(), ref);
  revalidateAll();
}

export async function hardDeleteEntity(ref: EntityRef) {
  await hardDelete(db(), ref);
  revalidateAll();
}

export async function linkEntity(raw: unknown) {
  await linkExternal(db(), ExternalLinkInput.parse(raw));
  revalidateAll();
}

export async function severEntity(ref: EntityRef) {
  await severLinks(db(), ref);
  revalidateAll();
}
