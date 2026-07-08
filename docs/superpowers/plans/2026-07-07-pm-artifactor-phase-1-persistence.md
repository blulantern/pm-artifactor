# PM Artifactor — Phase 1: Persistence + Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Depends on Phase 0 (`@pma/core`) being green.

**Goal:** Stand up the local-first persistence layer — an extended Prisma/SQLite schema covering the whole canonical model the 14 UI pages need, a Prisma repository adapter proven against a real SQLite database, the four methodology bundles + rich POC-mirroring seed data, and an in-process synchronous EventBus backed by a SQLite outbox table.

**Architecture:** The `db` workspace package owns the Prisma schema, the generated client, the seed, and the infrastructure adapters that implement `@pma/core` ports (Prisma repositories, SQLite outbox, in-process event bus). `db` is an infra edge: it depends on `@pma/core` (allowed — dependencies point inward) and `@prisma/client`. `@pma/core` never imports `db` (the dependency-cruiser rule from Phase 0 still holds). The application/composition layer arrives in Phase 2.

**Tech Stack:** Prisma 5 + `@prisma/client`, SQLite, Vitest, `@pma/core` (workspace).

## Global Constraints

- **SQLite conventions (verbatim):** SQLite lacks native enums and jsonb — model enums as `String` with a documented value set in a trailing comment; store JSON as `String`. The same schema targets Postgres later by switching the datasource provider.
- **Dependency rule still holds:** `@pma/core` imports nothing from `db`, `apps`, or any infra. `db` may import `@pma/core`.
- **IDs:** Prisma models use `@id @default(cuid())`. The domain receives IDs from the repository; it never generates them.
- **Read-only posture:** `SyncConnection.direction` defaults to `"inbound"`; nothing in this phase writes back to any external system. Tokens are never stored in a model column — `SyncConnection.authRef` is a keychain reference string only.
- **People red lines:** no ranking/leaderboard/score columns on people. `VelocityInsight` carries a `caveat` and is dimensioned; teammate notes carry a `sensitive` flag and support delete.
- **DB location:** `DATABASE_URL="file:./.vault/workspace.db"` for dev; tests use a per-test temp file DB. The `.vault/` dir is gitignored (Phase 0).
- **Test isolation:** every repository/seed/outbox test creates its own SQLite file via a helper, runs `prisma db push` or a programmatic migration against it, and deletes it after — no shared global DB in tests.
- **Prisma client output:** default location (`node_modules/.prisma/client`); `db` re-exports a typed singleton from `db/src/client.ts`.

---

### Task 1: `db` package scaffold + Prisma init

**Files:**
- Create: `db/package.json`
- Create: `db/tsconfig.json`
- Create: `db/.env` (gitignored via root `.gitignore` pattern `.vault/`; add `db/.env` to `.gitignore`)
- Create: `db/prisma/schema.prisma` (datasource + generator only, models come in Task 2)
- Modify: `.gitignore` (add `db/.env` and `db/generated/`)
- Create: `db/src/client.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: workspace package `@pma/db` exporting `prisma` (a `PrismaClient` singleton) from `db/src/client.ts`; `pnpm --filter @pma/db prisma:generate` works.

- [ ] **Step 1: Add ignore entries — append to root `.gitignore`**

```
db/.env
db/generated/
```

- [ ] **Step 2: Create `db/package.json`**

```json
{
  "name": "@pma/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:push": "prisma db push --skip-generate",
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@pma/core": "workspace:*",
    "@prisma/client": "^5.22.0"
  },
  "devDependencies": {
    "prisma": "^5.22.0",
    "tsx": "^4.19.0"
  }
}
```

- [ ] **Step 3: Create `db/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `db/.env`**

```
DATABASE_URL="file:./.vault/workspace.db"
```

- [ ] **Step 5: Create `db/prisma/schema.prisma` (datasource + generator only for now)**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 6: Create `db/src/client.ts`**

```ts
import { PrismaClient } from "@prisma/client";

let _prisma: PrismaClient | undefined;

/** Singleton PrismaClient. Pass a url to point at a specific DB (used by tests). */
export function getPrisma(url?: string): PrismaClient {
  if (url) return new PrismaClient({ datasources: { db: { url } } });
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}
```

- [ ] **Step 7: Create `db/src/index.ts`**

```ts
export { getPrisma } from "./client.js";
```

- [ ] **Step 8: Install and validate the schema**

Run: `pnpm install && pnpm --filter @pma/db exec prisma validate`
Expected: "The schema is valid 🚀". (Note: `prisma generate` intentionally refuses to emit a client while the schema has zero models — client generation is verified in Task 2 once the first model exists. Do NOT add a placeholder model here.)

- [ ] **Step 9: Commit**

```bash
git add db .gitignore pnpm-lock.yaml
git commit -m "chore(db): scaffold @pma/db package + prisma init (sqlite)"
```

---

### Task 2: The full canonical schema

**Files:**
- Modify: `db/prisma/schema.prisma` (append all models)

**Interfaces:**
- Produces: the complete SQLite schema for the spine, work execution, methodology config, people, financials, measurement, release/deployment, stakeholders, teammate notes, copilot/comms, integration, and the AI/feature store. Later tasks and phases read/write these models by the exact names below.

- [ ] **Step 1: Append all models to `db/prisma/schema.prisma`**

