# PM Artifactor

A **local-first Portfolio / Program / Project management toolkit and PM copilot.**

Everything runs on your machine: a SQLite "vault" holds the data, a pure deterministic engine
computes every number you see (prioritization, health, capacity, flow, DORA), and an optional,
interchangeable AI layer drafts narrative on top — grounded in that same data, never inventing it.
External integrations are **read-only**: PM Artifactor never writes back to Jira, Confluence, or
anything else.

> Status: local POC / active development. Not packaged for distribution yet — you run it from source.

---

## Quickstart

Requires **Node ≥ 20** and **pnpm 10** (`packageManager` is pinned in `package.json`).

```bash
# 1. Install, and generate the Prisma client
pnpm install
pnpm --filter @pma/db run prisma:generate

# 2. Create + seed the local vault (SQLite)
pnpm --filter @pma/db exec prisma db push --skip-generate
pnpm --filter @pma/web run seed

# 3. Warm the intelligence layer (optional, but makes /intelligence show real numbers)
pnpm --filter @pma/web run warm

# 4. Dev server
pnpm --filter @pma/web run dev
```

Then open **http://localhost:3000**.

`DATABASE_URL` defaults to `file:./.vault/workspace.db` via `db/.env`. The `.vault/` directory, the
`.pma/` AI config, and the encrypted credential vault are all gitignored — nothing local ever gets
committed.

Production build:

```bash
pnpm --filter @pma/web run build
pnpm --filter @pma/web run start
```

> **Run on port 3000.** Atlassian OAuth callbacks are pinned to
> `http://localhost:3000/api/atlassian/callback` (an Atlassian app registers exactly one callback).

### Gotcha: regenerate Prisma after a schema change

The generated Prisma client is gitignored, so **checking out a branch never updates it**. After any
change to `db/prisma/schema.prisma` — or after switching branches — run:

```bash
pnpm --filter @pma/db run prisma:generate
```

A stale client fails at runtime with a cryptic `Cannot read properties of undefined (reading
'findMany')` (i.e. `prisma.someModel` is `undefined`), *not* a "column does not exist" error.

---

## Monorepo layout

pnpm workspace (`packages/*`, `apps/*`, `db`):

| Package | What it is |
|---|---|
| `packages/core` (`@pma/core`) | **Pure** hexagonal domain + deterministic engine. Composite work items, Abstract-Factory methodology profiles, WSJF/RICE strategies, health composites, capacity, sprint/DORA metrics, Specification rules → daily brief, provenance/override logic, connection state. Imports **zero** infrastructure. |
| `packages/contracts` (`@pma/contracts`) | Zod validators. The `AI_TASK_OUTPUT` registry; every AI output extends `OutputBase` (`grounded_on` with min 1 entry, `confidence` 0–1). |
| `db` (`@pma/db`) | Prisma schema over SQLite (~50 models), methodology seed, repository + outbox adapters. |
| `apps/web` (`@pma/web`) | Next.js 15 App Router UI. The **composition root** — the only package importing both `@pma/db` and `@pma/core`. Server data layer in `src/server/`; pages render view-models. |

### Architecture invariants

These are load-bearing. The first is enforced mechanically by dependency-cruiser
(`.dependency-cruiser.cjs`) as part of the gate.

1. **Core purity** — `packages/core` imports no infrastructure. No Prisma, no Next, no AI SDKs, no
   `node:child_process`. All of that lives under `apps/web/src/server`.
2. **DB boundary** — only `apps/web/src/server` touches Prisma. Core and contracts never do.
3. **Read-only ingestion** — external integrations are read-only. The app never writes back to a
   vendor, and AI never writes externally.
4. **AI grounding** — every AI output is validated against `@pma/contracts`, and every id cited in
   `grounded_on` must literally appear in the input. Ungrounded output is discarded and falls back
   to the deterministic template port.
5. **People red lines** — teammate notes are "written to be seen"; there is no secret scoring.
   Secrets are never stored in SQLite or in plaintext by default.

---

## Routes

| Route | Page |
|---|---|
| `/` | Today — daily command center (copilot brief) |
| `/inbox` | Inbox — email digest |
| `/portfolio` | Portfolio — health, benefits, cross-tool capacity |
| `/programs` | Programs |
| `/projects`, `/projects/[id]` | Projects list + detail (forecast, sprint, health drivers) |
| `/products`, `/products/[id]` | Products list + detail |
| `/prioritize` | Prioritize — WSJF / RICE (`?model=`) |
| `/releases` | Release command center |
| `/deploy-health` | Deployment health (DORA) |
| `/team`, `/team/[id]` | Team + person detail (with note modal) |
| `/stakeholders` | Stakeholders — power/interest grid |
| `/intelligence` | System intelligence — resolution-ladder tiers, tokens saved |
| `/connections` | Connections — external sources, Atlassian connect |
| `/settings` | AI settings — provider, model, API keys |
| `/vault`, `/vault/setup`, `/unlock` | Vault status, passphrase setup, unlock |
| `/setup` | First-run screen |
| `/api/atlassian/callback` | Atlassian OAuth redirect handler |

Portfolios, programs, projects, and products are fully CRUD-able, including
**interactive delete-with-disposition** (per child: keep standalone / archive), plus provenance and
placement filters, sort, and navigation on each dashboard.

---

## The vault (session & credentials)

The credential vault is a gitignored, `0600`, **AES-256-GCM** encrypted file (`vault.enc`) with an
**scrypt**-derived key. The passphrase is never stored — it's checked against an encrypted verifier.
Writes are atomic (tmp + rename).

- Set a passphrase at `/vault/setup`, unlock at `/unlock`, and **Lock / Log out** from the sidebar.
- **Leaving it unconfigured leaves the app open** — the lock is opt-in and backward compatible.
- Restarting the dev server drops the in-memory key, so a configured vault returns to `locked` and
  you'll land on `/unlock`. That's expected.

