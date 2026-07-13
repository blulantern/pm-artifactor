# PPM Manual Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standalone, manual CRUD for Portfolios, Programs, Products, and Projects — a nullable hierarchy with a provenance/local-override layer and provenance-segmented, navigable dashboards.

**Architecture:** Pure hierarchy/override/disposition logic in `@pma/core`; Zod contracts in `@pma/contracts`; Prisma schema + write store + server actions under `apps/web/src/server`; a single DRY `EntityForm` + a delete-disposition dialog + Products pages + shared filter/sort/nav controls in `apps/web/src/app` / `apps/web/src/ui`. Provenance is modeled entirely through the existing polymorphic `ExternalLink`.

**Tech Stack:** TypeScript ESM, Prisma/SQLite (`@pma/db`), Zod, Next.js App Router (server components + server actions), Vitest, dependency-cruiser.

## Global Constraints

- **Core purity:** `packages/core` imports zero infra (no `@prisma`, `next`, vendor SDKs, `node:*`); enforced by `.dependency-cruiser.cjs`. Prisma/`node:*` only under `apps/web/src/server` and `db/`.
- **Gate:** `pnpm -w run test:all` (dependency-cruiser + `vitest run` + typecheck of all 4 packages) must pass before every commit.
- **ESM imports:** relative imports carry a `.js` suffix (e.g. `./override.js`); `@/*` → `apps/web/src/*`.
- **No `Co-Authored-By` trailer** on commits. Author remains `blulantern <jfox@blulantern.com>`.
- **Commit style:** conventional commits (`feat(core):`, `feat(db):`, `feat(web):`, `test:`…).
- **Read-only to vendors:** the override layer is local-only; nothing writes back to an external system.
- **Test DB:** `import { makeTestDb } from "../testing/test-db.js"` (from within `db/`) returns `{ prisma, url, cleanup }`; wrap each test body in `try { … } finally { await cleanup(); }` and pass `30000` as the vitest timeout.

---

### Task 1: Schema — nullable hierarchy, Product, provenance/override/archive fields

**Files:**
- Modify: `db/prisma/schema.prisma` (Program 45-56, Project 70-95, ExternalLink 534-…, Portfolio 21-…)
- Modify: `db/prisma/seed.ts` (add one standalone program, one standalone project, one product with a delivering project)
- Test: `db/src/persistence/spine-hierarchy.test.ts`

**Interfaces:**
- Produces (Prisma models, consumed by all later tasks): `Product { id, organizationId, portfolioId?, name, status, vision?, overriddenFields?, archivedAt?, updatedAt, projects }`; `Program`/`Project` gain `organizationId` (required), nullable parent FKs, `overriddenFields String?`, `archivedAt DateTime?`, `updatedAt DateTime @updatedAt`; `Project.productId String?`; `ExternalLink.severedAt DateTime?`; `Portfolio` + `Organization` gain the same override/archive fields and `products`/`Product[]` back-relations.

- [ ] **Step 1: Write the failing test**

Create `db/src/persistence/spine-hierarchy.test.ts`:

```ts
import { expect, test } from "vitest";
import { makeTestDb } from "../testing/test-db.js";

test("programs, products, and projects can be standalone and cross-linked", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const org = await prisma.organization.create({ data: { name: "WS" } });
    const method = await prisma.methodology.create({ data: { name: "Scrum", kind: "scrum" } });

    // standalone program (no portfolio) + standalone product
    const program = await prisma.program.create({ data: { organizationId: org.id, name: "P1" } });
    const product = await prisma.product.create({ data: { organizationId: org.id, name: "Prod1" } });

    // standalone project delivering the product, no portfolio/program
    const project = await prisma.project.create({
      data: { organizationId: org.id, name: "Proj1", methodologyId: method.id, productId: product.id },
    });

    expect(program.portfolioId).toBeNull();
    expect(product.portfolioId).toBeNull();
    expect(project.portfolioId).toBeNull();
    expect(project.programId).toBeNull();
    expect(project.productId).toBe(product.id);
    expect(project.overriddenFields).toBeNull();
    expect(project.archivedAt).toBeNull();
  } finally {
    await cleanup();
  }
}, 30000);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pma/db exec vitest run src/persistence/spine-hierarchy.test.ts`
Expected: FAIL — `product` is not a Prisma model / `organizationId` unknown on program.

- [ ] **Step 3: Edit `db/prisma/schema.prisma`**

Replace the `Program` block (lines 45-56) with:

```prisma
model Program {
  id              String       @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  portfolioId     String?
  portfolio       Portfolio?   @relation(fields: [portfolioId], references: [id])
  name            String
  status          String       @default("planning") // planning | on_track | at_risk | done
  methodology     String?
  benefitPct      Float?
  targetEnd       DateTime?
  overriddenFields String?     // JSON array of locally-edited fields; null = manual
  archivedAt      DateTime?
  updatedAt       DateTime     @updatedAt
  benefits        Benefit[]
  projects        Project[]
}
```

Replace the `Project` block (lines 70-95) header fields with (keep the existing child relations `phases … baselines`):