```prisma
// ============================== Strategy & Portfolio ==============================
model Organization {
  id        String   @id @default(cuid())
  name      String
  tier      String?
  portfolios Portfolio[]
  objectives StrategicObjective[]
  people    Person[]
  teams     Team[]
}

model Portfolio {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  name           String
  vision         String?
  status         String   @default("active")
  totalInvestment Float?
  benefitRealized Float?
  programs       Program[]
  projects       Project[]
}

model StrategicObjective {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  title          String
  horizon        String?
  measureOfSuccess String?
  weightPct      Float?   // portfolio investment weight, for the strategic-alignment panel
}

// ============================== Program & Benefits ==============================
model Program {
  id          String   @id @default(cuid())
  portfolioId String
  portfolio   Portfolio @relation(fields: [portfolioId], references: [id])
  name        String
  status      String   @default("planning") // planning | on_track | at_risk | done
  methodology String?  // display label e.g. SAFe | Hybrid
  benefitPct  Float?   // realization %
  targetEnd   DateTime?
  benefits    Benefit[]
  projects    Project[]
}

model Benefit {
  id                String  @id @default(cuid())
  programId         String
  program           Program @relation(fields: [programId], references: [id])
  name              String
  metric            String?
  baselineValue     Float?
  targetValue       Float?
  realizationStatus String  @default("planned")
}

// ============================== Project & Lifecycle ==============================
model Project {
  id            String   @id @default(cuid())
  portfolioId   String
  portfolio     Portfolio @relation(fields: [portfolioId], references: [id])
  programId     String?
  program       Program?  @relation(fields: [programId], references: [id])
  methodologyId String
  methodology   Methodology @relation(fields: [methodologyId], references: [id])
  name          String
  status        String   @default("planning") // on_track | at_risk | done
  health        Int      @default(0)          // 0-100 composite (materialized rollup)
  nextMilestone String?                        // display: "Sprint 14 ends Mar 18"
  sourceLabel   String?                        // display: Jira | Azure DevOps | GitHub
  spi           Float?
  cpi           Float?
  startDate     DateTime?
  targetEndDate DateTime?
  phases        Phase[]
  workItems     WorkItem[]
  cadences      Cadence[]
  backlogs      Backlog[]
  releases      Release[]
  raidItems     RaidItem[]
  baselines     Baseline[]
}

model Phase {
  id               String  @id @default(cuid())
  projectId        String
  project          Project @relation(fields: [projectId], references: [id])
  lifecyclePhaseId String?
  name             String
  sequence         Int
  status           String  @default("not_started")
  gate             Gate?
}

model Gate {
  id           String    @id @default(cuid())
  phaseId      String    @unique
  phase        Phase     @relation(fields: [phaseId], references: [id])
  name         String
  decision     String    @default("pending") // pending | go | no_go | conditional
  decisionDate DateTime?
}

// ============================== Work Execution (polymorphic core) ==============================
model WorkItem {
  id             String   @id @default(cuid())
  projectId      String
  project        Project  @relation(fields: [projectId], references: [id])
  parentId       String?
  parent         WorkItem?  @relation("WorkItemTree", fields: [parentId], references: [id])
  children       WorkItem[] @relation("WorkItemTree")
  workItemTypeId String
  workItemType   WorkItemType @relation(fields: [workItemTypeId], references: [id])
  cadenceId      String?
  cadence        Cadence?   @relation(fields: [cadenceId], references: [id])
  workflowStateId String?
  assigneeId     String?
  assignee       Person?    @relation(fields: [assigneeId], references: [id])
  title          String
  rank           Int        @default(0)
  estimate       Float?
  estimateUnit   String?    // points | hours | days | tshirt
  complexityBand String?    // low | med | high
  riskBand       String?    // low | med | high
  status         String     @default("todo") // todo | in_progress | done | blocked
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  lastStatusChangeAt DateTime?
  predecessors   Dependency[] @relation("Predecessor")
  successors     Dependency[] @relation("Successor")
  backlogItems   BacklogItem[]
  externalLinks  ExternalLink[]

  @@index([projectId])
  @@index([parentId])
  @@index([cadenceId])
}

model Dependency {
  id            String @id @default(cuid())
  predecessorId String
  predecessor   WorkItem @relation("Predecessor", fields: [predecessorId], references: [id])
  successorId   String
  successor     WorkItem @relation("Successor", fields: [successorId], references: [id])
  type          String // FS | SS | FF | SF | BLOCKS | RELATES
  lagDays       Int    @default(0)
}

model Cadence {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id])
  kind      String   // sprint | iteration | pi | phase_window | release
  name      String
  startDate DateTime
  endDate   DateTime
  goal      String?
  capacity  Float?
  committedPoints Float?
  workItems WorkItem[]
  capacities Capacity[]
}

model Backlog {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id])
  kind      String   // product | sprint | wbs | improvement
  items     BacklogItem[]
}

model BacklogItem {
  id         String @id @default(cuid())
  backlogId  String
  backlog    Backlog @relation(fields: [backlogId], references: [id])
  workItemId String
  workItem   WorkItem @relation(fields: [workItemId], references: [id])
  rank       Int
  // WSJF inputs (human judgments; nullable)
  wsjfUserBusinessValue Float?
  wsjfTimeCriticality   Float?
  wsjfRiskReduction     Float?
  // RICE inputs
  riceReach      Float?
  riceImpact     Float?
  riceConfidence Float?
  riceEffort     Float?
}

// ============================== Methodology config (methodology-as-data) ==============================
model Methodology {
  id          String @id @default(cuid())
  key         String @unique // SCRUM | SAFE | WATERFALL | DMAIC
  name        String
  family      String // agile | traditional | lean | hybrid
  isIterative Boolean @default(true)
  projects    Project[]
  workItemTypes WorkItemType[]
  lifecycles  Lifecycle[]
  workflows   WorkflowDefinition[]
}

model Lifecycle {
  id            String @id @default(cuid())
  methodologyId String
  methodology   Methodology @relation(fields: [methodologyId], references: [id])
  name          String
  phases        LifecyclePhase[]
}

model LifecyclePhase {
  id           String @id @default(cuid())
  lifecycleId  String
  lifecycle    Lifecycle @relation(fields: [lifecycleId], references: [id])
  name         String
  sequence     Int
  gateRequired Boolean @default(false)
}

model WorkItemType {
  id                 String @id @default(cuid())
  methodologyId      String
  methodology        Methodology @relation(fields: [methodologyId], references: [id])
  name               String // Epic | Story | Task | Work Package | Activity | Charter ...
  hierarchyLevel     Int
  defaultEstimateUnit String?
  workItems          WorkItem[]
}

model WorkflowDefinition {
  id            String @id @default(cuid())
  methodologyId String
  methodology   Methodology @relation(fields: [methodologyId], references: [id])
  appliesToType String?
  states        WorkflowState[]
}

model WorkflowState {
  id                   String @id @default(cuid())
  workflowDefinitionId String
  workflowDefinition   WorkflowDefinition @relation(fields: [workflowDefinitionId], references: [id])
  name                 String
  category             String // todo | in_progress | done | blocked
  order                Int
  fromTransitions      StateTransition[] @relation("FromState")
  toTransitions        StateTransition[] @relation("ToState")
}

model StateTransition {
  id          String @id @default(cuid())
  fromStateId String
  fromState   WorkflowState @relation("FromState", fields: [fromStateId], references: [id])
  toStateId   String
  toState     WorkflowState @relation("ToState", fields: [toStateId], references: [id])
  name        String
  requiresApproval Boolean @default(false)
}

// ============================== People, financials, measurement ==============================
model Person {
  id             String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  name           String
  email          String @unique
  role           String?
  active         Boolean @default(true)
  flowNote       String?  // display: "high-complexity backend"
  teamId         String?
  team           Team?   @relation(fields: [teamId], references: [id])
  workItems      WorkItem[]
  allocations    Allocation[]
  teammateNotes  TeammateNote[]
  skillObservations SkillObservation[]
  velocityInsights  VelocityInsight[]
  oneOnOnes      OneOnOne[]
}

model Team {
  id             String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  name           String
  members        Person[]
  capacities     Capacity[]
}

model Allocation {
  id        String   @id @default(cuid())
  personId  String
  person    Person   @relation(fields: [personId], references: [id])
  ownerType String   // project | program | portfolio | work_item
  ownerId   String
  pct       Float
  sourceLabel String? // which tool this allocation came from (for cross-tool truth)
  fromDate  DateTime?
  toDate    DateTime?
}

model Capacity {
  id             String  @id @default(cuid())
  teamId         String
  team           Team    @relation(fields: [teamId], references: [id])
  cadenceId      String?
  cadence        Cadence? @relation(fields: [cadenceId], references: [id])
  availableUnits Float
}

model Budget {
  id        String @id @default(cuid())
  ownerType String
  ownerId   String
  amount    Float
  period    String?
  costEntries CostEntry[]
}

model CostEntry {
  id         String @id @default(cuid())
  budgetId   String
  budget     Budget @relation(fields: [budgetId], references: [id])
  category   String
  amount     Float
  incurredOn DateTime?
}

model Baseline {
  id         String @id @default(cuid())
  projectId  String
  project    Project @relation(fields: [projectId], references: [id])
  type       String // schedule | cost | scope
  snapshot   String // JSON as text
  capturedOn DateTime @default(now())
}

model RaidItem {
  id          String @id @default(cuid())
  projectId   String
  project     Project @relation(fields: [projectId], references: [id])
  category    String // risk | assumption | issue | dependency
  title       String
  probability Int?
  impact      Int?
  status      String @default("open")
}

// ============================== Release & Deployment ==============================
model Release {
  id         String @id @default(cuid())
  projectId  String
  project    Project @relation(fields: [projectId], references: [id])
  version    String
  name       String?
  status     String @default("planned") // planned | deploying | released
  targetDate DateTime?
  releasedAt DateTime?
  deployments Deployment[]
}

model Environment {
  id          String @id @default(cuid())
  name        String // dev | staging | prod
  promoteOrder Int
  deployments Deployment[]
}

model Deployment {
  id            String @id @default(cuid())
  releaseId     String
  release       Release @relation(fields: [releaseId], references: [id])
  environmentId String
  environment   Environment @relation(fields: [environmentId], references: [id])
  status        String // running | success | failed | rolled_back
  buildRef      String?
  commitSha     String?
  rollbackOfId  String?
  rollbackOf    Deployment? @relation("Rollback", fields: [rollbackOfId], references: [id])
  rollbacks     Deployment[] @relation("Rollback")
  startedAt     DateTime @default(now())
  finishedAt    DateTime?
  leadTimeMinutes Int?
}

// ============================== Stakeholders ==============================
model Stakeholder {
  id             String @id @default(cuid())
  name           String
  org            String?
  role           String?
  influence      Int    @default(3) // 1-5
  interest       Int    @default(3) // 1-5
  stance         String @default("neutral") // supporter | neutral | skeptic | blocker
  preferredChannel String?
  updateCadence  String?  // display: "Biweekly · due Thu"
  nextDue        DateTime?
  caresAbout     String?  // display summary
  interests      StakeholderInterest[]
  communications Communication[]
}

model StakeholderInterest {
  id            String @id @default(cuid())
  stakeholderId String
  stakeholder   Stakeholder @relation(fields: [stakeholderId], references: [id])
  ownerType     String // strategic_objective | benefit | program | project | work_item
  ownerId       String
  reason        String?
}

model Communication {
  id            String @id @default(cuid())
  stakeholderId String
  stakeholder   Stakeholder @relation(fields: [stakeholderId], references: [id])
  channel       String?
  occurredOn    DateTime?
  summary       String?
  nextDue       DateTime?
}

// ============================== Teammate notes (PM-owned private layer) ==============================
model TeammateNote {
  id        String @id @default(cuid())
  personId  String
  person    Person @relation(fields: [personId], references: [id])
  category  String // recognition | strength | growth | motivation | goal | general
  content   String
  howToSupport String?
  sensitive Boolean @default(false)
  evidenceRefs String? // JSON array of {type,id} as text
  updatedAt DateTime @updatedAt
}

model SkillObservation {
  id          String @id @default(cuid())
  personId    String
  person      Person @relation(fields: [personId], references: [id])
  skill       String
  proficiency Int    // 1-5
  interest    Int    // 1-5
}

model VelocityInsight {
  id         String @id @default(cuid())
  personId   String
  person     Person @relation(fields: [personId], references: [id])
  dimension  String // complexity | effort | risk
  band       Int    // 0-2 (low/med/high)
  throughput Float
  caveat     String?
}

model OneOnOne {
  id           String @id @default(cuid())
  personId     String
  person       Person @relation(fields: [personId], references: [id])
  metOn        DateTime
  talkingPoints String?
  followUps    String?
}

// ============================== Copilot & comms ==============================
model SuggestedAction {
  id        String @id @default(cuid())
  type      String // sprint_end | complex_check_in | stakeholder_update_due | one_on_one_overdue | gate_deadline | deploy_attention | meeting_prep
  urgency   String // low | med | high
  text      String
  refType   String?
  refId     String?
  createdAt DateTime @default(now())
}

model DailyBrief {
  id        String   @id @default(cuid())
  date      DateTime
  headline  String
  tips      String   // JSON array as text
  createdAt DateTime @default(now())
}

model EmailMessage {
  id         String @id @default(cuid())
  threadId   String?
  subject    String
  fromEmail  String
  snippet    String
  receivedAt DateTime
  isUnread   Boolean @default(true)
  kind       String? // needs_reply | decision | risk | fyi (classification)
  linkLabel  String? // display: "linked to Ledger Migration"
}

model CalendarEvent {
  id        String @id @default(cuid())
  title     String
  start     DateTime
  end       DateTime
  isFreeTime Boolean @default(false)
  linkLabel String?
}

// ============================== Integration (read-only federation) ==============================
model ExternalSystem {
  id          String @id @default(cuid())
  vendor      String // jira | github | azure_devops | bitbucket | monday | google_calendar | gmail | confluence
  baseUrl     String?
  connections SyncConnection[]
}

model SyncConnection {
  id               String @id @default(cuid())
  externalSystemId String
  externalSystem   ExternalSystem @relation(fields: [externalSystemId], references: [id])
  authRef          String  // keychain reference — never the token itself
  direction        String  @default("inbound") // inbound | outbound | bidirectional
  lastPulledAt     DateTime?
  links            ExternalLink[]
  fieldMappings    FieldMapping[]
  events           SyncEvent[]
  snapshots        IngestionSnapshot[]
}

model ExternalLink {
  id               String @id @default(cuid())
  syncConnectionId String
  syncConnection   SyncConnection @relation(fields: [syncConnectionId], references: [id])
  internalType     String
  internalId       String
  workItemId       String?
  workItem         WorkItem? @relation(fields: [workItemId], references: [id])
  externalId       String
  externalUrl      String?
  lastSyncedAt     DateTime?
}

model FieldMapping {
  id               String @id @default(cuid())
  syncConnectionId String
  syncConnection   SyncConnection @relation(fields: [syncConnectionId], references: [id])
  internalField    String
  externalField    String
  transform        String?
}

model SyncEvent {
  id               String @id @default(cuid())
  syncConnectionId String
  syncConnection   SyncConnection @relation(fields: [syncConnectionId], references: [id])
  direction        String
  status           String
  payload          String // JSON as text
  createdAt        DateTime @default(now())
}

model IngestionSnapshot {
  id               String @id @default(cuid())
  syncConnectionId String
  syncConnection   SyncConnection @relation(fields: [syncConnectionId], references: [id])
  source           String
  pulledAt         DateTime @default(now())
  raw              String // JSON as text (provenance)
  normalized       Boolean @default(false)
}

// ============================== AI / feature store (contracts) ==============================
model AiTask {
  id             String @id @default(cuid())
  taskType       String
  inputHash      String
  output         String  // JSON as text
  groundedOn     String  // JSON array of entity ids as text
  confidence     Float
  resolutionTier String  // exact_cache | semantic_cache | incremental | learned_model | llm | deterministic
  tokensUsed     Int     @default(0)
  tokensSaved    Int     @default(0)
  humanReviewed  Boolean @default(false)
  createdAt      DateTime @default(now())
}

model AiResultCache {
  id             String  @id @default(cuid())
  keyHash        String  @unique
  taskType       String
  grain          String?
  inputHash      String
  output         String  // JSON as text
  modelVersion   String
  resolutionTier String
  tokensUsed     Int     @default(0)
  tokensSaved    Int     @default(0)
  hitCount       Int     @default(0)
  stale          Boolean @default(false)
  createdAt      DateTime @default(now())
  lastUsedAt     DateTime?
  deps           AiCacheDep[]
}

model AiCacheDep {
  id         String @id @default(cuid())
  cacheId    String
  cache      AiResultCache @relation(fields: [cacheId], references: [id])
  entityType String
  entityId   String
  field      String?
}

model FeatureRecord {
  id            String   @id @default(cuid())
  metric        String
  entityType    String
  entityId      String
  value         String   // JSON as text (FeatureValue discriminated union)
  computedAt    DateTime @default(now())
  deterministicFn String
  fnVersion     String
  inputsHash    String?
}

// ============================== Event outbox (durable local dispatch) ==============================
model OutboxEntry {
  id          String   @id @default(cuid())
  type        String
  payload     String   // JSON as text
  status      String   @default("pending") // pending | dispatched | failed
  createdAt   DateTime @default(now())
  dispatchedAt DateTime?
}
```