The pure `SessionPort` and `CredentialStorePort` live in `packages/core/src/ports`; the local
adapter is `apps/web/src/server/vault/`.

---

## AI layer

Every provider implements the `AIPort` contract behind a `ResolutionLadder` (**exact-cache → llm**),
which logs `AiTask` / `AiResultCache` rows with `grounded_on` dependency fingerprints — that's what
`/intelligence` visualizes.

Shared behavior lives in `apps/web/src/server/ai/grounded-llm-port.ts` (`GroundedLLMPort`, a Template
Method): it builds the prompt, validates the response against contracts, enforces grounding, and
**falls back to the deterministic `TemplateAIPort` on any failure**. Each provider only implements
`complete()`:

| Provider | Notes |
|---|---|
| `template` | Deterministic, always-grounded fallback. No model calls. |
| `anthropic` | Anthropic API via `@anthropic-ai/sdk` (default `claude-opus-4-8`). Metered key. |
| `openai` | OpenAI Chat Completions, JSON mode. |
| `gemini` | Google Gemini via `@google/genai`. |
| `claude-code` | The logged-in `claude` CLI (subscription). **Local/dev only** — spawns a process per task. |

**Configure it in the app** at `/settings` (nav → *AI Settings*): pick a provider and model and set
keys. Config is written to a gitignored, server-only, `0600` file `.pma/ai-config.json` (override the
path with `PMA_AI_CONFIG_PATH`), layered over env vars for back-compat: `PMA_AI_PROVIDER`,
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` / `GOOGLE_API_KEY`.

Keys are **never** stored in SQLite and **never** sent back to the browser — the settings view
exposes only presence and source. Re-run `warm` after changing providers to light up the real `llm`
tier on `/intelligence`.

> Keys currently sit in a `0600` plaintext file, which is a deliberate local-dev choice. An OS
> keychain is the shipping path.

---

## Integrations

**Atlassian (Jira + Confluence)** is the first real connector, currently at the *connect* slice:

- OAuth 2.0 (3LO) with classic read-only scopes: `offline_access`, `read:jira-work`,
  `read:confluence-space.summary`, `read:confluence-content.summary`.
- One consent → one encrypted token blob in the vault under `atlassian:<cloudId>` → **two**
  `SyncConnection` rows (`vendor=jira`, `vendor=confluence`) sharing that `authRef`, with
  `direction="inbound"`.
- Rotating refresh tokens are handled with persist-before-use and single-flight per connection. Only
  `invalid_grant` forces re-consent; transient failures (503, network) re-throw without flagging.
- Connecting or refreshing requires an **unlocked vault** — the client ID and secret live there too,
  under `atlassian:client`.

**To use it you must register your own OAuth 2.0 (3LO) app** at
[developer.atlassian.com](https://developer.atlassian.com) with the callback and scopes above, then
paste the client ID/secret into `/connections` (write-only, straight into the vault).

Everything else on `/connections` is still a read-only fake adapter demonstrating the
pull → `IngestionSnapshot` (provenance) → normalized `WorkItem` + `ExternalLink` path.

---

## Development

The gate — **must stay green before any commit**:

```bash
pnpm -w run test:all      # dependency-cruiser (core purity) + vitest + typecheck (all 4 packages)
```

Currently **197 tests across 62 files**. Individual pieces:

```bash
pnpm run test         # vitest, watch
pnpm run test:run     # vitest, once
pnpm run typecheck    # tsc --noEmit across core, contracts, db, web
pnpm run depcruise    # core-purity dependency rule only
```

### Conventions

- **Pages**: server component with `export const dynamic = "force-dynamic"` → `getXView()` from
  `@/server/view-models` → `<Shell active crumb><XComponent view={...} /></Shell>`. Interactive bits
  are `"use client"` components under `@/ui/`. Path alias `@/*` → `apps/web/src/*`.
- **ESM**: source uses `.js`-suffixed relative imports (TS ESM). Next resolves these via
  `webpack.resolve.extensionAlias` in `next.config.mjs`.
- **Tests**: colocated `*.test.ts(x)`, vitest. AI adapters and config are tested with mocked
  clients/runners and temp config files — the suite makes **no** real API or CLI calls.
- **Commits**: conventional commits, landing on `main` (single-branch flow).

### Known benign warnings

Browser-extension hydration warnings (e.g. ColorZilla's `cz-shortcut-listen` on `<body>`) are not app
bugs; `<body suppressHydrationWarning>` in `layout.tsx` silences them.

---

## Docs

Design specs and phase plans live under `docs/superpowers/`:

- `specs/2026-07-07-pm-artifactor-first-build-design.md` — the original build spec
- `specs/2026-07-10-ppm-manual-foundation-design.md` — manual PPM hierarchy, provenance, CRUD
- `specs/2026-07-15-session-credential-foundation-design.md` — session + credential vault
- `specs/2026-07-16-atlassian-oauth-connect-design.md` — Atlassian OAuth connect
- `specs/2026-07-31-atlassian-api-token-connect-design.md` — Atlassian API-token connect (designed, not yet built)

Corresponding execution plans are in `docs/superpowers/plans/`.

### Roadmap

Atlassian work is decomposed as **B1 connect** (done) → **B1b API-token connect** (spec'd) →
**B2 discovery + container mapping** → **B3 inbound sync** → **B4 onboarding wizard**.

Also deferred: an OS-keychain credential store (which also gates Electron/Tauri packaging),
semantic-cache and learned/shadow resolution tiers, a GitHub Copilot AI adapter (blocked on a public
BYO-key chat API), and restore / hard-delete UI.
