# PM Artifactor — First Build Design Spec

**Date:** 2026-07-07
**Status:** Approved (design), pending spec review
**Source package:** `../Development Package/` (CLAUDE.md, ROADMAP.md, docs/01–08, contracts/, prisma/schema.prisma, poc/PM_Artifactor_POC.html)
**Target repo:** `/home/jfox/Projects/pm-artifactor/pm-artifactor` (git, `main`)

---

## 1. Purpose & the honest scope decision

PM Artifactor is a **local-first, single-user Portfolio/Program/Project management toolkit with a PM copilot**, specified across an 8-phase roadmap. The full package is an enterprise-grade platform (pure hexagonal core, methodology-as-data, a ~40-entity polymorphic canonical model, six read-only integration ports, a deterministic-first intelligence engine, a grounded/typed AI layer with a resolution ladder + cache, a learning layer, and a 14-page desktop UI). Building all eight phases to production depth in one pass is not realistic and, for live OAuth / a trained learning layer / the real LLM tail, not even meaningful without credentials and an accumulated corpus.

This spec therefore covers a **decomposed first build**: a *real, runnable local-first app that presents the entire 14-page POC surface*, backed by a *genuine domain core + deterministic intelligence engine + SQLite persistence*, with the *integration, generative-LLM, and learning edges implemented as real ports with stub adapters* that later phases fill in without changing callers.

This corresponds to **Roadmap Phases 0, 1, 2 + the deterministic slice of Phase 4 + the full UI surface**.

### Approved decisions

| Decision | Choice |
|---|---|
| **Build scope** | Foundation + full UI surface (real app matching the POC; edges stubbed behind ports) |
| **Desktop shell** | Run as a web app now (`pnpm dev` → browser, SQLite file); Electron/Tauri wrapper is a later isolated step |
| **AI provider** | Deterministic engine + a template-composed **stub AIPort** satisfying the contracts (no API key); real Claude adapter swaps in later behind the same port |

---

## 2. Non-negotiable principles (inherited from the package CLAUDE.md)

These are acceptance criteria, not aspirations:

1. **Hexagonal dependency rule** — `packages/core` has ZERO runtime deps on Prisma/Next/vendor SDKs; a violating import fails the build (enforced physically).
2. **Methodology is data, not code** — types/lifecycles/workflows/gates are config rows resolved by a `MethodologyProfile` (Abstract Factory). No hard-coded Scrum/Waterfall branches.
3. **Read-only first** — every integration ingests read-only. No write-back to any source of record. The AI never writes externally; it drafts in-app.
4. **Compute first, generate only when you must** — deterministic core implemented before any LLM call.
5. **AI is grounded and typed** — every AI I/O validates against `contracts/`; outputs carry `grounded_on` entity IDs; empty grounding = hallucination = discarded.
6. **Suggestions, not actions** — the copilot proposes; a human disposes. Anything touching a person/external system is a draft with an approve step.
7. **People-data red lines** — no secret scoring, no leaderboards, no stack-ranking. Velocity is a planning aid, never a performance verdict. Notes are private, behavioral, evidence-linked, with export/delete honored.
8. **Don't over-engineer** — a pattern answers a named friction. Visitor stays rejected. The learned layer is NOT built before a corpus justifies it.

---

## 3. Monorepo architecture

pnpm workspace, TypeScript project references, laid out per the prescribed module layout:

```
pm-artifactor/
  packages/
    core/                       # DOMAIN + PORTS — pure TS, zero infra deps
      src/domain/
        hierarchy/              # Organization, Portfolio, Program, Project aggregates + rollups
        workitem/               # WorkItem aggregate (Composite) + tree rollups
        methodology/            # MethodologyProfile (Abstract Factory) + registry
        metrics/                # MetricsStrategy interface + Velocity / EarnedValue impls
        scheduling/             # SchedulingStrategy fn-types + SprintCapacity / CriticalPath
        workflow/               # WorkflowEngine (State-as-data)
        prioritization/         # PrioritizationStrategy (WSJF, RICE)
        intelligence/           # deterministic analyzers: health, velocity/capacity, DORA,
                                #   Specification rules, daily-brief Builder; emits FeatureRecords
        events/                 # DomainEvent definitions
      src/ports/                # Repository ports, 6 integration ports, AIPort, EventBus,
                                #   OutboxPort, KeychainPort, ClockPort
    contracts/                  # 4 JSON schemas → TS types + Zod validators + re-exported schemas
    application/                # use cases: command/query handlers, event dispatcher,
                                #   composition root (framework-free wiring)
  apps/
    web/                        # Next.js App Router renderer + server route handlers (the host)
      src/adapters/
        persistence/            # Prisma repositories (implement Repository ports)
        ingestion/              # stub read-only ingestion adapters (fake calendar + work-tracker)
        ai/                     # stub AIPort (template prose) + resolution-ladder Proxy
        messaging/              # in-process synchronous EventBus + SQLite outbox dispatcher
        identity/               # manual/seed IdentityDirectory adapter
        keychain/               # stub KeychainPort (env/file) behind the real interface
      src/app/                  # the 14 pages (App Router routes)
      src/ui/                   # shared components matching the POC design language
  db/
    prisma/schema.prisma        # extended from the starter schema
    prisma/seed.ts              # methodology bundles + POC-mirroring data
  docs/superpowers/specs/       # this spec + the implementation plan
  .dependency-cruiser.cjs       # physical enforcement of the dependency rule
```