- [ ] **Step 2: Format and validate the schema**

Run: `pnpm --filter @pma/db exec prisma format && pnpm --filter @pma/db exec prisma validate`
Expected: "The schema is valid 🚀" (or Prisma's equivalent success message).

- [ ] **Step 3: Generate the client**

Run: `pnpm --filter @pma/db prisma:generate`
Expected: "Generated Prisma Client" with all models available.

- [ ] **Step 4: Commit**

```bash
git add db/prisma/schema.prisma
git commit -m "feat(db): add full canonical Prisma schema (spine, workitem, methodology, people, release, stakeholders, notes, AI store)"
```

---

### Task 3: Test DB helper + connectivity test

**Files:**
- Create: `db/src/testing/test-db.ts`
- Create: `db/src/testing/connectivity.test.ts`

**Interfaces:**
- Consumes: `getPrisma` (Task 1), schema (Task 2).
- Produces:
  - `async function makeTestDb(): Promise<{ prisma: PrismaClient; url: string; cleanup: () => Promise<void> }>` — creates a unique temp SQLite file, applies the schema with `prisma db push`, returns a client pointed at it plus a cleanup that disconnects and deletes the file.

- [ ] **Step 1: Create `db/src/testing/test-db.ts`**

```ts
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPrisma } from "../client.js";
import type { PrismaClient } from "@prisma/client";

export async function makeTestDb(): Promise<{
  prisma: PrismaClient;
  url: string;
  cleanup: () => Promise<void>;
}> {
  const dir = mkdtempSync(join(tmpdir(), "pma-test-"));
  const file = join(dir, "test.db");
  const url = `file:${file}`;
  // Apply the schema to the fresh file.
  execSync(`pnpm --filter @pma/db exec prisma db push --skip-generate`, {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });
  const prisma = getPrisma(url);
  return {
    prisma,
    url,
    cleanup: async () => {
      await prisma.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
```

- [ ] **Step 2: Create `db/src/testing/connectivity.test.ts`**

```ts
import { expect, test } from "vitest";
import { makeTestDb } from "./test-db.js";

test("a fresh test DB accepts and reads back an organization", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const found = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(found?.name).toBe("Acme");
  } finally {
    await cleanup();
  }
}, 30000);
```

- [ ] **Step 3: Run the connectivity test**

Run: `pnpm -w test:run db/src/testing/connectivity`
Expected: PASS (may take a few seconds — it runs `prisma db push` against a temp file).

- [ ] **Step 4: Commit**

```bash
git add db/src/testing
git commit -m "test(db): add temp-DB helper + connectivity test"
```

---

### Task 4: Prisma WorkItem repository adapter

**Files:**
- Create: `db/src/persistence/work-item-mapper.ts`
- Create: `db/src/persistence/prisma-work-item-repository.ts`
- Create: `db/src/persistence/prisma-work-item-repository.test.ts`
- Modify: `db/src/index.ts` (export the repository)

**Interfaces:**
- Consumes: `WorkItemRepository`, `WorkItem`, `WorkItemProps`, branded id constructors from `@pma/core`; `makeTestDb` (Task 3).
- Produces:
  - `function toDomain(row: PrismaWorkItemRow): WorkItem` and `function toCreateInput(item: WorkItem): Prisma.WorkItemUncheckedCreateInput`.
  - `class PrismaWorkItemRepository implements WorkItemRepository` constructed with a `PrismaClient`.

- [ ] **Step 1: Write the failing test `db/src/persistence/prisma-work-item-repository.test.ts`**

```ts
import { expect, test } from "vitest";
import { makeTestDb } from "../testing/test-db.js";
import { PrismaWorkItemRepository } from "./prisma-work-item-repository.js";
import { WorkItem, workItemId, projectId, workItemTypeId, WorkItemTree } from "@pma/core";

async function seedProjectAndType(prisma: any) {
  const org = await prisma.organization.create({ data: { name: "Org" } });
  const pf = await prisma.portfolio.create({ data: { name: "PF", organizationId: org.id } });
  const meth = await prisma.methodology.create({ data: { key: "SCRUM", name: "Scrum", family: "agile" } });
  const type = await prisma.workItemType.create({ data: { methodologyId: meth.id, name: "Story", hierarchyLevel: 2 } });
  const proj = await prisma.project.create({ data: { name: "Proj", portfolioId: pf.id, methodologyId: meth.id } });
  return { projectId: proj.id as string, typeId: type.id as string };
}

test("saves a work item and reads it back by project with correct rollup", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const ids = await seedProjectAndType(prisma);
    const repo = new PrismaWorkItemRepository(prisma);
    const P = projectId(ids.projectId);
    const T = workItemTypeId(ids.typeId);

    const epic = new WorkItem({
      id: workItemId("epic-1"), projectId: P, parentId: null, typeId: T,
      title: "Epic", status: "in_progress", estimate: null, estimateUnit: null,
      complexityBand: null, riskBand: null, assigneeId: null,
    });
    const story = new WorkItem({
      id: workItemId("story-1"), projectId: P, parentId: workItemId("epic-1"), typeId: T,
      title: "Story", status: "done", estimate: 5, estimateUnit: "points",
      complexityBand: "high", riskBand: null, assigneeId: null,
    });
    await repo.save(epic);
    await repo.save(story);

    const items = await repo.findByProject(P);
    expect(items).toHaveLength(2);
    const tree = WorkItemTree.fromFlat(items);
    expect(tree.rolledUpEstimate(workItemId("epic-1"))).toBe(5);
    expect(tree.rolledUpStatus(workItemId("epic-1"))).toBe("done");

    const one = await repo.findById(workItemId("story-1"));
    expect(one?.complexityBand).toBe("high");
  } finally {
    await cleanup();
  }
}, 30000);
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run db/src/persistence`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `db/src/persistence/work-item-mapper.ts`**

```ts
import { WorkItem, workItemId, projectId, workItemTypeId, personId } from "@pma/core";
import type { WorkItemProps } from "@pma/core";
import type { StatusCategory, Band, EstimateUnit } from "@pma/core";

export interface WorkItemRow {
  id: string;
  projectId: string;
  parentId: string | null;
  workItemTypeId: string;
  assigneeId: string | null;
  title: string;
  status: string;
  estimate: number | null;
  estimateUnit: string | null;
  complexityBand: string | null;
  riskBand: string | null;
}

export function toDomain(row: WorkItemRow): WorkItem {
  const props: WorkItemProps = {
    id: workItemId(row.id),
    projectId: projectId(row.projectId),
    parentId: row.parentId ? workItemId(row.parentId) : null,
    typeId: workItemTypeId(row.workItemTypeId),
    title: row.title,
    status: row.status as StatusCategory,
    estimate: row.estimate,
    estimateUnit: (row.estimateUnit as EstimateUnit | null) ?? null,
    complexityBand: (row.complexityBand as Band | null) ?? null,
    riskBand: (row.riskBand as Band | null) ?? null,
    assigneeId: row.assigneeId ? personId(row.assigneeId) : null,
  };
  return new WorkItem(props);
}

export function toCreateInput(item: WorkItem) {
  const p = item.toProps();
  return {
    id: p.id,
    projectId: p.projectId,
    parentId: p.parentId,
    workItemTypeId: p.typeId,
    assigneeId: p.assigneeId,
    title: p.title,
    status: p.status,
    estimate: p.estimate,
    estimateUnit: p.estimateUnit,
    complexityBand: p.complexityBand,
    riskBand: p.riskBand,
    rank: 0,
  };
}
```

- [ ] **Step 4: Create `db/src/persistence/prisma-work-item-repository.ts`**

```ts
import type { PrismaClient } from "@prisma/client";
import type { WorkItemRepository, WorkItem, WorkItemId, ProjectId } from "@pma/core";
import { toDomain, toCreateInput, type WorkItemRow } from "./work-item-mapper.js";

export class PrismaWorkItemRepository implements WorkItemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByProject(projectId: ProjectId): Promise<WorkItem[]> {
    const rows = await this.prisma.workItem.findMany({ where: { projectId: projectId as string } });
    return rows.map((r) => toDomain(r as unknown as WorkItemRow));
  }

  async findById(id: WorkItemId): Promise<WorkItem | null> {
    const row = await this.prisma.workItem.findUnique({ where: { id: id as string } });
    return row ? toDomain(row as unknown as WorkItemRow) : null;
  }

  async save(item: WorkItem): Promise<void> {
    const data = toCreateInput(item);
    await this.prisma.workItem.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }
}
```

- [ ] **Step 5: Export from `db/src/index.ts` — append**

```ts
export { PrismaWorkItemRepository } from "./persistence/prisma-work-item-repository.js";
export { toDomain, toCreateInput } from "./persistence/work-item-mapper.js";
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm -w test:run db/src/persistence`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add db/src/persistence db/src/index.ts
git commit -m "feat(db): add Prisma WorkItem repository adapter + mapper"
```

---

### Task 5: Methodology bundle seed

**Files:**
- Create: `db/prisma/seed-methodologies.ts`
- Create: `db/src/seed/seed-methodologies.test.ts`

**Interfaces:**
- Consumes: schema (Task 2), `makeTestDb` (Task 3).
- Produces:
  - `async function seedMethodologies(prisma: PrismaClient): Promise<void>` — inserts the four methodology rows (SCRUM, SAFE, WATERFALL, DMAIC) each with its lifecycle+phases, work-item types, and a workflow definition with states+transitions. Idempotent by `Methodology.key` (skips if present).

- [ ] **Step 1: Write the failing test `db/src/seed/seed-methodologies.test.ts`**

```ts
import { expect, test } from "vitest";
import { makeTestDb } from "../testing/test-db.js";
import { seedMethodologies } from "../../prisma/seed-methodologies.js";

test("seeds the four methodology bundles with types and workflow states", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await seedMethodologies(prisma);
    const keys = (await prisma.methodology.findMany()).map((m) => m.key).sort();
    expect(keys).toEqual(["DMAIC", "SAFE", "SCRUM", "WATERFALL"]);

    const scrum = await prisma.methodology.findUnique({
      where: { key: "SCRUM" },
      include: { workItemTypes: true, workflows: { include: { states: true } } },
    });
    expect(scrum!.workItemTypes.map((t) => t.name)).toContain("Story");
    expect(scrum!.workflows[0]!.states.length).toBeGreaterThanOrEqual(3);

    // Idempotent: running twice does not duplicate.
    await seedMethodologies(prisma);
    expect(await prisma.methodology.count()).toBe(4);
  } finally {
    await cleanup();
  }
}, 30000);
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run db/src/seed/seed-methodologies`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `db/prisma/seed-methodologies.ts`**

```ts
import type { PrismaClient } from "@prisma/client";

