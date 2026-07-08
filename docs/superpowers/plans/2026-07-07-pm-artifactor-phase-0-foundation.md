# PM Artifactor — Phase 0: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the pnpm monorepo and a pure-TypeScript domain core (`packages/core`) — WorkItem Composite, MethodologyProfile (Scrum + Waterfall), WorkflowEngine, domain events, and all port interfaces with in-memory fakes — proven by unit tests with zero infrastructure present, and with the hexagonal dependency rule physically enforced.

**Architecture:** Hexagonal / ports-and-adapters. `packages/core` holds the domain and the port *interfaces* and depends on nothing outward. Behavior that varies per methodology is resolved through a `MethodologyProfile` (Abstract Factory) that wires `MetricsStrategy` / `SchedulingStrategy` (Strategy) and a data-driven `WorkflowEngine` (State-as-data). Everything is tested against in-memory port fakes, so no DB or vendor exists yet.

**Tech Stack:** Node 24, pnpm 10 workspaces, TypeScript 5 (strict), Vitest, dependency-cruiser.

## Global Constraints

- **Dependency rule (verbatim):** `packages/core` has ZERO runtime dependencies on Prisma, NestJS, Next.js, or any vendor SDK. A violating import MUST fail the build (enforced by dependency-cruiser).
- **Methodology is data, not code:** no `if (methodology === 'SCRUM')` branching in domain logic. Variation is resolved through `MethodologyProfile`.
- **Visitor is rejected:** tree operations are Strategies over the Composite, never Visitors.
- **People red lines:** no ranking/leaderboard/stack-ranking constructs anywhere. (No Phase-0 code emits person-vs-person comparisons.)
- **TypeScript:** `"strict": true`; single-method, stateless behaviors are `type` function-types, not one-method classes (TS idiom, per docs/02 §4).
- **IDs:** domain entity IDs are branded `string` types; the domain never generates IDs from infra — an ID is supplied by the caller/port.
- **Package manager:** pnpm only. Run tests with `pnpm -w test` (Vitest, workspace root).
- **Node version floor:** Node ≥ 20 (`engines` field), developed on Node 24.

---