```prisma
model Project {
  id              String       @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  portfolioId     String?
  portfolio       Portfolio?   @relation(fields: [portfolioId], references: [id])
  programId       String?
  program         Program?     @relation(fields: [programId], references: [id])
  productId       String?
  product         Product?     @relation(fields: [productId], references: [id])
  methodologyId   String
  methodology     Methodology  @relation(fields: [methodologyId], references: [id])
  name            String
  status          String       @default("planning")
  health          Int          @default(0)
  nextMilestone   String?
  sourceLabel     String?
  spi             Float?
  cpi             Float?
  startDate       DateTime?
  targetEndDate   DateTime?
  overriddenFields String?
  archivedAt      DateTime?
  updatedAt       DateTime     @updatedAt
  phases          Phase[]
  workItems       WorkItem[]
  cadences        Cadence[]
  backlogs        Backlog[]
  releases        Release[]
  raidItems       RaidItem[]
  baselines       Baseline[]
}
```

Add a new `Product` model (place after `Project`):

```prisma
model Product {
  id              String       @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  portfolioId     String?
  portfolio       Portfolio?   @relation(fields: [portfolioId], references: [id])
  name            String
  status          String       @default("active") // discovery | active | maintenance | sunset
  vision          String?
  overriddenFields String?
  archivedAt      DateTime?
  updatedAt       DateTime     @updatedAt
  projects        Project[]
}
```

In `Portfolio` add `overriddenFields String?`, `archivedAt DateTime?`, `updatedAt DateTime @updatedAt`, and the back-relations `programs Program[]` (already present), `products Product[]`, `projects Project[]` (present). In `Organization` add back-relations `programs Program[]`, `products Product[]`, `projects Project[]`. In `ExternalLink` (line 534) add `severedAt DateTime?`.

- [ ] **Step 4: Add seed rows**

In `db/prisma/seed.ts`, after the existing portfolio/program/project seed, add (use the already-seeded org + a methodology id in scope):

```ts
// Standalone-capability demo data (manual foundation)
const standaloneProduct = await prisma.product.create({
  data: { organizationId: org.id, name: "Ledger Platform", status: "active", vision: "One source of truth for spend." },
});
await prisma.program.create({ data: { organizationId: org.id, name: "Ops Excellence (standalone)", status: "on_track" } });
await prisma.project.create({
  data: { organizationId: org.id, name: "Ledger API (standalone, delivers product)", methodologyId: scrum.id, productId: standaloneProduct.id, status: "on_track" },
});
```

(Backfill: `organizationId` is set on every existing seeded program/project — set `organizationId: org.id` on each existing `prisma.program.create` / `prisma.project.create` call in the seed. The local vault is regenerated on reseed, so there is no production migration.)

- [ ] **Step 5: Push schema + run test**

Run: `pnpm --filter @pma/db exec vitest run src/persistence/spine-hierarchy.test.ts`
Expected: PASS (the vitest test-db helper runs `prisma db push` on a fresh file, so it picks up the new schema).

- [ ] **Step 6: Regenerate client + full gate**

Run: `pnpm --filter @pma/db run prisma:generate && pnpm -w run test:all`
Expected: PASS. (Regenerating the client makes the new `prisma.product` type available to `apps/web` typecheck.)

- [ ] **Step 7: Commit**

```bash
git add db/prisma/schema.prisma db/prisma/seed.ts db/src/persistence/spine-hierarchy.test.ts
git commit -m "feat(db): nullable PPM hierarchy + Product model + provenance/override/archive fields"
```

---

### Task 2: Contracts — spine types, entity refs, provenance, CRUD validators

**Files:**
- Create: `packages/contracts/src/spine.ts`
- Modify: `packages/contracts/src/index.ts` (add `export * from "./spine.js";`)
- Test: `packages/contracts/src/spine.test.ts`

**Interfaces:**
- Produces: `SPINE_TYPES`, `SpineType`, `EntityRef` (`{type, id}`), `PROVENANCE_STATES`, `ProvenanceState` (`"manual"|"connected"|"formerly_synced"`), `PPM_STATUS` (`["planning","on_track","at_risk","done"]`), `PRODUCT_STATUS` (`["discovery","active","maintenance","sunset"]`), and `PortfolioInput`, `ProgramInput`, `ProductInput`, `ProjectInput`, `ExternalLinkInput` Zod objects. Consumed by core (types), server actions (parse), and forms.

- [ ] **Step 1: Write the failing test**

Create `packages/contracts/src/spine.test.ts`:

```ts
import { expect, test } from "vitest";
import { EntityRef, ProjectInput, SpineType } from "./spine.js";

test("SpineType accepts the four spine kinds and rejects others", () => {
  expect(SpineType.safeParse("product").success).toBe(true);
  expect(SpineType.safeParse("workitem").success).toBe(false);
});

test("EntityRef requires a non-empty id", () => {
  expect(EntityRef.safeParse({ type: "project", id: "p1" }).success).toBe(true);
  expect(EntityRef.safeParse({ type: "project", id: "" }).success).toBe(false);
});

test("ProjectInput requires name + org + methodology, allows null parents", () => {
  const ok = ProjectInput.safeParse({ name: "P", organizationId: "o1", methodologyId: "m1", portfolioId: null, programId: null, productId: null });
  expect(ok.success).toBe(true);
  expect(ProjectInput.safeParse({ name: "P", organizationId: "o1" }).success).toBe(false); // no methodology
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pma/contracts exec vitest run src/spine.test.ts`
Expected: FAIL — `./spine.js` not found.

- [ ] **Step 3: Create `packages/contracts/src/spine.ts`**

```ts
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
```

- [ ] **Step 4: Export from index + run test**

Add to `packages/contracts/src/index.ts`: `export * from "./spine.js";`
Run: `pnpm --filter @pma/contracts exec vitest run src/spine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/spine.ts packages/contracts/src/spine.test.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): spine types, entity refs, and PPM CRUD validators"
```