interface Bundle {
  key: string;
  name: string;
  family: string;
  isIterative: boolean;
  types: { name: string; level: number; unit: string }[];
  phases: { name: string; gate: boolean }[];
  states: { name: string; category: string }[];
  transitions: { from: string; to: string; name: string; approval?: boolean }[];
}

const BUNDLES: Bundle[] = [
  {
    key: "SCRUM", name: "Scrum", family: "agile", isIterative: true,
    types: [
      { name: "Epic", level: 1, unit: "points" },
      { name: "Story", level: 2, unit: "points" },
      { name: "Task", level: 3, unit: "points" },
    ],
    phases: [{ name: "Sprint", gate: false }],
    states: [
      { name: "To Do", category: "todo" },
      { name: "In Progress", category: "in_progress" },
      { name: "Done", category: "done" },
    ],
    transitions: [
      { from: "To Do", to: "In Progress", name: "start" },
      { from: "In Progress", to: "Done", name: "finish" },
    ],
  },
  {
    key: "SAFE", name: "SAFe", family: "agile", isIterative: true,
    types: [
      { name: "Portfolio Epic", level: 1, unit: "points" },
      { name: "Feature", level: 2, unit: "points" },
      { name: "Story", level: 3, unit: "points" },
    ],
    phases: [{ name: "PI Planning", gate: true }, { name: "Execution", gate: false }, { name: "Inspect & Adapt", gate: true }],
    states: [
      { name: "Funnel", category: "todo" },
      { name: "Implementing", category: "in_progress" },
      { name: "Done", category: "done" },
    ],
    transitions: [
      { from: "Funnel", to: "Implementing", name: "pull" },
      { from: "Implementing", to: "Done", name: "complete" },
    ],
  },
  {
    key: "WATERFALL", name: "Waterfall", family: "traditional", isIterative: false,
    types: [
      { name: "Work Package", level: 1, unit: "days" },
      { name: "Activity", level: 2, unit: "days" },
      { name: "Task", level: 3, unit: "days" },
    ],
    phases: [
      { name: "Initiate", gate: true }, { name: "Plan", gate: true },
      { name: "Execute", gate: true }, { name: "Monitor", gate: false }, { name: "Close", gate: true },
    ],
    states: [
      { name: "Not Started", category: "todo" },
      { name: "In Progress", category: "in_progress" },
      { name: "Complete", category: "done" },
    ],
    transitions: [
      { from: "Not Started", to: "In Progress", name: "begin" },
      { from: "In Progress", to: "Complete", name: "complete", approval: true },
    ],
  },
  {
    key: "DMAIC", name: "DMAIC", family: "lean", isIterative: false,
    types: [
      { name: "Improvement Charter", level: 1, unit: "days" },
      { name: "Root Cause", level: 2, unit: "days" },
      { name: "Corrective Action", level: 3, unit: "days" },
    ],
    phases: [
      { name: "Define", gate: true }, { name: "Measure", gate: true }, { name: "Analyze", gate: true },
      { name: "Improve", gate: true }, { name: "Control", gate: true },
    ],
    states: [
      { name: "Open", category: "todo" },
      { name: "Investigating", category: "in_progress" },
      { name: "Controlled", category: "done" },
    ],
    transitions: [
      { from: "Open", to: "Investigating", name: "investigate" },
      { from: "Investigating", to: "Controlled", name: "control", approval: true },
    ],
  },
];

