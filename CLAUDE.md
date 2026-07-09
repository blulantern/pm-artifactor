# PM Artifactor — working notes for Claude

Local-first Portfolio/Program/Project management toolkit + PM copilot, built from the spec
in `docs/superpowers/specs/2026-07-07-pm-artifactor-first-build-design.md`. Phase plans are
under `docs/superpowers/plans/`. Run instructions: `apps/web/README.md`.

## Monorepo layout (pnpm workspace)

- `packages/core` — **PURE** hexagonal domain + deterministic engine (GoF-pattern-heavy:
  Composite work items, Abstract-Factory methodology profiles, WSJF/RICE strategies, health,
  capacity, sprint/DORA, Specification rules → daily brief). **Imports nothing infra.**
- `packages/contracts` — Zod validators (`@pma/contracts`). `AI_TASK_OUTPUT` registry; every AI
  output extends `OutputBase` (`grounded_on` min 1, `confidence` 0–1).
- `db` (`@pma/db`) — Prisma/SQLite schema, methodology seed, repo/outbox adapters.
- `apps/web` — Next.js App Router. The **composition root** (only package importing both `@pma/db`
  and `@pma/core`). Server data layer in `src/server/`; pages render view-models.

## Invariants — do not break these

1. **Core purity** — `packages/core` imports zero infra. Enforced physically by
   `.dependency-cruiser.cjs` (forbids `@prisma|next|@anthropic-ai|openai|@google/genai|...` in core).
   Infra (Prisma, all AI SDKs, `node:child_process`) lives only under `apps/web/src/server`.
2. **DB boundary** — only `apps/web/src/server` touches Prisma; core/contracts never do.
3. **Read-only ingestion** — external integrations are read-only; the app never writes back to
   vendors. AI never writes externally.
4. **AI grounding** — every AI output is validated against `@pma/contracts` and every cited
   `grounded_on` id must literally appear in the input; ungrounded output is discarded/fallen-back.
5. **People red lines** — notes are "written to be seen"; no secret scoring. Secrets never in
   SQLite/plaintext by default (see the AI-keys caveat below, which the user opted into for dev).

## The gate — must stay green

```bash
pnpm -w run test:all      # depcruise (core purity) + vitest + typecheck (all 4 packages)
```
Commit only when green. Conventional commits; land on `main` (the project's single-branch flow);
don't push unless asked. End commit messages with the Co-Authored-By trailer.

## Conventions

- **Pages**: server component with `export const dynamic = "force-dynamic"` → `getXView()` from
  `@/server/view-models` → `<Shell active crumb><XComponent view={...}/></Shell>`. Interactive bits
  are `"use client"` components in `@/ui/`. Path alias `@/*` → `apps/web/src/*`.
- **ESM**: source uses `.js`-suffixed relative imports (TS ESM). Next resolves via
  `webpack.resolve.extensionAlias` in `next.config.mjs`.
- **Tests**: colocated `*.test.ts(x)`, vitest. AI adapters/config are tested with mocked
  clients/runners and temp config files — no real API/CLI calls in the suite.

## AI layer (interchangeable providers)

All providers implement the `AIPort` contract behind the `ResolutionLadder` (exact-cache → llm).
Shared logic is in `apps/web/src/server/ai/grounded-llm-port.ts` (`GroundedLLMPort`, Template
Method): builds the prompt, validates against contracts, enforces grounding, and **falls back to
the deterministic `TemplateAIPort` on any failure**. Each provider only implements `complete()`:

- `claude-ai-port.ts` — Anthropic API (`@anthropic-ai/sdk`, `claude-opus-4-8`). Metered key.
- `openai-ai-port.ts` — OpenAI Chat Completions (JSON mode).
- `gemini-ai-port.ts` — Google Gemini (`@google/genai`).
- `claude-code-ai-port.ts` — the logged-in `claude` CLI (subscription). **Local/dev only** (spawns
  a process per task).
- `template-ai-port.ts` — deterministic, always-grounded fallback.

Selection: `delegateFor(cfg)` in `warm-intelligence.ts` builds the delegate from a
`ResolvedAiConfig`; `aiPort()` feeds it `resolveAiConfig()`. Config source of truth is
`ai-config-store.ts`: a **gitignored, server-only, 0600 file `.pma/ai-config.json`** (override
`PMA_AI_CONFIG_PATH`), layered over env vars (`PMA_AI_PROVIDER`, `ANTHROPIC_API_KEY`,
`OPENAI_API_KEY`, `GEMINI_API_KEY`/`GOOGLE_API_KEY`) for back-compat. Keys are **never** stored in
SQLite and **never** sent back to the browser (the settings view exposes presence + source only).

**Configure it in-app**: the `/settings` page (nav → "AI Settings") picks provider + model and sets
keys (server action `app/settings/actions.ts`, write-only for keys). Or set env vars. Then rerun
`warm` to light up the real `llm` tier on the Intelligence page.

## Current state (2026-07-09, HEAD `81f375b`)

First build (4 phases) + hardening merged; then the AI layer was made real and interchangeable:
- `43db2b3` live Claude adapter, `d66454f` interchangeable providers + Claude Code, `81f375b`
  in-app configuration (OpenAI + Gemini adapters + `/settings` page).
- Gate green at **121 tests**. This dev env has **no API keys**; `claude` CLI 2.1.204 is installed.
- Verified live via Playwright: `/settings` renders, saving persists to the 0600 file, secrets
  never appear in page HTML.

### Deferred / candidate next steps

- **Copilot adapter** — deferred (no public BYO-key chat API). Drop-in = one more `GroundedLLMPort`
  subclass + a `delegateFor` case, once the backend (GitHub Models / Azure OpenAI) is chosen.
- **Real credential storage** — keys are currently plaintext-on-disk (0600, gitignored), a dev
  choice. A real OS keychain / encryption is the shipping path (also gates Electron/Tauri packaging).
- Semantic-cache + learned/shadow resolution tiers (only exact-cache + llm exist).
- Live vendor OAuth/APIs (all ingestion is currently a read-only fake).
- Minor: Prisma String-enum fields lack value-set comments; indexes only on `WorkItem`.

The 5 final-review architectural invariants above all PASS. When you finish a unit of work, run the
gate, commit on `main`, and update this **Current state** section.
