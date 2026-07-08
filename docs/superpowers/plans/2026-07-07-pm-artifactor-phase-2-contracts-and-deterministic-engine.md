# PM Artifactor — Phase 2: Contracts + Deterministic Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Depends on Phase 0 (`@pma/core`) and Phase 1 (`@pma/db`) being green.

**Goal:** Build the typed AI boundary (`@pma/contracts`: Zod validators + TS types for the four JSON schemas, with grounding enforced) and the pure deterministic intelligence engine inside `@pma/core` (prioritization, health, velocity/capacity, sprint/flow, DORA, the seven Specification rules, and the daily-brief Builder) — every analyzer a pure function returning its result plus `FeatureRecord`s, fully unit-tested against in-memory fixtures with no DB or vendor present.

**Architecture:** `@pma/contracts` is a standalone pure package (depends only on `zod`) that mirrors `contracts/*.schema.json`. The deterministic engine lives in `@pma/core` under `domain/prioritization` and `domain/intelligence`; it stays dependency-free (no zod, no prisma) — analyzers take plain input DTOs and return `{ result, features }`. Reads that feed these analyzers from Prisma are wired later in `apps/web` (the composition root), so Phase 2 needs no repository ports beyond Phase 0's.

**Tech Stack:** TypeScript 5 (strict), Zod 3, Vitest, `@pma/core` (workspace).

## Global Constraints

- **Core stays pure:** `@pma/core` gains NO dependency on `zod`, `@pma/contracts`, Prisma, or any infra. The dependency-cruiser rule from Phase 0 must stay green. Deterministic analyzers are pure functions — no `Date.now()` inside them; the current time is passed in.
- **Deterministic-first:** every analyzer in this phase is pure computation — no LLM, no I/O. Each returns its result AND the `FeatureRecord`s it produced (the caller persists them later).
- **Grounding enforced (contracts):** every AI-task output schema requires `grounded_on` with `minItems: 1`; an output with empty grounding must fail validation. AI-emitted numbers use `GroundedNumber` (`value` + `source: derived|suggested`). `is_draft` is `z.literal(true)` where the schema says `const true`.
- **People red lines:** velocity/thrive analyzers never emit person-vs-person ranking or an ordered leaderboard; velocity carries a caveat and is dimensioned; capacity comparison is team-level aggregate only.
- **Formulas (verbatim, matching the POC):**
  - WSJF = (userBusinessValue + timeCriticality + riskReduction) ÷ jobSize, where jobSize = the item's estimate. Higher ranks first.
  - RICE = (reach × impact × (confidence ÷ 100)) ÷ effort. Higher ranks first.
  - DORA change-failure-rate = prod deployments with a rollback ÷ total prod deployments.
- **Source of truth for schemas:** the four JSON schemas copied into `packages/contracts/schemas/` (Task 1) are authoritative; Zod validators must match them. Read the JSON schema file for a type before writing its validator.
- **FeatureValue** is a discriminated union on `kind`: `number | band | category | trend | vector`.
- **Testing:** Vitest; analyzers tested with in-memory fixtures; contracts tested with valid + invalid round-trips (invalid must throw). Full gate: `pnpm -w run test:all` green.

---

### Task 1: `@pma/contracts` scaffold + copy source schemas + shared primitives

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/schemas/{ingestion,ai-tasks,caching,learning}.schema.json` (copied verbatim from the Development Package)
- Create: `packages/contracts/src/primitives.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/primitives.test.ts`

**Interfaces:**
- Produces: workspace package `@pma/contracts` depending on `zod`. Shared Zod schemas + inferred types:
  - `GroundedNumber` = `z.object({ value: z.number(), source: z.enum(["derived","suggested"]), from_field: z.string().nullable().optional() })`
  - `EntityId` = `z.string()`
  - `OutputBase` = `z.object({ grounded_on: z.array(EntityId).min(1), confidence: z.number().min(0).max(1) })`
  - `CanonicalRef` = `z.object({ type: z.enum([...10 types]), id: z.string() })`
  - `Provenance` = `z.object({ source: z.enum([...]), external_id: z.string(), external_url: z.string().optional(), pulled_at: z.string(), mode: z.literal("read_only"), raw: z.record(z.string(), z.unknown()).optional() })`

- [ ] **Step 1: Copy the four JSON schemas into the package**

Run:
```bash
mkdir -p packages/contracts/schemas
cp "../Development Package/ppm-toolkit-dev-package/ppm-toolkit-dev-package/contracts/ingestion.schema.json" packages/contracts/schemas/
cp "../Development Package/ppm-toolkit-dev-package/ppm-toolkit-dev-package/contracts/ai-tasks.schema.json" packages/contracts/schemas/
cp "../Development Package/ppm-toolkit-dev-package/ppm-toolkit-dev-package/contracts/caching.schema.json" packages/contracts/schemas/
cp "../Development Package/ppm-toolkit-dev-package/ppm-toolkit-dev-package/contracts/learning.schema.json" packages/contracts/schemas/
```
Expected: four files present under `packages/contracts/schemas/`. Read them — they are the authoritative field definitions for Tasks 2–4.

- [ ] **Step 2: Create `packages/contracts/package.json`**

```json
{
  "name": "@pma/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "zod": "^3.23.0" }
}
```

- [ ] **Step 3: Create `packages/contracts/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `packages/contracts/src/primitives.ts`**

```ts
import { z } from "zod";

export const CANONICAL_ENTITY_TYPES = [
  "portfolio", "program", "project", "work_item", "release",
  "deployment", "stakeholder", "person", "benefit", "objective",
] as const;

export const CACHE_ENTITY_TYPES = [...CANONICAL_ENTITY_TYPES, "cadence"] as const;

export const INGESTION_SOURCES = [
  "jira", "asana", "monday", "github", "bitbucket", "azure_devops",
  "google_calendar", "outlook_calendar", "gmail", "outlook_mail",
] as const;

export const GroundedNumber = z.object({
  value: z.number(),
  source: z.enum(["derived", "suggested"]),
  from_field: z.string().nullable().optional(),
});
export type GroundedNumber = z.infer<typeof GroundedNumber>;

export const EntityId = z.string();

export const OutputBase = z.object({
  grounded_on: z.array(EntityId).min(1),
  confidence: z.number().min(0).max(1),
});
export type OutputBase = z.infer<typeof OutputBase>;

export const CanonicalRef = z.object({
  type: z.enum(CANONICAL_ENTITY_TYPES),
  id: z.string(),
});
export type CanonicalRef = z.infer<typeof CanonicalRef>;

export const Provenance = z.object({
  source: z.enum(INGESTION_SOURCES),
  external_id: z.string(),
  external_url: z.string().optional(),
  pulled_at: z.string(),
  mode: z.literal("read_only"),
  raw: z.record(z.string(), z.unknown()).optional(),
});
export type Provenance = z.infer<typeof Provenance>;
```

- [ ] **Step 5: Create `packages/contracts/src/index.ts`**

```ts
export * from "./primitives.js";
```

- [ ] **Step 6: Write the test `packages/contracts/src/primitives.test.ts`**

```ts
import { expect, test } from "vitest";
import { GroundedNumber, OutputBase, Provenance } from "./index.js";

test("GroundedNumber requires a source enum", () => {
  expect(GroundedNumber.safeParse({ value: 3, source: "derived" }).success).toBe(true);
  expect(GroundedNumber.safeParse({ value: 3, source: "guessed" }).success).toBe(false);
});

test("OutputBase rejects empty grounding (hallucination)", () => {
  expect(OutputBase.safeParse({ grounded_on: ["e1"], confidence: 0.9 }).success).toBe(true);
  expect(OutputBase.safeParse({ grounded_on: [], confidence: 0.9 }).success).toBe(false);
  expect(OutputBase.safeParse({ grounded_on: ["e1"], confidence: 1.4 }).success).toBe(false);
});

test("Provenance pins mode to read_only", () => {
  const base = { source: "jira", external_id: "X-1", pulled_at: "2026-03-16T00:00:00Z" };
  expect(Provenance.safeParse({ ...base, mode: "read_only" }).success).toBe(true);
  expect(Provenance.safeParse({ ...base, mode: "write" }).success).toBe(false);
});
```

- [ ] **Step 7: Install, run the test, verify**

Run: `pnpm install && pnpm -w test:run packages/contracts/src/primitives`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add packages/contracts pnpm-lock.yaml
git commit -m "feat(contracts): scaffold @pma/contracts + source schemas + shared primitives"
```

---

### Task 2: Ingestion envelope validators

**Files:**
- Create: `packages/contracts/src/ingestion.ts`
- Create: `packages/contracts/src/ingestion.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: `Provenance`, `CanonicalRef` (Task 1). Read `packages/contracts/schemas/ingestion.schema.json` for exact fields.
- Produces (Zod schema + inferred type for each): `WorkItemEnvelope`, `PersonEnvelope`, `SprintEnvelope`, `DeploymentEnvelope`, `CalendarEventEnvelope`, `EmailMessageEnvelope`, and `IngestionEnvelope` = `z.union([...])`.