**Hosting note.** The `application` package is framework-free and exposes a composition root. For web-now, Next.js **server route handlers / server components** import that composition root and call use cases; Prisma + stub adapters are wired there. When the Electron/Tauri shell arrives, the same composition root is hosted in the desktop main process (optionally under NestJS as CLAUDE.md describes) — no change to `core`, `contracts`, `application`, or the UI's data contracts.

**Toolchain.** Node 24, pnpm 10, TypeScript 5, Next.js (App Router) + React, Prisma + SQLite, Zod, Vitest, dependency-cruiser. Fonts: Public Sans + IBM Plex Mono.

---

## 4. Domain core & the pattern register

Implemented patterns (from docs/02 §3–4), each answering its named friction:

| # | Pattern | Applied to | Notes |
|---|---|---|---|
| D1 | **Abstract Factory** | `MethodologyProfile` | Scrum + Waterfall now; SAFe + DMAIC seeded as data. Reads config rows; wires behavioral strategies. Resolved via a registry Factory (D10), never a switch. |
| D2 | **Strategy** | `MetricsStrategy` (Velocity / EarnedValue), `SchedulingStrategy` (SprintCapacity / CriticalPath) | Metrics = multi-method interface; scheduling = fn-type. |
| D3 | **State-as-data** | `WorkflowEngine` | Interprets WorkflowState + StateTransition rows; returns new state + emitted events; writes status-history. Gates = transitions with an approval guard. |
| D5+D6 | **Observer + Command/outbox** | domain events | In-process **synchronous** dispatch for the single-user tier; SQLite outbox table for restart durability. |
| D7 | **Composite** | WorkItem tree | Adjacency list; rollups (estimate/status/cost) computed over the tree; cached rollups invalidated by the same events. |
| D8 | **Strategy over Composite** | tree operations | **Visitor deliberately rejected** — work-item types are configurable data. |
| D11 | **Strategy** | `PrioritizationStrategy` (WSJF, RICE) | Every score stored with component breakdown + rationale. |
| D12 | **Specification → Builder** | daily command center | Rule objects emit `SuggestedAction`; Builder assembles the ranked brief. |
| D13 | **Adapter + Command + contracts** | `AIPort` | Typed, grounded, logged. |
| D15 | **Strategy + cached rollup** | per-altitude health composite | Named, traceable drivers. |
| D16/D17/D18 | **Chain of Responsibility / caching Proxy / CachePolicy** | resolution ladder | deterministic → exact cache → (LLM-stub). Semantic/learned tiers deferred. |
| D19 | **Observer + `grounded_on` fingerprint** | cache invalidation | Field-level where the typed input makes fields knowable; TTL backstop. |

`MethodologyProfile` interface (illustrative):

```ts
export interface MethodologyProfile {
  readonly key: MethodologyKey;            // SCRUM | SAFE | WATERFALL | DMAIC
  workItemTypes(): WorkItemTypeSet;
  workflow(): WorkflowDefinition;
  lifecycle(): LifecycleDefinition;
  metrics(): MetricsStrategy;
  scheduler(): SchedulingStrategy;
}
```

The domain is written against **in-memory port fakes** and unit-tested with no DB or vendor present — the payoff of the dependency direction and the proof that the seams hold.

---

## 5. Canonical data model (Prisma + SQLite)

Extend the starter `schema.prisma` to cover exactly what the 14 pages need honestly. SQLite conventions: enums modeled as `String` with a documented value set; JSON stored as text. The same schema targets Postgres later by switching the datasource + promoting to native enum/jsonb.