export async function seedMethodologies(prisma: PrismaClient): Promise<void> {
  for (const b of BUNDLES) {
    const existing = await prisma.methodology.findUnique({ where: { key: b.key } });
    if (existing) continue;

    const meth = await prisma.methodology.create({
      data: { key: b.key, name: b.name, family: b.family, isIterative: b.isIterative },
    });
    const lifecycle = await prisma.lifecycle.create({
      data: { methodologyId: meth.id, name: b.name },
    });
    await prisma.lifecyclePhase.createMany({
      data: b.phases.map((p, i) => ({
        lifecycleId: lifecycle.id, name: p.name, sequence: i, gateRequired: p.gate,
      })),
    });
    await prisma.workItemType.createMany({
      data: b.types.map((t) => ({
        methodologyId: meth.id, name: t.name, hierarchyLevel: t.level, defaultEstimateUnit: t.unit,
      })),
    });
    const wf = await prisma.workflowDefinition.create({ data: { methodologyId: meth.id } });
    const stateIds = new Map<string, string>();
    for (let i = 0; i < b.states.length; i++) {
      const s = b.states[i]!;
      const created = await prisma.workflowState.create({
        data: { workflowDefinitionId: wf.id, name: s.name, category: s.category, order: i },
      });
      stateIds.set(s.name, created.id);
    }
    for (const t of b.transitions) {
      await prisma.stateTransition.create({
        data: {
          fromStateId: stateIds.get(t.from)!,
          toStateId: stateIds.get(t.to)!,
          name: t.name,
          requiresApproval: t.approval ?? false,
        },
      });
    }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -w test:run db/src/seed/seed-methodologies`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/prisma/seed-methodologies.ts db/src/seed
git commit -m "feat(db): seed the four methodology bundles (Scrum/SAFe/Waterfall/DMAIC)"
```

---

### Task 6: POC-mirroring domain seed

**Files:**
- Create: `db/prisma/seed-poc.ts`
- Create: `db/prisma/seed.ts` (entry point wiring both seeds)
- Create: `db/src/seed/seed-poc.test.ts`

**Interfaces:**
- Consumes: `seedMethodologies` (Task 5), schema (Task 2).
- Produces:
  - `async function seedPoc(prisma: PrismaClient): Promise<void>` — creates the Digital Banking org/portfolio, 2 programs, 3 projects (each linked to a seeded methodology), a Scrum project's epic→story→task tree with a Sprint 14 cadence, 4 people with allocations (Sam at 122% across two sources), 4 stakeholders with interests, a 5-item backlog with WSJF/RICE inputs, 2 releases with environments+deployments (one rolled back for CFR), 4 emails, 4 calendar events, the 7 suggested actions, and teammate notes/skills/velocity for the team. Idempotent by portfolio name.
  - `db/prisma/seed.ts` runs `seedMethodologies` then `seedPoc` against the default client (for `pnpm --filter @pma/db seed`).

- [ ] **Step 1: Write the failing test `db/src/seed/seed-poc.test.ts`**

```ts
import { expect, test } from "vitest";
import { makeTestDb } from "../testing/test-db.js";
import { seedMethodologies } from "../../prisma/seed-methodologies.js";
import { seedPoc } from "../../prisma/seed-poc.js";

test("POC seed creates the portfolio, 3 projects, and the cross-tool overallocation case", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await seedMethodologies(prisma);
    await seedPoc(prisma);

    const portfolio = await prisma.portfolio.findFirst({ where: { name: "Digital Banking Portfolio" } });
    expect(portfolio).not.toBeNull();
    expect(await prisma.project.count()).toBe(3);
    expect(await prisma.stakeholder.count()).toBe(4);
    expect(await prisma.backlogItem.count()).toBe(5);

    // Sam is over 100% once allocations across sources are summed.
    const sam = await prisma.person.findFirst({ where: { name: "Sam Rivera" }, include: { allocations: true } });
    const total = sam!.allocations.reduce((s, a) => s + a.pct, 0);
    expect(total).toBeGreaterThan(100);

    // A rolled-back deployment exists (drives change-failure-rate).
    const rolledBack = await prisma.deployment.count({ where: { status: "rolled_back" } });
    expect(rolledBack).toBeGreaterThanOrEqual(1);

    // Seven suggested actions for the Today page.
    expect(await prisma.suggestedAction.count()).toBe(7);
  } finally {
    await cleanup();
  }
}, 30000);
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run db/src/seed/seed-poc`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `db/prisma/seed-poc.ts`**

```ts
import type { PrismaClient } from "@prisma/client";

export async function seedPoc(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.portfolio.findFirst({ where: { name: "Digital Banking Portfolio" } });
  if (existing) return;

  const org = await prisma.organization.create({ data: { name: "Northwind Bank", tier: "enterprise" } });
  const portfolio = await prisma.portfolio.create({
    data: {
      name: "Digital Banking Portfolio", organizationId: org.id, vision: "Modern, trusted banking",
      status: "active", totalInvestment: 12.4, benefitRealized: 4.1,
    },
  });

  await prisma.strategicObjective.createMany({
    data: [
      { organizationId: org.id, title: "Grow deposits", weightPct: 42 },
      { organizationId: org.id, title: "Reduce fraud loss", weightPct: 31 },
      { organizationId: org.id, title: "Improve NPS", weightPct: 18 },
    ],
  });

  const pay = await prisma.program.create({
    data: { portfolioId: portfolio.id, name: "Payments Modernization", status: "on_track", methodology: "SAFe", benefitPct: 68 },
  });
  const cx = await prisma.program.create({
    data: { portfolioId: portfolio.id, name: "Customer Experience", status: "at_risk", methodology: "Hybrid", benefitPct: 41 },
  });
  await prisma.benefit.create({ data: { programId: pay.id, name: "Ledger cost savings", metric: "$", baselineValue: 0, targetValue: 2.5, realizationStatus: "in_progress" } });

  const scrum = (await prisma.methodology.findUnique({ where: { key: "SCRUM" } }))!;
  const waterfall = (await prisma.methodology.findUnique({ where: { key: "WATERFALL" } }))!;

  const checkout = await prisma.project.create({
    data: {
      name: "Mobile Checkout Revamp", portfolioId: portfolio.id, programId: cx.id, methodologyId: scrum.id,
      status: "at_risk", health: 62, nextMilestone: "Sprint 14 ends Mar 18", sourceLabel: "Jira", spi: 0.92, cpi: 1.03,
    },
  });
  const ledger = await prisma.project.create({
    data: {
      name: "Ledger Migration", portfolioId: portfolio.id, programId: pay.id, methodologyId: waterfall.id,
      status: "at_risk", health: 70, nextMilestone: "Gate 2 · Mar 22", sourceLabel: "Azure DevOps", spi: 0.88, cpi: 0.96,
    },
  });
  const fraud = await prisma.project.create({
    data: {
      name: "Fraud Signals v2", portfolioId: portfolio.id, programId: pay.id, methodologyId: scrum.id,
      status: "on_track", health: 86, nextMilestone: "Continuous", sourceLabel: "GitHub", spi: 1.0, cpi: 1.02,
    },
  });

  // Scrum tree for Checkout: epic -> 3 stories, in Sprint 14.
  const storyType = (await prisma.workItemType.findFirst({ where: { methodologyId: scrum.id, name: "Story" } }))!;
  const epicType = (await prisma.workItemType.findFirst({ where: { methodologyId: scrum.id, name: "Epic" } }))!;
  const sprint = await prisma.cadence.create({
    data: {
      projectId: checkout.id, kind: "sprint", name: "Sprint 14",
      startDate: new Date("2026-03-04"), endDate: new Date("2026-03-18"), goal: "Checkout revamp", capacity: 40, committedPoints: 34,
    },
  });
  const epic = await prisma.workItem.create({
    data: { projectId: checkout.id, workItemTypeId: epicType.id, title: "Checkout revamp", status: "in_progress" },
  });
  await prisma.workItem.createMany({
    data: [
      { projectId: checkout.id, parentId: epic.id, workItemTypeId: storyType.id, cadenceId: sprint.id, title: "Payment sheet", status: "done", estimate: 8, estimateUnit: "points", complexityBand: "med" },
      { projectId: checkout.id, parentId: epic.id, workItemTypeId: storyType.id, cadenceId: sprint.id, title: "Apple Pay", status: "in_progress", estimate: 5, estimateUnit: "points", complexityBand: "high" },
      { projectId: checkout.id, parentId: epic.id, workItemTypeId: storyType.id, cadenceId: sprint.id, title: "a11y pass", status: "in_progress", estimate: 3, estimateUnit: "points", complexityBand: "low" },
    ],
  });

  // Team of four.
  const team = await prisma.team.create({ data: { organizationId: org.id, name: "Checkout Squad" } });
  const dana = await prisma.person.create({ data: { organizationId: org.id, teamId: team.id, name: "Dana Okafor", email: "dana@northwind.example", role: "Sr. Backend Eng", flowNote: "high-complexity backend" } });
  const sam = await prisma.person.create({ data: { organizationId: org.id, teamId: team.id, name: "Sam Rivera", email: "sam@northwind.example", role: "Frontend Eng", flowNote: "polished small/med UI" } });
  const lin = await prisma.person.create({ data: { organizationId: org.id, teamId: team.id, name: "Lin Chen", email: "lin@northwind.example", role: "Data Eng", flowNote: "steady, load-bearing work" } });
  const theo = await prisma.person.create({ data: { organizationId: org.id, teamId: team.id, name: "Theo Adékúnlé", email: "theo@northwind.example", role: "QA / Automation", flowNote: "consistent, thorough" } });

  // Allocations — Sam overallocated across two sources (F1 cross-tool truth).
  await prisma.allocation.createMany({
    data: [
      { personId: dana.id, ownerType: "project", ownerId: checkout.id, pct: 68, sourceLabel: "Jira" },
      { personId: sam.id, ownerType: "project", ownerId: checkout.id, pct: 70, sourceLabel: "Jira" },
      { personId: sam.id, ownerType: "project", ownerId: fraud.id, pct: 52, sourceLabel: "Monday" },
      { personId: lin.id, ownerType: "project", ownerId: ledger.id, pct: 84, sourceLabel: "Azure DevOps" },
      { personId: theo.id, ownerType: "project", ownerId: checkout.id, pct: 55, sourceLabel: "Jira" },
    ],
  });

  // Skills + velocity + a note for Dana (shape the person page).
  await prisma.skillObservation.createMany({
    data: [
      { personId: dana.id, skill: "Distributed systems", proficiency: 5, interest: 5 },
      { personId: dana.id, skill: "Kubernetes", proficiency: 2, interest: 4 },
      { personId: sam.id, skill: "React / UI", proficiency: 5, interest: 5 },
      { personId: sam.id, skill: "Accessibility", proficiency: 3, interest: 5 },
    ],
  });
  await prisma.velocityInsight.createMany({
    data: [
      { personId: dana.id, dimension: "complexity", band: 2, throughput: 1.15, caveat: "Flows on high-complexity backend" },
      { personId: dana.id, dimension: "complexity", band: 0, throughput: 0.7 },
    ],
  });
  await prisma.teammateNote.create({
    data: { personId: dana.id, category: "recognition", content: "Shipped conflict-replay four days ahead of commitment.", howToSupport: "Give her the release-notes engine she's wanted.", evidenceRefs: '[{"type":"pr","id":"812"}]' },
  });
  await prisma.oneOnOne.create({ data: { personId: lin.id, metOn: new Date("2026-02-23"), talkingPoints: "Infra goal", followUps: "Pair on pipeline" } });

  // Stakeholders.
  const priya = await prisma.stakeholder.create({ data: { name: "Priya N.", role: "CFO · Exec Sponsor", influence: 5, interest: 4, stance: "supporter", updateCadence: "Biweekly · due Thu", nextDue: new Date("2026-03-19"), caresAbout: "Ledger benefit, budget" } });
  await prisma.stakeholder.createMany({
    data: [
      { name: "Marcus L.", role: "Head of Risk", influence: 4, interest: 5, stance: "skeptic", updateCadence: "Weekly · due Mon", caresAbout: "Fraud Signals, RAID" },
      { name: "Elena V.", role: "VP Product", influence: 4, interest: 3, stance: "neutral", updateCadence: "Monthly", caresAbout: "Checkout roadmap" },
      { name: "Raj P.", role: "Eng Director", influence: 3, interest: 2, stance: "supporter", updateCadence: "Monthly", caresAbout: "Capacity, hiring" },
    ],
  });
  await prisma.stakeholderInterest.create({ data: { stakeholderId: priya.id, ownerType: "project", ownerId: ledger.id, reason: "Tracks the Ledger benefit" } });

  // Backlog with WSJF/RICE inputs (matches POC).
  const backlog = await prisma.backlog.create({ data: { projectId: checkout.id, kind: "product" } });
  const items = [
    { title: "Enterprise SSO", bv: 8, tc: 5, rr: 8, size: 5, r: 2000, i: 2, c: 80, e: 3 },
    { title: "Audit logging", bv: 5, tc: 2, rr: 8, size: 3, r: 800, i: 1, c: 90, e: 2 },
    { title: "Release-notes engine", bv: 8, tc: 3, rr: 3, size: 8, r: 1200, i: 2, c: 70, e: 5 },
    { title: "Checkout a11y pass", bv: 5, tc: 8, rr: 2, size: 3, r: 5000, i: 1, c: 85, e: 2 },
    { title: "Billing proration", bv: 3, tc: 2, rr: 2, size: 2, r: 400, i: 0.5, c: 60, e: 2 },
  ];
  let rank = 0;
  for (const it of items) {
    const wi = await prisma.workItem.create({
      data: { projectId: checkout.id, workItemTypeId: storyType.id, title: it.title, status: "todo", estimate: it.size, estimateUnit: "points" },
    });
    await prisma.backlogItem.create({
      data: {
        backlogId: backlog.id, workItemId: wi.id, rank: rank++,
        wsjfUserBusinessValue: it.bv, wsjfTimeCriticality: it.tc, wsjfRiskReduction: it.rr,
        riceReach: it.r, riceImpact: it.i, riceConfidence: it.c, riceEffort: it.e,
      },
    });
  }

  // Releases + environments + deployments (DORA: include a rollback).
  const dev = await prisma.environment.create({ data: { name: "dev", promoteOrder: 0 } });
  const staging = await prisma.environment.create({ data: { name: "staging", promoteOrder: 1 } });
  const prod = await prisma.environment.create({ data: { name: "prod", promoteOrder: 2 } });
  const v23 = await prisma.release.create({ data: { projectId: checkout.id, version: "v2.3", name: "Checkout + Fraud", status: "deploying" } });
  const v22 = await prisma.release.create({ data: { projectId: ledger.id, version: "v2.2", name: "Ledger phase 1", status: "released", releasedAt: new Date("2026-03-10") } });
  await prisma.deployment.createMany({
    data: [
      { releaseId: v23.id, environmentId: dev.id, status: "success", leadTimeMinutes: 40 },
      { releaseId: v23.id, environmentId: staging.id, status: "success", leadTimeMinutes: 55 },
      { releaseId: v23.id, environmentId: prod.id, status: "running" },
      { releaseId: v22.id, environmentId: dev.id, status: "success", leadTimeMinutes: 30 },
      { releaseId: v22.id, environmentId: staging.id, status: "success", leadTimeMinutes: 45 },
      { releaseId: v22.id, environmentId: prod.id, status: "success", leadTimeMinutes: 60 },
    ],
  });
  const fraudRelease = await prisma.release.create({ data: { projectId: fraud.id, version: "v1.9", name: "Fraud model", status: "released" } });
  const failedProd = await prisma.deployment.create({ data: { releaseId: fraudRelease.id, environmentId: prod.id, status: "rolled_back", leadTimeMinutes: 52 } });
  await prisma.deployment.create({ data: { releaseId: fraudRelease.id, environmentId: prod.id, status: "success", rollbackOfId: failedProd.id, leadTimeMinutes: 20 } });

  // Emails, calendar, suggested actions.
  await prisma.emailMessage.createMany({
    data: [
      { subject: "Ledger cutover date", fromEmail: "priya@northwind.example", snippet: "Confirm the Ledger cutover date before the board deck.", receivedAt: new Date("2026-03-16T07:10:00Z"), kind: "needs_reply", linkLabel: "Ledger Migration" },
      { subject: "Fraud threshold", fromEmail: "marcus@northwind.example", snippet: "Wants sign-off on the fraud model threshold change.", receivedAt: new Date("2026-03-16T06:40:00Z"), kind: "decision", linkLabel: "Fraud Signals v2" },
      { subject: "Gateway maintenance", fromEmail: "ops@vendor.example", snippet: "Payment gateway maintenance window overlaps release v2.3.", receivedAt: new Date("2026-03-15T22:00:00Z"), kind: "risk", linkLabel: "Release v2.3" },
      { subject: "Q2 roadmap", fromEmail: "elena@northwind.example", snippet: "Shared updated Q2 roadmap for Checkout.", receivedAt: new Date("2026-03-15T18:00:00Z"), kind: "fyi", linkLabel: "Mobile Checkout" },
    ],
  });
  await prisma.calendarEvent.createMany({
    data: [
      { title: "Standup · Checkout", start: new Date("2026-03-16T09:00:00Z"), end: new Date("2026-03-16T09:15:00Z"), linkLabel: "Mobile Checkout Revamp" },
      { title: "1:1 open slot", start: new Date("2026-03-16T11:30:00Z"), end: new Date("2026-03-16T12:00:00Z"), isFreeTime: true },
      { title: "Risk review · Marcus", start: new Date("2026-03-16T14:00:00Z"), end: new Date("2026-03-16T14:30:00Z") },
      { title: "Sprint 14 review prep", start: new Date("2026-03-16T16:00:00Z"), end: new Date("2026-03-16T16:30:00Z") },
    ],
  });
  await prisma.suggestedAction.createMany({
    data: [
      { type: "sprint_end", urgency: "high", text: "Sprint 14 ends Fri — 3 stories still In Progress on Checkout", refType: "project", refId: checkout.id },
      { type: "deploy_attention", urgency: "high", text: "Release v2.3 is deploying to prod — watch the gateway maintenance overlap", refType: "release", refId: v23.id },
      { type: "stakeholder_update_due", urgency: "med", text: "Draft Priya's biweekly update (she tracks the Ledger benefit) — due Thu", refType: "stakeholder", refId: priya.id },
      { type: "one_on_one_overdue", urgency: "med", text: "You haven't met Lin in 3 weeks — she has an open infra goal", refType: "person", refId: lin.id },
      { type: "gate_deadline", urgency: "med", text: "Ledger Gate 2 review is Mar 22 — 2 deliverables still unaccepted", refType: "project", refId: ledger.id },
      { type: "complex_check_in", urgency: "low", text: "Auth-rewrite (high-complexity) has been quiet 4 days — check in with Dana", refType: "person", refId: dana.id },
      { type: "meeting_prep", urgency: "med", text: "Standup in 40m; prep note: 2 blockers flagged overnight", refType: "project", refId: checkout.id },
    ],
  });

  // Read-only connections shown on the Connections page.
  const jira = await prisma.externalSystem.create({ data: { vendor: "jira" } });
  await prisma.syncConnection.create({ data: { externalSystemId: jira.id, authRef: "keychain:jira", direction: "inbound", lastPulledAt: new Date() } });
}
```

- [ ] **Step 4: Create `db/prisma/seed.ts`**

```ts
import { getPrisma } from "../src/client.js";
import { seedMethodologies } from "./seed-methodologies.js";
import { seedPoc } from "./seed-poc.js";

async function main() {
  const prisma = getPrisma();
  await seedMethodologies(prisma);
  await seedPoc(prisma);
  await prisma.$disconnect();
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -w test:run db/src/seed/seed-poc`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/prisma/seed-poc.ts db/prisma/seed.ts db/src/seed/seed-poc.test.ts
git commit -m "feat(db): seed POC-mirroring domain data (portfolio, projects, team, releases, backlog, copilot)"
```

---

### Task 7: SQLite outbox + in-process EventBus adapter

**Files:**
- Create: `db/src/messaging/prisma-outbox.ts`
- Create: `db/src/messaging/sqlite-event-bus.ts`
- Create: `db/src/messaging/messaging.test.ts`
- Modify: `db/src/index.ts` (export both)

**Interfaces:**
- Consumes: `EventBus`, `OutboxPort`, `DomainEvent` from `@pma/core`; schema `OutboxEntry` (Task 2).
- Produces:
  - `class PrismaOutbox implements OutboxPort` — `enqueue` writes an `OutboxEntry` row (status `pending`).
  - `class SqliteEventBus implements EventBus` — synchronous in-process dispatch to subscribers AND persists each published event to the outbox (so a restart can replay). Exposes `pendingCount()` for tests.

- [ ] **Step 1: Write the failing test `db/src/messaging/messaging.test.ts`**

```ts
import { expect, test } from "vitest";
import { makeTestDb } from "../testing/test-db.js";
import { SqliteEventBus } from "./sqlite-event-bus.js";
import { PrismaOutbox } from "./prisma-outbox.js";

test("event bus dispatches synchronously and records to the outbox", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const bus = new SqliteEventBus(prisma);
    const seen: string[] = [];
    bus.subscribe("WorkItemStatusChanged", async (e) => { seen.push(e.aggregateId); });
    await bus.publish([{ type: "WorkItemStatusChanged", occurredAt: new Date(), aggregateId: "wi-1" }]);
    expect(seen).toEqual(["wi-1"]);
    expect(await bus.pendingCount()).toBe(1);
  } finally {
    await cleanup();
  }
}, 30000);