- [ ] **Step 1: Write the failing test `packages/contracts/src/ingestion.test.ts`**

```ts
import { expect, test } from "vitest";
import { WorkItemEnvelope, DeploymentEnvelope, EmailMessageEnvelope } from "./index.js";

const prov = { source: "jira", external_id: "PMA-1", pulled_at: "2026-03-16T00:00:00Z", mode: "read_only" };

test("WorkItemEnvelope accepts a valid canonical work item", () => {
  const wi = {
    provenance: prov, title: "Apple Pay", canonical_type: "Story", status_category: "in_progress",
    hierarchy_level: 2, estimate: 5, estimate_unit: "points", complexity_band: "high", labels: [], links: [],
  };
  expect(WorkItemEnvelope.safeParse(wi).success).toBe(true);
});

test("WorkItemEnvelope rejects an unknown status_category", () => {
  const wi = { provenance: prov, title: "x", canonical_type: "Story", status_category: "wip" };
  expect(WorkItemEnvelope.safeParse(wi).success).toBe(false);
});

test("DeploymentEnvelope requires environment/status/started_at", () => {
  const ok = { provenance: prov, environment: "prod", status: "success", started_at: "2026-03-16T00:00:00Z" };
  expect(DeploymentEnvelope.safeParse(ok).success).toBe(true);
  expect(DeploymentEnvelope.safeParse({ provenance: prov, environment: "prod" }).success).toBe(false);
});

test("EmailMessageEnvelope requires subject/from_email/received_at/snippet", () => {
  const ok = { provenance: prov, subject: "Ledger", from_email: "a@b.com", received_at: "2026-03-16T00:00:00Z", snippet: "hi" };
  expect(EmailMessageEnvelope.safeParse(ok).success).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/contracts/src/ingestion`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/contracts/src/ingestion.ts`** (fields per `schemas/ingestion.schema.json`)

```ts
import { z } from "zod";
import { Provenance, CanonicalRef } from "./primitives.js";

export const WorkItemEnvelope = z.object({
  provenance: Provenance,
  title: z.string(),
  canonical_type: z.string(),
  status_category: z.enum(["todo", "in_progress", "done", "blocked"]),
  hierarchy_level: z.number().int().min(1).optional(),
  parent_external_id: z.string().nullable().optional(),
  status_raw: z.string().optional(),
  assignee_email: z.string().email().nullable().optional(),
  estimate: z.number().nullable().optional(),
  estimate_unit: z.enum(["points", "hours", "days", "tshirt"]).nullable().optional(),
  complexity_band: z.enum(["low", "med", "high"]).nullable().optional(),
  risk_band: z.enum(["low", "med", "high"]).nullable().optional(),
  labels: z.array(z.string()).optional(),
  sprint_external_id: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  last_status_change_at: z.string().nullable().optional(),
  links: z.array(CanonicalRef).optional(),
});
export type WorkItemEnvelope = z.infer<typeof WorkItemEnvelope>;

export const PersonEnvelope = z.object({
  provenance: Provenance,
  name: z.string(),
  email: z.string().email(),
  role: z.string().nullable().optional(),
  team_external_id: z.string().nullable().optional(),
  active: z.boolean().optional(),
});
export type PersonEnvelope = z.infer<typeof PersonEnvelope>;

export const SprintEnvelope = z.object({
  provenance: Provenance,
  name: z.string(),
  kind: z.enum(["sprint", "iteration", "pi", "phase_window", "release"]),
  start_date: z.string(),
  end_date: z.string(),
  goal: z.string().nullable().optional(),
  state: z.enum(["future", "active", "closed"]).optional(),
  committed_points: z.number().nullable().optional(),
});
export type SprintEnvelope = z.infer<typeof SprintEnvelope>;

export const DeploymentEnvelope = z.object({
  provenance: Provenance,
  environment: z.enum(["dev", "staging", "prod", "other"]),
  status: z.enum(["running", "success", "failed", "rolled_back"]),
  started_at: z.string(),
  build_ref: z.string().nullable().optional(),
  commit_sha: z.string().nullable().optional(),
  is_rollback: z.boolean().optional(),
  finished_at: z.string().nullable().optional(),
  pr_external_ids: z.array(z.string()).optional(),
  work_item_links: z.array(CanonicalRef).optional(),
});
export type DeploymentEnvelope = z.infer<typeof DeploymentEnvelope>;

export const CalendarEventEnvelope = z.object({
  provenance: Provenance,
  title: z.string(),
  start: z.string(),
  end: z.string(),
  attendee_emails: z.array(z.string().email()).optional(),
  is_free_time: z.boolean().optional(),
  links: z.array(CanonicalRef).optional(),
});
export type CalendarEventEnvelope = z.infer<typeof CalendarEventEnvelope>;

export const EmailMessageEnvelope = z.object({
  provenance: Provenance,
  thread_id: z.string().optional(),
  subject: z.string(),
  from_email: z.string().email(),
  to_emails: z.array(z.string().email()).optional(),
  received_at: z.string(),
  snippet: z.string(),
  is_unread: z.boolean().optional(),
  links: z.array(CanonicalRef).optional(),
});
export type EmailMessageEnvelope = z.infer<typeof EmailMessageEnvelope>;

export const IngestionEnvelope = z.union([
  WorkItemEnvelope, PersonEnvelope, SprintEnvelope,
  DeploymentEnvelope, CalendarEventEnvelope, EmailMessageEnvelope,
]);
export type IngestionEnvelope = z.infer<typeof IngestionEnvelope>;
```

- [ ] **Step 4: Export — append to `packages/contracts/src/index.ts`**

```ts
export * from "./ingestion.js";
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -w test:run packages/contracts/src/ingestion`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src
git commit -m "feat(contracts): add ingestion envelope validators"
```

---

### Task 3: AI-task input/output validators (grounding enforced)

**Files:**
- Create: `packages/contracts/src/ai-tasks.ts`
- Create: `packages/contracts/src/ai-tasks.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: `GroundedNumber`, `EntityId`, `OutputBase` (Task 1), `EmailMessageEnvelope` (Task 2). Read `packages/contracts/schemas/ai-tasks.schema.json`.
- Produces named input/output pairs for the six tasks, each output extending `OutputBase` (so `grounded_on.min(1)` is enforced):
  - `PrioritizationSuggestInput/Output`, `DailyBriefComposeInput/Output`, `HealthExplainInput/Output`, `TeammateInsightInput/Output`, `EmailDigestInput/Output`, `StakeholderUpdateInput/Output`.
  - A registry: `AI_TASK_OUTPUT = { "prioritization.suggest": ..., ... }` mapping task key → output schema.

- [ ] **Step 1: Write the failing test `packages/contracts/src/ai-tasks.test.ts`**

```ts
import { expect, test } from "vitest";
import {
  DailyBriefComposeOutput, StakeholderUpdateOutput, HealthExplainOutput,
} from "./index.js";

test("daily-brief output requires non-empty grounded_on", () => {
  const ok = { headline: "Busy day", ranked_action_ids: ["a1"], tips: ["breathe"], grounded_on: ["a1"], confidence: 0.8 };
  expect(DailyBriefComposeOutput.safeParse(ok).success).toBe(true);
  expect(DailyBriefComposeOutput.safeParse({ ...ok, grounded_on: [] }).success).toBe(false);
});

test("stakeholder update output pins is_draft to true", () => {
  const base = { draft: "Hello Priya", grounded_on: ["ledger"], confidence: 0.7 };
  expect(StakeholderUpdateOutput.safeParse({ ...base, is_draft: true }).success).toBe(true);
  expect(StakeholderUpdateOutput.safeParse({ ...base, is_draft: false }).success).toBe(false);
});