**Included entity groups:**

- **Spine:** Organization, Portfolio, StrategicObjective, PortfolioObjective, Program, Benefit, Project, Phase, Gate, Milestone, Deliverable.
- **Work execution (polymorphic core):** WorkItem (self-ref tree), WorkItemType, Cadence, Backlog, BacklogItem, Dependency.
- **Methodology config:** Methodology, Lifecycle, LifecyclePhase, WorkflowDefinition, WorkflowState, StateTransition.
- **People & governance:** Person, Team, RoleAssignment, RaidItem, Decision.
- **Financials & resources:** Budget, CostEntry, Allocation, Capacity, Baseline.
- **Measurement:** Objective, KeyResult, Kpi.
- **Release & deployment:** Release, ReleaseScope, Environment, Deployment (self-ref `rollbackOf`), ChangelogEntry, ReleaseNote, NoteRendition, PublishRecord, PublishTarget.
- **Stakeholders:** Stakeholder, StakeholderInterest (polymorphic owner), Communication.
- **Teammate notes (docs/05, PM-owned private layer):** TeammateNote (with `sensitive` flag), StrengthNote, GrowthNote (`howToSupport`), MotivationNote, GoalNote, SkillObservation (proficiency + interest), VelocityInsight (dimensioned + caveat), OneOnOne, ContextHint.
- **Copilot & comms:** SuggestedAction, Reminder, DailyBrief, EmailMessage, EmailDigest, EmailThreadLink, CalendarEvent.
- **Integration (read-only federation):** ExternalSystem, SyncConnection, ExternalLink, FieldMapping, SyncEvent, IngestionSnapshot (staging + provenance).
- **Intelligence / AI store (from contracts):** FeatureRecord, AiTask, AiResultCache, AiCacheDep, AiFeedback. (LearnedModel, CachePolicy, ShadowEvaluation tables MAY be created empty for forward-compat but are not exercised.)

**Deferred entities** (no page depends on them now): FundingSource, InvestmentTheme, ValueStream, ChangeRequest, Endorsement. Easy to add later.

**Seed data** = the four methodology bundles (Scrum, SAFe, Waterfall, DMAIC as config rows) **plus** rich POC-mirroring content: the Digital Banking portfolio; Payments Modernization (SAFe) + Customer Experience (Hybrid) programs; Mobile Checkout (Scrum) / Ledger Migration (Waterfall) / Fraud Signals v2 (Kanban) projects; team of four (Dana/Sam/Lin/Theo) with skills and the 122%-overallocation case for Sam; four stakeholders; the five-item backlog; two releases; DORA-populating deployments; sample emails and calendar events.

---

## 6. Deterministic intelligence engine + contracts

**Everything computable is computed with no LLM.** Analyzers live in `packages/core/domain/intelligence`, are pure, and each emits a `FeatureRecord` as a side effect:

- **Prioritization** — WSJF = (BizValue + TimeCriticality + RiskReduction) ÷ JobSize; RICE = (Reach × Impact × Confidence) ÷ Effort. Component breakdown + rationale stored (`PrioritizationScore`, polymorphic owner). The Prioritize page recomputes live via the domain strategy — it disagreement-flags WSJF vs RICE.
- **Health composites** — per-altitude Strategy decomposing schedule variance, cost variance, scope creep, RAID exposure, dependency risk, benefit confidence, team-health; each card answers "why this score?" and proposes an action.
- **Velocity & capacity** — cross-tool aware (F1): a person's true load = union across tools → surfaces the 122% case a single tool hides. Velocity dimensioned by complexity/effort/risk band, never a bare number, never a verdict.
- **Sprint/flow** — burndown, scope-change vs sprint baseline, cycle time / WIP / aging.
- **DORA** — deploy frequency, lead time, change-failure rate (deployments with `rollbackOf`), MTTR — from the release/deployment model.
- **Specification rules → SuggestedAction** — the seven rule types: sprint-end check-in, complex-work check-in, stakeholder-update-due, 1:1-overdue, gate/decision deadline, deployment-attention, meeting-prep. A **Builder** assembles surviving actions into a ranked `DailyBrief`.

**Contracts.** `packages/contracts` provides TS types + Zod validators for all four schemas (ingestion, ai-tasks, caching, learning). Rules honored: `mode`/`is_draft` as literals; `grounded_on` min 1; `GroundedNumber` for AI-emitted numbers; `FeatureValue` as a discriminated union on `kind`; `email.digest` input references the `EmailMessageEnvelope`. Every AIPort call validates input and output against these; an output with empty `grounded_on` is discarded.

