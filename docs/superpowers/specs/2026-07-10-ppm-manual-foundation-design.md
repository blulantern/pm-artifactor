# PPM Manual Foundation — Design Spec

**Date:** 2026-07-10
**Status:** Approved (design), pending spec review
**Builds on:** the first build (`2026-07-07-pm-artifactor-first-build-design.md`) and the interchangeable AI layer already merged to `main`.
**Target repo:** `/home/jfox/Projects/pm-artifactor/pm-artifactor` (git, `main`)

---

## 1. Purpose & scope

The app currently renders 14 read-only dashboards over seeded data. This spec adds the **actual management processes**: create, edit, and delete **Portfolios, Programs, Products, and Projects** as a fully **standalone, manually set up toolkit** — with a nullable hierarchy, provenance-aware segmentation, a local-override layer that lets the same entities later be synced from external systems, and dashboards you can filter, sort, and navigate by hierarchy and connection state.

This is the **manual foundation**. It is deliberately decomposed from live external sync:

- **In scope:** the four spine entities' full CRUD; nullable hierarchy (everything standalone-capable); the **polymorphic internal↔external link abstraction** as a real data model, including a *manual* "link this entity to an external system's item" affordance (enter the external id/url, pick a system); the local-override + sever mechanics implemented as pure logic and exercised against the existing fake ingestion; provenance-segmented dashboards with filter / sort / parent-child navigation.
- **Out of scope (separate follow-on spec):** live Jira / Monday / Asana connectors, OAuth, API clients, field-mapping UIs, and secure credential storage. These plug into the seam this spec solidifies without changing callers.

### Approved decisions (from brainstorming)

1. **Product model:** Product is a first-class entity, peer to Program — **standalone or under a Portfolio**. Each **Project optionally delivers one Product** (`Project.productId`, nullable; many projects → one product).
2. **Sync lifecycle:** **local-override layer.** Connected entities are editable; each local edit is recorded as an override that a future sync will not clobber (sync updates only non-overridden fields; last-pulled snapshot retained). **Severing** a connection detaches its entities to plain manual data and keeps a "formerly synced from X" marker.
3. **Delete rules:** deleting a parent opens an **interactive child-disposition step** — each child (and delivering project) is individually marked *keep-as-standalone* or *archive*; then the parent and the archive-marked children are **soft-archived** (hidden from default views, restorable). Hard delete is a separate explicit action on already-archived items.

---

## 2. Non-negotiable principles (inherited)

- **Core purity** — `packages/core` imports zero infra (dependency-cruiser-enforced). All new hierarchy/override/disposition *logic* is pure functions in core; Prisma writes and server actions live only under `apps/web/src/server`; forms in `@/ui`.
- **Read-only to vendors** — the app never writes back to an external system. The override layer is a *local* concept; sync (later) is inbound-only.
- **Secrets never in SQLite/plaintext-by-default** — unchanged; external-system credentials are out of scope here (the manual link affordance stores only a non-secret external id/url + system reference).
- **Grounded, provenance-honest data** — every entity carries its source identity; views segment by it and never silently blend across sources.
- The full gate (`pnpm -w run test:all`: dependency-cruiser + vitest + typecheck) stays green.

---

## 3. Data model (Prisma / SQLite)

### 3.1 Nullable hierarchy + workspace membership

The current blocker is that parent FKs are **required**. Decouple *workspace membership* (always present) from *portfolio/program grouping* (optional):

- `Program.portfolioId` → **optional**; add `Program.organizationId` (**required**, → the single workspace org).
- `Project.portfolioId` → **optional** (`Project.programId` already optional); add `Project.organizationId` (**required**); add `Project.productId` (**optional**).
- Every spine entity therefore always belongs to the workspace org; a portfolio/program/product parent is optional. "Standalone" = the relevant parent FK is null.

### 3.2 New `Product` model

