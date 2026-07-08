# @pma/web — PM Artifactor local-first UI

The Next.js (App Router) web app for PM Artifactor. It is the composition root: the only package that imports both `@pma/db` (Prisma/SQLite) and `@pma/core` (the pure deterministic engine). A server-side data layer (`src/server/`) maps Prisma rows → `@pma/core` analyzer inputs → view-models; server components render them.

## Run it

From the repo root:

```bash
# 1. Install (once)
pnpm install
pnpm --filter @pma/db prisma:generate

# 2. Create and seed a local vault (SQLite file)
DATABASE_URL="file:./.vault/workspace.db" pnpm --filter @pma/db exec prisma db push --skip-generate
DATABASE_URL="file:./.vault/workspace.db" pnpm --filter @pma/web run seed

# 3. Warm the intelligence layer (persists the FeatureRecord corpus and runs
#    the AI tasks through the resolution ladder so the System Intelligence page
#    shows a real tier distribution + tokens-saved instead of a projected state)
DATABASE_URL="file:./.vault/workspace.db" pnpm --filter @pma/web run warm

# 4. Dev server → http://localhost:3000
DATABASE_URL="file:./.vault/workspace.db" pnpm --filter @pma/web dev
```

Or a production build + start:

```bash
pnpm --filter @pma/web exec next build
DATABASE_URL="file:./.vault/workspace.db" pnpm --filter @pma/web exec next start -p 3000
```

`DATABASE_URL` defaults to `file:./.vault/workspace.db` (see `db/.env`); the `.vault/` directory is gitignored.

## Routes (all 14 POC pages)

| Route | Page |
|---|---|
| `/` | Today / Daily Command Center (copilot) |
| `/inbox` | Inbox (email digest) |
| `/portfolio` | Portfolio (health, benefits, cross-tool capacity) |
| `/programs` | Programs |
| `/projects`, `/projects/[id]` | Projects list + detail (forecast, sprint, health drivers) |
| `/prioritize` | Prioritize (WSJF/RICE, `?model=`) |
| `/releases` | Release Command Center |
| `/deploy-health` | Deployment Health (DORA) |
| `/team`, `/team/[id]` | Team + person detail (+ note modal) |
| `/stakeholders` | Stakeholders (power-interest grid) |
| `/intelligence` | System Intelligence (3-layer engine) |
| `/connections` | Connections (read-only sources) |
| `/vault` | Your Vault |
| `/setup` | First-run screen |

## Architecture notes

- **Server-only DB access:** `@pma/db` is imported only under `src/server/**`. Never import it into a client component.
- **Deterministic engine:** every page's data comes from `@pma/core` analyzers (WSJF/RICE, health composites, cross-tool capacity, sprint/flow, DORA, the Specification rules → daily brief) run server-side over the SQLite vault.
- **Read-only:** the app never writes to an external system; the note modal is a presentational draft affordance.
- **AI layer:** a stub template `AIPort` produces grounded, contract-valid drafts; a resolution-ladder Proxy (deterministic → exact-cache → stub-LLM) logs `AiTask`/`AiResultCache` with `grounded_on` dependency fingerprints. After `warm`, the System Intelligence page shows a real tier distribution + tokens-saved. The real Claude adapter drops in behind the same `AIPort` later.
- **Read-only ingestion:** a fake work-tracker adapter demonstrates the pull → `IngestionSnapshot` (provenance) → normalized canonical `WorkItem` + `ExternalLink` path — nothing writes back to any source.