### Task 1: Monorepo scaffold + tooling

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts` (root)
- Create: `.dependency-cruiser.cjs`
- Create: `.gitignore`
- Create: `.npmrc`

**Interfaces:**
- Consumes: nothing.
- Produces: a workspace where `pnpm -w test` runs Vitest across `packages/*` and `apps/*`, and `pnpm -w depcruise` runs the dependency rule. Root scripts: `test`, `test:run`, `typecheck`, `depcruise`.

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
dist/
.next/
*.tsbuildinfo
.vault/
coverage/
*.db
*.db-journal
```

- [ ] **Step 2: Create `.npmrc`**

```
auto-install-peers=true
strict-peer-dependencies=false
```

- [ ] **Step 3: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "apps/*"
  - "db"
```

- [ ] **Step 4: Create root `package.json`**

```json
{
  "name": "pm-artifactor",
  "private": true,
  "version": "0.0.0",
  "engines": { "node": ">=20" },
  "packageManager": "pnpm@10.33.2",
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "tsc -b --noEmit || tsc -b",
    "depcruise": "depcruise packages/core/src --config .dependency-cruiser.cjs"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "dependency-cruiser": "^16.4.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 5: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "declaration": true,
    "composite": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Step 6: Create root `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 7: Create `.dependency-cruiser.cjs`**

```js
/** Enforces the hexagonal dependency rule: packages/core imports nothing infra. */
module.exports = {
  forbidden: [
    {
      name: "core-stays-pure",
      severity: "error",
      comment: "packages/core must not import infra (prisma/next/nest/vendor SDKs).",
      from: { path: "^packages/core/src" },
      to: {
        path: "node_modules/(@prisma|prisma|next|@nestjs|@anthropic-ai|googleapis|@octokit)",
      },
    },
    {
      name: "no-app-imports-from-core",
      severity: "error",
      comment: "core must not reach into apps/* or db/*.",
      from: { path: "^packages/core/src" },
      to: { path: "^(apps|db)/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: { extensions: [".ts", ".js"] },
  },
};
```

- [ ] **Step 8: Install and verify the workspace resolves**

Run: `pnpm install`
Expected: completes without error; `node_modules` created at root.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json vitest.config.ts .dependency-cruiser.cjs .gitignore .npmrc pnpm-lock.yaml
git commit -m "chore: scaffold pnpm monorepo + tooling (vitest, dependency-cruiser)"
```

---

### Task 2: `packages/core` package skeleton

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/smoke.test.ts`

**Interfaces:**
- Consumes: root tooling from Task 1.
- Produces: workspace package `@pma/core` with no runtime dependencies; export barrel at `packages/core/src/index.ts`.

- [ ] **Step 1: Create `packages/core/package.json`** (note: NO dependencies block — the dependency rule made physical)

```json
{
  "name": "@pma/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/core/src/index.ts`**

```ts
export const CORE_VERSION = "0.0.0";
```

- [ ] **Step 4: Write the smoke test `packages/core/src/smoke.test.ts`**

```ts
import { expect, test } from "vitest";
import { CORE_VERSION } from "./index.js";

test("core package loads", () => {
  expect(CORE_VERSION).toBe("0.0.0");
});
```

- [ ] **Step 5: Run the smoke test**

Run: `pnpm -w test:run packages/core`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add packages/core
git commit -m "feat(core): add @pma/core package skeleton"
```

---

### Task 3: Shared domain primitives (IDs, enums, Result)

**Files:**
- Create: `packages/core/src/domain/shared/ids.ts`
- Create: `packages/core/src/domain/shared/enums.ts`
- Create: `packages/core/src/domain/shared/ids.test.ts`

**Interfaces:**
- Produces:
  - Branded IDs: `type WorkItemId = string & { readonly __brand: "WorkItemId" }`; same shape for `ProjectId`, `CadenceId`, `WorkItemTypeId`, `WorkflowStateId`, `PersonId`. Constructors `workItemId(s: string): WorkItemId` etc.
  - `type MethodologyKey = "SCRUM" | "SAFE" | "WATERFALL" | "DMAIC"`.
  - `type StatusCategory = "todo" | "in_progress" | "done" | "blocked"`.
  - `type Band = "low" | "med" | "high"`.
  - `type EstimateUnit = "points" | "hours" | "days" | "tshirt"`.

- [ ] **Step 1: Write the failing test `packages/core/src/domain/shared/ids.test.ts`**

```ts
import { expect, test } from "vitest";
import { workItemId, projectId } from "./ids.js";

test("branded id constructors preserve the string value", () => {
  expect(workItemId("wi-1")).toBe("wi-1");
  expect(projectId("p-1")).toBe("p-1");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/domain/shared`
Expected: FAIL — cannot find module `./ids.js`.

- [ ] **Step 3: Create `packages/core/src/domain/shared/ids.ts`**

```ts
export type WorkItemId = string & { readonly __brand: "WorkItemId" };
export type ProjectId = string & { readonly __brand: "ProjectId" };
export type CadenceId = string & { readonly __brand: "CadenceId" };
export type WorkItemTypeId = string & { readonly __brand: "WorkItemTypeId" };
export type WorkflowStateId = string & { readonly __brand: "WorkflowStateId" };
export type PersonId = string & { readonly __brand: "PersonId" };

export const workItemId = (s: string): WorkItemId => s as WorkItemId;
export const projectId = (s: string): ProjectId => s as ProjectId;
export const cadenceId = (s: string): CadenceId => s as CadenceId;
export const workItemTypeId = (s: string): WorkItemTypeId => s as WorkItemTypeId;
export const workflowStateId = (s: string): WorkflowStateId => s as WorkflowStateId;
export const personId = (s: string): PersonId => s as PersonId;
```

- [ ] **Step 4: Create `packages/core/src/domain/shared/enums.ts`**

```ts
export type MethodologyKey = "SCRUM" | "SAFE" | "WATERFALL" | "DMAIC";
export type StatusCategory = "todo" | "in_progress" | "done" | "blocked";
export type Band = "low" | "med" | "high";
export type EstimateUnit = "points" | "hours" | "days" | "tshirt";
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/domain/shared`
Expected: PASS.

- [ ] **Step 6: Export from the barrel — append to `packages/core/src/index.ts`**

```ts
export * from "./domain/shared/ids.js";
export * from "./domain/shared/enums.js";
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/shared packages/core/src/index.ts
git commit -m "feat(core): add branded ids and shared enums"
```

---

### Task 4: Domain events

**Files:**
- Create: `packages/core/src/domain/events/domain-event.ts`
- Create: `packages/core/src/domain/events/work-item-events.ts`
- Create: `packages/core/src/domain/events/work-item-events.test.ts`

**Interfaces:**
- Produces:
  - `interface DomainEvent { readonly type: string; readonly occurredAt: Date; readonly aggregateId: string; }`
  - `interface WorkItemCreated extends DomainEvent { type: "WorkItemCreated"; workItemId: WorkItemId; projectId: ProjectId; }`
  - `interface WorkItemStatusChanged extends DomainEvent { type: "WorkItemStatusChanged"; workItemId: WorkItemId; from: StatusCategory; to: StatusCategory; }`
  - Factories `workItemCreated(...)`, `workItemStatusChanged(...)` taking an explicit `occurredAt: Date` (no `Date.now()` inside the domain).

- [ ] **Step 1: Write the failing test `packages/core/src/domain/events/work-item-events.test.ts`**

```ts
import { expect, test } from "vitest";
import { workItemStatusChanged } from "./work-item-events.js";
import { workItemId } from "../shared/ids.js";

test("status-changed event carries from/to and aggregate id", () => {
  const at = new Date("2026-03-16T09:00:00Z");
  const e = workItemStatusChanged(workItemId("wi-1"), "todo", "in_progress", at);
  expect(e.type).toBe("WorkItemStatusChanged");
  expect(e.aggregateId).toBe("wi-1");
  expect(e.from).toBe("todo");
  expect(e.to).toBe("in_progress");
  expect(e.occurredAt).toBe(at);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/domain/events`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/events/domain-event.ts`**

```ts
export interface DomainEvent {
  readonly type: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
}
```

- [ ] **Step 4: Create `packages/core/src/domain/events/work-item-events.ts`**

```ts
import type { DomainEvent } from "./domain-event.js";
import type { WorkItemId, ProjectId } from "../shared/ids.js";
import type { StatusCategory } from "../shared/enums.js";

export interface WorkItemCreated extends DomainEvent {
  readonly type: "WorkItemCreated";
  readonly workItemId: WorkItemId;
  readonly projectId: ProjectId;
}

export interface WorkItemStatusChanged extends DomainEvent {
  readonly type: "WorkItemStatusChanged";
  readonly workItemId: WorkItemId;
  readonly from: StatusCategory;
  readonly to: StatusCategory;
}

export const workItemCreated = (
  id: WorkItemId,
  project: ProjectId,
  occurredAt: Date,
): WorkItemCreated => ({
  type: "WorkItemCreated",
  occurredAt,
  aggregateId: id,
  workItemId: id,
  projectId: project,
});

export const workItemStatusChanged = (
  id: WorkItemId,
  from: StatusCategory,
  to: StatusCategory,
  occurredAt: Date,
): WorkItemStatusChanged => ({
  type: "WorkItemStatusChanged",
  occurredAt,
  aggregateId: id,
  workItemId: id,
  from,
  to,
});
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/domain/events`
Expected: PASS.

- [ ] **Step 6: Export from barrel — append to `packages/core/src/index.ts`**

```ts
export * from "./domain/events/domain-event.js";
export * from "./domain/events/work-item-events.js";
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/events packages/core/src/index.ts
git commit -m "feat(core): add domain events (WorkItemCreated, WorkItemStatusChanged)"
```

---

### Task 5: WorkItem aggregate + Composite rollups

**Files:**
- Create: `packages/core/src/domain/workitem/work-item.ts`
- Create: `packages/core/src/domain/workitem/work-item-tree.ts`
- Create: `packages/core/src/domain/workitem/work-item-tree.test.ts`

**Interfaces:**
- Produces:
  - `interface WorkItemProps { id: WorkItemId; projectId: ProjectId; parentId: WorkItemId | null; typeId: WorkItemTypeId; title: string; status: StatusCategory; estimate: number | null; estimateUnit: EstimateUnit | null; complexityBand: Band | null; riskBand: Band | null; assigneeId: PersonId | null; }`
  - `class WorkItem` wrapping `WorkItemProps` (readonly getters).
  - `class WorkItemTree` built from a flat `WorkItem[]` via `WorkItemTree.fromFlat(items)`, with:
    - `roots(): WorkItem[]`
    - `childrenOf(id: WorkItemId): WorkItem[]`
    - `rolledUpEstimate(id: WorkItemId): number` (sum of the subtree's leaf estimates, treating null as 0)
    - `rolledUpStatus(id: WorkItemId): StatusCategory` (`done` only if all descendants `done`; `blocked` if any descendant `blocked`; else `in_progress` if any not-`todo`; else `todo`)

- [ ] **Step 1: Write the failing test `packages/core/src/domain/workitem/work-item-tree.test.ts`**

```ts
import { expect, test } from "vitest";
import { WorkItem } from "./work-item.js";
import { WorkItemTree } from "./work-item-tree.js";
import { workItemId, projectId, workItemTypeId } from "../shared/ids.js";

const P = projectId("p-1");
const T = workItemTypeId("t-1");

function wi(id: string, parent: string | null, status: string, est: number | null) {
  return new WorkItem({
    id: workItemId(id),
    projectId: P,
    parentId: parent ? workItemId(parent) : null,
    typeId: T,
    title: id,
    status: status as any,
    estimate: est,
    estimateUnit: est === null ? null : "points",
    complexityBand: null,
    riskBand: null,
    assigneeId: null,
  });
}

test("rolls up estimate over the subtree", () => {
  const tree = WorkItemTree.fromFlat([
    wi("epic", null, "in_progress", null),
    wi("s1", "epic", "done", 5),
    wi("s2", "epic", "in_progress", 3),
  ]);
  expect(tree.rolledUpEstimate(workItemId("epic"))).toBe(8);
});

test("rolls up status: blocked child dominates", () => {
  const tree = WorkItemTree.fromFlat([
    wi("epic", null, "in_progress", null),
    wi("s1", "epic", "done", 5),
    wi("s2", "epic", "blocked", 3),
  ]);
  expect(tree.rolledUpStatus(workItemId("epic"))).toBe("blocked");
});

test("rolls up status: all done => done", () => {
  const tree = WorkItemTree.fromFlat([
    wi("epic", null, "in_progress", null),
    wi("s1", "epic", "done", 5),
    wi("s2", "epic", "done", 3),
  ]);
  expect(tree.rolledUpStatus(workItemId("epic"))).toBe("done");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/domain/workitem`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/workitem/work-item.ts`**

```ts
import type { WorkItemId, ProjectId, WorkItemTypeId, PersonId } from "../shared/ids.js";
import type { StatusCategory, Band, EstimateUnit } from "../shared/enums.js";

export interface WorkItemProps {
  readonly id: WorkItemId;
  readonly projectId: ProjectId;
  readonly parentId: WorkItemId | null;
  readonly typeId: WorkItemTypeId;
  readonly title: string;
  readonly status: StatusCategory;
  readonly estimate: number | null;
  readonly estimateUnit: EstimateUnit | null;
  readonly complexityBand: Band | null;
  readonly riskBand: Band | null;
  readonly assigneeId: PersonId | null;
}

export class WorkItem {
  constructor(private readonly props: WorkItemProps) {}
  get id(): WorkItemId { return this.props.id; }
  get parentId(): WorkItemId | null { return this.props.parentId; }
  get status(): StatusCategory { return this.props.status; }
  get estimate(): number | null { return this.props.estimate; }
  get complexityBand(): Band | null { return this.props.complexityBand; }
  get riskBand(): Band | null { return this.props.riskBand; }
  get assigneeId(): PersonId | null { return this.props.assigneeId; }
  get title(): string { return this.props.title; }
  toProps(): WorkItemProps { return this.props; }
}
```

- [ ] **Step 4: Create `packages/core/src/domain/workitem/work-item-tree.ts`**

```ts
import { WorkItem } from "./work-item.js";
import type { WorkItemId } from "../shared/ids.js";
import type { StatusCategory } from "../shared/enums.js";

export class WorkItemTree {
  private readonly byId = new Map<string, WorkItem>();
  private readonly childIds = new Map<string, WorkItemId[]>();

  private constructor(items: WorkItem[]) {
    for (const it of items) {
      this.byId.set(it.id, it);
      if (!this.childIds.has(it.id)) this.childIds.set(it.id, []);
    }
    for (const it of items) {
      if (it.parentId) {
        const siblings = this.childIds.get(it.parentId) ?? [];
        siblings.push(it.id);
        this.childIds.set(it.parentId, siblings);
      }
    }
  }

  static fromFlat(items: WorkItem[]): WorkItemTree {
    return new WorkItemTree(items);
  }

  roots(): WorkItem[] {
    return [...this.byId.values()].filter((i) => i.parentId === null);
  }

  childrenOf(id: WorkItemId): WorkItem[] {
    return (this.childIds.get(id) ?? []).map((cid) => this.byId.get(cid)!);
  }

  private descendants(id: WorkItemId): WorkItem[] {
    const out: WorkItem[] = [];
    for (const child of this.childrenOf(id)) {
      out.push(child, ...this.descendants(child.id));
    }
    return out;
  }

  rolledUpEstimate(id: WorkItemId): number {
    const self = this.byId.get(id);
    const kids = this.childrenOf(id);
    if (kids.length === 0) return self?.estimate ?? 0;
    return this.descendants(id)
      .filter((d) => this.childrenOf(d.id).length === 0)
      .reduce((sum, leaf) => sum + (leaf.estimate ?? 0), 0);
  }

  rolledUpStatus(id: WorkItemId): StatusCategory {
    const kids = this.descendants(id);
    if (kids.length === 0) return this.byId.get(id)?.status ?? "todo";
    if (kids.some((k) => k.status === "blocked")) return "blocked";
    if (kids.every((k) => k.status === "done")) return "done";
    if (kids.some((k) => k.status !== "todo")) return "in_progress";
    return "todo";
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/domain/workitem`
Expected: PASS (3 tests).

- [ ] **Step 6: Export from barrel — append to `packages/core/src/index.ts`**

```ts
export * from "./domain/workitem/work-item.js";
export * from "./domain/workitem/work-item-tree.js";
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/workitem packages/core/src/index.ts
git commit -m "feat(core): add WorkItem aggregate and Composite tree rollups"
```

---

### Task 6: Methodology config types

**Files:**
- Create: `packages/core/src/domain/methodology/config.ts`
- Create: `packages/core/src/domain/methodology/config.test.ts`

**Interfaces:**
- Produces:
  - `interface WorkItemTypeDef { id: WorkItemTypeId; name: string; hierarchyLevel: number; defaultEstimateUnit: EstimateUnit | null; }`
  - `type WorkItemTypeSet = readonly WorkItemTypeDef[]`
  - `interface WorkflowStateDef { id: WorkflowStateId; name: string; category: StatusCategory; order: number; }`
  - `interface StateTransitionDef { fromStateId: WorkflowStateId; toStateId: WorkflowStateId; name: string; requiresApproval?: boolean; }`
  - `interface WorkflowDefinition { states: readonly WorkflowStateDef[]; transitions: readonly StateTransitionDef[]; }`
  - `interface LifecyclePhaseDef { name: string; sequence: number; gateRequired: boolean; }`
  - `interface LifecycleDefinition { name: string; phases: readonly LifecyclePhaseDef[]; }`
  - Helper `legalNextStates(wf: WorkflowDefinition, from: WorkflowStateId): WorkflowStateDef[]`.

- [ ] **Step 1: Write the failing test `packages/core/src/domain/methodology/config.test.ts`**

```ts
import { expect, test } from "vitest";
import { legalNextStates } from "./config.js";
import { workflowStateId } from "../shared/ids.js";

const wf = {
  states: [
    { id: workflowStateId("todo"), name: "To Do", category: "todo" as const, order: 0 },
    { id: workflowStateId("doing"), name: "In Progress", category: "in_progress" as const, order: 1 },
    { id: workflowStateId("done"), name: "Done", category: "done" as const, order: 2 },
  ],
  transitions: [
    { fromStateId: workflowStateId("todo"), toStateId: workflowStateId("doing"), name: "start" },
    { fromStateId: workflowStateId("doing"), toStateId: workflowStateId("done"), name: "finish" },
  ],
};

test("legalNextStates returns only reachable states", () => {
  const next = legalNextStates(wf, workflowStateId("todo"));
  expect(next.map((s) => s.name)).toEqual(["In Progress"]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/domain/methodology`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/methodology/config.ts`**

```ts
import type { WorkItemTypeId, WorkflowStateId } from "../shared/ids.js";
import type { StatusCategory, EstimateUnit } from "../shared/enums.js";

export interface WorkItemTypeDef {
  readonly id: WorkItemTypeId;
  readonly name: string;
  readonly hierarchyLevel: number;
  readonly defaultEstimateUnit: EstimateUnit | null;
}
export type WorkItemTypeSet = readonly WorkItemTypeDef[];

export interface WorkflowStateDef {
  readonly id: WorkflowStateId;
  readonly name: string;
  readonly category: StatusCategory;
  readonly order: number;
}

export interface StateTransitionDef {
  readonly fromStateId: WorkflowStateId;
  readonly toStateId: WorkflowStateId;
  readonly name: string;
  readonly requiresApproval?: boolean;
}

export interface WorkflowDefinition {
  readonly states: readonly WorkflowStateDef[];
  readonly transitions: readonly StateTransitionDef[];
}

export interface LifecyclePhaseDef {
  readonly name: string;
  readonly sequence: number;
  readonly gateRequired: boolean;
}
export interface LifecycleDefinition {
  readonly name: string;
  readonly phases: readonly LifecyclePhaseDef[];
}

export function legalNextStates(
  wf: WorkflowDefinition,
  from: WorkflowStateId,
): WorkflowStateDef[] {
  const targets = wf.transitions
    .filter((t) => t.fromStateId === from)
    .map((t) => t.toStateId);
  return wf.states.filter((s) => targets.includes(s.id));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/domain/methodology`
Expected: PASS.

- [ ] **Step 5: Export from barrel — append to `packages/core/src/index.ts`**

```ts
export * from "./domain/methodology/config.js";
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/methodology packages/core/src/index.ts
git commit -m "feat(core): add methodology config types (types, workflow, lifecycle)"
```

---

### Task 7: MetricsStrategy + Velocity / EarnedValue

**Files:**
- Create: `packages/core/src/domain/metrics/metrics-strategy.ts`
- Create: `packages/core/src/domain/metrics/velocity-metrics.ts`
- Create: `packages/core/src/domain/metrics/earned-value-metrics.ts`
- Create: `packages/core/src/domain/metrics/metrics.test.ts`

**Interfaces:**
- Consumes: `WorkItemTree` (Task 5).
- Produces:
  - `interface Progress { percentComplete: number; earnedValue?: number; spi?: number; cpi?: number; }`
  - `interface MetricsStrategy { readonly key: string; progress(input: MetricsInput): Progress; }`
  - `interface MetricsInput { tree: WorkItemTree; rootId: WorkItemId; plannedValue?: number; actualCost?: number; }`
  - `class VelocityMetrics implements MetricsStrategy` — `percentComplete` = done-leaf-estimate ÷ total-leaf-estimate.
  - `class EarnedValueMetrics implements MetricsStrategy` — `earnedValue = percentComplete * plannedValue`; `spi = earnedValue / plannedValue`; `cpi = earnedValue / actualCost`.

- [ ] **Step 1: Write the failing test `packages/core/src/domain/metrics/metrics.test.ts`**

```ts
import { expect, test } from "vitest";
import { WorkItem } from "../workitem/work-item.js";
import { WorkItemTree } from "../workitem/work-item-tree.js";
import { VelocityMetrics } from "./velocity-metrics.js";
import { EarnedValueMetrics } from "./earned-value-metrics.js";
import { workItemId, projectId, workItemTypeId } from "../shared/ids.js";

const P = projectId("p-1");
const T = workItemTypeId("t-1");
function wi(id: string, parent: string | null, status: string, est: number | null) {
  return new WorkItem({
    id: workItemId(id), projectId: P, parentId: parent ? workItemId(parent) : null,
    typeId: T, title: id, status: status as any, estimate: est,
    estimateUnit: est === null ? null : "points", complexityBand: null, riskBand: null, assigneeId: null,
  });
}
const tree = WorkItemTree.fromFlat([
  wi("epic", null, "in_progress", null),
  wi("s1", "epic", "done", 6),
  wi("s2", "epic", "in_progress", 2),
]);

test("velocity percentComplete = done points / total points", () => {
  const p = new VelocityMetrics().progress({ tree, rootId: workItemId("epic") });
  expect(p.percentComplete).toBeCloseTo(0.75);
});

test("earned value derives SPI and CPI from planned value and actual cost", () => {
  const p = new EarnedValueMetrics().progress({
    tree, rootId: workItemId("epic"), plannedValue: 100, actualCost: 90,
  });
  expect(p.earnedValue).toBeCloseTo(75);
  expect(p.spi).toBeCloseTo(0.75);
  expect(p.cpi).toBeCloseTo(75 / 90);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/domain/metrics`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/metrics/metrics-strategy.ts`**

```ts
import type { WorkItemTree } from "../workitem/work-item-tree.js";
import type { WorkItemId } from "../shared/ids.js";

export interface Progress {
  readonly percentComplete: number;
  readonly earnedValue?: number;
  readonly spi?: number;
  readonly cpi?: number;
}

export interface MetricsInput {
  readonly tree: WorkItemTree;
  readonly rootId: WorkItemId;
  readonly plannedValue?: number;
  readonly actualCost?: number;
}

export interface MetricsStrategy {
  readonly key: string;
  progress(input: MetricsInput): Progress;
}

/** Shared helper: fraction of leaf estimate that is done. */
export function doneFraction(input: MetricsInput): number {
  const { tree, rootId } = input;
  const leaves = collectLeaves(tree, rootId);
  const total = leaves.reduce((s, l) => s + (l.estimate ?? 0), 0);
  if (total === 0) return 0;
  const done = leaves
    .filter((l) => l.status === "done")
    .reduce((s, l) => s + (l.estimate ?? 0), 0);
  return done / total;
}

function collectLeaves(tree: WorkItemTree, rootId: WorkItemId) {
  const result: { estimate: number | null; status: string }[] = [];
  const walk = (id: WorkItemId) => {
    const kids = tree.childrenOf(id);
    if (kids.length === 0) {
      const self = tree.roots().concat(...tree.roots().map((r) => tree.childrenOf(r.id)))
        .find((w) => w.id === id);
      return;
    }
    for (const k of kids) {
      if (tree.childrenOf(k.id).length === 0) result.push({ estimate: k.estimate, status: k.status });
      else walk(k.id);
    }
  };
  walk(rootId);
  return result;
}
```

> Note: `collectLeaves` above must reliably enumerate leaves. Replace its body with the simpler tree-backed version below in Step 3b.

- [ ] **Step 3b: Replace `collectLeaves` in `metrics-strategy.ts` with a correct implementation and add a `leavesOf` method to `WorkItemTree`.**

First, add to `packages/core/src/domain/workitem/work-item-tree.ts` (inside the class):

```ts
  leavesOf(id: WorkItemId): WorkItem[] {
    const kids = this.childrenOf(id);
    if (kids.length === 0) {
      const self = this.byId.get(id);
      return self ? [self] : [];
    }
    return kids.flatMap((k) => this.leavesOf(k.id));
  }
```

Then rewrite `collectLeaves` in `metrics-strategy.ts`:

```ts
function collectLeaves(tree: WorkItemTree, rootId: WorkItemId) {
  return tree.leavesOf(rootId).map((l) => ({ estimate: l.estimate, status: l.status }));
}
```

- [ ] **Step 4: Create `packages/core/src/domain/metrics/velocity-metrics.ts`**

```ts
import { type MetricsStrategy, type MetricsInput, type Progress, doneFraction } from "./metrics-strategy.js";

export class VelocityMetrics implements MetricsStrategy {
  readonly key = "VELOCITY";
  progress(input: MetricsInput): Progress {
    return { percentComplete: doneFraction(input) };
  }
}
```

- [ ] **Step 5: Create `packages/core/src/domain/metrics/earned-value-metrics.ts`**

```ts
import { type MetricsStrategy, type MetricsInput, type Progress, doneFraction } from "./metrics-strategy.js";

export class EarnedValueMetrics implements MetricsStrategy {
  readonly key = "EARNED_VALUE";
  progress(input: MetricsInput): Progress {
    const pct = doneFraction(input);
    const pv = input.plannedValue ?? 0;
    const ac = input.actualCost ?? 0;
    const ev = pct * pv;
    return {
      percentComplete: pct,
      earnedValue: ev,
      spi: pv === 0 ? 0 : ev / pv,
      cpi: ac === 0 ? 0 : ev / ac,
    };
  }
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/domain/metrics`
Expected: PASS (2 tests). If the WorkItemTree rollup test from Task 5 also runs, it stays green.

- [ ] **Step 7: Export from barrel — append to `packages/core/src/index.ts`**

```ts
export * from "./domain/metrics/metrics-strategy.js";
export * from "./domain/metrics/velocity-metrics.js";
export * from "./domain/metrics/earned-value-metrics.js";
```

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/domain/metrics packages/core/src/domain/workitem/work-item-tree.ts packages/core/src/index.ts
git commit -m "feat(core): add MetricsStrategy with velocity and earned-value implementations"
```

---

### Task 8: SchedulingStrategy function-types

**Files:**
- Create: `packages/core/src/domain/scheduling/scheduling-strategy.ts`
- Create: `packages/core/src/domain/scheduling/scheduling.test.ts`

**Interfaces:**
- Produces:
  - `interface ScheduleItem { id: WorkItemId; estimate: number; }`
  - `interface DependencyEdge { predecessorId: WorkItemId; successorId: WorkItemId; lagDays: number; }`
  - `interface Schedule { orderedIds: WorkItemId[]; totalDurationDays: number; }`
  - `type SchedulingStrategy = (items: ScheduleItem[], deps: DependencyEdge[], capacityPerDay: number) => Schedule`
  - `const sprintCapacityScheduler: SchedulingStrategy` — ignores precedence; duration = ceil(totalEstimate / capacityPerDay); order = input order.
  - `const criticalPathScheduler: SchedulingStrategy` — topological order over deps; duration = longest path (estimate as days) + lags.

- [ ] **Step 1: Write the failing test `packages/core/src/domain/scheduling/scheduling.test.ts`**

```ts
import { expect, test } from "vitest";
import { sprintCapacityScheduler, criticalPathScheduler } from "./scheduling-strategy.js";
import { workItemId } from "../shared/ids.js";

const a = workItemId("a"), b = workItemId("b"), c = workItemId("c");

test("sprint capacity scheduler divides total estimate by capacity", () => {
  const s = sprintCapacityScheduler(
    [{ id: a, estimate: 5 }, { id: b, estimate: 5 }], [], 4,
  );
  expect(s.totalDurationDays).toBe(3); // ceil(10/4)
  expect(s.orderedIds).toEqual([a, b]);
});

test("critical path scheduler topologically orders and sums the longest path", () => {
  const s = criticalPathScheduler(
    [{ id: a, estimate: 2 }, { id: b, estimate: 3 }, { id: c, estimate: 1 }],
    [{ predecessorId: a, successorId: b, lagDays: 0 }, { predecessorId: b, successorId: c, lagDays: 1 }],
    1,
  );
  expect(s.orderedIds).toEqual([a, b, c]);
  expect(s.totalDurationDays).toBe(2 + 3 + 1 + 1); // estimates + lag
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/domain/scheduling`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/scheduling/scheduling-strategy.ts`**

```ts
import type { WorkItemId } from "../shared/ids.js";

export interface ScheduleItem { readonly id: WorkItemId; readonly estimate: number; }
export interface DependencyEdge {
  readonly predecessorId: WorkItemId;
  readonly successorId: WorkItemId;
  readonly lagDays: number;
}
export interface Schedule { readonly orderedIds: WorkItemId[]; readonly totalDurationDays: number; }

export type SchedulingStrategy = (
  items: ScheduleItem[],
  deps: DependencyEdge[],
  capacityPerDay: number,
) => Schedule;

export const sprintCapacityScheduler: SchedulingStrategy = (items, _deps, capacityPerDay) => {
  const total = items.reduce((s, i) => s + i.estimate, 0);
  const cap = capacityPerDay <= 0 ? 1 : capacityPerDay;
  return { orderedIds: items.map((i) => i.id), totalDurationDays: Math.ceil(total / cap) };
};

export const criticalPathScheduler: SchedulingStrategy = (items, deps, _capacityPerDay) => {
  const est = new Map(items.map((i) => [i.id as string, i.estimate]));
  const successors = new Map<string, { to: string; lag: number }[]>();
  const indegree = new Map<string, number>();
  for (const i of items) { successors.set(i.id, []); indegree.set(i.id, 0); }
  for (const d of deps) {
    successors.get(d.predecessorId)!.push({ to: d.successorId, lag: d.lagDays });
    indegree.set(d.successorId, (indegree.get(d.successorId) ?? 0) + 1);
  }
  // Kahn topological sort.
  const queue = items.filter((i) => (indegree.get(i.id) ?? 0) === 0).map((i) => i.id as string);
  const ordered: string[] = [];
  const longest = new Map<string, number>(items.map((i) => [i.id, est.get(i.id) ?? 0]));
  while (queue.length) {
    const n = queue.shift()!;
    ordered.push(n);
    for (const { to, lag } of successors.get(n) ?? []) {
      const candidate = (longest.get(n) ?? 0) + lag + (est.get(to) ?? 0);
      if (candidate > (longest.get(to) ?? 0)) longest.set(to, candidate);
      indegree.set(to, (indegree.get(to) ?? 0) - 1);
      if ((indegree.get(to) ?? 0) === 0) queue.push(to);
    }
  }
  const total = Math.max(0, ...[...longest.values()]);
  return { orderedIds: ordered as unknown as WorkItemId[], totalDurationDays: total };
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/domain/scheduling`
Expected: PASS (2 tests).

- [ ] **Step 5: Export from barrel — append to `packages/core/src/index.ts`**

```ts
export * from "./domain/scheduling/scheduling-strategy.js";
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/scheduling packages/core/src/index.ts
git commit -m "feat(core): add SchedulingStrategy (sprint-capacity + critical-path)"
```

---

### Task 9: WorkflowEngine (State-as-data)

**Files:**
- Create: `packages/core/src/domain/workflow/workflow-engine.ts`
- Create: `packages/core/src/domain/workflow/workflow-engine.test.ts`

**Interfaces:**
- Consumes: `WorkflowDefinition`, `WorkflowStateDef`, `StateTransitionDef` (Task 6); `workItemStatusChanged` (Task 4); `WorkItem` (Task 5).
- Produces:
  - `interface TransitionContext { now: Date; approved?: boolean; }`
  - `interface TransitionResult { newStateId: WorkflowStateId; newCategory: StatusCategory; events: DomainEvent[]; }`
  - `class WorkflowEngine` constructed with a `WorkflowDefinition`, exposing:
    - `can(currentStateId, transitionName, ctx): boolean` (false if a `requiresApproval` transition lacks `ctx.approved`)
    - `apply(item: WorkItem, currentStateId, transitionName, ctx): TransitionResult` (throws if illegal; emits `WorkItemStatusChanged` when the category changes)

- [ ] **Step 1: Write the failing test `packages/core/src/domain/workflow/workflow-engine.test.ts`**

```ts
import { expect, test } from "vitest";
import { WorkflowEngine } from "./workflow-engine.js";
import { WorkItem } from "../workitem/work-item.js";
import { workflowStateId, workItemId, projectId, workItemTypeId } from "../shared/ids.js";

const wf = {
  states: [
    { id: workflowStateId("todo"), name: "To Do", category: "todo" as const, order: 0 },
    { id: workflowStateId("doing"), name: "Doing", category: "in_progress" as const, order: 1 },
    { id: workflowStateId("review"), name: "Review", category: "in_progress" as const, order: 2 },
    { id: workflowStateId("done"), name: "Done", category: "done" as const, order: 3 },
  ],
  transitions: [
    { fromStateId: workflowStateId("todo"), toStateId: workflowStateId("doing"), name: "start" },
    { fromStateId: workflowStateId("review"), toStateId: workflowStateId("done"), name: "approve", requiresApproval: true },
  ],
};
const item = new WorkItem({
  id: workItemId("wi-1"), projectId: projectId("p"), parentId: null,
  typeId: workItemTypeId("t"), title: "x", status: "todo", estimate: 3,
  estimateUnit: "points", complexityBand: null, riskBand: null, assigneeId: null,
});

test("apply performs a legal transition and emits a status-changed event on category change", () => {
  const eng = new WorkflowEngine(wf);
  const r = eng.apply(item, workflowStateId("todo"), "start", { now: new Date("2026-03-16") });
  expect(r.newCategory).toBe("in_progress");
  expect(r.events).toHaveLength(1);
  expect(r.events[0]!.type).toBe("WorkItemStatusChanged");
});

test("gate transition is blocked without approval", () => {
  const eng = new WorkflowEngine(wf);
  expect(eng.can(workflowStateId("review"), "approve", { now: new Date() })).toBe(false);
  expect(eng.can(workflowStateId("review"), "approve", { now: new Date(), approved: true })).toBe(true);
});

test("illegal transition throws", () => {
  const eng = new WorkflowEngine(wf);
  expect(() => eng.apply(item, workflowStateId("todo"), "approve", { now: new Date() })).toThrow();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/domain/workflow`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/workflow/workflow-engine.ts`**

```ts
import type { WorkflowDefinition, StateTransitionDef } from "../methodology/config.js";
import type { WorkflowStateId } from "../shared/ids.js";
import type { StatusCategory } from "../shared/enums.js";
import type { DomainEvent } from "../events/domain-event.js";
import { workItemStatusChanged } from "../events/work-item-events.js";
import type { WorkItem } from "../workitem/work-item.js";

export interface TransitionContext { readonly now: Date; readonly approved?: boolean; }
export interface TransitionResult {
  readonly newStateId: WorkflowStateId;
  readonly newCategory: StatusCategory;
  readonly events: DomainEvent[];
}

export class WorkflowEngine {
  constructor(private readonly wf: WorkflowDefinition) {}

  private find(from: WorkflowStateId, name: string): StateTransitionDef | undefined {
    return this.wf.transitions.find((t) => t.fromStateId === from && t.name === name);
  }

  private categoryOf(id: WorkflowStateId): StatusCategory {
    const s = this.wf.states.find((st) => st.id === id);
    if (!s) throw new Error(`Unknown workflow state: ${id}`);
    return s.category;
  }

  can(from: WorkflowStateId, name: string, ctx: TransitionContext): boolean {
    const t = this.find(from, name);
    if (!t) return false;
    if (t.requiresApproval && !ctx.approved) return false;
    return true;
  }

  apply(
    item: WorkItem,
    from: WorkflowStateId,
    name: string,
    ctx: TransitionContext,
  ): TransitionResult {
    const t = this.find(from, name);
    if (!t) throw new Error(`Illegal transition '${name}' from ${from}`);
    if (t.requiresApproval && !ctx.approved) throw new Error(`Transition '${name}' requires approval`);
    const fromCat = this.categoryOf(from);
    const toCat = this.categoryOf(t.toStateId);
    const events: DomainEvent[] =
      fromCat === toCat ? [] : [workItemStatusChanged(item.id, fromCat, toCat, ctx.now)];
    return { newStateId: t.toStateId, newCategory: toCat, events };
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/domain/workflow`
Expected: PASS (3 tests).

- [ ] **Step 5: Export from barrel — append to `packages/core/src/index.ts`**

```ts
export * from "./domain/workflow/workflow-engine.js";
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/workflow packages/core/src/index.ts
git commit -m "feat(core): add data-driven WorkflowEngine with gate approval + events"
```

---

### Task 10: MethodologyProfile (Abstract Factory) + registry

**Files:**
- Create: `packages/core/src/domain/methodology/methodology-profile.ts`
- Create: `packages/core/src/domain/methodology/scrum-profile.ts`
- Create: `packages/core/src/domain/methodology/waterfall-profile.ts`
- Create: `packages/core/src/domain/methodology/methodology-registry.ts`
- Create: `packages/core/src/domain/methodology/methodology-registry.test.ts`

**Interfaces:**
- Consumes: config types (Task 6), `MetricsStrategy` + `VelocityMetrics` + `EarnedValueMetrics` (Task 7), `SchedulingStrategy` + `sprintCapacityScheduler` + `criticalPathScheduler` (Task 8).
- Produces:
  - `interface MethodologyProfile { readonly key: MethodologyKey; workItemTypes(): WorkItemTypeSet; workflow(): WorkflowDefinition; lifecycle(): LifecycleDefinition; metrics(): MetricsStrategy; scheduler(): SchedulingStrategy; }`
  - `class ScrumProfile implements MethodologyProfile` (VelocityMetrics + sprintCapacityScheduler).
  - `class WaterfallProfile implements MethodologyProfile` (EarnedValueMetrics + criticalPathScheduler).
  - `interface MethodologyRegistry { resolve(key: MethodologyKey): MethodologyProfile; }`
  - `class DefaultMethodologyRegistry implements MethodologyRegistry` — a registry map, NOT a switch.

- [ ] **Step 1: Write the failing test `packages/core/src/domain/methodology/methodology-registry.test.ts`**

```ts
import { expect, test } from "vitest";
import { DefaultMethodologyRegistry } from "./methodology-registry.js";

test("registry resolves Scrum to a velocity+sprint profile", () => {
  const p = new DefaultMethodologyRegistry().resolve("SCRUM");
  expect(p.key).toBe("SCRUM");
  expect(p.metrics().key).toBe("VELOCITY");
});

test("registry resolves Waterfall to an earned-value profile", () => {
  const p = new DefaultMethodologyRegistry().resolve("WATERFALL");
  expect(p.metrics().key).toBe("EARNED_VALUE");
});

test("resolving an unregistered methodology throws (SAFe/DMAIC come with the seed data later)", () => {
  expect(() => new DefaultMethodologyRegistry().resolve("SAFE")).toThrow();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/domain/methodology/methodology-registry`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/domain/methodology/methodology-profile.ts`**

```ts
import type { MethodologyKey } from "../shared/enums.js";
import type { WorkItemTypeSet, WorkflowDefinition, LifecycleDefinition } from "./config.js";
import type { MetricsStrategy } from "../metrics/metrics-strategy.js";
import type { SchedulingStrategy } from "../scheduling/scheduling-strategy.js";

export interface MethodologyProfile {
  readonly key: MethodologyKey;
  workItemTypes(): WorkItemTypeSet;
  workflow(): WorkflowDefinition;
  lifecycle(): LifecycleDefinition;
  metrics(): MetricsStrategy;
  scheduler(): SchedulingStrategy;
}
```

- [ ] **Step 4: Create `packages/core/src/domain/methodology/scrum-profile.ts`**

```ts
import type { MethodologyProfile } from "./methodology-profile.js";
import type { WorkItemTypeSet, WorkflowDefinition, LifecycleDefinition } from "./config.js";
import { VelocityMetrics } from "../metrics/velocity-metrics.js";
import { sprintCapacityScheduler, type SchedulingStrategy } from "../scheduling/scheduling-strategy.js";
import { workItemTypeId, workflowStateId } from "../shared/ids.js";

/** Structural products default to the seeded Scrum bundle; overridable via constructor for config-as-data. */
export class ScrumProfile implements MethodologyProfile {
  readonly key = "SCRUM" as const;
  constructor(
    private readonly types: WorkItemTypeSet = DEFAULT_SCRUM_TYPES,
    private readonly wf: WorkflowDefinition = DEFAULT_SCRUM_WORKFLOW,
    private readonly lc: LifecycleDefinition = DEFAULT_SCRUM_LIFECYCLE,
  ) {}
  workItemTypes(): WorkItemTypeSet { return this.types; }
  workflow(): WorkflowDefinition { return this.wf; }
  lifecycle(): LifecycleDefinition { return this.lc; }
  metrics() { return new VelocityMetrics(); }
  scheduler(): SchedulingStrategy { return sprintCapacityScheduler; }
}

export const DEFAULT_SCRUM_TYPES: WorkItemTypeSet = [
  { id: workItemTypeId("scrum-epic"), name: "Epic", hierarchyLevel: 1, defaultEstimateUnit: "points" },
  { id: workItemTypeId("scrum-story"), name: "Story", hierarchyLevel: 2, defaultEstimateUnit: "points" },
  { id: workItemTypeId("scrum-task"), name: "Task", hierarchyLevel: 3, defaultEstimateUnit: "points" },
];

export const DEFAULT_SCRUM_WORKFLOW: WorkflowDefinition = {
  states: [
    { id: workflowStateId("scrum-todo"), name: "To Do", category: "todo", order: 0 },
    { id: workflowStateId("scrum-doing"), name: "In Progress", category: "in_progress", order: 1 },
    { id: workflowStateId("scrum-done"), name: "Done", category: "done", order: 2 },
  ],
  transitions: [
    { fromStateId: workflowStateId("scrum-todo"), toStateId: workflowStateId("scrum-doing"), name: "start" },
    { fromStateId: workflowStateId("scrum-doing"), toStateId: workflowStateId("scrum-done"), name: "finish" },
  ],
};

export const DEFAULT_SCRUM_LIFECYCLE: LifecycleDefinition = {
  name: "Scrum",
  phases: [{ name: "Sprint", sequence: 0, gateRequired: false }],
};
```

- [ ] **Step 5: Create `packages/core/src/domain/methodology/waterfall-profile.ts`**

```ts
import type { MethodologyProfile } from "./methodology-profile.js";
import type { WorkItemTypeSet, WorkflowDefinition, LifecycleDefinition } from "./config.js";
import { EarnedValueMetrics } from "../metrics/earned-value-metrics.js";
import { criticalPathScheduler, type SchedulingStrategy } from "../scheduling/scheduling-strategy.js";
import { workItemTypeId, workflowStateId } from "../shared/ids.js";

export class WaterfallProfile implements MethodologyProfile {
  readonly key = "WATERFALL" as const;
  constructor(
    private readonly types: WorkItemTypeSet = DEFAULT_WF_TYPES,
    private readonly wf: WorkflowDefinition = DEFAULT_WF_WORKFLOW,
    private readonly lc: LifecycleDefinition = DEFAULT_WF_LIFECYCLE,
  ) {}
  workItemTypes(): WorkItemTypeSet { return this.types; }
  workflow(): WorkflowDefinition { return this.wf; }
  lifecycle(): LifecycleDefinition { return this.lc; }
  metrics() { return new EarnedValueMetrics(); }
  scheduler(): SchedulingStrategy { return criticalPathScheduler; }
}

export const DEFAULT_WF_TYPES: WorkItemTypeSet = [
  { id: workItemTypeId("wf-wp"), name: "Work Package", hierarchyLevel: 1, defaultEstimateUnit: "days" },
  { id: workItemTypeId("wf-activity"), name: "Activity", hierarchyLevel: 2, defaultEstimateUnit: "days" },
  { id: workItemTypeId("wf-task"), name: "Task", hierarchyLevel: 3, defaultEstimateUnit: "days" },
];

export const DEFAULT_WF_WORKFLOW: WorkflowDefinition = {
  states: [
    { id: workflowStateId("wf-notstarted"), name: "Not Started", category: "todo", order: 0 },
    { id: workflowStateId("wf-inprogress"), name: "In Progress", category: "in_progress", order: 1 },
    { id: workflowStateId("wf-complete"), name: "Complete", category: "done", order: 2 },
  ],
  transitions: [
    { fromStateId: workflowStateId("wf-notstarted"), toStateId: workflowStateId("wf-inprogress"), name: "begin" },
    { fromStateId: workflowStateId("wf-inprogress"), toStateId: workflowStateId("wf-complete"), name: "complete", requiresApproval: true },
  ],
};

export const DEFAULT_WF_LIFECYCLE: LifecycleDefinition = {
  name: "Waterfall",
  phases: [
    { name: "Initiate", sequence: 0, gateRequired: true },
    { name: "Plan", sequence: 1, gateRequired: true },
    { name: "Execute", sequence: 2, gateRequired: true },
    { name: "Monitor", sequence: 3, gateRequired: false },
    { name: "Close", sequence: 4, gateRequired: true },
  ],
};
```

- [ ] **Step 6: Create `packages/core/src/domain/methodology/methodology-registry.ts`**

```ts
import type { MethodologyKey } from "../shared/enums.js";
import type { MethodologyProfile } from "./methodology-profile.js";
import { ScrumProfile } from "./scrum-profile.js";
import { WaterfallProfile } from "./waterfall-profile.js";

export interface MethodologyRegistry {
  resolve(key: MethodologyKey): MethodologyProfile;
}

/** Registry map (Factory, D10) — deliberately NOT a switch. SAFe/DMAIC register when seeded. */
export class DefaultMethodologyRegistry implements MethodologyRegistry {
  private readonly factories = new Map<MethodologyKey, () => MethodologyProfile>([
    ["SCRUM", () => new ScrumProfile()],
    ["WATERFALL", () => new WaterfallProfile()],
  ]);

  register(key: MethodologyKey, make: () => MethodologyProfile): void {
    this.factories.set(key, make);
  }

  resolve(key: MethodologyKey): MethodologyProfile {
    const make = this.factories.get(key);
    if (!make) throw new Error(`No methodology profile registered for '${key}'`);
    return make();
  }
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/domain/methodology/methodology-registry`
Expected: PASS (3 tests).

- [ ] **Step 8: Export from barrel — append to `packages/core/src/index.ts`**

```ts
export * from "./domain/methodology/methodology-profile.js";
export * from "./domain/methodology/scrum-profile.js";
export * from "./domain/methodology/waterfall-profile.js";
export * from "./domain/methodology/methodology-registry.js";
```

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/domain/methodology packages/core/src/index.ts
git commit -m "feat(core): add MethodologyProfile Abstract Factory (Scrum + Waterfall) + registry"
```

---

### Task 11: Port interfaces

**Files:**
- Create: `packages/core/src/ports/repository.ts`
- Create: `packages/core/src/ports/event-bus.ts`
- Create: `packages/core/src/ports/integration-ports.ts`
- Create: `packages/core/src/ports/ai-port.ts`
- Create: `packages/core/src/ports/system-ports.ts`
- Create: `packages/core/src/ports/ports.test.ts`

**Interfaces:**
- Produces (interfaces only; adapters land in later phases):
  - `interface WorkItemRepository { findByProject(projectId: ProjectId): Promise<WorkItem[]>; findById(id: WorkItemId): Promise<WorkItem | null>; save(item: WorkItem): Promise<void>; }`
  - `interface EventBus { publish(events: DomainEvent[]): Promise<void>; subscribe(type: string, handler: (e: DomainEvent) => Promise<void>): void; }`
  - `interface OutboxPort { enqueue(command: { type: string; payload: unknown }): Promise<void>; }`
  - Six integration ports: `WorkTrackerPort`, `SourceControlPort`, `CICDPort`, `KnowledgeBasePort`, `IdentityDirectoryPort`, `CommunicationPort` — each with a single read method returning `Promise<unknown[]>` for now (typed envelopes arrive with `@pma/contracts` in Phase 2/4); each carries a `readonly capability` discriminator string.
  - `interface AIPort { run(task: string, input: unknown): Promise<{ output: unknown; groundedOn: string[]; confidence: number }>; }`
  - `interface KeychainPort { get(ref: string): Promise<string | null>; set(ref: string, secret: string): Promise<void>; }`
  - `type Clock = () => Date` (a port; the domain/app receive time, never call `Date.now()` themselves).

- [ ] **Step 1: Write the failing test `packages/core/src/ports/ports.test.ts`** (a structural/compile test — implement a trivial fake to prove the interfaces are usable)

```ts
import { expect, test } from "vitest";
import type { EventBus } from "./event-bus.js";
import type { DomainEvent } from "../domain/events/domain-event.js";

test("EventBus interface can be implemented by a fake", async () => {
  const seen: string[] = [];
  const bus: EventBus = {
    async publish(events) { for (const e of events) for (const h of handlers[e.type] ?? []) await h(e); },
    subscribe(type, handler) { (handlers[type] ??= []).push(handler); },
  };
  const handlers: Record<string, ((e: DomainEvent) => Promise<void>)[]> = {};
  bus.subscribe("X", async (e) => { seen.push(e.aggregateId); });
  await bus.publish([{ type: "X", occurredAt: new Date(), aggregateId: "a1" }]);
  expect(seen).toEqual(["a1"]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/ports`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/ports/event-bus.ts`**

```ts
import type { DomainEvent } from "../domain/events/domain-event.js";

export interface EventBus {
  publish(events: DomainEvent[]): Promise<void>;
  subscribe(type: string, handler: (e: DomainEvent) => Promise<void>): void;
}

export interface OutboxPort {
  enqueue(command: { readonly type: string; readonly payload: unknown }): Promise<void>;
}
```

- [ ] **Step 4: Create `packages/core/src/ports/repository.ts`**

```ts
import type { WorkItem } from "../domain/workitem/work-item.js";
import type { WorkItemId, ProjectId } from "../domain/shared/ids.js";

export interface WorkItemRepository {
  findByProject(projectId: ProjectId): Promise<WorkItem[]>;
  findById(id: WorkItemId): Promise<WorkItem | null>;
  save(item: WorkItem): Promise<void>;
}
```

- [ ] **Step 5: Create `packages/core/src/ports/integration-ports.ts`**

```ts
/**
 * The six segregated integration ports (ISP). Read side only for now.
 * Typed ingestion envelopes arrive with @pma/contracts in a later phase;
 * until then reads return unknown[] so adapters can be stubbed.
 */
export interface WorkTrackerPort { readonly capability: "work_tracker"; fetchWorkItems(connectionId: string): Promise<unknown[]>; }
export interface SourceControlPort { readonly capability: "source_control"; fetchPullRequests(connectionId: string): Promise<unknown[]>; }
export interface CICDPort { readonly capability: "cicd"; fetchDeployments(connectionId: string): Promise<unknown[]>; }
export interface KnowledgeBasePort { readonly capability: "knowledge_base"; listPublishTargets(connectionId: string): Promise<unknown[]>; }
export interface IdentityDirectoryPort { readonly capability: "identity"; fetchPeople(connectionId: string): Promise<unknown[]>; }
export interface CommunicationPort { readonly capability: "communication"; fetchMessages(connectionId: string): Promise<unknown[]>; }
```

- [ ] **Step 6: Create `packages/core/src/ports/ai-port.ts`**

```ts
export interface AIResult {
  readonly output: unknown;
  readonly groundedOn: string[];
  readonly confidence: number;
}
export interface AIPort {
  run(task: string, input: unknown): Promise<AIResult>;
}
```

- [ ] **Step 7: Create `packages/core/src/ports/system-ports.ts`**

```ts
export interface KeychainPort {
  get(ref: string): Promise<string | null>;
  set(ref: string, secret: string): Promise<void>;
}
export type Clock = () => Date;
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/ports`
Expected: PASS.

- [ ] **Step 9: Export from barrel — append to `packages/core/src/index.ts`**

```ts
export * from "./ports/repository.js";
export * from "./ports/event-bus.js";
export * from "./ports/integration-ports.js";
export * from "./ports/ai-port.js";
export * from "./ports/system-ports.js";
```

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/ports packages/core/src/index.ts
git commit -m "feat(core): add port interfaces (repository, event bus, 6 integration, AI, system)"
```

---

### Task 12: In-memory port fakes

**Files:**
- Create: `packages/core/src/testing/in-memory-work-item-repository.ts`
- Create: `packages/core/src/testing/in-process-event-bus.ts`
- Create: `packages/core/src/testing/fakes.test.ts`

**Interfaces:**
- Consumes: `WorkItemRepository` (Task 11), `EventBus` (Task 11), `WorkItem` (Task 5).
- Produces:
  - `class InMemoryWorkItemRepository implements WorkItemRepository`.
  - `class InProcessEventBus implements EventBus` — synchronous dispatch (the local-tier degrade of the outbox).

- [ ] **Step 1: Write the failing test `packages/core/src/testing/fakes.test.ts`**

```ts
import { expect, test } from "vitest";
import { InMemoryWorkItemRepository } from "./in-memory-work-item-repository.js";
import { InProcessEventBus } from "./in-process-event-bus.js";
import { WorkItem } from "../domain/workitem/work-item.js";
import { workItemId, projectId, workItemTypeId } from "../domain/shared/ids.js";

test("in-memory repo saves and finds by project", async () => {
  const repo = new InMemoryWorkItemRepository();
  const P = projectId("p-1");
  await repo.save(new WorkItem({
    id: workItemId("wi-1"), projectId: P, parentId: null, typeId: workItemTypeId("t"),
    title: "x", status: "todo", estimate: 1, estimateUnit: "points",
    complexityBand: null, riskBand: null, assigneeId: null,
  }));
  const found = await repo.findByProject(P);
  expect(found).toHaveLength(1);
  expect(await repo.findById(workItemId("wi-1"))).not.toBeNull();
});

test("in-process event bus dispatches synchronously to subscribers", async () => {
  const bus = new InProcessEventBus();
  const seen: string[] = [];
  bus.subscribe("WorkItemStatusChanged", async (e) => { seen.push(e.aggregateId); });
  await bus.publish([{ type: "WorkItemStatusChanged", occurredAt: new Date(), aggregateId: "wi-1" }]);
  expect(seen).toEqual(["wi-1"]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run packages/core/src/testing`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/core/src/testing/in-memory-work-item-repository.ts`**

```ts
import type { WorkItemRepository } from "../ports/repository.js";
import type { WorkItem } from "../domain/workitem/work-item.js";
import type { WorkItemId, ProjectId } from "../domain/shared/ids.js";

export class InMemoryWorkItemRepository implements WorkItemRepository {
  private readonly items = new Map<string, WorkItem>();
  async findByProject(projectId: ProjectId): Promise<WorkItem[]> {
    return [...this.items.values()].filter((i) => i.toProps().projectId === projectId);
  }
  async findById(id: WorkItemId): Promise<WorkItem | null> {
    return this.items.get(id) ?? null;
  }
  async save(item: WorkItem): Promise<void> {
    this.items.set(item.id, item);
  }
}
```

- [ ] **Step 4: Create `packages/core/src/testing/in-process-event-bus.ts`**

```ts
import type { EventBus } from "../ports/event-bus.js";
import type { DomainEvent } from "../domain/events/domain-event.js";

export class InProcessEventBus implements EventBus {
  private readonly handlers = new Map<string, ((e: DomainEvent) => Promise<void>)[]>();
  subscribe(type: string, handler: (e: DomainEvent) => Promise<void>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }
  async publish(events: DomainEvent[]): Promise<void> {
    for (const e of events) {
      for (const h of this.handlers.get(e.type) ?? []) await h(e);
    }
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/testing`
Expected: PASS (2 tests).

- [ ] **Step 6: Export from barrel — append to `packages/core/src/index.ts`**

```ts
export * from "./testing/in-memory-work-item-repository.js";
export * from "./testing/in-process-event-bus.js";
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/testing packages/core/src/index.ts
git commit -m "test(core): add in-memory port fakes (repo + in-process event bus)"
```

---

### Task 13: End-to-end domain slice test (workflow → event → rollup, vs fakes)

**Files:**
- Create: `packages/core/src/domain/domain-slice.test.ts`

**Interfaces:**
- Consumes: `DefaultMethodologyRegistry` (Task 10), `WorkflowEngine` (Task 9), `InProcessEventBus` (Task 12), `WorkItemTree` (Task 5). No new production code — this proves the seams compose.

- [ ] **Step 1: Write the test `packages/core/src/domain/domain-slice.test.ts`**

```ts
import { expect, test } from "vitest";
import { DefaultMethodologyRegistry } from "./methodology/methodology-registry.js";
import { WorkflowEngine } from "./workflow/workflow-engine.js";
import { InProcessEventBus } from "../testing/in-process-event-bus.js";
import { WorkItem } from "./workitem/work-item.js";
import { WorkItemTree } from "./workitem/work-item-tree.js";
import { workItemId, projectId, workItemTypeId, workflowStateId } from "./shared/ids.js";

test("a Scrum status change flows through the engine, emits an event, and moves the rollup", async () => {
  const registry = new DefaultMethodologyRegistry();
  const scrum = registry.resolve("SCRUM");
  const engine = new WorkflowEngine(scrum.workflow());
  const bus = new InProcessEventBus();

  const received: string[] = [];
  bus.subscribe("WorkItemStatusChanged", async (e) => { received.push(e.type); });

  const P = projectId("p-1");
  const T = workItemTypeId("scrum-story");
  const story = new WorkItem({
    id: workItemId("s1"), projectId: P, parentId: workItemId("epic"), typeId: T,
    title: "Story", status: "todo", estimate: 5, estimateUnit: "points",
    complexityBand: null, riskBand: null, assigneeId: null,
  });

  const result = engine.apply(story, workflowStateId("scrum-todo"), "start", { now: new Date("2026-03-16") });
  await bus.publish(result.events);
  expect(received).toEqual(["WorkItemStatusChanged"]);

  // After the story starts, the epic's rolled-up status is in_progress.
  const moved = new WorkItem({ ...story.toProps(), status: result.newCategory });
  const epic = new WorkItem({
    id: workItemId("epic"), projectId: P, parentId: null, typeId: workItemTypeId("scrum-epic"),
    title: "Epic", status: "in_progress", estimate: null, estimateUnit: null,
    complexityBand: null, riskBand: null, assigneeId: null,
  });
  const tree = WorkItemTree.fromFlat([epic, moved]);
  expect(tree.rolledUpStatus(workItemId("epic"))).toBe("in_progress");
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/domain/domain-slice`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/domain/domain-slice.test.ts
git commit -m "test(core): end-to-end domain slice (workflow -> event -> rollup) vs fakes"
```

---

### Task 14: Enforce the dependency rule + full green run

**Files:**
- Modify: root `package.json` (add a `test:all` script wiring depcruise + vitest)
- Create: `packages/core/src/architecture.test.ts`

**Interfaces:**
- Consumes: `.dependency-cruiser.cjs` (Task 1).
- Produces: a test asserting the dependency rule holds, and a single command that runs the whole suite green.

- [ ] **Step 1: Write the architecture test `packages/core/src/architecture.test.ts`**

```ts
import { execSync } from "node:child_process";
import { expect, test } from "vitest";

test("packages/core imports nothing infra (dependency rule)", () => {
  // depcruise exits 0 when no forbidden edges are found.
  const out = execSync("pnpm -w depcruise", { encoding: "utf8" });
  expect(out).not.toMatch(/error/i);
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `pnpm -w test:run packages/core/src/architecture`
Expected: PASS (depcruise reports no forbidden dependencies).

- [ ] **Step 3: Add a `test:all` script — modify root `package.json` scripts block**

```json
    "test:all": "depcruise packages/core/src --config .dependency-cruiser.cjs && vitest run"
```

- [ ] **Step 4: Run the entire Phase 0 suite green**

Run: `pnpm -w run test:all`
Expected: dependency-cruiser reports 0 errors; all Vitest tests pass (Tasks 2–13).

- [ ] **Step 5: Typecheck the workspace**

Run: `pnpm -w typecheck`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/architecture.test.ts package.json
git commit -m "test(core): assert hexagonal dependency rule + wire full green run"
```

---

## Phase 0 Definition of Done

- [ ] `pnpm -w run test:all` is green (dependency-cruiser clean + all unit tests pass).
- [ ] `pnpm -w typecheck` passes.
- [ ] `packages/core` has no runtime dependencies (its `package.json` has no `dependencies` block) and no infra imports.
- [ ] The domain composes end-to-end against in-memory fakes (Task 13) — no DB or vendor present.
- [ ] Methodology variation is resolved through `MethodologyProfile` + registry; no `if (methodology === ...)` branching exists in the domain.
- [ ] Change report written; nothing auto-committed beyond the per-task commits above.

## Self-Review (against the spec)

- **Spec §3 monorepo / dependency rule** → Tasks 1, 2, 14 (pnpm workspace, no-dep core package, dependency-cruiser + architecture test). ✅
- **Spec §4 patterns:** Abstract Factory → Task 10; Strategy (metrics/scheduling) → Tasks 7, 8; State-as-data → Task 9; Composite → Task 5; Observer (events + in-process bus) → Tasks 4, 12; port interfaces → Task 11. ✅
- **Spec §2 principle 2 (methodology as data)** → Task 10 registry-map, config-driven profiles. ✅
- **Spec §2 principle 8 (Visitor rejected)** → honored; operations are Strategies over the Composite (Tasks 5, 7, 8). ✅
- **Deferred correctly to later phases:** Prisma/SQLite (Phase 1), contracts/deterministic analyzers (Phase 2), UI (Phase 3), stub adapters + resolution ladder (Phase 4). Not in scope here. ✅
- **Placeholder scan:** the only self-flagged item is Task 7 Step 3→3b, where a deliberately-simpler `leavesOf` replaces a first-pass helper; the replacement code is given in full, not deferred. ✅
- **Type consistency:** `MethodologyProfile.metrics().key` values (`"VELOCITY"`/`"EARNED_VALUE"`) asserted in Task 10 match the classes defined in Task 7; `workflowStateId`/`workItemTypeId` constructors used consistently across Tasks 6, 9, 10. ✅

**Note on subsequent phases:** Phases 1–4 each get their own fully-detailed plan, written just-in-time once the prior phase is green, so each reflects the actual produced interfaces.
