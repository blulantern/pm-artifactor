# PM Artifactor — Phase 3: Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Depends on Phases 0–2 being green.

**Goal:** Build `apps/web` — a Next.js (App Router) application that renders all 14 POC pages in the exact POC design language, wired to the real domain + deterministic engine via a server-side data layer that maps Prisma rows → `@pma/core` analyzer inputs → view-models.

**Architecture:** `apps/web` is the composition root: the ONE package allowed to import both `@pma/db` (Prisma/SQLite) and `@pma/core` (pure analyzers). Server Components / route handlers call a server data layer (`apps/web/src/server/`) that reads the SQLite vault via Prisma, runs the deterministic analyzers, and returns plain view-models; UI components render them. Client interactivity is minimal (nav is links; Prioritize model switch is a query param; the note modal is a small client component). The `@pma/core` purity rule is untouched — only `apps/web` (outermost layer) knows about both infra and core.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, `@pma/db`, `@pma/core`, Vitest. Design language: teal (`#0f766e`/`#0d9488`/`#14b8a6`), Public Sans + IBM Plex Mono, card-based (from the POC).

## Global Constraints

- **Composition-root only for infra:** only `apps/web` imports `@pma/db`. `@pma/core` and `@pma/contracts` never gain UI/infra deps. The Phase 0 dependency-cruiser rule stays green.
- **Design fidelity (verbatim):** match the POC's tokens exactly — `--teal:#0f766e; --teal2:#0d9488; --teal3:#14b8a6; --deep:#0b3d39; --bg:#f4f5f7; --card:#fff; --ink:#1a1d23; --muted:#6b7280; --faint:#9aa1ab; --line:#e6e8ec; --line2:#d4d8de;` plus the win/flag/amber/violet/blue accent set. Fonts: `'Public Sans'` (body), `'IBM Plex Mono'` (`.mono`, eyebrows, tags). Card-based layout, teal gradient sidebar, "Read-only · offline-ready" top-bar chip, local/encrypted footer. **The reference is `apps/web/reference/PM_Artifactor_POC.html` (copied in Task 1) — port its render functions faithfully.**
- **Read-only / drafts:** the UI never writes to an external system. In-app writes limited to local notes (the note modal is a draft affordance; persisting notes is out of scope for this phase — the modal is presentational per the POC). No auth in the local tier.
- **People red lines:** the Team and Person pages render growth-framed data only; velocity shown with its caveat, never as a ranking. Capacity uses the analyzer's id-ordered output.
- **Data source:** the app reads `DATABASE_URL` (defaults to `file:./.vault/workspace.db`). A dev script seeds it. Pages must not crash on an empty DB (render an empty state), but the primary target is the seeded vault.
- **Server-only db access:** Prisma/`@pma/db` is imported ONLY in `apps/web/src/server/**` (server components / route handlers). Never import `@pma/db` into a client component.
- **Testing:** the data layer (`apps/web/src/server/**`) has Vitest integration tests against a temp seeded DB (reuse `@pma/db`'s `makeTestDb` + seeds). Pages are verified by running the app (Task 12). Full gate: `pnpm -w run test:all` green + `apps/web` builds.

---

### Task 1: `apps/web` scaffold + design tokens + app shell

**Files:**
- Create: `apps/web/package.json`, `apps/web/next.config.mjs`, `apps/web/tsconfig.json`, `apps/web/next-env.d.ts`
- Create: `apps/web/src/app/globals.css` (POC tokens + base styles)
- Create: `apps/web/src/app/layout.tsx` (root layout, fonts, `<Shell>`)
- Create: `apps/web/src/ui/shell.tsx` (sidebar nav + top bar)
- Create: `apps/web/reference/PM_Artifactor_POC.html` (copied reference)
- Modify: root `.gitignore` (ensure `.next/` ignored — already is)

**Interfaces:**
- Produces: a runnable Next.js app (`pnpm --filter @pma/web dev`) showing the teal sidebar shell + top bar, with `/` routing to Today (added in Task 4; for now a placeholder). `Shell({ active, crumb, children })` renders the POC sidebar (nav groups Command/Manage/Deliver/People/System) + top bar.

- [ ] **Step 1: Copy the POC reference into the app**

Run:
```bash
mkdir -p apps/web/reference
cp "../Development Package/ppm-toolkit-dev-package/ppm-toolkit-dev-package/poc/PM_Artifactor_POC.html" apps/web/reference/PM_Artifactor_POC.html
```

- [ ] **Step 2: Create `apps/web/package.json`**

```json
{
  "name": "@pma/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "seed": "pnpm --filter @pma/db seed"
  },
  "dependencies": {
    "@pma/core": "workspace:*",
    "@pma/db": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 3: Create `apps/web/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @pma/* are TS workspace packages consumed from source.
  transpilePackages: ["@pma/core", "@pma/db", "@pma/contracts"],
  experimental: { externalDir: true },
};
export default nextConfig;
```

- [ ] **Step 4: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "composite": false,
    "verbatimModuleSyntax": false,
    "noEmit": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "next-env.d.ts", ".next/types/**/*.ts"]
}
```

- [ ] **Step 5: Create `apps/web/next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 6: Create `apps/web/src/app/globals.css`** — copy the POC's `:root` token block and base element styles verbatim from `apps/web/reference/PM_Artifactor_POC.html` (the `<style>` contents: `:root{...}`, `body`, `.mono`, scrollbar, `button/input/select/textarea`, focus, the `@keyframes` pmpulse/pmfade/pmgrow/pmdraw, `.view/.live/.bar/.spark`, `.card`, `.nav`, `.eyebrow`, `.navhead`, `.btn`, `.ghost`, `.chip`, `.tag`, `.row:hover`, `.avatar`, `.h1/.h2`, `.sub`, `.grid`, `.kpi`, `label`, the reduced-motion query). Prefix the file with `@import` nothing; it is global CSS imported by the root layout.