test("health explain output requires summary/primary_driver/suggested_action", () => {
  const ok = { summary: "Schedule slipping", primary_driver: "schedule_variance", suggested_action: "rebalance", grounded_on: ["checkout"], confidence: 0.9 };
  expect(HealthExplainOutput.safeParse(ok).success).toBe(true);
  expect(HealthExplainOutput.safeParse({ ...ok, summary: undefined }).success).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/contracts/src/ai-tasks`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/contracts/src/ai-tasks.ts`** (per `schemas/ai-tasks.schema.json`)

```ts
import { z } from "zod";
import { GroundedNumber, EntityId, OutputBase } from "./primitives.js";
import { EmailMessageEnvelope } from "./ingestion.js";

// prioritization.suggest
export const PrioritizationSuggestInput = z.object({
  model: z.enum(["WSJF", "RICE"]),
  items: z.array(z.object({
    id: z.string(),
    title: z.string(),
    estimate: z.number().nullable().optional(),
    linked_benefits: z.array(z.string()).optional(),
    linked_risks: z.array(z.string()).optional(),
    deadline: z.string().nullable().optional(),
    reach_estimate: z.number().nullable().optional(),
  })),
});
export const PrioritizationSuggestOutput = OutputBase.extend({
  scores: z.array(z.object({
    id: z.string(),
    components: z.record(z.string(), GroundedNumber),
    rationale: z.string(),
  })),
});

// daily-brief.compose
export const DailyBriefComposeInput = z.object({
  date: z.string(),
  manager_name: z.string().optional(),
  suggested_actions: z.array(z.object({
    id: z.string(),
    type: z.enum([
      "sprint_end", "complex_check_in", "stakeholder_update_due",
      "one_on_one_overdue", "gate_deadline", "deploy_attention", "meeting_prep",
    ]),
    urgency: z.enum(["low", "med", "high"]),
    text: z.string(),
    refs: z.array(EntityId),
  })),
  calendar: z.array(z.object({}).passthrough()).optional(),
});
export const DailyBriefComposeOutput = OutputBase.extend({
  headline: z.string(),
  ranked_action_ids: z.array(EntityId),
  tips: z.array(z.string()),
});

// health.explain
export const HealthExplainInput = z.object({
  entity: z.object({ id: z.string(), type: z.enum(["portfolio", "program", "project"]), name: z.string() }),
  composite: z.number().min(0).max(100),
  drivers: z.array(z.object({
    name: z.enum([
      "schedule_variance", "cost_variance", "scope_creep", "raid_exposure",
      "dependency_risk", "benefit_confidence", "team_health",
    ]),
    value: z.number(),
    trend: z.enum(["improving", "flat", "worsening"]),
  })),
});
export const HealthExplainOutput = OutputBase.extend({
  summary: z.string(),
  primary_driver: z.string(),
  suggested_action: z.string(),
});

// teammate.insight (no ranking fields by design)
export const TeammateInsightInput = z.object({
  person_id: z.string(),
  velocity_samples: z.array(z.object({
    dimension: z.enum(["complexity", "effort", "risk"]),
    band: z.number().int(),
    throughput: z.number(),
    caveat: z.string().nullable().optional(),
  })),
  skills: z.array(z.object({
    skill: z.string(),
    proficiency: z.number().int().min(1).max(5),
    interest: z.number().int().min(1).max(5),
  })),
  upcoming_demand: z.array(z.string()).optional(),
});
export const TeammateInsightOutput = OutputBase.extend({
  thrives_on: z.string(),
  nudges: z.array(z.string()),
  stretch_candidates: z.array(z.string()).optional(),
});

// email.digest
export const EmailDigestInput = z.object({
  messages: z.array(EmailMessageEnvelope),
});
export const EmailDigestOutput = OutputBase.extend({
  items: z.array(z.object({
    kind: z.enum(["needs_reply", "decision", "risk", "fyi"]),
    summary: z.string(),
    thread_id: z.string().optional(),
    linked_refs: z.array(EntityId).optional(),
  })),
});

// stakeholder.update (draft, is_draft const true)
export const StakeholderUpdateInput = z.object({
  stakeholder: z.object({
    id: z.string(),
    name: z.string(),
    interest_level: z.enum(["manage_closely", "keep_satisfied", "keep_informed", "monitor"]),
  }),
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    reason_invested: z.string().nullable().optional(),
  })),
});
export const StakeholderUpdateOutput = OutputBase.extend({
  draft: z.string(),
  is_draft: z.literal(true),
});

export const AI_TASK_OUTPUT = {
  "prioritization.suggest": PrioritizationSuggestOutput,
  "daily-brief.compose": DailyBriefComposeOutput,
  "health.explain": HealthExplainOutput,
  "teammate.insight": TeammateInsightOutput,
  "email.digest": EmailDigestOutput,
  "stakeholder.update": StakeholderUpdateOutput,
} as const;
export type AiTaskKey = keyof typeof AI_TASK_OUTPUT;
```

- [ ] **Step 4: Export — append to `packages/contracts/src/index.ts`**

```ts
export * from "./ai-tasks.js";
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -w test:run packages/contracts/src/ai-tasks`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src
git commit -m "feat(contracts): add AI-task input/output validators with grounding enforced"
```

---

### Task 4: Caching + learning validators (incl. FeatureRecord)

**Files:**
- Create: `packages/contracts/src/caching.ts`
- Create: `packages/contracts/src/learning.ts`
- Create: `packages/contracts/src/caching-learning.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: `CACHE_ENTITY_TYPES` (Task 1). Read `schemas/caching.schema.json` + `schemas/learning.schema.json`.
- Produces:
  - caching: `ResolutionTier`, `CacheDependency`, `CacheEntry`, `CachePolicy`, `AIFeedback`, `LearnedModel`, `ResolutionResult`.
  - learning: `EntityRef`, `FeatureValue` (discriminated union on `kind`), `FeatureRecord`, `TaskComputationProfile`, `TrainingExample`, `ShadowEvaluation`.

- [ ] **Step 1: Write the failing test `packages/contracts/src/caching-learning.test.ts`**

```ts
import { expect, test } from "vitest";
import { CacheEntry, AIFeedback, FeatureRecord, FeatureValue } from "./index.js";

test("FeatureValue is a discriminated union on kind", () => {
  expect(FeatureValue.safeParse({ kind: "number", number: 3 }).success).toBe(true);
  expect(FeatureValue.safeParse({ kind: "band", band: "high" }).success).toBe(true);
  expect(FeatureValue.safeParse({ kind: "band", band: "extreme" }).success).toBe(false);
  expect(FeatureValue.safeParse({ kind: "number", band: "high" }).success).toBe(false);
});

test("FeatureRecord requires metric/entity/value/fn", () => {
  const ok = {
    metric: "velocity.throughput.complexity.high",
    entity: { type: "person", id: "11111111-1111-1111-1111-111111111111" },
    value: { kind: "number", number: 1.15 },
    computed_at: "2026-03-16T00:00:00Z", deterministic_fn: "velocity.v1", fn_version: "1",
  };
  expect(FeatureRecord.safeParse(ok).success).toBe(true);
});

test("AIFeedback verdict is accept|edit|dismiss", () => {
  const ok = { ai_task_id: "11111111-1111-1111-1111-111111111111", task_type: "daily-brief.compose", verdict: "accept", at: "2026-03-16T00:00:00Z" };
  expect(AIFeedback.safeParse(ok).success).toBe(true);
  expect(AIFeedback.safeParse({ ...ok, verdict: "ignore" }).success).toBe(false);
});

test("CacheEntry requires key_hash/task_type/output/tier", () => {
  const ok = { key_hash: "h", task_type: "health.explain", input_hash: "ih", output: {}, model_version: "v1", resolution_tier: "exact_cache", created_at: "2026-03-16T00:00:00Z", stale: false };
  expect(CacheEntry.safeParse(ok).success).toBe(true);
  expect(CacheEntry.safeParse({ ...ok, resolution_tier: "magic" }).success).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/contracts/src/caching-learning`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/contracts/src/caching.ts`**

```ts
import { z } from "zod";
import { CACHE_ENTITY_TYPES } from "./primitives.js";

export const ResolutionTier = z.enum([
  "exact_cache", "semantic_cache", "incremental", "learned_model", "llm",
]);

export const CacheDependency = z.object({
  entity_type: z.enum(CACHE_ENTITY_TYPES),
  entity_id: z.string(),
  field: z.string().nullable().optional(),
  version: z.union([z.number().int(), z.string()]).nullable().optional(),
});

export const CacheEntry = z.object({
  key_hash: z.string(),
  task_type: z.string(),
  grain: z.string().nullable().optional(),
  input_hash: z.string(),
  output: z.record(z.string(), z.unknown()),
  model_version: z.string(),
  resolution_tier: ResolutionTier,
  dependencies: z.array(CacheDependency).optional(),
  embedding: z.array(z.number()).nullable().optional(),
  tokens_used: z.number().int().min(0).optional(),
  tokens_saved: z.number().int().min(0).optional(),
  hit_count: z.number().int().min(0).optional(),
  created_at: z.string(),
  last_used_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  stale: z.boolean(),
});

export const CachePolicy = z.object({
  task_type: z.string(),
  tiers_enabled: z.array(ResolutionTier),
  ttl_seconds: z.number().int().min(0).nullable().optional(),
  semantic_threshold: z.number().min(0).max(1).nullable().optional(),
  decompose_grain: z.string().nullable().optional(),
  decision_bearing: z.boolean().optional(),
});

export const AIFeedback = z.object({
  ai_task_id: z.string(),
  task_type: z.string(),
  verdict: z.enum(["accept", "edit", "dismiss"]),
  edited_output: z.record(z.string(), z.unknown()).nullable().optional(),
  at: z.string(),
});

export const LearnedModel = z.object({
  task_type: z.string(),
  kind: z.enum(["regression", "classifier", "preference"]),
  version: z.string(),
  artifact_ref: z.string().optional(),
  trained_on: z.number().int().nullable().optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
  confidence_floor: z.number().min(0).max(1).nullable().optional(),
  active: z.boolean(),
  trained_at: z.string(),
});

export const ResolutionResult = z.object({
  task_type: z.string(),
  resolution_tier: ResolutionTier,
  cache_key: z.string().nullable().optional(),
  learned_model_version: z.string().nullable().optional(),
  escalated_to_llm: z.boolean().optional(),
  tokens_used: z.number().int().min(0),
  tokens_saved: z.number().int().min(0),
});
```

- [ ] **Step 4: Create `packages/contracts/src/learning.ts`**

```ts
import { z } from "zod";
import { CACHE_ENTITY_TYPES } from "./primitives.js";

export const EntityRef = z.object({
  type: z.enum(CACHE_ENTITY_TYPES),
  id: z.string(),
});

export const FeatureValue = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("number"), number: z.number() }),
  z.object({ kind: z.literal("band"), band: z.enum(["low", "med", "high"]) }),
  z.object({ kind: z.literal("category"), category: z.string() }),
  z.object({ kind: z.literal("trend"), trend: z.enum(["improving", "flat", "worsening"]) }),
  z.object({ kind: z.literal("vector"), vector: z.array(z.number()) }),
]);
export type FeatureValue = z.infer<typeof FeatureValue>;