---

### Task 3: Core — local-override + sync-merge + sever (pure)

**Files:**
- Create: `packages/core/src/domain/provenance/override.ts`
- Test: `packages/core/src/domain/provenance/override.test.ts`

**Interfaces:**
- Produces: `applyEdit(current, patch, { connected, overriddenFields })` → `{ values, overriddenFields }`; `mergePull(current, pulled, overriddenFields)` → merged values; `sever(overriddenFields)` → `{ overriddenFields: [] }`. Consumed by the write store (Task 6).

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { applyEdit, mergePull, sever } from "./override.js";

test("manual edit does not track override fields", () => {
  const r = applyEdit({ name: "A", status: "planning" }, { name: "B" }, { connected: false, overriddenFields: [] });
  expect(r.values).toEqual({ name: "B", status: "planning" });
  expect(r.overriddenFields).toEqual([]);
});

test("connected edit records changed fields as overrides (deduped)", () => {
  const r1 = applyEdit({ name: "A", status: "planning" }, { name: "B" }, { connected: true, overriddenFields: [] });
  expect(r1.overriddenFields).toEqual(["name"]);
  const r2 = applyEdit({ name: "B", status: "planning" }, { name: "C" }, { connected: true, overriddenFields: ["name"] });
  expect(r2.overriddenFields).toEqual(["name"]);
});

test("mergePull keeps overridden fields and takes pulled values elsewhere", () => {
  const merged = mergePull({ name: "local", status: "done" }, { name: "remote", status: "planning" }, ["name"]);
  expect(merged).toEqual({ name: "local", status: "planning" });
});