- [ ] **Step 7: Create `apps/web/src/app/layout.tsx`**

```tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "PM Artifactor", description: "Local-first PPM copilot" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Create `apps/web/src/ui/shell.tsx`** — port the POC `shell()` function to a React server component. Signature: `export function Shell({ active, crumb, children }: { active: string; crumb: ReactNode; children: ReactNode })`. Reproduce the POC's sidebar (logo, the five nav groups with their items and tags, the "Local · encrypted" footer) using Next `<Link href>` for each nav item (hrefs: today→`/`, inbox→`/inbox`, portfolio→`/portfolio`, programs→`/programs`, projects→`/projects`, prioritize→`/prioritize`, releases→`/releases`, dora→`/deploy-health`, team→`/team`, stakeholders→`/stakeholders`, intel→`/intelligence`, connections→`/connections`, vault→`/vault`). Mark the item matching `active` with the `on` class. Reproduce the top bar (crumb slot + "Read-only · offline-ready" chip + Enrich button). Use inline styles matching the POC exactly.

- [ ] **Step 9: Create a temporary placeholder home `apps/web/src/app/page.tsx`**

```tsx
import { Shell } from "@/ui/shell";
export default function Page() {
  return <Shell active="today" crumb="Today"><div className="view">Today — coming in Task 4.</div></Shell>;
}
```

- [ ] **Step 10: Install and run a build to verify the app compiles**

Run: `pnpm install && pnpm --filter @pma/web exec next build`
Expected: build succeeds (the placeholder home renders). If `next build` requires a running DB, it must not — the placeholder page reads no data yet.

- [ ] **Step 11: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): scaffold Next.js app + POC design tokens + sidebar/topbar shell"
```

---

### Task 2: Shared UI primitives

**Files:**
- Create: `apps/web/src/ui/primitives.tsx`
- Create: `apps/web/src/ui/format.ts`
- Create: `apps/web/src/ui/primitives.test.tsx` (light render/logic tests via Vitest)

**Interfaces:**
- Produces React components porting the POC helpers:
  - `Card`, `Panel({ title, sub, children })`, `Chip`, `Tag`, `Kpi({ value, label, color })`, `Bars({ value, max, color })`, `Spark({ points, color })`, `HealthDot({ health })`, `Avatar({ name, size })`, `Eyebrow`.
  - `apps/web/src/ui/format.ts`: `initials(name)`, `healthColor(h)` (`h>=75` win, `>=60` amber, else flag), `initialsOf`, urgency/kind color maps mirroring the POC's `uu` and `uibq`.