export const FeatureRecord = z.object({
  metric: z.string(),
  entity: EntityRef,
  value: FeatureValue,
  computed_at: z.string(),
  deterministic_fn: z.string(),
  fn_version: z.string(),
  inputs_hash: z.string().nullable().optional(),
});
export type FeatureRecord = z.infer<typeof FeatureRecord>;

export const TaskComputationProfile = z.object({
  task_type: z.string(),
  mode: z.enum(["deterministic", "hybrid", "generative"]),
  deterministic_first: z.boolean().optional(),
  feature_metrics: z.array(z.string()).optional(),
  graduation_eligible: z.boolean().optional(),
  min_examples_to_train: z.number().int().min(1).nullable().optional(),
  promotion_agreement: z.number().min(0).max(1).nullable().optional(),
});

export const TrainingExample = z.object({
  task_type: z.string(),
  features: z.array(FeatureRecord),
  served_output: z.record(z.string(), z.unknown()).nullable().optional(),
  served_by: z.enum(["deterministic", "llm", "learned_model"]).nullable().optional(),
  label: z.object({
    verdict: z.enum(["accept", "edit", "dismiss"]),
    corrected_output: z.record(z.string(), z.unknown()).nullable().optional(),
  }).nullable().optional(),
  outcome_ref: EntityRef,
  outcome_value: z.union([z.number(), z.string(), z.boolean()]).nullable().optional(),
  dataset_version: z.string(),
});

export const ShadowEvaluation = z.object({
  task_type: z.string(),
  learned_model_version: z.string(),
  sample_size: z.number().int().min(1),
  agreement: z.number().min(0).max(1),
  regressions: z.array(z.string()).nullable().optional(),
  recommend_promote: z.boolean(),
  evaluated_at: z.string(),
});
```

- [ ] **Step 5: Export — append to `packages/contracts/src/index.ts`**

```ts
export * from "./caching.js";
export * from "./learning.js";
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm -w test:run packages/contracts/src/caching-learning`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/src
git commit -m "feat(contracts): add caching + learning validators (CacheEntry, FeatureRecord, etc.)"
```

---

### Task 5: Intelligence foundations — FeatureRecord type, FeatureValue, analyzer result envelope

**Files:**
- Create: `packages/core/src/domain/intelligence/feature-record.ts`
- Create: `packages/core/src/domain/intelligence/feature-record.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces (pure TS in `@pma/core`, NO zod):
  - `type FeatureValue = { kind: "number"; number: number } | { kind: "band"; band: Band } | { kind: "category"; category: string } | { kind: "trend"; trend: Trend } | { kind: "vector"; vector: number[] }` (Trend = `"improving"|"flat"|"worsening"`).
  - `interface FeatureRecord { metric: string; entity: { type: string; id: string }; value: FeatureValue; computedAt: Date; deterministicFn: string; fnVersion: string; }`
  - `interface AnalyzerResult<T> { result: T; features: FeatureRecord[] }`
  - Helper `feature(metric, entity, value, computedAt, fn, fnVersion): FeatureRecord`.

- [ ] **Step 1: Write the failing test `packages/core/src/domain/intelligence/feature-record.test.ts`**

```ts
import { expect, test } from "vitest";
import { feature } from "./feature-record.js";

