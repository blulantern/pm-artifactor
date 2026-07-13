import { z } from "zod";

export const SPINE_TYPES = ["portfolio", "program", "product", "project"] as const;
export const SpineType = z.enum(SPINE_TYPES);
export type SpineType = z.infer<typeof SpineType>;

export const EntityRef = z.object({ type: SpineType, id: z.string().min(1) });
export type EntityRef = z.infer<typeof EntityRef>;

export const PROVENANCE_STATES = ["manual", "connected", "formerly_synced"] as const;
export const ProvenanceState = z.enum(PROVENANCE_STATES);
export type ProvenanceState = z.infer<typeof ProvenanceState>;

export const PPM_STATUS = ["planning", "on_track", "at_risk", "done"] as const;
export const PRODUCT_STATUS = ["discovery", "active", "maintenance", "sunset"] as const;
export const PORTFOLIO_STATUS = ["active", "on_hold", "done"] as const;

const nid = z.string().min(1);
const optRef = z.string().min(1).nullable().optional();

export const PortfolioInput = z.object({
  name: nid,
  organizationId: nid,
  vision: z.string().nullable().optional(),
  status: z.enum(PORTFOLIO_STATUS).optional(),
});
export const ProgramInput = z.object({
  name: nid,
  organizationId: nid,
  portfolioId: optRef,
  status: z.enum(PPM_STATUS).optional(),
  methodology: z.string().nullable().optional(),
});
export const ProductInput = z.object({
  name: nid,
  organizationId: nid,
  portfolioId: optRef,
  status: z.enum(PRODUCT_STATUS).optional(),
  vision: z.string().nullable().optional(),
});
export const ProjectInput = z.object({
  name: nid,
  organizationId: nid,
  methodologyId: nid,
  portfolioId: optRef,
  programId: optRef,
  productId: optRef,
  status: z.enum(PPM_STATUS).optional(),
});
export const ExternalLinkInput = z.object({
  ref: EntityRef,
  externalSystemId: nid,
  externalId: nid,
  externalUrl: z.string().url().nullable().optional(),
});

export type PortfolioInput = z.infer<typeof PortfolioInput>;
export type ProgramInput = z.infer<typeof ProgramInput>;
export type ProductInput = z.infer<typeof ProductInput>;
export type ProjectInput = z.infer<typeof ProjectInput>;
export type ExternalLinkInput = z.infer<typeof ExternalLinkInput>;