- These reproduce the POC's `panel()`, `healthDot()`, `healthColor()`, `bars()`, `spark()`, `initials()` helpers as components/functions.

- [ ] **Step 1: Write the failing test `apps/web/src/ui/primitives.test.tsx`**

```tsx
import { expect, test } from "vitest";
import { healthColor, initials } from "./format.js";

test("healthColor thresholds match the POC", () => {
  expect(healthColor(86)).toContain("win");
  expect(healthColor(70)).toContain("amber");
  expect(healthColor(59)).toContain("flag");
});

test("initials takes the first two word-initials", () => {
  expect(initials("Dana Okafor")).toBe("DO");
  expect(initials("Theo Adékúnlé")).toBe("TA");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run apps/web/src/ui/primitives`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/web/src/ui/format.ts`**

```ts
export const initials = (n: string): string =>
  n.split(" ").map((w) => w[0]).slice(0, 2).join("");

export const healthColor = (h: number): string =>
  h >= 75 ? "var(--win)" : h >= 60 ? "var(--amber)" : "var(--flag)";

export const URGENCY_COLOR: Record<string, string> = {
  high: "var(--flag)", med: "var(--amber)", low: "var(--faint)",
};

export const EMAIL_KIND: Record<string, [string, string]> = {
  needs_reply: ["var(--flag)", "Needs reply"],
  decision: ["var(--violet)", "Decision"],
  risk: ["var(--amber)", "Risk"],
  fyi: ["var(--faint)", "FYI"],
};
```

- [ ] **Step 4: Create `apps/web/src/ui/primitives.tsx`** — port the POC helpers to React components. Provide `Card`, `Panel`, `Chip`, `Tag`, `Kpi`, `Bars`, `Spark`, `HealthDot`, `Avatar`, `Eyebrow`, each reproducing the POC's inline styles/classes. `Bars` and `Spark` reproduce `bars(v,max,color)` and `spark(vals,color)` (the SVG polyline). Keep them server components (no client hooks).

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -w test:run apps/web/src/ui/primitives`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/ui
git commit -m "feat(web): add shared UI primitives ported from the POC"
```

---

### Task 3: Server data layer — mappers + view-models

**Files:**
- Create: `apps/web/src/server/db.ts` (Prisma accessor for the app)
- Create: `apps/web/src/server/view-models.ts` (the read functions)
- Create: `apps/web/src/server/view-models.test.ts` (integration test vs a temp seeded DB)

**Interfaces:**
- Consumes: `@pma/db` (`getPrisma`, `makeTestDb`, seeds), `@pma/core` (analyzers).
- Produces async view-model builders (all read the DB and run analyzers), returning plain serializable objects:
  - `getPortfolioView()` → `{ name; health; invest; benefitRealized; programs: {id,name,health,status,benefitPct}[]; loads: PersonLoad[]; objectives: {title,weightPct}[] }`
  - `getProjectsView()` → `{ id;name;methodology;health;status;next;source;spi;cpi }[]`
  - `getProjectView(id)` → project detail incl. `health` composite + drivers (via `computeHealth`) + sprint metrics (via `computeSprint`) + baseline variances
  - `getPrioritizeView(model)` → `{ model; rows: {id,title,value,components}[] }` using `WsjfStrategy`/`RiceStrategy`
  - `getTodayView()` → `{ managerName; brief; actions; meetings }` using `runSpecificationRules` + `buildDailyBrief` over a snapshot assembled from the DB
  - `getReleasesView()` / `getDoraView()` (via `computeDora`)
  - `getTeamView()` / `getPersonView(id)` / `getStakeholdersView()` / `getInboxView()` / `getIntelView()` / `getConnectionsView()` / `getVaultView()`
- `apps/web/src/server/db.ts` exports `db()` returning the shared `PrismaClient` from `getPrisma()`.

- [ ] **Step 1: Write the failing test `apps/web/src/server/view-models.test.ts`**

```ts
import { expect, test } from "vitest";
import { makeTestDb } from "@pma/db/src/testing/test-db.js";
import { seedMethodologies } from "@pma/db/prisma/seed-methodologies.js";
import { seedPoc } from "@pma/db/prisma/seed-poc.js";
import { buildPortfolioView, buildPrioritizeView, buildDoraView } from "./view-models.js";