test("feature() builds a FeatureRecord with a discriminated value", () => {
  const at = new Date("2026-03-16");
  const f = feature("sprint.done_ratio", { type: "cadence", id: "s14" }, { kind: "number", number: 0.72 }, at, "sprint.v1", "1");
  expect(f.metric).toBe("sprint.done_ratio");
  expect(f.value).toEqual({ kind: "number", number: 0.72 });
  expect(f.computedAt).toBe(at);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/domain/intelligence/feature-record`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/intelligence/feature-record.ts`**

```ts
import type { Band } from "../shared/enums.js";

export type Trend = "improving" | "flat" | "worsening";

export type FeatureValue =
  | { kind: "number"; number: number }
  | { kind: "band"; band: Band }
  | { kind: "category"; category: string }
  | { kind: "trend"; trend: Trend }
  | { kind: "vector"; vector: number[] };

export interface FeatureEntity { type: string; id: string; }

export interface FeatureRecord {
  metric: string;
  entity: FeatureEntity;
  value: FeatureValue;
  computedAt: Date;
  deterministicFn: string;
  fnVersion: string;
}

export interface AnalyzerResult<T> {
  result: T;
  features: FeatureRecord[];
}

export function feature(
  metric: string,
  entity: FeatureEntity,
  value: FeatureValue,
  computedAt: Date,
  deterministicFn: string,
  fnVersion: string,
): FeatureRecord {
  return { metric, entity, value, computedAt, deterministicFn, fnVersion };
}
```

- [ ] **Step 4: Export — append to `packages/core/src/index.ts`**

```ts
export * from "./domain/intelligence/feature-record.js";
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/domain/intelligence/feature-record`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/intelligence packages/core/src/index.ts
git commit -m "feat(core): add FeatureRecord type + analyzer-result envelope (pure)"
```

---

### Task 6: Prioritization — WSJF / RICE Strategy

**Files:**
- Create: `packages/core/src/domain/prioritization/prioritization-strategy.ts`
- Create: `packages/core/src/domain/prioritization/wsjf-strategy.ts`
- Create: `packages/core/src/domain/prioritization/rice-strategy.ts`
- Create: `packages/core/src/domain/prioritization/prioritization.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `FeatureRecord`, `feature`, `AnalyzerResult` (Task 5).
- Produces:
  - `interface ScorableItem { id: string; title: string; estimate: number | null; wsjf?: { userBusinessValue: number; timeCriticality: number; riskReduction: number }; rice?: { reach: number; impact: number; confidence: number; effort: number }; }`
  - `interface PriorityScore { id: string; value: number; components: Record<string, number>; rationale: string; }`
  - `interface PrioritizationStrategy { readonly key: "WSJF" | "RICE"; rank(items: ScorableItem[], now: Date): AnalyzerResult<PriorityScore[]>; }`
  - `class WsjfStrategy` and `class RiceStrategy`. Results sorted descending by `value`; each emits a `prioritization.score` FeatureRecord per item.

- [ ] **Step 1: Write the failing test `packages/core/src/domain/prioritization/prioritization.test.ts`**

```ts
import { expect, test } from "vitest";
import { WsjfStrategy } from "./wsjf-strategy.js";
import { RiceStrategy } from "./rice-strategy.js";

const now = new Date("2026-03-16");
const items = [
  { id: "sso", title: "Enterprise SSO", estimate: 5, wsjf: { userBusinessValue: 8, timeCriticality: 5, riskReduction: 8 }, rice: { reach: 2000, impact: 2, confidence: 80, effort: 3 } },
  { id: "a11y", title: "a11y pass", estimate: 3, wsjf: { userBusinessValue: 5, timeCriticality: 8, riskReduction: 2 }, rice: { reach: 5000, impact: 1, confidence: 85, effort: 2 } },
];

test("WSJF = (bv+tc+rr)/size, ranked desc, with component breakdown", () => {
  const { result, features } = new WsjfStrategy().rank(items, now);
  // sso: (8+5+8)/5 = 4.2 ; a11y: (5+8+2)/3 = 5.0 -> a11y first
  expect(result[0]!.id).toBe("a11y");
  expect(result[0]!.value).toBeCloseTo(5.0);
  expect(result[1]!.value).toBeCloseTo(4.2);
  expect(result[0]!.components.timeCriticality).toBe(8);
  expect(features).toHaveLength(2);
});

test("RICE = (reach*impact*confidence/100)/effort, ranked desc", () => {
  const { result } = new RiceStrategy().rank(items, now);
  // sso: (2000*2*0.8)/3 = 1066.7 ; a11y: (5000*1*0.85)/2 = 2125 -> a11y first
  expect(result[0]!.id).toBe("a11y");
  expect(result[0]!.value).toBeCloseTo(2125);
  expect(result[1]!.value).toBeCloseTo(1066.67, 1);
});

test("WSJF treats missing size as 1 (avoids divide-by-zero)", () => {
  const { result } = new WsjfStrategy().rank([{ id: "x", title: "x", estimate: null, wsjf: { userBusinessValue: 1, timeCriticality: 1, riskReduction: 1 } }], now);
  expect(result[0]!.value).toBeCloseTo(3);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/domain/prioritization`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/prioritization/prioritization-strategy.ts`**

```ts
import type { AnalyzerResult } from "../intelligence/feature-record.js";

export interface ScorableItem {
  id: string;
  title: string;
  estimate: number | null;
  wsjf?: { userBusinessValue: number; timeCriticality: number; riskReduction: number };
  rice?: { reach: number; impact: number; confidence: number; effort: number };
}

export interface PriorityScore {
  id: string;
  value: number;
  components: Record<string, number>;
  rationale: string;
}

export interface PrioritizationStrategy {
  readonly key: "WSJF" | "RICE";
  rank(items: ScorableItem[], now: Date): AnalyzerResult<PriorityScore[]>;
}
```

- [ ] **Step 4: Create `packages/core/src/domain/prioritization/wsjf-strategy.ts`**

```ts
import type { PrioritizationStrategy, ScorableItem, PriorityScore } from "./prioritization-strategy.js";
import type { AnalyzerResult, FeatureRecord } from "../intelligence/feature-record.js";
import { feature } from "../intelligence/feature-record.js";

export class WsjfStrategy implements PrioritizationStrategy {
  readonly key = "WSJF" as const;
  rank(items: ScorableItem[], now: Date): AnalyzerResult<PriorityScore[]> {
    const features: FeatureRecord[] = [];
    const scores = items.map((it) => {
      const w = it.wsjf ?? { userBusinessValue: 0, timeCriticality: 0, riskReduction: 0 };
      const size = it.estimate && it.estimate > 0 ? it.estimate : 1;
      const cod = w.userBusinessValue + w.timeCriticality + w.riskReduction;
      const value = round2(cod / size);
      features.push(feature("prioritization.wsjf", { type: "work_item", id: it.id }, { kind: "number", number: value }, now, "wsjf", "1"));
      return {
        id: it.id, value,
        components: { userBusinessValue: w.userBusinessValue, timeCriticality: w.timeCriticality, riskReduction: w.riskReduction, jobSize: size },
        rationale: `Cost of Delay ${cod} ÷ Job Size ${size}`,
      };
    });
    scores.sort((a, b) => b.value - a.value);
    return { result: scores, features };
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
```

- [ ] **Step 5: Create `packages/core/src/domain/prioritization/rice-strategy.ts`**

```ts
import type { PrioritizationStrategy, ScorableItem, PriorityScore } from "./prioritization-strategy.js";
import type { AnalyzerResult, FeatureRecord } from "../intelligence/feature-record.js";
import { feature } from "../intelligence/feature-record.js";

export class RiceStrategy implements PrioritizationStrategy {
  readonly key = "RICE" as const;
  rank(items: ScorableItem[], now: Date): AnalyzerResult<PriorityScore[]> {
    const features: FeatureRecord[] = [];
    const scores = items.map((it) => {
      const r = it.rice ?? { reach: 0, impact: 0, confidence: 0, effort: 1 };
      const effort = r.effort > 0 ? r.effort : 1;
      const value = round2((r.reach * r.impact * (r.confidence / 100)) / effort);
      features.push(feature("prioritization.rice", { type: "work_item", id: it.id }, { kind: "number", number: value }, now, "rice", "1"));
      return {
        id: it.id, value,
        components: { reach: r.reach, impact: r.impact, confidence: r.confidence, effort },
        rationale: `(Reach ${r.reach} × Impact ${r.impact} × Confidence ${r.confidence}%) ÷ Effort ${effort}`,
      };
    });
    scores.sort((a, b) => b.value - a.value);
    return { result: scores, features };
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
```

- [ ] **Step 6: Export — append to `packages/core/src/index.ts`**

```ts
export * from "./domain/prioritization/prioritization-strategy.js";
export * from "./domain/prioritization/wsjf-strategy.js";
export * from "./domain/prioritization/rice-strategy.js";
```

- [ ] **Step 7: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/domain/prioritization`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/domain/prioritization packages/core/src/index.ts
git commit -m "feat(core): add WSJF/RICE prioritization strategies (deterministic, feature-emitting)"
```

---

### Task 7: Health composite analyzer

**Files:**
- Create: `packages/core/src/domain/intelligence/health.ts`
- Create: `packages/core/src/domain/intelligence/health.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `AnalyzerResult`, `FeatureRecord`, `feature`, `Trend` (Task 5).
- Produces:
  - `type DriverName = "schedule_variance" | "cost_variance" | "scope_creep" | "raid_exposure" | "dependency_risk" | "benefit_confidence" | "team_health"`
  - `interface HealthDriverInput { name: DriverName; severity: number; trend: Trend }` (severity 0–100, higher = worse)
  - `interface HealthComposite { entityId: string; composite: number; drivers: { name: DriverName; severity: number; trend: Trend }[]; primaryDriver: DriverName; }`
  - `function computeHealth(entityId: string, drivers: HealthDriverInput[], now: Date): AnalyzerResult<HealthComposite>` — composite = round(100 − mean(severity)); primaryDriver = highest severity; emits a `health.composite` feature + one `health.driver.<name>` feature per driver.

- [ ] **Step 1: Write the failing test `packages/core/src/domain/intelligence/health.test.ts`**

```ts
import { expect, test } from "vitest";
import { computeHealth } from "./health.js";

const now = new Date("2026-03-16");

test("composite = 100 - mean(severity); primary driver is the worst", () => {
  const { result, features } = computeHealth("checkout", [
    { name: "schedule_variance", severity: 75, trend: "worsening" },
    { name: "cost_variance", severity: 45, trend: "flat" },
    { name: "team_health", severity: 60, trend: "worsening" },
  ], now);
  expect(result.composite).toBe(40); // 100 - mean(75,45,60)=100-60
  expect(result.primaryDriver).toBe("schedule_variance");
  // 1 composite feature + 3 driver features
  expect(features).toHaveLength(4);
});

test("empty drivers => composite 100, no primary crash", () => {
  const { result } = computeHealth("x", [], now);
  expect(result.composite).toBe(100);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/domain/intelligence/health`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/intelligence/health.ts`**

```ts
import { feature, type AnalyzerResult, type FeatureRecord, type Trend } from "./feature-record.js";

export type DriverName =
  | "schedule_variance" | "cost_variance" | "scope_creep" | "raid_exposure"
  | "dependency_risk" | "benefit_confidence" | "team_health";

export interface HealthDriverInput { name: DriverName; severity: number; trend: Trend; }

export interface HealthComposite {
  entityId: string;
  composite: number;
  drivers: { name: DriverName; severity: number; trend: Trend }[];
  primaryDriver: DriverName | null;
}

export function computeHealth(
  entityId: string,
  drivers: HealthDriverInput[],
  now: Date,
): AnalyzerResult<HealthComposite> {
  const features: FeatureRecord[] = [];
  const mean = drivers.length === 0 ? 0 : drivers.reduce((s, d) => s + d.severity, 0) / drivers.length;
  const composite = Math.round(100 - mean);
  const primary = drivers.length === 0
    ? null
    : drivers.reduce((worst, d) => (d.severity > worst.severity ? d : worst)).name;

  features.push(feature("health.composite", { type: "project", id: entityId }, { kind: "number", number: composite }, now, "health", "1"));
  for (const d of drivers) {
    features.push(feature(`health.driver.${d.name}`, { type: "project", id: entityId }, { kind: "trend", trend: d.trend }, now, "health", "1"));
  }

  return {
    result: { entityId, composite, drivers: drivers.map((d) => ({ name: d.name, severity: d.severity, trend: d.trend })), primaryDriver: primary },
    features,
  };
}
```

- [ ] **Step 4: Export — append to `packages/core/src/index.ts`**

```ts
export * from "./domain/intelligence/health.js";
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/domain/intelligence/health`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/intelligence/health.ts packages/core/src/index.ts
git commit -m "feat(core): add explainable health composite analyzer"
```

---

### Task 8: Velocity + capacity analyzer (cross-tool, red-line-safe)

**Files:**
- Create: `packages/core/src/domain/intelligence/capacity.ts`
- Create: `packages/core/src/domain/intelligence/capacity.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `AnalyzerResult`, `feature` (Task 5).
- Produces:
  - `interface AllocationInput { personId: string; pct: number; source: string }`
  - `interface PersonLoad { personId: string; totalPct: number; overallocated: boolean; bySource: { source: string; pct: number }[] }`
  - `function computeLoads(allocations: AllocationInput[], now: Date): AnalyzerResult<PersonLoad[]>` — sums pct per person ACROSS sources (cross-tool truth); `overallocated = totalPct > 100`; emits a `capacity.load` feature per person. Result is keyed/ordered by personId (NOT ranked by load — no leaderboard).

- [ ] **Step 1: Write the failing test `packages/core/src/domain/intelligence/capacity.test.ts`**

```ts
import { expect, test } from "vitest";
import { computeLoads } from "./capacity.js";

const now = new Date("2026-03-16");

test("sums allocation across sources and flags >100% (the Sam case)", () => {
  const { result, features } = computeLoads([
    { personId: "sam", pct: 70, source: "Jira" },
    { personId: "sam", pct: 52, source: "Monday" },
    { personId: "dana", pct: 68, source: "Jira" },
  ], now);
  const sam = result.find((r) => r.personId === "sam")!;
  expect(sam.totalPct).toBe(122);
  expect(sam.overallocated).toBe(true);
  expect(sam.bySource).toHaveLength(2);
  const dana = result.find((r) => r.personId === "dana")!;
  expect(dana.overallocated).toBe(false);
  expect(features).toHaveLength(2); // one per person
});

test("result is ordered by personId, not by load (no leaderboard)", () => {
  const { result } = computeLoads([
    { personId: "b", pct: 50, source: "Jira" },
    { personId: "a", pct: 99, source: "Jira" },
  ], now);
  expect(result.map((r) => r.personId)).toEqual(["a", "b"]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/domain/intelligence/capacity`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/intelligence/capacity.ts`**

```ts
import { feature, type AnalyzerResult, type FeatureRecord } from "./feature-record.js";

export interface AllocationInput { personId: string; pct: number; source: string; }
export interface PersonLoad {
  personId: string;
  totalPct: number;
  overallocated: boolean;
  bySource: { source: string; pct: number }[];
}

export function computeLoads(allocations: AllocationInput[], now: Date): AnalyzerResult<PersonLoad[]> {
  const byPerson = new Map<string, AllocationInput[]>();
  for (const a of allocations) {
    const list = byPerson.get(a.personId) ?? [];
    list.push(a);
    byPerson.set(a.personId, list);
  }
  const features: FeatureRecord[] = [];
  const loads: PersonLoad[] = [...byPerson.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) // ordered by id, never by load
    .map(([personId, allocs]) => {
      const totalPct = allocs.reduce((s, a) => s + a.pct, 0);
      features.push(feature("capacity.load", { type: "person", id: personId }, { kind: "number", number: totalPct }, now, "capacity", "1"));
      return {
        personId,
        totalPct,
        overallocated: totalPct > 100,
        bySource: allocs.map((a) => ({ source: a.source, pct: a.pct })),
      };
    });
  return { result: loads, features };
}
```

- [ ] **Step 4: Export — append to `packages/core/src/index.ts`**

```ts
export * from "./domain/intelligence/capacity.js";
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/domain/intelligence/capacity`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/intelligence/capacity.ts packages/core/src/index.ts
git commit -m "feat(core): add cross-tool capacity analyzer (surfaces >100%, no leaderboard)"
```

---

### Task 9: Sprint/flow metrics + DORA

**Files:**
- Create: `packages/core/src/domain/intelligence/sprint.ts`
- Create: `packages/core/src/domain/intelligence/dora.ts`
- Create: `packages/core/src/domain/intelligence/sprint-dora.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `AnalyzerResult`, `feature` (Task 5).
- Produces:
  - sprint: `interface SprintItemInput { status: string; estimate: number | null }`; `interface SprintMetrics { committed: number; done: number; remaining: number; doneRatio: number }`; `function computeSprint(items: SprintItemInput[], cadenceId: string, now: Date): AnalyzerResult<SprintMetrics>` (committed = sum estimate; done = sum where status==="done"; remaining = committed−done; doneRatio = done/committed or 0).
  - dora: `interface DeploymentInput { environment: string; status: string; leadTimeMinutes: number | null; isRollback: boolean }`; `interface DoraMetrics { prodDeploys: number; changeFailureRate: number; avgLeadTimeMinutes: number | null; mttrMinutes: number | null }`; `function computeDora(deploys: DeploymentInput[], now: Date): AnalyzerResult<DoraMetrics>` (prodDeploys = count env==="prod"; CFR = rolled_back prod ÷ prod; avgLeadTime = mean of non-null leadTimeMinutes among prod success; MTTR = mean leadTimeMinutes of recovery deployments, i.e. prod success deployments flagged isRollback recovery — for simplicity: mean leadTimeMinutes of prod deployments whose status==="success" AND isRollback===true).

- [ ] **Step 1: Write the failing test `packages/core/src/domain/intelligence/sprint-dora.test.ts`**

```ts
import { expect, test } from "vitest";
import { computeSprint } from "./sprint.js";
import { computeDora } from "./dora.js";

const now = new Date("2026-03-16");

test("sprint metrics: committed/done/remaining/doneRatio", () => {
  const { result } = computeSprint([
    { status: "done", estimate: 8 },
    { status: "in_progress", estimate: 5 },
    { status: "in_progress", estimate: 3 },
  ], "s14", now);
  expect(result.committed).toBe(16);
  expect(result.done).toBe(8);
  expect(result.remaining).toBe(8);
  expect(result.doneRatio).toBeCloseTo(0.5);
});

test("DORA: change failure rate = rolled_back prod / total prod", () => {
  const { result } = computeDora([
    { environment: "prod", status: "success", leadTimeMinutes: 60, isRollback: false },
    { environment: "prod", status: "rolled_back", leadTimeMinutes: 52, isRollback: false },
    { environment: "prod", status: "success", leadTimeMinutes: 20, isRollback: true },
    { environment: "staging", status: "success", leadTimeMinutes: 45, isRollback: false },
  ], now);
  expect(result.prodDeploys).toBe(3);
  expect(result.changeFailureRate).toBeCloseTo(1 / 3);
  expect(result.mttrMinutes).toBe(20); // the recovery deploy
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/domain/intelligence/sprint-dora`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/intelligence/sprint.ts`**

```ts
import { feature, type AnalyzerResult, type FeatureRecord } from "./feature-record.js";

export interface SprintItemInput { status: string; estimate: number | null; }
export interface SprintMetrics { committed: number; done: number; remaining: number; doneRatio: number; }

export function computeSprint(
  items: SprintItemInput[],
  cadenceId: string,
  now: Date,
): AnalyzerResult<SprintMetrics> {
  const committed = items.reduce((s, i) => s + (i.estimate ?? 0), 0);
  const done = items.filter((i) => i.status === "done").reduce((s, i) => s + (i.estimate ?? 0), 0);
  const remaining = committed - done;
  const doneRatio = committed === 0 ? 0 : done / committed;
  const features: FeatureRecord[] = [
    feature("sprint.done_ratio", { type: "cadence", id: cadenceId }, { kind: "number", number: doneRatio }, now, "sprint", "1"),
  ];
  return { result: { committed, done, remaining, doneRatio }, features };
}
```

- [ ] **Step 4: Create `packages/core/src/domain/intelligence/dora.ts`**

```ts
import { feature, type AnalyzerResult, type FeatureRecord } from "./feature-record.js";

export interface DeploymentInput {
  environment: string;
  status: string;
  leadTimeMinutes: number | null;
  isRollback: boolean;
}
export interface DoraMetrics {
  prodDeploys: number;
  changeFailureRate: number;
  avgLeadTimeMinutes: number | null;
  mttrMinutes: number | null;
}

export function computeDora(deploys: DeploymentInput[], now: Date): AnalyzerResult<DoraMetrics> {
  const prod = deploys.filter((d) => d.environment === "prod");
  const prodDeploys = prod.length;
  const rolledBack = prod.filter((d) => d.status === "rolled_back").length;
  const changeFailureRate = prodDeploys === 0 ? 0 : rolledBack / prodDeploys;

  const successLead = prod.filter((d) => d.status === "success" && d.leadTimeMinutes != null).map((d) => d.leadTimeMinutes!);
  const avgLeadTimeMinutes = successLead.length === 0 ? null : Math.round(successLead.reduce((s, n) => s + n, 0) / successLead.length);

  const recoveries = prod.filter((d) => d.status === "success" && d.isRollback && d.leadTimeMinutes != null).map((d) => d.leadTimeMinutes!);
  const mttrMinutes = recoveries.length === 0 ? null : Math.round(recoveries.reduce((s, n) => s + n, 0) / recoveries.length);

  const features: FeatureRecord[] = [
    feature("dora.change_failure_rate", { type: "project", id: "portfolio" }, { kind: "number", number: changeFailureRate }, now, "dora", "1"),
  ];
  return { result: { prodDeploys, changeFailureRate, avgLeadTimeMinutes, mttrMinutes }, features };
}
```

- [ ] **Step 5: Export — append to `packages/core/src/index.ts`**

```ts
export * from "./domain/intelligence/sprint.js";
export * from "./domain/intelligence/dora.js";
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/domain/intelligence/sprint-dora`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/intelligence/sprint.ts packages/core/src/domain/intelligence/dora.ts packages/core/src/index.ts
git commit -m "feat(core): add sprint/flow metrics + DORA analyzers"
```

---

### Task 10: Specification rules → SuggestedAction

**Files:**
- Create: `packages/core/src/domain/intelligence/suggested-action.ts`
- Create: `packages/core/src/domain/intelligence/specification-rules.ts`
- Create: `packages/core/src/domain/intelligence/specification-rules.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: nothing from other Phase-2 tasks except types.
- Produces:
  - `type ActionType = "sprint_end" | "complex_check_in" | "stakeholder_update_due" | "one_on_one_overdue" | "gate_deadline" | "deploy_attention" | "meeting_prep"`
  - `type Urgency = "low" | "med" | "high"`
  - `interface SuggestedAction { type: ActionType; urgency: Urgency; text: string; refType: string; refId: string }`
  - `interface CanonicalSnapshot { now: Date; cadences: { id: string; name: string; endDate: Date; openStoryCount: number }[]; complexItems: { id: string; title: string; assignee: string; daysSinceStatusChange: number }[]; stakeholders: { id: string; name: string; nextDue: Date | null; cares: string }[]; oneOnOnes: { personId: string; personName: string; lastMet: Date | null; cadenceDays: number }[]; gates: { projectId: string; name: string; deadline: Date; unacceptedDeliverables: number }[]; deployments: { id: string; releaseVersion: string; status: string }[]; meetings: { title: string; start: Date; linkLabel: string | null }[] }`
  - Seven predicate functions, each `(snap) => SuggestedAction[]`, plus `runSpecificationRules(snap, opts?: { sprintEndWithinDays?: number; complexQuietDays?: number; stakeholderDueWithinDays?: number }): SuggestedAction[]` that concatenates them. Thresholds default: sprintEndWithinDays=3, complexQuietDays=3, stakeholderDueWithinDays=2.

- [ ] **Step 1: Write the failing test `packages/core/src/domain/intelligence/specification-rules.test.ts`**

```ts
import { expect, test } from "vitest";
import { runSpecificationRules } from "./specification-rules.js";

const now = new Date("2026-03-16T08:00:00Z");
function snap(overrides: any = {}) {
  return {
    now,
    cadences: [], complexItems: [], stakeholders: [], oneOnOnes: [],
    gates: [], deployments: [], meetings: [], ...overrides,
  };
}

test("sprint-end fires when a cadence ends within N days with open stories", () => {
  const actions = runSpecificationRules(snap({
    cadences: [{ id: "s14", name: "Sprint 14", endDate: new Date("2026-03-18T00:00:00Z"), openStoryCount: 3 }],
  }));
  const a = actions.find((x) => x.type === "sprint_end");
  expect(a).toBeTruthy();
  expect(a!.text).toContain("Sprint 14");
  expect(a!.urgency).toBe("high");
});

test("sprint-end does NOT fire when no stories are open", () => {
  const actions = runSpecificationRules(snap({
    cadences: [{ id: "s14", name: "Sprint 14", endDate: new Date("2026-03-18T00:00:00Z"), openStoryCount: 0 }],
  }));
  expect(actions.find((x) => x.type === "sprint_end")).toBeUndefined();
});

test("deploy-attention fires on a rolled_back deployment", () => {
  const actions = runSpecificationRules(snap({
    deployments: [{ id: "d1", releaseVersion: "v2.3", status: "rolled_back" }],
  }));
  expect(actions.find((x) => x.type === "deploy_attention")).toBeTruthy();
});

test("1:1 overdue fires when last meeting exceeds cadence", () => {
  const actions = runSpecificationRules(snap({
    oneOnOnes: [{ personId: "lin", personName: "Lin", lastMet: new Date("2026-02-20T00:00:00Z"), cadenceDays: 14 }],
  }));
  expect(actions.find((x) => x.type === "one_on_one_overdue")).toBeTruthy();
});

test("all seven rule types can fire together", () => {
  const actions = runSpecificationRules(snap({
    cadences: [{ id: "s14", name: "S14", endDate: new Date("2026-03-17T00:00:00Z"), openStoryCount: 2 }],
    complexItems: [{ id: "auth", title: "Auth rewrite", assignee: "Dana", daysSinceStatusChange: 4 }],
    stakeholders: [{ id: "priya", name: "Priya", nextDue: new Date("2026-03-17T00:00:00Z"), cares: "Ledger" }],
    oneOnOnes: [{ personId: "lin", personName: "Lin", lastMet: new Date("2026-02-01T00:00:00Z"), cadenceDays: 14 }],
    gates: [{ projectId: "ledger", name: "Gate 2", deadline: new Date("2026-03-22T00:00:00Z"), unacceptedDeliverables: 2 }],
    deployments: [{ id: "d1", releaseVersion: "v2.3", status: "rolled_back" }],
    meetings: [{ title: "Standup", start: new Date("2026-03-16T08:40:00Z"), linkLabel: "Checkout" }],
  }));
  const types = new Set(actions.map((a) => a.type));
  expect(types.size).toBe(7);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/domain/intelligence/specification-rules`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/intelligence/suggested-action.ts`**

```ts
export type ActionType =
  | "sprint_end" | "complex_check_in" | "stakeholder_update_due"
  | "one_on_one_overdue" | "gate_deadline" | "deploy_attention" | "meeting_prep";
export type Urgency = "low" | "med" | "high";

export interface SuggestedAction {
  type: ActionType;
  urgency: Urgency;
  text: string;
  refType: string;
  refId: string;
}

export interface CanonicalSnapshot {
  now: Date;
  cadences: { id: string; name: string; endDate: Date; openStoryCount: number }[];
  complexItems: { id: string; title: string; assignee: string; daysSinceStatusChange: number }[];
  stakeholders: { id: string; name: string; nextDue: Date | null; cares: string }[];
  oneOnOnes: { personId: string; personName: string; lastMet: Date | null; cadenceDays: number }[];
  gates: { projectId: string; name: string; deadline: Date; unacceptedDeliverables: number }[];
  deployments: { id: string; releaseVersion: string; status: string }[];
  meetings: { title: string; start: Date; linkLabel: string | null }[];
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const daysBetween = (a: Date, b: Date): number => (a.getTime() - b.getTime()) / DAY_MS;
```

- [ ] **Step 4: Create `packages/core/src/domain/intelligence/specification-rules.ts`**

```ts
import {
  type CanonicalSnapshot, type SuggestedAction, daysBetween,
} from "./suggested-action.js";

export interface RuleOptions {
  sprintEndWithinDays?: number;
  complexQuietDays?: number;
  stakeholderDueWithinDays?: number;
}

export function runSpecificationRules(snap: CanonicalSnapshot, opts: RuleOptions = {}): SuggestedAction[] {
  const sprintWindow = opts.sprintEndWithinDays ?? 3;
  const complexQuiet = opts.complexQuietDays ?? 3;
  const stakeholderWindow = opts.stakeholderDueWithinDays ?? 2;
  return [
    ...sprintEnd(snap, sprintWindow),
    ...complexCheckIn(snap, complexQuiet),
    ...stakeholderDue(snap, stakeholderWindow),
    ...oneOnOneOverdue(snap),
    ...gateDeadline(snap),
    ...deployAttention(snap),
    ...meetingPrep(snap),
  ];
}

function sprintEnd(snap: CanonicalSnapshot, withinDays: number): SuggestedAction[] {
  return snap.cadences
    .filter((c) => {
      const d = daysBetween(c.endDate, snap.now);
      return d >= 0 && d <= withinDays && c.openStoryCount > 0;
    })
    .map((c) => ({
      type: "sprint_end" as const, urgency: "high" as const,
      text: `${c.name} ends soon — ${c.openStoryCount} stories still open`,
      refType: "cadence", refId: c.id,
    }));
}

function complexCheckIn(snap: CanonicalSnapshot, quietDays: number): SuggestedAction[] {
  return snap.complexItems
    .filter((i) => i.daysSinceStatusChange >= quietDays)
    .map((i) => ({
      type: "complex_check_in" as const, urgency: "low" as const,
      text: `Check in on ${i.title} — high-complexity, quiet ${i.daysSinceStatusChange} days (${i.assignee})`,
      refType: "work_item", refId: i.id,
    }));
}

function stakeholderDue(snap: CanonicalSnapshot, withinDays: number): SuggestedAction[] {
  return snap.stakeholders
    .filter((s) => s.nextDue != null && daysBetween(s.nextDue, snap.now) >= 0 && daysBetween(s.nextDue, snap.now) <= withinDays)
    .map((s) => ({
      type: "stakeholder_update_due" as const, urgency: "med" as const,
      text: `Draft ${s.name}'s update (tracks ${s.cares})`,
      refType: "stakeholder", refId: s.id,
    }));
}

function oneOnOneOverdue(snap: CanonicalSnapshot): SuggestedAction[] {
  return snap.oneOnOnes
    .filter((o) => o.lastMet == null || daysBetween(snap.now, o.lastMet) > o.cadenceDays)
    .map((o) => ({
      type: "one_on_one_overdue" as const, urgency: "med" as const,
      text: `You haven't met ${o.personName} recently — schedule a 1:1`,
      refType: "person", refId: o.personId,
    }));
}

function gateDeadline(snap: CanonicalSnapshot): SuggestedAction[] {
  return snap.gates
    .filter((g) => daysBetween(g.deadline, snap.now) >= 0)
    .map((g) => ({
      type: "gate_deadline" as const, urgency: "med" as const,
      text: `${g.name} review approaches — ${g.unacceptedDeliverables} deliverables unaccepted`,
      refType: "project", refId: g.projectId,
    }));
}

function deployAttention(snap: CanonicalSnapshot): SuggestedAction[] {
  return snap.deployments
    .filter((d) => d.status === "failed" || d.status === "rolled_back")
    .map((d) => ({
      type: "deploy_attention" as const, urgency: "high" as const,
      text: `${d.releaseVersion} ${d.status} — MTTR clock running`,
      refType: "deployment", refId: d.id,
    }));
}

function meetingPrep(snap: CanonicalSnapshot): SuggestedAction[] {
  return snap.meetings
    .filter((m) => m.linkLabel != null && daysBetween(m.start, snap.now) >= 0)
    .map((m) => ({
      type: "meeting_prep" as const, urgency: "med" as const,
      text: `${m.title} soon — prep note for ${m.linkLabel}`,
      refType: "meeting", refId: m.title,
    }));
}
```

- [ ] **Step 5: Export — append to `packages/core/src/index.ts`**

```ts
export * from "./domain/intelligence/suggested-action.js";
export * from "./domain/intelligence/specification-rules.js";
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/domain/intelligence/specification-rules`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/intelligence/suggested-action.ts packages/core/src/domain/intelligence/specification-rules.ts packages/core/src/index.ts
git commit -m "feat(core): add the seven Specification rules emitting SuggestedActions"
```

---

### Task 11: Daily-brief Builder

**Files:**
- Create: `packages/core/src/domain/intelligence/daily-brief.ts`
- Create: `packages/core/src/domain/intelligence/daily-brief.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `SuggestedAction`, `Urgency` (Task 10); `AnalyzerResult`, `feature` (Task 5).
- Produces:
  - `interface DailyBrief { date: Date; headline: string; rankedActions: SuggestedAction[]; tips: string[] }`
  - `function buildDailyBrief(actions: SuggestedAction[], date: Date, managerName?: string): AnalyzerResult<DailyBrief>` — ranks actions by urgency (high > med > low), stable within a band; builds a deterministic template headline naming the count of high-urgency items and the manager; tips derived from the highest-urgency items (deterministic, no LLM); emits a `brief.action_count` feature.

- [ ] **Step 1: Write the failing test `packages/core/src/domain/intelligence/daily-brief.test.ts`**

```ts
import { expect, test } from "vitest";
import { buildDailyBrief } from "./daily-brief.js";

const date = new Date("2026-03-16");
const actions = [
  { type: "one_on_one_overdue", urgency: "med", text: "Meet Lin", refType: "person", refId: "lin" },
  { type: "sprint_end", urgency: "high", text: "Sprint 14 ends Fri", refType: "cadence", refId: "s14" },
  { type: "complex_check_in", urgency: "low", text: "Auth rewrite quiet", refType: "work_item", refId: "auth" },
] as const;

test("ranks by urgency high>med>low, stable within a band", () => {
  const { result } = buildDailyBrief([...actions], date, "Alex");
  expect(result.rankedActions.map((a) => a.urgency)).toEqual(["high", "med", "low"]);
  expect(result.rankedActions[0]!.refId).toBe("s14");
});

test("headline names the manager and the high-urgency count", () => {
  const { result, features } = buildDailyBrief([...actions], date, "Alex");
  expect(result.headline).toContain("Alex");
  expect(result.headline).toContain("1"); // one high-urgency item
  expect(features).toHaveLength(1);
});

test("empty actions => calm headline, no crash", () => {
  const { result } = buildDailyBrief([], date);
  expect(result.rankedActions).toHaveLength(0);
  expect(result.headline.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/domain/intelligence/daily-brief`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/intelligence/daily-brief.ts`**

```ts
import { feature, type AnalyzerResult, type FeatureRecord } from "./feature-record.js";
import type { SuggestedAction, Urgency } from "./suggested-action.js";

const RANK: Record<Urgency, number> = { high: 0, med: 1, low: 2 };

export interface DailyBrief {
  date: Date;
  headline: string;
  rankedActions: SuggestedAction[];
  tips: string[];
}

export function buildDailyBrief(
  actions: SuggestedAction[],
  date: Date,
  managerName?: string,
): AnalyzerResult<DailyBrief> {
  const ranked = actions
    .map((a, i) => ({ a, i }))
    .sort((x, y) => RANK[x.a.urgency] - RANK[y.a.urgency] || x.i - y.i) // stable within band
    .map(({ a }) => a);

  const highCount = ranked.filter((a) => a.urgency === "high").length;
  const who = managerName ? `${managerName}, ` : "";
  const headline = ranked.length === 0
    ? `${who}a clear runway today — nothing urgent flagged.`
    : `${who}${highCount} high-priority item${highCount === 1 ? "" : "s"} today; ${ranked.length} to review.`;

  const tips = ranked.filter((a) => a.urgency === "high").slice(0, 3).map((a) => a.text);

  const features: FeatureRecord[] = [
    feature("brief.action_count", { type: "objective", id: "daily" }, { kind: "number", number: ranked.length }, date, "daily-brief", "1"),
  ];

  return { result: { date, headline, rankedActions: ranked, tips }, features };
}
```

- [ ] **Step 4: Export — append to `packages/core/src/index.ts`**

```ts
export * from "./domain/intelligence/daily-brief.js";
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/domain/intelligence/daily-brief`
Expected: PASS (3 tests).

- [ ] **Step 6: Full green run**

Run: `pnpm -w run test:all`
Expected: dependency-cruiser clean (core still pure — no zod/contracts import leaked into core); all Phase 0 + 1 + 2 tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/intelligence/daily-brief.ts packages/core/src/index.ts
git commit -m "feat(core): add deterministic daily-brief Builder (ranked actions + templated headline)"
```

---

## Phase 2 Definition of Done

- [ ] `pnpm -w run test:all` green (dependency rule + all Phase 0/1/2 tests).
- [ ] `@pma/contracts` validates all four schemas; grounding (`grounded_on.min(1)`) and `is_draft:true` are enforced (invalid inputs throw).
- [ ] The deterministic engine covers WSJF/RICE, health composite, cross-tool capacity (the 122% case), sprint/flow, DORA, the seven Specification rules, and the daily-brief Builder — all pure, all emitting FeatureRecords.
- [ ] `@pma/core` still imports nothing from `zod`, `@pma/contracts`, `@pma/db`, or infra (dependency-cruiser clean).
- [ ] People red lines honored: capacity is ordered by id (not ranked); no leaderboard output anywhere.

## Self-Review (against the spec)

- **Spec §4 contracts (Zod types + validators for the 4 schemas, grounded_on enforced)** → Tasks 1–4. ✅
- **Spec §6 deterministic engine (WSJF/RICE, health, velocity/capacity, sprint/flow, DORA, Specification rules → Builder daily brief, FeatureRecords)** → Tasks 5–11. ✅
- **Spec §2 principle 4 (compute-first)** → every analyzer is pure computation, no LLM. ✅
- **Spec §2 principle 1 (core purity)** → core gains no zod/contracts/infra dep; dependency-cruiser guards it (Task 11 Step 6). Core defines its OWN plain `FeatureRecord` (Task 5), structurally aligned with the contracts version but not importing it. ✅
- **Spec §2 principle 7 (people red lines)** → capacity analyzer ordered by id, no ranking; teammate.insight output schema has no ranking fields. ✅
- **Deferred to Phase 3:** mapping Prisma rows → analyzer inputs and rendering; deferred to Phase 4: the stub AIPort + resolution ladder that consume these contracts. Not in scope here. ✅
- **Placeholder scan:** none — all code complete. ✅
- **Type consistency:** `FeatureRecord`/`feature`/`AnalyzerResult` defined in Task 5 are consumed with identical signatures in Tasks 6–11; `SuggestedAction`/`Urgency` defined in Task 10 are consumed unchanged in Task 11; contract output schemas all `.extend` the Task-1 `OutputBase`. ✅