```
model Product {
  id             String     @id @default(cuid())
  organizationId String                       // workspace membership (required)
  portfolioId    String?                      // standalone OR under a Portfolio
  name           String
  status         String     @default("active")  // discovery | active | maintenance | sunset
  vision         String?
  projects       Project[]                    // delivered-by (Project.productId)
  // + shared provenance/override/archive fields (§3.3)
}
```

`Portfolio.products Product[]` is added to the relation.

### 3.3 Provenance, override, and soft-archive (shared across the four spine entities)

Provenance is modeled **entirely through the existing polymorphic `ExternalLink`** (`internalType` + `internalId` → `SyncConnection` → `ExternalSystem`). No per-entity source column is added.

- `ExternalLink` gains `severedAt DateTime?`. An entity is **connected** iff it has an `ExternalLink` with `severedAt = null`; **formerly-synced** iff all its links have `severedAt` set. The row is kept on sever for history.
- Each spine entity (`Portfolio`, `Program`, `Product`, `Project`) gains:
  - `overriddenFields String?` — JSON array of locally-edited field names. `null`/empty ⇒ purely manual (or a connected field still tracking source). The **row always stores the effective value** (override-wins already materialized), so `@pma/core` and the view-models read rows unchanged.
  - `archivedAt DateTime?` — soft-archive timestamp. Default views exclude non-null.
  - `updatedAt DateTime @updatedAt` — for sort-by-recency (add where missing).

*Approach note:* storing effective values on the row (with an overridden-field-set) is chosen over separate override records so that every existing read path stays unchanged; the extra bookkeeping is confined to the write/merge/sever paths.

### 3.4 The polymorphic link abstraction (the seam)

Solidify a single typed concept used everywhere an internal entity references an external item:

- `SpineType = "portfolio" | "program" | "product" | "project"` (extendable to `work_item`, etc.) — declared once in `@pma/contracts`.
- `EntityRef = { type: SpineType; id: string }`.
- A server module `entity-links.ts` exposes generic operations over `ExternalLink`: `linkExternal(ref, { systemId, connectionId?, externalId, externalUrl? })`, `severLinks(ref)`, `linksFor(ref)`, `provenanceOf(ref)` → `{ state: "manual" | "connected" | "formerly_synced"; system?: string }`.
- The **manual** affordance (this spec) creates an `ExternalLink` with an external id/url and `ExternalSystem` but no live `SyncConnection` pull; the future connectors reuse the exact same calls. This is what "creating connections between our entities and external items" looks like, validated against manual data first.

---

## 4. Behavior: manual vs connected, overrides, sever

Implemented as **pure functions in `@pma/core`** (`domain/provenance/`), consumed by the server write layer:

- **Effective value / edit:** `applyEdit(entity, patch, provenance)` returns the new field values plus the updated `overriddenFields`. For a manual entity it's a plain patch (no override tracking). For a connected entity, every changed field is added to `overriddenFields`.
- **Sync merge (exercised via the fake ingestion):** `mergePull(current, pulled, overriddenFields)` returns effective values where overridden fields keep `current` and all others take `pulled`. This makes the override layer real and unit-tested now; the live pull is deferred.
- **Sever:** the server sets `severedAt` on the entity's active `ExternalLink`(s) and clears `overriddenFields`; the entity becomes plain manual data with a retained "formerly synced from X" marker.

## 5. CRUD + interactive delete

- **Server actions** (`apps/web/src/app/*/actions.ts`, `"use server"`) + **forms** (`@/ui/*`) for each entity: `create`, `update`, `archive`, `restore`, `hardDelete`, plus `link`/`sever` for the external affordance. All writes route through a typed store in `apps/web/src/server`; **validation is pure** (`@pma/core`/`@pma/contracts`) — e.g., a project's `productId`/`programId`/`portfolioId` must resolve to the same org; status values must be in range; name required.
- **Create/edit forms** pick the optional parent(s) from the workspace's existing entities (or "none — standalone"). Creating a Project requires selecting a methodology from the seeded bundles (keeps the engine's workflow intact).
- **Delete-parent flow:** the delete action first returns the parent's children — a portfolio's programs, products, and directly-attached projects; a program's projects; a product's delivering projects — and the confirm dialog renders each with a **keep-standalone / archive** toggle. On confirm: soft-archive the parent; for each child either **detach** (set the parent FK null; child stays active) or **soft-archive** it. The disposition-planning logic (which children, default choice, resulting operations) is a **pure function in core** so it is unit-testable independent of Prisma. Projects have no PPM children, so deleting a project is a direct archive (its work items/releases are archived with it, not offered as standalone).