test("portfolio view surfaces Sam's cross-tool overallocation", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await seedMethodologies(prisma);
    await seedPoc(prisma);
    const vm = await buildPortfolioView(prisma);
    const sam = vm.loads.find((l) => l.personId === "Sam Rivera")!;
    expect(sam.totalPct).toBe(122);
    expect(sam.overallocated).toBe(true);
    expect(vm.programs).toHaveLength(2);
  } finally { await cleanup(); }
}, 30000);

test("prioritize view ranks the backlog by the chosen model", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await seedMethodologies(prisma);
    await seedPoc(prisma);
    const wsjf = await buildPrioritizeView(prisma, "WSJF");
    expect(wsjf.rows[0]!.value).toBeGreaterThanOrEqual(wsjf.rows[1]!.value);
    const rice = await buildPrioritizeView(prisma, "RICE");
    expect(rice.rows[0]!.title).toBe("Checkout a11y pass"); // 2125, highest
  } finally { await cleanup(); }
}, 30000);

test("dora view computes CFR from rolled-back prod deploys", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await seedMethodologies(prisma);
    await seedPoc(prisma);
    const vm = await buildDoraView(prisma);
    expect(vm.prodDeploys).toBeGreaterThanOrEqual(3);
    expect(vm.changeFailureRate).toBeGreaterThan(0);
  } finally { await cleanup(); }
}, 30000);
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run apps/web/src/server/view-models`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/web/src/server/db.ts`**

```ts
import { getPrisma } from "@pma/db/src/client.js";
import type { PrismaClient } from "@prisma/client";
export const db = (): PrismaClient => getPrisma();
```