test("sever clears the override set", () => {
  expect(sever(["name", "status"])).toEqual({ overriddenFields: [] });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pma/core exec vitest run src/domain/provenance/override.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/provenance/override.ts`**

```ts
export interface EditOpts {
  connected: boolean;
  overriddenFields: string[];
}

export function applyEdit<T extends Record<string, unknown>>(
  current: T,
  patch: Partial<T>,
  opts: EditOpts,
): { values: T; overriddenFields: string[] } {
  const values = { ...current, ...patch };
  if (!opts.connected) return { values, overriddenFields: opts.overriddenFields };
  const changed = Object.keys(patch).filter((k) => !Object.is(current[k], (patch as Record<string, unknown>)[k]));
  return { values, overriddenFields: [...new Set([...opts.overriddenFields, ...changed])] };
}

export function mergePull<T extends Record<string, unknown>>(
  current: T,
  pulled: Partial<T>,
  overriddenFields: string[],
): T {
  const overridden = new Set(overriddenFields);
  const out: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(pulled)) {
    if (!overridden.has(k)) out[k] = v;
  }
  return out as T;
}

export function sever(_overriddenFields: string[]): { overriddenFields: string[] } {
  return { overriddenFields: [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pma/core exec vitest run src/domain/provenance/override.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/domain/provenance/override.ts packages/core/src/domain/provenance/override.test.ts
git commit -m "feat(core): local-override / sync-merge / sever pure functions"
```

---

### Task 4: Core — delete-disposition resolver (pure)

**Files:**
- Create: `packages/core/src/domain/provenance/disposition.ts`
- Test: `packages/core/src/domain/provenance/disposition.test.ts`

**Interfaces:**
- Consumes: `EntityRef` from `@pma/contracts`.
- Produces: `resolveDelete(parent, choices)` → `{ archive: EntityRef[]; detach: EntityRef[] }`, where `choices: { ref: EntityRef; disposition: "keep" | "archive" }[]`. Consumed by the write store (Task 6).

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { resolveDelete } from "./disposition.js";

const parent = { type: "portfolio" as const, id: "port1" };
const a = { type: "program" as const, id: "prog1" };
const b = { type: "project" as const, id: "proj1" };

test("parent is always archived; kept children detach, archived children archive", () => {
  const r = resolveDelete(parent, [
    { ref: a, disposition: "keep" },
    { ref: b, disposition: "archive" },
  ]);
  expect(r.archive).toEqual([parent, b]);
  expect(r.detach).toEqual([a]);
});

test("no children → only the parent is archived", () => {
  expect(resolveDelete(parent, [])).toEqual({ archive: [parent], detach: [] });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pma/core exec vitest run src/domain/provenance/disposition.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/provenance/disposition.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes + gate**

Run: `pnpm --filter @pma/core exec vitest run src/domain/provenance/disposition.test.ts && pnpm -w run test:all`
Expected: PASS (gate green; dependency-cruiser confirms core stays pure — `@pma/contracts` is allowed).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/domain/provenance/disposition.ts packages/core/src/domain/provenance/disposition.test.ts
git commit -m "feat(core): delete-disposition resolver (keep-standalone vs archive)"
```

---

### Task 5: Server — polymorphic entity-link layer

**Files:**
- Create: `apps/web/src/server/ppm/entity-links.ts`
- Test: `apps/web/src/server/ppm/entity-links.test.ts`

**Interfaces:**
- Consumes: `PrismaClient`, `EntityRef`, `ExternalLinkInput` (`@pma/contracts`).
- Produces (all take `prisma` first): `linkExternal(prisma, input: ExternalLinkInput)` → the created `ExternalLink`; `severLinks(prisma, ref: EntityRef)` → count severed; `linksFor(prisma, ref)` → active `ExternalLink[]`; `provenanceOf(prisma, ref)` → `{ state: ProvenanceState; system: string | null }`. Consumed by the write store + actions.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { makeTestDb } from "@pma/db/src/testing/test-db.js";
import { linkExternal, severLinks, provenanceOf } from "./entity-links.js";

test("link → connected, sever → formerly_synced, unlinked → manual", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const org = await prisma.organization.create({ data: { name: "WS" } });
    const sys = await prisma.externalSystem.create({ data: { vendor: "jira" } });
    const conn = await prisma.syncConnection.create({ data: { externalSystemId: sys.id, authRef: "kc:1" } });
    const prog = await prisma.program.create({ data: { organizationId: org.id, name: "P" } });
    const ref = { type: "program" as const, id: prog.id };

    expect((await provenanceOf(prisma, ref)).state).toBe("manual");
    await linkExternal(prisma, { ref, externalSystemId: sys.id, externalId: "JIRA-1", externalUrl: null });
    // entity-links uses a connection when present; create one link via connection:
    await prisma.externalLink.updateMany({ where: { internalId: prog.id }, data: { syncConnectionId: conn.id } });
    expect((await provenanceOf(prisma, ref)).state).toBe("connected");
    await severLinks(prisma, ref);
    expect((await provenanceOf(prisma, ref)).state).toBe("formerly_synced");
  } finally {
    await cleanup();
  }
}, 30000);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pma/web exec vitest run src/server/ppm/entity-links.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/web/src/server/ppm/entity-links.ts`**

```ts
import type { PrismaClient } from "@prisma/client";
import type { EntityRef, ExternalLinkInput, ProvenanceState } from "@pma/contracts";

/** Creates an ExternalLink for a manual or synced connection to an external item. */
export async function linkExternal(prisma: PrismaClient, input: ExternalLinkInput) {
  // A manual link has no live SyncConnection; find-or-create a link-only connection for the system.
  const conn = await prisma.syncConnection.findFirst({ where: { externalSystemId: input.externalSystemId } })
    ?? (await prisma.syncConnection.create({ data: { externalSystemId: input.externalSystemId, authRef: "manual" } }));
  return prisma.externalLink.create({
    data: {
      syncConnectionId: conn.id,
      internalType: input.ref.type,
      internalId: input.ref.id,
      externalId: input.externalId,
      externalUrl: input.externalUrl ?? null,
    },
  });
}

export async function linksFor(prisma: PrismaClient, ref: EntityRef) {
  return prisma.externalLink.findMany({
    where: { internalType: ref.type, internalId: ref.id, severedAt: null },
  });
}

export async function severLinks(prisma: PrismaClient, ref: EntityRef): Promise<number> {
  const res = await prisma.externalLink.updateMany({
    where: { internalType: ref.type, internalId: ref.id, severedAt: null },
    data: { severedAt: new Date() },
  });
  return res.count;
}

export async function provenanceOf(
  prisma: PrismaClient,
  ref: EntityRef,
): Promise<{ state: ProvenanceState; system: string | null }> {
  const all = await prisma.externalLink.findMany({
    where: { internalType: ref.type, internalId: ref.id },
    include: { syncConnection: { include: { externalSystem: true } } },
  });
  if (all.length === 0) return { state: "manual", system: null };
  const active = all.find((l) => l.severedAt === null);
  const link = active ?? all[0];
  const system = link.syncConnection.externalSystem.vendor;
  return { state: active ? "connected" : "formerly_synced", system };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pma/web exec vitest run src/server/ppm/entity-links.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/ppm/entity-links.ts apps/web/src/server/ppm/entity-links.test.ts
git commit -m "feat(web): polymorphic entity↔external link layer (link/sever/provenance)"
```

---

### Task 6: Server — PPM write store (CRUD, archive/restore, transactional delete)

**Files:**
- Create: `apps/web/src/server/ppm/ppm-store.ts`
- Test: `apps/web/src/server/ppm/ppm-store.test.ts`

**Interfaces:**
- Consumes: `PrismaClient`; `applyEdit`, `resolveDelete` (`@pma/core`); `provenanceOf` (Task 5); the `*Input` validators (`@pma/contracts`).
- Produces (all take `prisma` first): `createEntity(prisma, type, input)` → created row; `updateEntity(prisma, type, id, patch)` → updated row (override-aware); `childrenOf(prisma, ref)` → `{ ref: EntityRef; name: string }[]`; `applyDeleteResolution(prisma, resolution)` → void (transactional: archive sets `archivedAt=now`, detach nulls the parent FK); `restore(prisma, ref)`; `hardDelete(prisma, ref)`. `type` is `SpineType`. Consumed by server actions (Task 7).

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { makeTestDb } from "@pma/db/src/testing/test-db.js";
import { createEntity, updateEntity, childrenOf, applyDeleteResolution } from "./ppm-store.js";
import { resolveDelete } from "@pma/core";

test("create standalone, update tracks manual edit, delete detaches kept child", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const org = await prisma.organization.create({ data: { name: "WS" } });
    const method = await prisma.methodology.create({ data: { name: "Scrum", kind: "scrum" } });
    const portfolio = await createEntity(prisma, "portfolio", { name: "Port", organizationId: org.id });
    const program = await createEntity(prisma, "program", { name: "Prog", organizationId: org.id, portfolioId: portfolio.id });

    const updated = await updateEntity(prisma, "program", program.id, { name: "Prog2" });
    expect(updated.name).toBe("Prog2");
    expect(updated.overriddenFields).toBeNull(); // manual entity: no override tracking

    const kids = await childrenOf(prisma, { type: "portfolio", id: portfolio.id });
    expect(kids.map((k) => k.ref.id)).toContain(program.id);

    await applyDeleteResolution(
      prisma,
      resolveDelete({ type: "portfolio", id: portfolio.id }, [{ ref: { type: "program", id: program.id }, disposition: "keep" }]),
    );
    const port = await prisma.portfolio.findUnique({ where: { id: portfolio.id } });
    const prog = await prisma.program.findUnique({ where: { id: program.id } });
    expect(port?.archivedAt).not.toBeNull();       // parent archived
    expect(prog?.archivedAt).toBeNull();            // kept child stays active…
    expect(prog?.portfolioId).toBeNull();           // …detached to standalone
  } finally {
    await cleanup();
  }
}, 30000);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pma/web exec vitest run src/server/ppm/ppm-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/web/src/server/ppm/ppm-store.ts`**

```ts
import type { PrismaClient } from "@prisma/client";
import type { EntityRef, SpineType } from "@pma/contracts";
import { applyEdit, type DeleteResolution } from "@pma/core";
import { provenanceOf } from "./entity-links.js";

type Delegate = {
  create(a: { data: Record<string, unknown> }): Promise<any>;
  findUnique(a: { where: { id: string } }): Promise<any>;
  update(a: { where: { id: string }; data: Record<string, unknown> }): Promise<any>;
  delete(a: { where: { id: string } }): Promise<any>;
};
const delegate = (prisma: PrismaClient, type: SpineType): Delegate =>
  ({ portfolio: prisma.portfolio, program: prisma.program, product: prisma.product, project: prisma.project }[type] as unknown as Delegate);

export function createEntity(prisma: PrismaClient, type: SpineType, input: Record<string, unknown>) {
  return delegate(prisma, type).create({ data: input });
}

export async function updateEntity(prisma: PrismaClient, type: SpineType, id: string, patch: Record<string, unknown>) {
  const current = await delegate(prisma, type).findUnique({ where: { id } });
  const prov = await provenanceOf(prisma, { type, id });
  const overriddenFields: string[] = current.overriddenFields ? JSON.parse(current.overriddenFields) : [];
  const r = applyEdit(current, patch, { connected: prov.state === "connected", overriddenFields });
  return delegate(prisma, type).update({
    where: { id },
    data: { ...patch, overriddenFields: r.overriddenFields.length ? JSON.stringify(r.overriddenFields) : null },
  });
}

/** PPM children to offer in the delete dialog: portfolio→programs+products+direct projects; program→projects; product→delivering projects. Projects have none. */
export async function childrenOf(prisma: PrismaClient, ref: EntityRef): Promise<{ ref: EntityRef; name: string }[]> {
  const out: { ref: EntityRef; name: string }[] = [];
  const push = (type: SpineType, rows: { id: string; name: string }[]) => rows.forEach((r) => out.push({ ref: { type, id: r.id }, name: r.name }));
  if (ref.type === "portfolio") {
    push("program", await prisma.program.findMany({ where: { portfolioId: ref.id, archivedAt: null } }));
    push("product", await prisma.product.findMany({ where: { portfolioId: ref.id, archivedAt: null } }));
    push("project", await prisma.project.findMany({ where: { portfolioId: ref.id, archivedAt: null } }));
  } else if (ref.type === "program") {
    push("project", await prisma.project.findMany({ where: { programId: ref.id, archivedAt: null } }));
  } else if (ref.type === "product") {
    push("project", await prisma.project.findMany({ where: { productId: ref.id, archivedAt: null } }));
  }
  return out;
}

export async function applyDeleteResolution(prisma: PrismaClient, resolution: DeleteResolution): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const ref of resolution.archive) {
      await delegate(tx as unknown as PrismaClient, ref.type).update({ where: { id: ref.id }, data: { archivedAt: new Date() } });
    }
    for (const ref of resolution.detach) {
      // detach a kept child: null whichever parent linked it to the deleted parent
      const data: Record<string, unknown> = { portfolioId: null, programId: null, productId: null };
      await delegate(tx as unknown as PrismaClient, ref.type).update({ where: { id: ref.id }, data });
    }
  });
}

export function restore(prisma: PrismaClient, ref: EntityRef) {
  return delegate(prisma, ref.type).update({ where: { id: ref.id }, data: { archivedAt: null } });
}
export function hardDelete(prisma: PrismaClient, ref: EntityRef) {
  return delegate(prisma, ref.type).delete({ where: { id: ref.id } });
}
```

*(Note: `applyDeleteResolution` nulls all three optional parent FKs on a detached child, which is correct because a child is only ever detached from the one parent being deleted and nulling an already-null FK is a no-op.)*

Add `export * from "./domain/provenance/disposition.js";` and `export * from "./domain/provenance/override.js";` to `packages/core/src/index.ts` so `@pma/core` exposes `applyEdit`, `resolveDelete`, `DeleteResolution`.

- [ ] **Step 4: Run test to verify it passes + gate**

Run: `pnpm --filter @pma/web exec vitest run src/server/ppm/ppm-store.test.ts && pnpm -w run test:all`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/ppm/ppm-store.ts apps/web/src/server/ppm/ppm-store.test.ts packages/core/src/index.ts
git commit -m "feat(web): PPM write store — CRUD, override-aware update, transactional delete"
```

---

### Task 7: Server actions — thin validated wrappers

**Files:**
- Create: `apps/web/src/app/manage/actions.ts`
- Test: `apps/web/src/app/manage/actions.test.ts`

**Interfaces:**
- Consumes: the store (Task 6), `entity-links` (Task 5), the `*Input` validators (Task 2).
- Produces `"use server"` async functions: `saveEntity(type, id | null, formInput)`, `deleteEntity(parentRef, choices)`, `restoreEntity(ref)`, `hardDeleteEntity(ref)`, `linkEntity(input)`, `severEntity(ref)`, and `listChildren(parentRef)` (read used by the dialog). Each parses input with the matching validator, calls the store with `db()`, and `revalidatePath`s the affected dashboards.

- [ ] **Step 1: Write the failing test** (validation only — server actions are thin; deeper behavior is covered by Task 6)

```ts
import { expect, test } from "vitest";
import { INPUT_FOR } from "./actions.js";

test("each spine type maps to its validator and rejects a missing name", () => {
  expect(INPUT_FOR.project.safeParse({ organizationId: "o", methodologyId: "m" }).success).toBe(false);
  expect(INPUT_FOR.portfolio.safeParse({ name: "P", organizationId: "o" }).success).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pma/web exec vitest run src/app/manage/actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/web/src/app/manage/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { EntityRef, SpineType } from "@pma/contracts";
import { PortfolioInput, ProgramInput, ProductInput, ProjectInput, ExternalLinkInput } from "@pma/contracts";
import { resolveDelete, type ChildChoice } from "@pma/core";
import { db } from "@/server/db";
import { createEntity, updateEntity, applyDeleteResolution, restore, hardDelete, childrenOf } from "@/server/ppm/ppm-store";
import { linkExternal, severLinks } from "@/server/ppm/entity-links";

export const INPUT_FOR = {
  portfolio: PortfolioInput,
  program: ProgramInput,
  product: ProductInput,
  project: ProjectInput,
} as const;

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

export async function restoreEntity(ref: EntityRef) { await restore(db(), ref); revalidateAll(); }
export async function hardDeleteEntity(ref: EntityRef) { await hardDelete(db(), ref); revalidateAll(); }
export async function linkEntity(raw: unknown) { await linkExternal(db(), ExternalLinkInput.parse(raw)); revalidateAll(); }
export async function severEntity(ref: EntityRef) { await severLinks(db(), ref); revalidateAll(); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pma/web exec vitest run src/app/manage/actions.test.ts`
Expected: PASS. (Add `export type { ChildChoice } from "./domain/provenance/disposition.js";` to `packages/core/src/index.ts` if not already exported.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/manage/actions.ts apps/web/src/app/manage/actions.test.ts packages/core/src/index.ts
git commit -m "feat(web): PPM server actions (save/delete/restore/link/sever)"
```

---

### Task 8: UI — generic EntityForm + external-link affordance

**Files:**
- Create: `apps/web/src/ui/entity-form.tsx` (`"use client"`)
- Create: `apps/web/src/server/ppm/manage-view.ts` (read helper for form option lists)
- Modify: existing dashboards to mount a "＋ New" button (Task 10 wires them; this task delivers the reusable form)
- Test: none (client component; behavior verified live in Task 12). Typecheck is the gate.

**Interfaces:**
- Consumes: `saveEntity`, `linkEntity`, `severEntity` (Task 7); option lists from `manage-view.ts`.
- Produces: `<EntityForm type initial? options />` — a DRY form rendering the fields for the given `SpineType` (name, status `<select>`, optional parent `<select>`s, product/methodology selects for projects), a Save button (`useTransition`), and — when editing — a collapsible "External link" section (system + external id/url → `linkEntity`; a "Sever connection" button → `severEntity`). Field set is driven by a per-type config object so there is exactly one form implementation.

- [ ] **Step 1: Create `apps/web/src/server/ppm/manage-view.ts`**

```ts
import { db } from "@/server/db";

export interface ManageOptions {
  organizationId: string;
  portfolios: { id: string; name: string }[];
  programs: { id: string; name: string }[];
  products: { id: string; name: string }[];
  methodologies: { id: string; name: string }[];
  externalSystems: { id: string; vendor: string }[];
}

export async function getManageOptions(): Promise<ManageOptions> {
  const prisma = db();
  const org = await prisma.organization.findFirst();
  const [portfolios, programs, products, methodologies, externalSystems] = await Promise.all([
    prisma.portfolio.findMany({ where: { archivedAt: null }, select: { id: true, name: true } }),
    prisma.program.findMany({ where: { archivedAt: null }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { archivedAt: null }, select: { id: true, name: true } }),
    prisma.methodology.findMany({ select: { id: true, name: true } }),
    prisma.externalSystem.findMany({ select: { id: true, vendor: true } }),
  ]);
  return { organizationId: org?.id ?? "", portfolios, programs, products, methodologies, externalSystems };
}
```

- [ ] **Step 2: Create `apps/web/src/ui/entity-form.tsx`**

Implement a single client component driven by a per-type field config. Full component (styling mirrors `ai-settings.tsx`: `card`, `btn`, `label`, inline `inputStyle`). Fields per type: all have `name` + `status`; `program`/`product` add `portfolioId`; `project` adds `programId`, `productId`, `methodologyId`; `product`/`portfolio` add `vision`. Include the edit-only External link block calling `linkEntity`/`severEntity`. Save calls `saveEntity(type, initial?.id ?? null, values)` inside `useTransition`, then `router.refresh()`. (Write the complete component following the `ai-settings.tsx` pattern already in the repo; a per-type `FIELDS` map keyed by `SpineType` selects which selects render.)

- [ ] **Step 3: Typecheck**

Run: `pnpm -w run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/ui/entity-form.tsx apps/web/src/server/ppm/manage-view.ts
git commit -m "feat(web): DRY EntityForm + manage option loader + external-link affordance"
```

---

### Task 9: UI — delete-with-disposition dialog

**Files:**
- Create: `apps/web/src/ui/delete-dialog.tsx` (`"use client"`)
- Test: none (client; verified live in Task 12).

**Interfaces:**
- Consumes: `listChildren`, `deleteEntity` (Task 7).
- Produces: `<DeleteButton parent={EntityRef} label />` — opens a modal (pattern from `note-modal.tsx`), on open calls `listChildren(parent)`, renders each child with a keep/archive toggle (default **keep**), and on confirm calls `deleteEntity(parent, choices)` then `router.refresh()`. A parent with no children confirms a simple archive.

- [ ] **Step 1: Create `apps/web/src/ui/delete-dialog.tsx`**

Full client component: modal shell copied from `note-modal.tsx`; `useState` for children + per-child disposition; `useEffect`/on-open `listChildren`; radio/toggle per child (`keep` | `archive`); confirm → `startTransition(async () => { await deleteEntity(parent, choices); router.refresh(); })`. Show the parent name and a one-line explainer ("Archived items are hidden from default views and can be restored.").

- [ ] **Step 2: Typecheck**

Run: `pnpm -w run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/ui/delete-dialog.tsx
git commit -m "feat(web): delete dialog with per-child keep-standalone/archive disposition"
```

---

### Task 10: Dashboards — Products pages, nav, and mounting CRUD on all four

**Files:**
- Create: `apps/web/src/app/products/page.tsx`, `apps/web/src/app/products/[id]/page.tsx`
- Create: `apps/web/src/ui/products.tsx`
- Modify: `apps/web/src/server/view-models.ts` (add `getProductsView`, `getProductView`)
- Modify: `apps/web/src/ui/shell.tsx` (add `{ v: "products", ic: "▧", l: "Products", href: "/products" }` to the Manage group)
- Modify: `apps/web/src/app/{portfolio,programs,projects}/page.tsx` + their `@/ui` components to mount `<EntityForm>` (New/Edit) and `<DeleteButton>`.
- Test: `apps/web/src/server/products-view.test.ts`

**Interfaces:**
- Consumes: `db()`; provenance via `provenanceOf`.
- Produces: `getProductsView()` → `{ products: { id, name, status, portfolioId, portfolioName, projectCount, provenance }[] }`; `getProductView(id)`. Product cards link to their portfolio (or "Standalone") and list delivering projects.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { makeTestDb } from "@pma/db/src/testing/test-db.js";
import { buildProductsView } from "./view-models.js";

test("products view lists standalone + portfolio-owned with project counts", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const org = await prisma.organization.create({ data: { name: "WS" } });
    const method = await prisma.methodology.create({ data: { name: "Scrum", kind: "scrum" } });
    const product = await prisma.product.create({ data: { organizationId: org.id, name: "Prod" } });
    await prisma.project.create({ data: { organizationId: org.id, name: "Pj", methodologyId: method.id, productId: product.id } });
    const view = await buildProductsView(prisma);
    expect(view.products[0]).toMatchObject({ name: "Prod", portfolioName: null, projectCount: 1, provenance: "manual" });
  } finally {
    await cleanup();
  }
}, 30000);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pma/web exec vitest run src/server/products-view.test.ts`
Expected: FAIL — `buildProductsView` not exported.

- [ ] **Step 3: Add `buildProductsView`/`buildProductView` + `getProductsView`/`getProductView` to `view-models.ts`**

```ts
export async function buildProductsView(prisma: PrismaClient) {
  const rows = await prisma.product.findMany({
    where: { archivedAt: null },
    include: { portfolio: true, projects: { where: { archivedAt: null } } },
  });
  const products = await Promise.all(rows.map(async (p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    portfolioId: p.portfolioId,
    portfolioName: p.portfolio?.name ?? null,
    projectCount: p.projects.length,
    provenance: (await provenanceOf(prisma, { type: "product", id: p.id })).state,
  })));
  return { products };
}
export const getProductsView = () => buildProductsView(db());
```

(Import `provenanceOf` from `./ppm/entity-links.js`. Add `buildProductView(prisma, id)` returning the product + its delivering projects for the detail page.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pma/web exec vitest run src/server/products-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the pages + nav + mount CRUD**

Create `apps/web/src/app/products/page.tsx` (mirrors `connections/page.tsx`: `getProductsView()` → `<Shell active="products" crumb="Products"><Products view/></Shell>`) and `products/[id]/page.tsx`. Create `apps/web/src/ui/products.tsx` (card grid; each card shows the provenance badge, portfolio link or "Standalone", project count, and an Edit `<EntityForm>` + `<DeleteButton>`; a "＋ New product" opens a create `<EntityForm type="product">`). Add the nav entry to `shell.tsx`. Mount the same `<EntityForm>`/`<DeleteButton>` on the portfolio/programs/projects components.

- [ ] **Step 6: Gate**

Run: `pnpm -w run test:all`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/products apps/web/src/ui/products.tsx apps/web/src/server/view-models.ts apps/web/src/server/products-view.test.ts apps/web/src/ui/shell.tsx apps/web/src/app/portfolio apps/web/src/app/programs apps/web/src/app/projects apps/web/src/ui
git commit -m "feat(web): Products pages + nav; mount CRUD (form + delete dialog) on all four models"
```

---

### Task 11: Dashboards — provenance/placement filters, sort, and navigation

**Files:**
- Create: `apps/web/src/ui/dashboard-filters.tsx` (`"use client"`)
- Create: `packages/core/src/domain/provenance/segment.ts` (pure filter/sort)
- Test: `packages/core/src/domain/provenance/segment.test.ts`

**Interfaces:**
- Produces: pure `segment(rows, { source, placement, sort })` in core — `rows: { provenance: ProvenanceState; hasParent: boolean; name: string; status: string; health?: number; updatedAt: string }[]`; filters by `source` (`all|manual|connected|formerly_synced`) and `placement` (`all|standalone|has_parent`), sorts by `name|status|health|updated`. The client `<DashboardFilters>` renders the controls and applies `segment` to the passed rows, rendering the provenance badge and a parent link / "Standalone" per row; a mixed-source rollup is labeled "mixed".

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { segment } from "./segment.js";

const rows = [
  { provenance: "manual" as const, hasParent: false, name: "B", status: "on_track", updatedAt: "2026-01-02" },
  { provenance: "connected" as const, hasParent: true, name: "A", status: "planning", updatedAt: "2026-01-01" },
];

test("filters by source + placement and sorts by name", () => {
  expect(segment(rows, { source: "manual", placement: "all", sort: "name" }).map((r) => r.name)).toEqual(["B"]);
  expect(segment(rows, { source: "all", placement: "standalone", sort: "name" }).map((r) => r.name)).toEqual(["B"]);
  expect(segment(rows, { source: "all", placement: "all", sort: "name" }).map((r) => r.name)).toEqual(["A", "B"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pma/core exec vitest run src/domain/provenance/segment.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/provenance/segment.ts`**

```ts
import type { ProvenanceState } from "@pma/contracts";

export interface SegmentRow {
  provenance: ProvenanceState;
  hasParent: boolean;
  name: string;
  status: string;
  health?: number;
  updatedAt: string;
}
export interface SegmentOpts {
  source: "all" | ProvenanceState;
  placement: "all" | "standalone" | "has_parent";
  sort: "name" | "status" | "health" | "updated";
}

export function segment<T extends SegmentRow>(rows: T[], opts: SegmentOpts): T[] {
  const filtered = rows.filter((r) =>
    (opts.source === "all" || r.provenance === opts.source) &&
    (opts.placement === "all" || (opts.placement === "standalone" ? !r.hasParent : r.hasParent)),
  );
  const cmp: Record<SegmentOpts["sort"], (a: T, b: T) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    status: (a, b) => a.status.localeCompare(b.status),
    health: (a, b) => (b.health ?? 0) - (a.health ?? 0),
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  };
  return [...filtered].sort(cmp[opts.sort]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pma/core exec vitest run src/domain/provenance/segment.test.ts`
Expected: PASS. Add `export * from "./domain/provenance/segment.js";` to `packages/core/src/index.ts`.

- [ ] **Step 5: Create `<DashboardFilters>` + wire into the four dashboards**

Client component with three `<select>`s (source / placement / sort) held in `useState`; applies `segment(rows, opts)` and renders the resulting list (each row: name, status, provenance badge, and parent link or "Standalone"). Replace the static lists in `products.tsx` and the portfolio/programs/projects components with `<DashboardFilters rows={...}>`. Ensure each view-model row now includes `provenance`, `hasParent`, `updatedAt` (extend the existing `buildXView` selects to include `updatedAt` and compute `hasParent`/`provenance`).

- [ ] **Step 6: Gate**

Run: `pnpm -w run test:all`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/provenance/segment.ts packages/core/src/domain/provenance/segment.test.ts packages/core/src/index.ts apps/web/src/ui/dashboard-filters.tsx apps/web/src/ui apps/web/src/server/view-models.ts
git commit -m "feat(web): provenance/placement filters + sort + navigation across the four dashboards"
```

---

### Task 12: Verify — full gate + live drive

**Files:** none (verification only).

- [ ] **Step 1: Full gate**

Run: `pnpm -w run test:all`
Expected: PASS (dependency-cruiser clean, all vitest green, typecheck clean).

- [ ] **Step 2: Reseed + run the app**

```bash
DATABASE_URL="file:./.vault/workspace.db" pnpm --filter @pma/db exec prisma db push --skip-generate
DATABASE_URL="file:./.vault/workspace.db" pnpm --filter @pma/web run seed
DATABASE_URL="file:./.vault/workspace.db" pnpm --filter @pma/web dev  # → http://localhost:3000
```

- [ ] **Step 3: Live Playwright drive (load the browser tools first)**

Drive and verify: create a standalone Product; create a Project that delivers it; edit the Project's name; open the Products dashboard, filter source=`manual` and placement=`standalone`, confirm the new items show with a "manual" badge and link to "Standalone"; delete a Portfolio and in the dialog mark one child **keep** and one **archive**, confirm, then verify the kept child is now standalone (parent link gone) and the archived one disappears from the default view. Capture a screenshot and **look at it**.

- [ ] **Step 4: Update CLAUDE.md Current state**

Edit `/home/jfox/Projects/pm-artifactor/CLAUDE.md` → append the manual-foundation milestone to the Current-state section (CRUD + Products + nullable hierarchy + provenance/override + dashboards shipped; live sync still deferred).

- [ ] **Step 5: Commit**

```bash
git commit -am "docs: record PPM manual foundation in CLAUDE.md current state"
```