## 6. Dashboards: segmentation, filter/sort, navigation

- **New `/products` page + product detail**, following the existing `page → getXView() → <Shell><XComponent view/>` pattern; Products join the nav. Portfolio / Programs / Projects pages gain the same controls.
- **Filters:** source (`manual` | `connected` | `formerly-synced` | by specific `ExternalSystem`) and placement (`standalone` | `has-parent`). **Sort:** name, status, health, last-updated.
- **Navigation:** each entity shows and links to its parent (or "Standalone") and to its children/deliveries — walk up/down the tree or jump laterally between models.
- **No intersection of agnostic data models:** every card/row shows its provenance badge; filters isolate a single source; a rollup that spans sources (e.g., a portfolio containing both manual and Jira-sourced programs) is rendered as **mixed-source**, never blended into one undifferentiated number. Filtering to one source yields a self-consistent slice.

## 7. Architecture placement

| Concern | Location |
|---|---|
| Hierarchy/standalone rules, `applyEdit`, `mergePull`, delete-disposition planning, validation | `packages/core` (pure) |
| `SpineType`, `EntityRef`, entity/link Zod validators | `packages/contracts` |
| Prisma schema, migration (`db push`), seed additions (a couple of standalone + a Product) | `db` (`@pma/db`) |
| Typed write store, `entity-links.ts`, server actions | `apps/web/src/server` + `apps/web/src/app/*/actions.ts` |
| Forms, filter/sort controls, delete dialog, product pages, nav | `apps/web/src/ui` + `apps/web/src/app` |

## 8. Testing & verification

- **Pure core unit tests:** `applyEdit` (manual vs connected override tracking), `mergePull` (overridden fields survive a pull), sever behavior, and delete-disposition planning (per-child keep vs archive → resulting ops).
- **Contract tests:** entity + link validators; same-org / valid-parent invariants.
- **Store/action tests:** against a temp SQLite DB — create/edit/archive/restore, orphan-on-detach, manual external link + sever.
- **Live drive:** a Playwright pass of create → edit → delete-with-child-disposition for at least one parent type, plus a filter/navigation check on a dashboard.
- The full gate stays green; dependency-cruiser confirms core purity (no infra, no vendor SDKs in core).

## 9. Explicitly deferred (honest cut)

- Live Jira / Monday / Asana API clients, OAuth flows, field-mapping UIs, scheduled pulls, and secure credential storage — the **follow-on sync spec**, built on the §3.4 seam and the §4 merge logic proven here.
- Real OS keychain / encrypted credential store (still the dev-only plaintext file from the AI-config work).
- Bulk import/CSV, multi-org, and audit history beyond `archivedAt` / `severedAt`.

## 10. Build order within this deliverable

1. Schema: nullable parents + `organizationId` on Program/Project/Product + `Product` model + `Project.productId` + `overriddenFields`/`archivedAt`/`updatedAt` + `ExternalLink.severedAt`; `db push`; small seed additions. (The new required `organizationId` is backfilled to the workspace org during the reseed — the local vault is regenerated, so there is no production-data migration to preserve.)
2. Contracts: `SpineType`, `EntityRef`, entity + link validators.
3. Core: provenance/override/disposition pure functions + tests.
4. Server: typed write store, `entity-links.ts`, server actions; store/action tests.
5. UI: create/edit forms, delete-with-disposition dialog, external-link affordance.
6. Dashboards: Products pages + nav; filter/sort/navigation controls across the four models.
7. Verify: gate green + Playwright drive.