test("outbox enqueue writes a pending entry", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const outbox = new PrismaOutbox(prisma);
    await outbox.enqueue({ type: "PushWorkItem", payload: { id: "wi-1" } });
    const rows = await prisma.outboxEntry.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("pending");
  } finally {
    await cleanup();
  }
}, 30000);
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run db/src/messaging`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `db/src/messaging/prisma-outbox.ts`**

```ts
import type { PrismaClient } from "@prisma/client";
import type { OutboxPort } from "@pma/core";

export class PrismaOutbox implements OutboxPort {
  constructor(private readonly prisma: PrismaClient) {}
  async enqueue(command: { type: string; payload: unknown }): Promise<void> {
    await this.prisma.outboxEntry.create({
      data: { type: command.type, payload: JSON.stringify(command.payload), status: "pending" },
    });
  }
}
```

- [ ] **Step 4: Create `db/src/messaging/sqlite-event-bus.ts`**

```ts
import type { PrismaClient } from "@prisma/client";
import type { EventBus, DomainEvent } from "@pma/core";

/** Local-tier EventBus: synchronous in-process dispatch + durable outbox record. */
export class SqliteEventBus implements EventBus {
  private readonly handlers = new Map<string, ((e: DomainEvent) => Promise<void>)[]>();
  constructor(private readonly prisma: PrismaClient) {}

