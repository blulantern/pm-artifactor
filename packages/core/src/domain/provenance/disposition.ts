import type { EntityRef } from "@pma/contracts";

export type Disposition = "keep" | "archive";
export interface ChildChoice {
  ref: EntityRef;
  disposition: Disposition;
}
export interface DeleteResolution {
  archive: EntityRef[];
  detach: EntityRef[];
}

export function resolveDelete(parent: EntityRef, choices: ChildChoice[]): DeleteResolution {
  return {
    archive: [parent, ...choices.filter((c) => c.disposition === "archive").map((c) => c.ref)],
    detach: choices.filter((c) => c.disposition === "keep").map((c) => c.ref),
  };
}