---

## 7. Ports & stub adapters (real seams, honest fills)

- **Repository ports** → Prisma adapters over SQLite.
- **EventBus + OutboxPort** → in-process synchronous dispatcher + SQLite outbox table; a status change fans out to a rollup handler + an audit handler locally (proves Observer/Command without a broker).
- **Read-only ingestion** → stub adapters for a fake **calendar** and a fake **work-tracker** that actually walk the pull → `IngestionSnapshot` (provenance) → normalize-into-canonical path, proving the Phase-3 architecture without live APIs. The Connections page reflects these as read-only sources.
- **AIPort** → **stub** that satisfies the ai-tasks contracts by composing grounded, template-based prose from real inputs (e.g. the daily brief assembled from the actual `SuggestedAction`s; a stakeholder draft from the real interest-set items). Marked `is_draft`, carries `grounded_on`. Wrapped by the **resolution-ladder Proxy** (deterministic → exact cache → stub), so the Intelligence page shows **real** tier distribution and tokens-saved from actually-logged `AiTask` / `AiResultCache` rows.
- **KeychainPort** → stub (env/file) behind the real interface; the real OS keychain is a later shell concern.

---

## 8. UI — all 14 POC pages

Next.js App Router implementing every POC view in the exact design language (teal `#0f766e`/`#0d9488`/`#14b8a6`, `--deep #0b3d39` sidebar, Public Sans + IBM Plex Mono, card-based, the "Read-only · offline-ready" chrome and local/encrypted footer):

`setup` (first-run), `today` (copilot), `inbox` (email digest), `portfolio`, `programs`, `projects`, `project` detail (forecast / sprint / health drivers / baseline variance), `prioritize` (WSJF/RICE, live), `releases` (Release Command Center), `dora` (Deployment Health), `team`, `person` detail (strengths / growth / skills / where-they-flow + note modal), `stakeholders` (power-interest grid), `intel` (System Intelligence — the resolution ladder + learning maturity), `connections`, `vault`.

Pages read from real application queries. People views enforce the red lines (growth-framed, no ranking). The note modal writes a real `TeammateNote` (shareable vs private-scratch, evidence-linked).

---

## 9. Testing & verification

- **Vitest** across `core` (domain vs in-memory fakes), `application` (use cases), `contracts` (schema round-trips + `grounded_on` rejection).
- **dependency-cruiser** test asserting `core` imports nothing infra.
- **Definition of done** per unit: core stays pure; deterministic path before any LLM; read-only posture; people red lines; unit + feature tests green; a short change report; nothing auto-committed beyond what the user approves.
- Final step: run `pnpm dev`, click through all 14 pages, confirm the deterministic outputs (WSJF/RICE ranking, health drivers, the 122% capacity flag, DORA, the daily brief) render from real data — evidence before claiming done.

---

## 10. Explicitly deferred (the honest cut)

Live vendor OAuth/APIs (Jira/GitHub/Azure/etc.); the real Claude generative tail; the semantic-cache tier; the learned/training/shadow layer (registry tables may exist, empty); Electron/Tauri packaging + real OS keychain; **any** write-back to a source of record (permanently out by principle). Each is isolated behind an existing port, so filling it in is additive.

---

## 11. Build order within this deliverable

1. **Phase 0 — pure core + fakes.** Monorepo + dependency-cruiser rule; WorkItem Composite; `MethodologyProfile` (Scrum + Waterfall); `WorkflowEngine`; domain events; all port interfaces; unit tests vs fakes.
2. **Phase 1 — persistence + seed.** Extended Prisma schema → SQLite; repository adapters; seed the four methodology bundles + POC data; in-process EventBus + outbox.
3. **Phase 2 — deterministic engine + contracts.** WSJF/RICE, health, velocity/capacity, sprint/flow, DORA; `contracts` types + validators; Specification rules → `SuggestedAction` → Builder daily brief; FeatureRecords.
4. **Phase 3 — UI.** Next.js app, all 14 pages, wired to application queries, POC design language.
5. **Phase 4 — stub adapters + ladder.** Read-only ingestion stubs (calendar + work-tracker) with IngestionSnapshot; stub AIPort; resolution-ladder Proxy + AiTask/cache logging; Intelligence page fed by real logs.
6. **Verify** end-to-end.

Each step is independently testable because the dependency direction lets a fake stand in for anything not yet built.