  subscribe(type: string, handler: (e: DomainEvent) => Promise<void>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  async publish(events: DomainEvent[]): Promise<void> {
    for (const e of events) {
      await this.prisma.outboxEntry.create({
        data: { type: e.type, payload: JSON.stringify(e), status: "pending" },
      });
      for (const h of this.handlers.get(e.type) ?? []) await h(e);
    }
  }

  async pendingCount(): Promise<number> {
    return this.prisma.outboxEntry.count({ where: { status: "pending" } });
  }
}
```

- [ ] **Step 5: Export from `db/src/index.ts` — append**

```ts
export { PrismaOutbox } from "./messaging/prisma-outbox.js";
export { SqliteEventBus } from "./messaging/sqlite-event-bus.js";
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm -w test:run db/src/messaging`
Expected: PASS (2 tests).

- [ ] **Step 7: Full green run + commit**

Run: `pnpm -w run test:all`
Expected: dependency-cruiser clean; all Phase 0 + Phase 1 tests pass.

```bash
git add db/src/messaging db/src/index.ts
git commit -m "feat(db): add SQLite outbox + in-process event bus adapter"
```

---

## Phase 1 Definition of Done

- [ ] `pnpm --filter @pma/db exec prisma validate` succeeds; the client generates.
- [ ] `pnpm -w run test:all` is green (dependency rule + Phase 0 + Phase 1 tests).
- [ ] A `WorkItem` tree round-trips through SQLite and its rollups compute correctly (Task 4).
- [ ] The four methodology bundles and full POC data seed idempotently; the cross-tool 122% case and a rolled-back deployment exist (Tasks 5, 6).
- [ ] `@pma/core` still imports nothing from `db` (dependency-cruiser rule intact).
- [ ] Running `pnpm --filter @pma/db exec prisma db push` then `pnpm --filter @pma/db seed` populates a real `.vault/workspace.db` (manual smoke, optional but recommended).

## Self-Review (against the spec)

- **Spec §5 data model** → Task 2 covers every included entity group (spine, work execution, methodology config, people/financials/measurement, release/deployment, stakeholders, teammate notes, copilot/comms, integration, AI/feature store). Deferred entities (FundingSource, ValueStream, ChangeRequest, Endorsement, InvestmentTheme) are intentionally omitted per spec §5. ✅
- **Spec §3 `db` package + dependency direction** → Task 1; `db` depends on `@pma/core`, never the reverse. ✅
- **Spec §5 seed = methodology bundles + POC data** → Tasks 5, 6. ✅
- **Spec §7 in-process EventBus + SQLite outbox** → Task 7. ✅
- **Spec §2 principle 7 people red lines** → no score/rank columns; `VelocityInsight.caveat`, dimensioned bands, `TeammateNote.sensitive`. ✅
- **Spec §2 principle 3 read-only** → `SyncConnection.direction` default `inbound`; `authRef` is a keychain reference, never a token. ✅
- **Placeholder scan:** none — all code is complete. ✅
- **Type consistency:** repository returns `@pma/core` `WorkItem` built via `toDomain`; `SqliteEventBus`/`PrismaOutbox` implement the `EventBus`/`OutboxPort` interfaces from Phase 0 Task 11 exactly. ✅
- **Deferred to Phase 2:** the application/composition layer, deterministic analyzers, and `@pma/contracts`. Not in scope here. ✅
