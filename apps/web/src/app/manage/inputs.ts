import { PortfolioInput, ProgramInput, ProductInput, ProjectInput } from "@pma/contracts";

/**
 * Plain (non-"use server") module: maps each spine type to its Zod validator.
 * Kept separate from actions.ts because a "use server" module may export only
 * async functions — a non-async object export like this one is forbidden there.
 */
export const INPUT_FOR = {
  portfolio: PortfolioInput,
  program: ProgramInput,
  product: ProductInput,
  project: ProjectInput,
} as const;