- [ ] **Step 4: Create `apps/web/src/server/view-models.ts`** — implement each builder taking an explicit `PrismaClient` (so tests inject `makeTestDb`'s client; the page wrappers pass `db()`). Full implementations for the builders the tests exercise (`buildPortfolioView`, `buildPrioritizeView`, `buildDoraView`) plus the remaining builders following the same pattern. Each maps Prisma rows → analyzer inputs → runs the analyzer → returns a plain object. Example (portfolio):

```ts
import type { PrismaClient } from "@prisma/client";
import { computeLoads, WsjfStrategy, RiceStrategy, computeDora, type PriorityScore } from "@pma/core";

const NOW = () => new Date();

export async function buildPortfolioView(prisma: PrismaClient) {
  const portfolio = await prisma.portfolio.findFirst({ include: { programs: true } });
  const allocations = await prisma.allocation.findMany({ include: { person: true } });
  const loads = computeLoads(
    allocations.map((a) => ({ personId: a.person.name, pct: a.pct, source: a.sourceLabel ?? "?" })),
    NOW(),
  ).result;
  const objectives = await prisma.strategicObjective.findMany();
  return {
    name: portfolio?.name ?? "Portfolio",
    health: portfolio ? Math.round((portfolio.programs.reduce((s, p) => s + (p.benefitPct ?? 0), 0) / Math.max(portfolio.programs.length, 1))) : 0,
    invest: portfolio?.totalInvestment ?? 0,
    benefitRealized: portfolio?.benefitRealized ?? 0,
    programs: portfolio?.programs.map((p) => ({ id: p.id, name: p.name, health: p.benefitPct ?? 0, status: p.status, benefitPct: p.benefitPct ?? 0 })) ?? [],
    loads,
    objectives: objectives.map((o) => ({ title: o.title, weightPct: o.weightPct ?? 0 })),
  };
}

export async function buildPrioritizeView(prisma: PrismaClient, model: "WSJF" | "RICE") {
  const backlog = await prisma.backlogItem.findMany({ include: { workItem: true }, orderBy: { rank: "asc" } });
  const items = backlog.map((b) => ({
    id: b.workItemId, title: b.workItem.title, estimate: b.workItem.estimate,
    wsjf: { userBusinessValue: b.wsjfUserBusinessValue ?? 0, timeCriticality: b.wsjfTimeCriticality ?? 0, riskReduction: b.wsjfRiskReduction ?? 0 },
    rice: { reach: b.riceReach ?? 0, impact: b.riceImpact ?? 0, confidence: b.riceConfidence ?? 0, effort: b.riceEffort ?? 1 },
  }));
  const scores: PriorityScore[] = (model === "WSJF" ? new WsjfStrategy() : new RiceStrategy()).rank(items, NOW()).result;
  const titleById = new Map(items.map((i) => [i.id, i.title]));
  return { model, rows: scores.map((s) => ({ id: s.id, title: titleById.get(s.id) ?? s.id, value: s.value, components: s.components })) };
}

export async function buildDoraView(prisma: PrismaClient) {
  const deps = await prisma.deployment.findMany({ include: { environment: true } });
  return computeDora(
    deps.map((d) => ({ environment: d.environment.name, status: d.status, leadTimeMinutes: d.leadTimeMinutes, isRollback: d.rollbackOfId != null })),
    NOW(),
  ).result;
}
```

Implement the remaining builders (`buildProjectsView`, `buildProjectView`, `buildTodayView`, `buildReleasesView`, `buildTeamView`, `buildPersonView`, `buildStakeholdersView`, `buildInboxView`, `buildIntelView`, `buildConnectionsView`, `buildVaultView`) following this exact pattern: read the relevant Prisma rows, run the matching analyzer where one applies (`buildTodayView` assembles a `CanonicalSnapshot` from cadences/complex items/stakeholders/one-on-ones/gates/deployments/calendar and runs `runSpecificationRules` + `buildDailyBrief`; `buildProjectView` runs `computeHealth` + `computeSprint`), and return a plain object. Add thin no-arg wrappers at the bottom that call the builder with `db()` for the page layer to use, e.g. `export const getPortfolioView = () => buildPortfolioView(db());`.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -w test:run apps/web/src/server/view-models`
Expected: PASS (3 tests). Fix mappings until green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server
git commit -m "feat(web): add server data layer mapping Prisma -> analyzers -> view-models"
```

---

### Task 4: Today (Daily Command Center) page

**Files:**
- Create: `apps/web/src/app/page.tsx` (replaces the Task-1 placeholder)
- Create: `apps/web/src/ui/today.tsx`

**Interfaces:**
- Consumes: `getTodayView` (Task 3), `Shell`, primitives.
- Produces the Today route at `/`. Port the POC `today()` function to React reading the real view-model: the AI-written daily brief (from `buildDailyBrief`'s headline), the "shifting task list" (from the ranked `SuggestedAction`s with urgency dots), today's calendar (read-only), the "Suggested" quick actions, and the "Walk through the workspace" grid (links to the other pages). Keep the exact POC markup/classes; replace the sample `D.today`/`D.meetings` with the view-model.

- [ ] **Step 1: Implement `apps/web/src/ui/today.tsx`** porting the POC `today()` function, reading `getTodayView()`. The urgency dot color uses `URGENCY_COLOR`. Each task row links to the referenced entity where natural (or is presentational). The brief text comes from `view.brief.headline`.
- [ ] **Step 2: Implement `apps/web/src/app/page.tsx`**

```tsx
import { Shell } from "@/ui/shell";
import { Today } from "@/ui/today";
import { getTodayView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getTodayView();
  return <Shell active="today" crumb="Today"><Today view={view} /></Shell>;
}
```

- [ ] **Step 3: Verify the page renders against the seeded vault**

Run: seed a dev DB then build —
```bash
DATABASE_URL="file:./.vault/workspace.db" pnpm --filter @pma/db exec prisma db push --skip-generate
DATABASE_URL="file:./.vault/workspace.db" pnpm --filter @pma/web run seed
pnpm --filter @pma/web exec next build
```
Expected: build succeeds; `/` is a dynamic route. (Interactive render is verified in Task 12.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/ui/today.tsx
git commit -m "feat(web): Today / Daily Command Center page wired to the deterministic copilot"
```

---

### Task 5: Portfolio page

**Files:**
- Create: `apps/web/src/app/portfolio/page.tsx`
- Create: `apps/web/src/ui/portfolio.tsx`

**Interfaces:**
- Consumes: `getPortfolioView`. Port the POC `portfolio()` function: KPI row (health, investment, benefit realized, programs/projects), health matrix (bars per program), investment-vs-benefit waterfall SVG, capacity-vs-demand (from `view.loads` — Sam at 122% shown red), strategic-alignment bars (from `view.objectives`).

- [ ] **Step 1: Implement `apps/web/src/ui/portfolio.tsx`** porting POC `portfolio()` reading the view-model (capacity bars use `loads`, coloring >100% with `--flag`).
- [ ] **Step 2: Implement `apps/web/src/app/portfolio/page.tsx`** (mirror Task 4's page pattern: `getPortfolioView()` → `<Shell active="portfolio" crumb="Portfolio"><Portfolio view={view} /></Shell>`, `dynamic = "force-dynamic"`).
- [ ] **Step 3: Verify** `pnpm --filter @pma/web exec next build` succeeds.
- [ ] **Step 4: Commit** `git commit -m "feat(web): Portfolio page (health matrix, investment/benefit, cross-tool capacity, alignment)"`

---

### Task 6: Programs, Projects list, Project detail

**Files:**
- Create: `apps/web/src/app/programs/page.tsx`, `apps/web/src/ui/programs.tsx`
- Create: `apps/web/src/app/projects/page.tsx`, `apps/web/src/ui/projects.tsx`
- Create: `apps/web/src/app/projects/[id]/page.tsx`, `apps/web/src/ui/project-detail.tsx`

**Interfaces:**
- Consumes: `getProgramsView` (add to Task 3 pattern if missing — read programs + their projects), `getProjectsView`, `getProjectView(id)`. Port POC `programs()`, `projects()`, `project()`. Project detail shows: delivery forecast panel, sprint progress (from `computeSprint`), health drivers (from `computeHealth` — the named drivers with trend + the "why NN" explanation), baseline variance. Project rows/links use `/projects/[id]`.

- [ ] **Step 1: Implement the three UI components** porting the POC functions, reading their view-models. Project detail's health-drivers panel renders `view.health.drivers` (name + trend severity bar) and the primary-driver explanation.
- [ ] **Step 2: Implement the three page files** (list pages `force-dynamic`; detail page reads `params.id`).
- [ ] **Step 3: Verify** `next build` succeeds.
- [ ] **Step 4: Commit** `git commit -m "feat(web): Programs, Projects list, and Project detail pages"`

---

### Task 7: Prioritize page (WSJF/RICE)

**Files:**
- Create: `apps/web/src/app/prioritize/page.tsx`, `apps/web/src/ui/prioritize.tsx`

**Interfaces:**
- Consumes: `getPrioritizeView(model)`. The model switch is a query param `?model=WSJF|RICE` (default WSJF) — the page reads `searchParams`, calls `buildPrioritizeView` with it (recomputing via the domain strategy — no client math), and the WSJF/RICE toggle buttons are `<Link href="?model=...">`. Port POC `prioritize()`: ranked rows with component bars + the score, the formula caption, the "switch models to see disagreement" note.

- [ ] **Step 1: Implement `apps/web/src/ui/prioritize.tsx`** porting POC `prioritize()` reading `view.rows` (component bars from `row.components`, the score from `row.value`).
- [ ] **Step 2: Implement `apps/web/src/app/prioritize/page.tsx`**

```tsx
import { Shell } from "@/ui/shell";
import { Prioritize } from "@/ui/prioritize";
import { getPrioritizeView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ model?: string }> }) {
  const sp = await searchParams;
  const model = sp.model === "RICE" ? "RICE" : "WSJF";
  const view = await getPrioritizeView(model);
  return <Shell active="prioritize" crumb="Prioritize backlog"><Prioritize view={view} /></Shell>;
}
```

- [ ] **Step 3: Verify** `next build` succeeds AND add a quick assertion via the Task-3 test pattern is optional — the WSJF/RICE ranking is already tested in Task 3.
- [ ] **Step 4: Commit** `git commit -m "feat(web): Prioritize page (WSJF/RICE, recomputed server-side via the domain strategy)"`

---

### Task 8: Releases + Deploy Health (DORA)

**Files:**
- Create: `apps/web/src/app/releases/page.tsx`, `apps/web/src/ui/releases.tsx`
- Create: `apps/web/src/app/deploy-health/page.tsx`, `apps/web/src/ui/dora.tsx`

**Interfaces:**
- Consumes: `getReleasesView`, `getDoraView`. Port POC `releases()` (release cards with per-env status dots, the "write once, drop anywhere" renditions/destinations strip) and `dora()` (the four DORA KPI cards from `computeDora` + the deploy-frequency bar chart).

- [ ] **Step 1: Implement both UI components** porting the POC functions from their view-models (DORA cards: `deployFrequency` derived, `avgLeadTimeMinutes`, `changeFailureRate` as a %, `mttrMinutes`).
- [ ] **Step 2: Implement both page files** (`/releases`, `/deploy-health`, both `force-dynamic`).
- [ ] **Step 3: Verify** `next build` succeeds.
- [ ] **Step 4: Commit** `git commit -m "feat(web): Release Command Center + Deployment Health (DORA) pages"`

---

### Task 9: Team, Person detail, Stakeholders

**Files:**
- Create: `apps/web/src/app/team/page.tsx`, `apps/web/src/ui/team.tsx`
- Create: `apps/web/src/app/team/[id]/page.tsx`, `apps/web/src/ui/person-detail.tsx`
- Create: `apps/web/src/ui/note-modal.tsx` (client component)
- Create: `apps/web/src/app/stakeholders/page.tsx`, `apps/web/src/ui/stakeholders.tsx`

**Interfaces:**
- Consumes: `getTeamView`, `getPersonView(id)`, `getStakeholdersView`. Port POC `team()`, `person()`, `stakeholders()`. Person detail: strengths, growth area ("How I support"), motivations, skills (proficiency vs interest bars), "where they flow" (velocity by band, WITH the caveat, never a ranking). The "Add note" button opens `note-modal.tsx` (a client component reproducing the POC note modal — presentational; it does not persist in this phase). Stakeholders: power-interest grid SVG + cards + the "draft update" affordance. Team/person links use `/team/[id]`.

- [ ] **Step 1: Implement `note-modal.tsx`** as a client component (`"use client"`) porting the POC `noteModal()` markup with local open/close state; triggered by a button on the person page.
- [ ] **Step 2: Implement the three UI components** porting the POC functions. Person "where they flow" renders the velocity bands with the caveat text; NO leaderboard/ranking.
- [ ] **Step 3: Implement the three page files.**
- [ ] **Step 4: Verify** `next build` succeeds.
- [ ] **Step 5: Commit** `git commit -m "feat(web): Team, Person detail (+note modal), and Stakeholders pages (red-line-safe)"`

---

### Task 10: Inbox, Intelligence, Connections, Vault

**Files:**
- Create: `apps/web/src/app/inbox/page.tsx`, `apps/web/src/ui/inbox.tsx`
- Create: `apps/web/src/app/intelligence/page.tsx`, `apps/web/src/ui/intel.tsx`
- Create: `apps/web/src/app/connections/page.tsx`, `apps/web/src/ui/connections.tsx`
- Create: `apps/web/src/app/vault/page.tsx`, `apps/web/src/ui/vault.tsx`

**Interfaces:**
- Consumes: `getInboxView`, `getIntelView`, `getConnectionsView`, `getVaultView`. Port POC `inbox()` (email digest rows by kind, from seeded `EmailMessage`s), `intel()` (resolution-ladder bars + learning-maturity + the pipeline strip — sourced from real `AiTask`/`FeatureRecord` counts where available, else the POC's representative distribution with a clear "no AI calls logged yet" state), `connections()` (read-only source cards from `SyncConnection`/`ExternalSystem`, plus the unconnected ones), `vault()` (the vault stats + export/manage affordances).

- [ ] **Step 1: Implement the four UI components** porting the POC functions from their view-models. Intel: if no `AiTask` rows exist yet (true this phase), show the tier distribution as an explicit "projected — no live AI calls yet" state rather than fabricating live numbers.
- [ ] **Step 2: Implement the four page files.**
- [ ] **Step 3: Verify** `next build` succeeds.
- [ ] **Step 4: Commit** `git commit -m "feat(web): Inbox, System Intelligence, Connections, and Vault pages"`

---

### Task 11: First-run / Setup page + polish

**Files:**
- Create: `apps/web/src/app/setup/page.tsx`, `apps/web/src/ui/setup.tsx`
- Modify: `apps/web/src/ui/shell.tsx` (only if a nav/crumb fix is needed after all pages exist)

**Interfaces:**
- Port POC `setup()` (the two-column first-run screen: teal marketing panel + "Open your workspace" form with an "Enter workspace →" link to `/`). Route at `/setup`. Presentational (no real vault creation in this phase).

- [ ] **Step 1: Implement `setup.tsx`** porting POC `setup()`; the "Enter workspace" button is a `<Link href="/">`.
- [ ] **Step 2: Implement `apps/web/src/app/setup/page.tsx`** (renders `<Setup/>` WITHOUT the Shell — it's a full-bleed screen).
- [ ] **Step 3: Verify** `next build` succeeds for the whole app (all routes).
- [ ] **Step 4: Commit** `git commit -m "feat(web): first-run Setup screen"`

---

### Task 12: End-to-end verification (run the app, click through)

**Files:** none (verification only; may add `apps/web/README.md` with run instructions).

**Interfaces:** proves the app runs against the seeded vault and every page renders real data.

- [ ] **Step 1: Seed a dev vault**

```bash
DATABASE_URL="file:./.vault/workspace.db" pnpm --filter @pma/db exec prisma db push --skip-generate
DATABASE_URL="file:./.vault/workspace.db" pnpm --filter @pma/web run seed
```

- [ ] **Step 2: Full production build of the app**

Run: `pnpm --filter @pma/web exec next build`
Expected: all 14 routes compile with no type/render errors.

- [ ] **Step 3: Start the app and smoke every route** (use the superpowers/run tooling or curl each route for a 200 + expected content marker)

Run (dev server in background), then for each of `/ /inbox /portfolio /programs /projects /prioritize /prioritize?model=RICE /releases /deploy-health /team /stakeholders /intelligence /connections /vault /setup`:
- confirm HTTP 200 and that a known data marker renders (e.g. `/` contains "Sprint 14"; `/portfolio` contains "122"; `/prioritize?model=RICE` lists "Checkout a11y pass" first; `/deploy-health` shows a change-failure figure).

- [ ] **Step 4: Full gate**

Run: `pnpm -w run test:all && pnpm -w typecheck`
Expected: dependency-cruiser clean (core/contracts still pure), all tests pass, typecheck clean.

- [ ] **Step 5: Write `apps/web/README.md`** with the seed + dev commands, then commit.

```bash
git add apps/web/README.md
git commit -m "docs(web): add run instructions; Phase 3 end-to-end verified"
```

---

## Phase 3 Definition of Done

- [ ] `apps/web` builds and runs; all 14 POC pages render against the seeded vault with real data (the deterministic engine's outputs, not sample constants).
- [ ] Design language matches the POC (teal, Public Sans + IBM Plex Mono, card-based, read-only chrome).
- [ ] `@pma/db` is imported only under `apps/web/src/server/**`; `@pma/core`/`@pma/contracts` stay pure (dependency-cruiser green).
- [ ] People red lines honored on Team/Person (growth-framed, caveated velocity, no ranking).
- [ ] `pnpm -w run test:all` + `pnpm -w typecheck` green.

## Self-Review (against the spec)

- **Spec §8 UI — all 14 POC pages in the POC design language** → Tasks 1 (shell/tokens), 2 (primitives), 4–11 (the pages). ✅
- **Spec §3 composition root — apps/web imports db + core; core stays pure** → Task 3 data layer + the Global Constraints; dependency-cruiser guards purity. ✅
- **Spec §6 pages read real application queries (e.g., Prioritize recomputes WSJF/RICE via the domain strategy)** → Task 3 view-models + Task 7 (server-side recompute via query param). ✅
- **Spec §2 principle 7 people red lines** → Task 9 (caveated velocity, no ranking). ✅
- **Spec §2 principle 3 read-only** → Global Constraints (no external writes; note modal presentational). ✅
- **Deferred to Phase 4:** the stub AIPort + resolution ladder + live Intelligence numbers (Task 10 shows a "no live AI calls yet" state until Phase 4). ✅
- **Placeholder scan:** infrastructure/data-layer code is complete; page tasks port named POC render functions from the in-repo reference (`apps/web/reference/PM_Artifactor_POC.html`) — a concrete, authoritative source, not a vague placeholder. ✅
- **Type consistency:** view-model builders in Task 3 are consumed by the page files in Tasks 4–11 via the `get*View` wrappers; `PersonLoad`/`PriorityScore`/`DoraMetrics` shapes come from `@pma/core` unchanged. ✅
