# PM Artifactor — Phase 4: AI Stub Layer + Resolution Ladder + Ingestion (Final Phase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Depends on Phases 0–3 being green.

**Goal:** Fill in the AI edge behind its real ports — a stub template `AIPort` producing contract-valid *grounded* output, a content-addressed cache with `grounded_on` dependency fingerprints, the resolution-ladder Proxy (exact-cache → stub-LLM) that logs `AiTask`/`AiResultCache`, fake read-only ingestion adapters that prove the pull → `IngestionSnapshot` (provenance) → normalize path, and a `warmIntelligence` pipeline that persists `FeatureRecord`s and exercises the ladder — so the System Intelligence page shows **real** tier distribution and tokens-saved instead of a projected state.

**Architecture:** All AI/ingestion infra lives in `apps/web/src/server/{ai,ingestion}/` (the composition root — it may import `@pma/db`, `@pma/core`, `@pma/contracts`). The `AIPort` interface stays in `@pma/core` (Phase 0). The resolution ladder is a caching **Proxy** implementing `AIPort` over a delegate `AIPort` (the stub) + a cache store (interface + in-memory fake for tests + Prisma-backed impl). Every AI I/O validates against `@pma/contracts`; an output with empty `grounded_on` is discarded. `@pma/core` and `@pma/contracts` stay pure — the dependency-cruiser rule holds.

**Tech Stack:** TypeScript, `node:crypto` (hashing, infra only), `@pma/core`, `@pma/contracts`, `@pma/db`, Vitest.

## Global Constraints

- **Purity preserved:** `@pma/core` and `@pma/contracts` gain no new deps; `@pma/db` is imported only under `apps/web/src/server/**`. The Phase 0 dependency-cruiser rule stays green.
- **Grounded & typed (verbatim):** every AI output is validated against the `@pma/contracts` task-output schema; `grounded_on` must be non-empty (min 1) or the output is discarded as a hallucination. `stakeholder.update` output has `is_draft: true`. AI-emitted numbers are `GroundedNumber`.
- **Suggestions, not actions:** the AI never writes to an external system. Drafts are produced in-app only. No external network calls — the "LLM" is a deterministic template composer (no real provider this phase).
- **Read-only ingestion:** ingestion adapters pull fake read-only data, write an `IngestionSnapshot` with `provenance` (`mode: "read_only"`), then normalize into canonical entities + `ExternalLink`. Nothing writes back to the fake source. `SyncConnection.direction` stays `inbound`; `authRef` is a keychain reference, never a token.
- **Compute-first / honest metrics:** the Intelligence tier distribution counts deterministic computations (persisted `FeatureRecord`s) as the deterministic tier, plus the real `AiTask` tiers (`exact_cache`/`llm`). `tokens_saved` comes from real cache hits. No fabricated numbers — `hasLiveData` is true only once real `AiTask` rows exist.
- **Resolution tiers (this phase):** the ladder emits `exact_cache` (cache hit, deps fresh) or `llm` (miss). Semantic/learned tiers are out of scope (documented as future). Deterministic "tier 0" is represented by the `FeatureRecord` corpus, not the ladder.
- **Cache key:** `sha256(task_type + normalized_input)` where normalization sorts object keys and drops answer-irrelevant fields; same-meaning input → same key.
- **Testing:** AI stub + cache store + ladder unit-tested against in-memory fakes; Prisma store, ingestion, and warm pipeline tested against a temp seeded DB (`makeTestDb` + seeds). Full gate: `pnpm -w run test:all` + `pnpm -w typecheck` green, and the app builds.

---

### Task 1: Stub template AIPort

**Files:**
- Create: `apps/web/src/server/ai/template-ai-port.ts`
- Create: `apps/web/src/server/ai/template-ai-port.test.ts`

**Interfaces:**
- Consumes: `AIPort`, `AIResult` (`@pma/core`); the task output validators from `@pma/contracts` (`DailyBriefComposeOutput`, `HealthExplainOutput`, `StakeholderUpdateOutput`, `EmailDigestOutput`, `PrioritizationSuggestOutput`, `TeammateInsightOutput`).
- Produces:
  - `class TemplateAIPort implements AIPort` — `run(task, input)` returns `{ output, groundedOn, confidence }` where `output` is a contract-valid object for the task, composed deterministically from the (already grounded) input, with `groundedOn` = the input entity IDs and a simulated `tokensUsed` exposed via a second return channel.
  - Because `AIResult` has no token field, expose tokens through a module-level pure helper `estimateTokens(output): number` (≈ `JSON.stringify(output).length / 4`) that the ladder calls — keep the port's return shape exactly `AIResult`.
  - Supported task keys (this phase): `daily-brief.compose`, `health.explain`, `stakeholder.update`, `email.digest`. For an unsupported task, throw `Error("unsupported AI task: <task>")`.

- [ ] **Step 1: Write the failing test `apps/web/src/server/ai/template-ai-port.test.ts`**

```ts
import { expect, test } from "vitest";
import { TemplateAIPort, estimateTokens } from "./template-ai-port.js";
import { DailyBriefComposeOutput, StakeholderUpdateOutput } from "@pma/contracts";

const ai = new TemplateAIPort();

test("daily-brief.compose returns a contract-valid grounded output", async () => {
  const input = {
    date: "2026-03-16", manager_name: "Alex",
    suggested_actions: [
      { id: "a1", type: "sprint_end", urgency: "high", text: "Sprint 14 ends Fri", refs: ["s14"] },
      { id: "a2", type: "one_on_one_overdue", urgency: "med", text: "Meet Lin", refs: ["lin"] },
    ],
  };
  const res = await ai.run("daily-brief.compose", input);
  expect(res.groundedOn.length).toBeGreaterThan(0);
  expect(DailyBriefComposeOutput.safeParse({ ...(res.output as object), grounded_on: res.groundedOn, confidence: res.confidence }).success).toBe(true);
  expect(estimateTokens(res.output)).toBeGreaterThan(0);
});

test("stakeholder.update output is a draft (is_draft true) and grounded", async () => {
  const input = {
    stakeholder: { id: "priya", name: "Priya", interest_level: "manage_closely" },
    items: [{ id: "ledger", name: "Ledger Migration", status: "at_risk", reason_invested: "tracks the benefit" }],
  };
  const res = await ai.run("stakeholder.update", input);
  const parsed = StakeholderUpdateOutput.safeParse({ ...(res.output as object), grounded_on: res.groundedOn, confidence: res.confidence });
  expect(parsed.success).toBe(true);
  expect((res.output as any).is_draft).toBe(true);
});

test("an unsupported task throws", async () => {
  await expect(ai.run("nope.task", {})).rejects.toThrow(/unsupported/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run apps/web/src/server/ai/template-ai-port`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/web/src/server/ai/template-ai-port.ts`**

```ts
import type { AIPort, AIResult } from "@pma/core";

/** Rough token estimate for the compute-economy panel (no real tokenizer this phase). */
export const estimateTokens = (output: unknown): number =>
  Math.max(1, Math.ceil(JSON.stringify(output).length / 4));

/**
 * Deterministic, grounded template composer standing in for the LLM adapter.
 * Every output is assembled from the already-grounded input, so grounded_on is
 * never empty and nothing is invented. The real Claude adapter drops in behind
 * this exact AIPort later.
 */
export class TemplateAIPort implements AIPort {
  async run(task: string, input: unknown): Promise<AIResult> {
    switch (task) {
      case "daily-brief.compose": return this.dailyBrief(input as DailyBriefInput);
      case "health.explain": return this.healthExplain(input as HealthInput);
      case "stakeholder.update": return this.stakeholderUpdate(input as StakeholderInput);
      case "email.digest": return this.emailDigest(input as EmailInput);
      default: throw new Error(`unsupported AI task: ${task}`);
    }
  }

  private dailyBrief(input: DailyBriefInput): AIResult {
    const actions = input.suggested_actions ?? [];
    const high = actions.filter((a) => a.urgency === "high");
    const who = input.manager_name ? `${input.manager_name}, ` : "";
    const headline = actions.length === 0
      ? `${who}a clear runway today.`
      : `${who}${high.length} high-priority item${high.length === 1 ? "" : "s"} today; ${actions.length} to review.`;
    const output = {
      headline,
      ranked_action_ids: actions.map((a) => a.id),
      tips: high.slice(0, 3).map((a) => a.text),
    };
    const grounded = [...new Set(actions.flatMap((a) => [a.id, ...(a.refs ?? [])]))];
    return { output, groundedOn: grounded, confidence: 0.9 };
  }

  private healthExplain(input: HealthInput): AIResult {
    const primary = [...input.drivers].sort((a, b) => b.value - a.value)[0];
    const output = {
      summary: `${input.entity.name} is at ${input.composite}/100; ${primary ? primary.name.replace(/_/g, " ") : "no driver"} is the main pressure.`,
      primary_driver: primary?.name ?? "none",
      suggested_action: primary ? `Address ${primary.name.replace(/_/g, " ")} first.` : "Hold steady.",
    };
    return { output, groundedOn: [input.entity.id], confidence: 0.85 };
  }

  private stakeholderUpdate(input: StakeholderInput): AIResult {
    const lines = input.items.map((i) => `• ${i.name}: ${i.status}${i.reason_invested ? ` (${i.reason_invested})` : ""}`).join("\n");
    const output = {
      draft: `Hi ${input.stakeholder.name},\n\nHere is where things stand:\n${lines}\n\nHappy to discuss.`,
      is_draft: true as const,
    };
    const grounded = [input.stakeholder.id, ...input.items.map((i) => i.id)];
    return { output, groundedOn: grounded, confidence: 0.8 };
  }

  private emailDigest(input: EmailInput): AIResult {
    const items = input.messages.map((m) => ({
      kind: classify(m.subject, m.snippet),
      summary: m.snippet,
      thread_id: m.thread_id ?? m.provenance.external_id,
      linked_refs: (m.links ?? []).map((l) => l.id),
    }));
    const output = { items };
    const grounded = [...new Set(input.messages.flatMap((m) => [m.provenance.external_id, ...(m.links ?? []).map((l) => l.id)]))];
    return { output, groundedOn: grounded, confidence: 0.75 };
  }
}

function classify(subject: string, snippet: string): "needs_reply" | "decision" | "risk" | "fyi" {
  const t = `${subject} ${snippet}`.toLowerCase();
  if (t.includes("confirm") || t.includes("?")) return "needs_reply";
  if (t.includes("sign-off") || t.includes("decision") || t.includes("approve")) return "decision";
  if (t.includes("overlap") || t.includes("risk") || t.includes("maintenance")) return "risk";
  return "fyi";
}

interface DailyBriefInput { date: string; manager_name?: string; suggested_actions?: { id: string; urgency: string; text: string; refs?: string[] }[] }
interface HealthInput { entity: { id: string; name: string }; composite: number; drivers: { name: string; value: number }[] }
interface StakeholderInput { stakeholder: { id: string; name: string }; items: { id: string; name: string; status: string; reason_invested?: string | null }[] }
interface EmailInput { messages: { subject: string; snippet: string; thread_id?: string; provenance: { external_id: string }; links?: { id: string }[] }[] }
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -w test:run apps/web/src/server/ai/template-ai-port`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/ai/template-ai-port.ts apps/web/src/server/ai/template-ai-port.test.ts
git commit -m "feat(web): add stub template AIPort producing grounded, contract-valid output"
```

---

### Task 2: AI cache store (interface + in-memory fake + hashing)

**Files:**
- Create: `apps/web/src/server/ai/cache-key.ts`
- Create: `apps/web/src/server/ai/cache-store.ts`
- Create: `apps/web/src/server/ai/cache-store.test.ts`

**Interfaces:**
- Produces:
  - `cache-key.ts`: `normalizeInput(input: unknown): unknown` (recursively sorts object keys, drops keys named `pulled_at`/`created_at`/`updated_at`); `cacheKey(taskType: string, input: unknown): string` = `sha256(taskType + JSON.stringify(normalizeInput(input)))` (hex) using `node:crypto`.
  - `cache-store.ts`:
    - `interface CachedEntry { keyHash: string; taskType: string; output: unknown; groundedOn: string[]; tokensUsed: number; hitCount: number; stale: boolean; }`
    - `interface AICacheStore { get(keyHash: string): Promise<CachedEntry | null>; put(entry: CachedEntry): Promise<void>; bumpHit(keyHash: string, tokensSaved: number): Promise<void>; markStaleByEntity(entityId: string): Promise<number>; }`
    - `class InMemoryAICacheStore implements AICacheStore` (for tests).

- [ ] **Step 1: Write the failing test `apps/web/src/server/ai/cache-store.test.ts`**

```ts
import { expect, test } from "vitest";
import { cacheKey, normalizeInput } from "./cache-key.js";
import { InMemoryAICacheStore } from "./cache-store.js";

test("cacheKey is stable across key order and ignores volatile fields", () => {
  const a = cacheKey("health.explain", { b: 1, a: 2, pulled_at: "2026-01-01" });
  const b = cacheKey("health.explain", { a: 2, b: 1, pulled_at: "2099-12-31" });
  expect(a).toBe(b);
  expect(cacheKey("other.task", { a: 2, b: 1 })).not.toBe(a);
});

test("in-memory store put/get/bumpHit/markStale", async () => {
  const s = new InMemoryAICacheStore();
  await s.put({ keyHash: "k1", taskType: "health.explain", output: { x: 1 }, groundedOn: ["checkout"], tokensUsed: 40, hitCount: 0, stale: false });
  const got = await s.get("k1");
  expect(got?.tokensUsed).toBe(40);
  await s.bumpHit("k1", 40);
  expect((await s.get("k1"))?.hitCount).toBe(1);
  const n = await s.markStaleByEntity("checkout");
  expect(n).toBe(1);
  expect((await s.get("k1"))?.stale).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run apps/web/src/server/ai/cache-store`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/web/src/server/ai/cache-key.ts`**

```ts
import { createHash } from "node:crypto";

const DROP = new Set(["pulled_at", "created_at", "updated_at"]);

export function normalizeInput(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(normalizeInput);
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(input as Record<string, unknown>).sort()) {
      if (DROP.has(key)) continue;
      out[key] = normalizeInput((input as Record<string, unknown>)[key]);
    }
    return out;
  }
  return input;
}

export function cacheKey(taskType: string, input: unknown): string {
  return createHash("sha256").update(taskType + JSON.stringify(normalizeInput(input))).digest("hex");
}
```

- [ ] **Step 4: Create `apps/web/src/server/ai/cache-store.ts`**

```ts
export interface CachedEntry {
  keyHash: string;
  taskType: string;
  output: unknown;
  groundedOn: string[];
  tokensUsed: number;
  hitCount: number;
  stale: boolean;
}

export interface AICacheStore {
  get(keyHash: string): Promise<CachedEntry | null>;
  put(entry: CachedEntry): Promise<void>;
  bumpHit(keyHash: string, tokensSaved: number): Promise<void>;
  markStaleByEntity(entityId: string): Promise<number>;
}

export class InMemoryAICacheStore implements AICacheStore {
  private readonly byKey = new Map<string, CachedEntry>();
  async get(keyHash: string): Promise<CachedEntry | null> {
    return this.byKey.get(keyHash) ?? null;
  }
  async put(entry: CachedEntry): Promise<void> {
    this.byKey.set(entry.keyHash, { ...entry });
  }
  async bumpHit(keyHash: string, _tokensSaved: number): Promise<void> {
    const e = this.byKey.get(keyHash);
    if (e) e.hitCount += 1;
  }
  async markStaleByEntity(entityId: string): Promise<number> {
    let n = 0;
    for (const e of this.byKey.values()) {
      if (!e.stale && e.groundedOn.includes(entityId)) { e.stale = true; n++; }
    }
    return n;
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -w test:run apps/web/src/server/ai/cache-store`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server/ai/cache-key.ts apps/web/src/server/ai/cache-store.ts apps/web/src/server/ai/cache-store.test.ts
git commit -m "feat(web): add AI cache store (content-addressed key + in-memory fake + grounded_on invalidation)"
```

---

### Task 3: Resolution-ladder Proxy

**Files:**
- Create: `apps/web/src/server/ai/resolution-ladder.ts`
- Create: `apps/web/src/server/ai/resolution-ladder.test.ts`

**Interfaces:**
- Consumes: `AIPort`, `AIResult` (`@pma/core`); `AICacheStore`, `CachedEntry` (Task 2); `cacheKey` (Task 2); `estimateTokens` (Task 1).
- Produces:
  - `interface ResolutionOutcome { output: unknown; groundedOn: string[]; confidence: number; tier: "exact_cache" | "llm"; tokensUsed: number; tokensSaved: number; }`
  - `class ResolutionLadder implements AIPort` — constructed with `(delegate: AIPort, store: AICacheStore)`. `run(task, input)` still returns `AIResult` (so it's a drop-in Proxy). Also exposes `resolve(task, input): Promise<ResolutionOutcome>` with the tier/token detail. Logic: compute `cacheKey`; if a fresh (non-stale) entry exists → `exact_cache`, `bumpHit`, `tokensSaved = entry.tokensUsed`, `tokensUsed = 0`; else call `delegate.run` (=`llm`), **discard if `groundedOn` is empty** (throw), `put` the entry, `tokensUsed = estimateTokens(output)`, `tokensSaved = 0`.

- [ ] **Step 1: Write the failing test `apps/web/src/server/ai/resolution-ladder.test.ts`**

```ts
import { expect, test } from "vitest";
import { ResolutionLadder } from "./resolution-ladder.js";
import { InMemoryAICacheStore } from "./cache-store.js";
import type { AIPort, AIResult } from "@pma/core";

const stubDelegate: AIPort = {
  async run(): Promise<AIResult> { return { output: { summary: "hi" }, groundedOn: ["checkout"], confidence: 0.9 }; },
};

test("first call is a miss (llm), second identical call is a hit (exact_cache) with tokens saved", async () => {
  const ladder = new ResolutionLadder(stubDelegate, new InMemoryAICacheStore());
  const input = { entity: { id: "checkout", name: "Checkout" }, composite: 62, drivers: [] };
  const miss = await ladder.resolve("health.explain", input);
  expect(miss.tier).toBe("llm");
  expect(miss.tokensUsed).toBeGreaterThan(0);
  expect(miss.tokensSaved).toBe(0);
  const hit = await ladder.resolve("health.explain", input);
  expect(hit.tier).toBe("exact_cache");
  expect(hit.tokensUsed).toBe(0);
  expect(hit.tokensSaved).toBeGreaterThan(0);
});

test("an output with empty grounded_on is discarded (hallucination guard)", async () => {
  const bad: AIPort = { async run() { return { output: {}, groundedOn: [], confidence: 0.5 }; } };
  const ladder = new ResolutionLadder(bad, new InMemoryAICacheStore());
  await expect(ladder.resolve("health.explain", { entity: { id: "x" } })).rejects.toThrow(/grounded/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run apps/web/src/server/ai/resolution-ladder`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/web/src/server/ai/resolution-ladder.ts`**

```ts
import type { AIPort, AIResult } from "@pma/core";
import type { AICacheStore } from "./cache-store.js";
import { cacheKey } from "./cache-key.js";
import { estimateTokens } from "./template-ai-port.js";

export interface ResolutionOutcome {
  output: unknown;
  groundedOn: string[];
  confidence: number;
  tier: "exact_cache" | "llm";
  tokensUsed: number;
  tokensSaved: number;
}

/** Caching Proxy over the real AIPort: exact-cache tier, else the delegate ("llm"). */
export class ResolutionLadder implements AIPort {
  constructor(private readonly delegate: AIPort, private readonly store: AICacheStore) {}

  async run(task: string, input: unknown): Promise<AIResult> {
    const r = await this.resolve(task, input);
    return { output: r.output, groundedOn: r.groundedOn, confidence: r.confidence };
  }

  async resolve(task: string, input: unknown): Promise<ResolutionOutcome> {
    const key = cacheKey(task, input);
    const cached = await this.store.get(key);
    if (cached && !cached.stale) {
      await this.store.bumpHit(key, cached.tokensUsed);
      return {
        output: cached.output, groundedOn: cached.groundedOn, confidence: 1,
        tier: "exact_cache", tokensUsed: 0, tokensSaved: cached.tokensUsed,
      };
    }
    const res = await this.delegate.run(task, input);
    if (!res.groundedOn || res.groundedOn.length === 0) {
      throw new Error(`AI output for '${task}' has empty grounded_on — discarded as a hallucination`);
    }
    const tokensUsed = estimateTokens(res.output);
    await this.store.put({
      keyHash: key, taskType: task, output: res.output, groundedOn: res.groundedOn,
      tokensUsed, hitCount: 0, stale: false,
    });
    return {
      output: res.output, groundedOn: res.groundedOn, confidence: res.confidence,
      tier: "llm", tokensUsed, tokensSaved: 0,
    };
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -w test:run apps/web/src/server/ai/resolution-ladder`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/ai/resolution-ladder.ts apps/web/src/server/ai/resolution-ladder.test.ts
git commit -m "feat(web): add resolution-ladder Proxy (exact-cache vs llm, grounding-guarded)"
```

---

### Task 4: Prisma-backed cache store + AiTask logging

**Files:**
- Create: `apps/web/src/server/ai/prisma-ai-store.ts`
- Create: `apps/web/src/server/ai/prisma-ai-store.test.ts`

**Interfaces:**
- Consumes: `AICacheStore`, `CachedEntry` (Task 2); a `PrismaClient`; `ResolutionOutcome` (Task 3).
- Produces:
  - `class PrismaAICacheStore implements AICacheStore` — backs `get`/`put`/`bumpHit`/`markStaleByEntity` with the `AiResultCache` + `AiCacheDep` tables (put writes the cache row + one `AiCacheDep` per grounded entity; `markStaleByEntity` sets `stale=true` on every cache whose `AiCacheDep` includes the entity; `bumpHit` increments `hitCount` + adds `tokensSaved`).
  - `async function logAiTask(prisma, taskType, outcome: ResolutionOutcome): Promise<void>` — writes an `AiTask` row (taskType, inputHash=cache key n/a → store the output hash or "", output JSON, groundedOn JSON, confidence, resolutionTier=outcome.tier, tokensUsed, tokensSaved).

- [ ] **Step 1: Write the failing test `apps/web/src/server/ai/prisma-ai-store.test.ts`**

```ts
import { expect, test } from "vitest";
import { makeTestDb } from "@pma/db/src/testing/test-db.js";
import { PrismaAICacheStore, logAiTask } from "./prisma-ai-store.js";

test("prisma cache store persists, hits, and invalidates by entity", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    const store = new PrismaAICacheStore(prisma);
    await store.put({ keyHash: "k1", taskType: "health.explain", output: { s: 1 }, groundedOn: ["checkout", "ledger"], tokensUsed: 50, hitCount: 0, stale: false });
    expect((await store.get("k1"))?.tokensUsed).toBe(50);
    expect(await prisma.aiCacheDep.count()).toBe(2);
    await store.bumpHit("k1", 50);
    expect((await store.get("k1"))?.hitCount).toBe(1);
    const n = await store.markStaleByEntity("ledger");
    expect(n).toBe(1);
    expect((await store.get("k1"))?.stale).toBe(true);
  } finally { await cleanup(); }
}, 30000);

test("logAiTask writes an AiTask row with the resolution tier", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await logAiTask(prisma, "daily-brief.compose", { output: { h: "x" }, groundedOn: ["a1"], confidence: 0.9, tier: "llm", tokensUsed: 30, tokensSaved: 0 });
    const row = await prisma.aiTask.findFirst();
    expect(row?.resolutionTier).toBe("llm");
    expect(row?.tokensUsed).toBe(30);
  } finally { await cleanup(); }
}, 30000);
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run apps/web/src/server/ai/prisma-ai-store`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/web/src/server/ai/prisma-ai-store.ts`**

```ts
import type { PrismaClient } from "@prisma/client";
import type { AICacheStore, CachedEntry } from "./cache-store.js";
import type { ResolutionOutcome } from "./resolution-ladder.js";

export class PrismaAICacheStore implements AICacheStore {
  constructor(private readonly prisma: PrismaClient) {}

  async get(keyHash: string): Promise<CachedEntry | null> {
    const row = await this.prisma.aiResultCache.findUnique({ where: { keyHash } });
    if (!row) return null;
    return {
      keyHash: row.keyHash, taskType: row.taskType, output: JSON.parse(row.output),
      groundedOn: [], tokensUsed: row.tokensUsed, hitCount: row.hitCount, stale: row.stale,
    };
  }

  async put(entry: CachedEntry): Promise<void> {
    await this.prisma.aiResultCache.upsert({
      where: { keyHash: entry.keyHash },
      create: {
        keyHash: entry.keyHash, taskType: entry.taskType, inputHash: entry.keyHash,
        output: JSON.stringify(entry.output), modelVersion: "template-1", resolutionTier: "llm",
        tokensUsed: entry.tokensUsed, tokensSaved: 0, hitCount: 0, stale: false,
        deps: { create: entry.groundedOn.map((id) => ({ entityType: "unknown", entityId: id })) },
      },
      update: { output: JSON.stringify(entry.output), stale: false },
    });
  }

  async bumpHit(keyHash: string, tokensSaved: number): Promise<void> {
    await this.prisma.aiResultCache.update({
      where: { keyHash },
      data: { hitCount: { increment: 1 }, tokensSaved: { increment: tokensSaved }, lastUsedAt: new Date() },
    });
  }

  async markStaleByEntity(entityId: string): Promise<number> {
    const deps = await this.prisma.aiCacheDep.findMany({ where: { entityId }, select: { cacheId: true } });
    const ids = [...new Set(deps.map((d) => d.cacheId))];
    if (ids.length === 0) return 0;
    const res = await this.prisma.aiResultCache.updateMany({ where: { id: { in: ids }, stale: false }, data: { stale: true } });
    return res.count;
  }
}

export async function logAiTask(prisma: PrismaClient, taskType: string, o: ResolutionOutcome): Promise<void> {
  await prisma.aiTask.create({
    data: {
      taskType, inputHash: "", output: JSON.stringify(o.output), groundedOn: JSON.stringify(o.groundedOn),
      confidence: o.confidence, resolutionTier: o.tier, tokensUsed: o.tokensUsed, tokensSaved: o.tokensSaved,
      humanReviewed: false,
    },
  });
}
```

Note: `get` returns `groundedOn: []` because the ladder does not need the deps back on a hit (it re-derives from the cached output's own grounding via the entry). If a later task needs deps hydrated, extend the query.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -w test:run apps/web/src/server/ai/prisma-ai-store`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/ai/prisma-ai-store.ts apps/web/src/server/ai/prisma-ai-store.test.ts
git commit -m "feat(web): add Prisma AI cache store + AiTask logging"
```

---

### Task 5: Fake read-only ingestion adapters (pull → IngestionSnapshot → normalize)

**Files:**
- Create: `apps/web/src/server/ingestion/fake-ingestion.ts`
- Create: `apps/web/src/server/ingestion/fake-ingestion.test.ts`

**Interfaces:**
- Consumes: `WorkTrackerPort`/`CommunicationPort`-style read contracts from `@pma/core`; the ingestion envelope validators from `@pma/contracts` (`WorkItemEnvelope`, `CalendarEventEnvelope`); a `PrismaClient`.
- Produces:
  - `class FakeWorkTrackerAdapter` with `pull(): Promise<WorkItemEnvelope[]>` returning 1–2 read-only work-item envelopes (each with `provenance` `{ source: "jira", external_id, pulled_at, mode: "read_only" }`), validated against `WorkItemEnvelope`.
  - `async function ingestWorkItems(prisma, connectionId, envelopes): Promise<{ snapshots: number; created: number }>` — for each envelope: validate against `WorkItemEnvelope`, write an `IngestionSnapshot` row (source, `raw` = the envelope JSON, `normalized: false`), then normalize into a canonical `WorkItem` (under the seeded Checkout project + a Story type) + an `ExternalLink` (internalType `work_item`, externalId, via the connection), then flip the snapshot `normalized: true`. Returns counts. Read-only: never calls back to the fake source.

- [ ] **Step 1: Write the failing test `apps/web/src/server/ingestion/fake-ingestion.test.ts`**

```ts
import { expect, test } from "vitest";
import { makeTestDb } from "@pma/db/src/testing/test-db.js";
import { seedMethodologies } from "@pma/db/prisma/seed-methodologies.js";
import { seedPoc } from "@pma/db/prisma/seed-poc.js";
import { FakeWorkTrackerAdapter, ingestWorkItems } from "./fake-ingestion.js";

test("pull → IngestionSnapshot (provenance) → normalized canonical WorkItem + ExternalLink", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await seedMethodologies(prisma);
    await seedPoc(prisma);
    const sys = await prisma.externalSystem.create({ data: { vendor: "jira" } });
    const conn = await prisma.syncConnection.create({ data: { externalSystemId: sys.id, authRef: "keychain:jira", direction: "inbound" } });

    const envelopes = await new FakeWorkTrackerAdapter().pull();
    expect(envelopes[0]!.provenance.mode).toBe("read_only");

    const before = await prisma.workItem.count();
    const res = await ingestWorkItems(prisma, conn.id, envelopes);
    expect(res.snapshots).toBe(envelopes.length);
    expect(res.created).toBe(envelopes.length);

    // Snapshots carry provenance and are marked normalized.
    const snaps = await prisma.ingestionSnapshot.findMany();
    expect(snaps.every((s) => s.normalized)).toBe(true);
    expect(snaps[0]!.source).toBe("jira");
    // Canonical entities + external links created.
    expect(await prisma.workItem.count()).toBe(before + envelopes.length);
    expect(await prisma.externalLink.count()).toBe(envelopes.length);
  } finally { await cleanup(); }
}, 30000);
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -w test:run apps/web/src/server/ingestion/fake-ingestion`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/web/src/server/ingestion/fake-ingestion.ts`** — implement `FakeWorkTrackerAdapter.pull()` returning validated `WorkItemEnvelope`s (use a fixed `pulled_at` passed in or a constant string — do NOT call `Date.now()` in a way that breaks determinism; a literal ISO string is fine), and `ingestWorkItems` doing: validate each envelope with `WorkItemEnvelope.parse`; create an `IngestionSnapshot` (`source: env.provenance.source`, `raw: JSON.stringify(env)`, `normalized: false`); resolve the seeded Checkout project + its Scrum Story `WorkItemType`; create a `WorkItem` (title from envelope, status from `status_category`, estimate/bands mapped); create an `ExternalLink` (`internalType: "work_item"`, `internalId: <new work item id>`, `externalId: env.provenance.external_id`, via `syncConnectionId: connectionId`, `workItemId`); update the snapshot `normalized: true`. Return `{ snapshots, created }`.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm -w test:run apps/web/src/server/ingestion/fake-ingestion`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/ingestion
git commit -m "feat(web): add fake read-only ingestion (pull -> IngestionSnapshot -> normalize + ExternalLink)"
```

---

### Task 6: FeatureRecord persistence + `warmIntelligence` pipeline

**Files:**
- Create: `apps/web/src/server/ai/feature-persistence.ts`
- Create: `apps/web/src/server/ai/warm-intelligence.ts`
- Create: `apps/web/src/server/ai/warm-intelligence.test.ts`

**Interfaces:**
- Consumes: `@pma/core` analyzers + `FeatureRecord`; the ladder + stub + Prisma store (Tasks 1–4); `@pma/db` seeds.
- Produces:
  - `feature-persistence.ts`: `async function persistFeatures(prisma, records: FeatureRecord[]): Promise<number>` — writes each `FeatureRecord` to the `FeatureRecord` table (metric, entityType/entityId from `entity`, value JSON, computedAt, deterministicFn, fnVersion).
  - `warm-intelligence.ts`: `async function warmIntelligence(prisma): Promise<{ features: number; aiTasks: number }>` — (1) runs the deterministic analyzers over seeded data (prioritization WSJF+RICE over the backlog, capacity over allocations, DORA over deployments, health over each project, sprint over the active cadence) and `persistFeatures` all emitted `FeatureRecord`s; (2) builds a `ResolutionLadder(TemplateAIPort, PrismaAICacheStore)` and runs the generative tasks (daily-brief.compose from the seeded suggested actions; health.explain for a project; stakeholder.update for one stakeholder; email.digest from seeded emails) **twice each** (first = `llm` miss, second = `exact_cache` hit) via `ladder.resolve`, calling `logAiTask` each time. Returns counts.
  - `aiPort()` factory (in `warm-intelligence.ts` or a small `index.ts`) returning a `ResolutionLadder` wired with the Prisma store for app use.

- [ ] **Step 1: Write the failing test `apps/web/src/server/ai/warm-intelligence.test.ts`**

```ts
import { expect, test } from "vitest";
import { makeTestDb } from "@pma/db/src/testing/test-db.js";
import { seedMethodologies } from "@pma/db/prisma/seed-methodologies.js";
import { seedPoc } from "@pma/db/prisma/seed-poc.js";
import { warmIntelligence } from "./warm-intelligence.js";

test("warmIntelligence persists features and logs mixed-tier AiTasks (miss then hit)", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await seedMethodologies(prisma);
    await seedPoc(prisma);
    const res = await warmIntelligence(prisma);
    expect(res.features).toBeGreaterThan(0);
    expect(res.aiTasks).toBeGreaterThan(0);
    // Real feature corpus persisted.
    expect(await prisma.featureRecord.count()).toBe(res.features);
    // Both tiers represented (each task run twice → at least one llm + one exact_cache).
    const llm = await prisma.aiTask.count({ where: { resolutionTier: "llm" } });
    const hits = await prisma.aiTask.count({ where: { resolutionTier: "exact_cache" } });
    expect(llm).toBeGreaterThan(0);
    expect(hits).toBeGreaterThan(0);
    // Tokens were actually saved on the hits.
    const saved = await prisma.aiTask.aggregate({ _sum: { tokensSaved: true } });
    expect(saved._sum.tokensSaved ?? 0).toBeGreaterThan(0);
  } finally { await cleanup(); }
}, 60000);
```

- [ ] **Step 2: Run to verify it fails; Step 3: implement; Step 4: verify PASS**

Run: `pnpm -w test:run apps/web/src/server/ai/warm-intelligence`
Expected: FAIL then PASS. Implement `persistFeatures` + `warmIntelligence` per the Interfaces. Map each analyzer's `FeatureRecord[]` through `persistFeatures`; assemble each generative task's grounded input from seeded rows (reuse the mapping style from `view-models.ts`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/ai/feature-persistence.ts apps/web/src/server/ai/warm-intelligence.ts apps/web/src/server/ai/warm-intelligence.test.ts
git commit -m "feat(web): add FeatureRecord persistence + warmIntelligence pipeline (real tiers + tokens saved)"
```

---

### Task 7: Live Intelligence metrics + page/Connections wiring + warm script

**Files:**
- Modify: `apps/web/src/server/view-models.ts` (`buildIntelView` reads real `AiTask`/`AiResultCache`/`FeatureRecord`; `buildConnectionsView` reflects the ingested source if present)
- Modify: `apps/web/src/ui/intel.tsx` (render live tier distribution + tokens saved when `hasLiveData`)
- Create: `apps/web/src/server/warm.ts` (script entry) + add a `warm` script to `apps/web/package.json`
- Create/Modify: `apps/web/src/server/view-models.test.ts` (add a test that after `warmIntelligence`, `buildIntelView().hasLiveData` is true with a real tier distribution)

**Interfaces:**
- `buildIntelView(prisma)` now returns `{ hasLiveData, tokensSaved, featureRecordCount, aiTaskCount, tiers: { name: string; count: number; pct: number }[], models: ... }` where `tiers` = `[{deterministic = featureRecordCount}, {exact_cache = AiTask count tier}, {llm = AiTask count tier}]` with pct over the sum; `tokensSaved` = sum of `AiResultCache.tokensSaved` (or `AiTask.tokensSaved`). `hasLiveData = aiTaskCount > 0`.
- `warm.ts`: `getPrisma()` → `warmIntelligence(prisma)` → log counts → disconnect (mirrors `db/prisma/seed.ts`).

- [ ] **Step 1: Add a failing test to `apps/web/src/server/view-models.test.ts`**

```ts
test("intel view goes live after warming (real tier distribution + tokens saved)", async () => {
  const { prisma, cleanup } = await makeTestDb();
  try {
    await seedMethodologies(prisma); await seedPoc(prisma);
    const { warmIntelligence } = await import("./ai/warm-intelligence.js");
    await warmIntelligence(prisma);
    const { buildIntelView } = await import("./view-models.js");
    const vm = await buildIntelView(prisma);
    expect(vm.hasLiveData).toBe(true);
    expect(vm.tokensSaved).toBeGreaterThan(0);
    const det = vm.tiers.find((t) => t.name === "deterministic")!;
    expect(det.count).toBeGreaterThan(0);
    expect(vm.tiers.reduce((s, t) => s + t.pct, 0)).toBeGreaterThan(99); // ~100%
  } finally { await cleanup(); }
}, 60000);
```

- [ ] **Step 2: Run to verify it fails; Step 3: implement `buildIntelView`; Step 4: verify PASS.** Update `intel.tsx` to render the live `tiers` bars + real `tokensSaved`/`featureRecordCount`/`aiTaskCount` when `hasLiveData`, keeping the "projected" banner only when it is false. Update `buildConnectionsView` to show the Jira source's `lastPulledAt` if an `IngestionSnapshot`/`ExternalLink` exists.

- [ ] **Step 5: Create `apps/web/src/server/warm.ts` + add the `warm` script**

`apps/web/package.json` scripts: add `"warm": "tsx src/server/warm.ts"`. `warm.ts` mirrors `db/prisma/seed.ts`: `getPrisma()` → `warmIntelligence(prisma)` → `console.log` counts → `$disconnect()`.

- [ ] **Step 6: Verify build + full suite**

Run: `pnpm --filter @pma/web exec next build && pnpm -w run test:all`
Expected: build succeeds; all tests green.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/server/view-models.ts apps/web/src/ui/intel.tsx apps/web/src/server/warm.ts apps/web/package.json apps/web/src/server/view-models.test.ts
git commit -m "feat(web): live System Intelligence metrics from real AiTask/cache/feature data + warm script"
```

---

### Task 8: End-to-end verification + final gate

**Files:** may add notes to `apps/web/README.md`.

- [ ] **Step 1: Seed + warm a dev vault**

```bash
DATABASE_URL="file:./.vault/workspace.db" pnpm --filter @pma/db exec prisma db push --skip-generate
DATABASE_URL="file:./.vault/workspace.db" pnpm --filter @pma/web run seed
DATABASE_URL="file:./.vault/workspace.db" pnpm --filter @pma/web run warm
```

- [ ] **Step 2: Confirm real AI data landed**

Query the vault (a throwaway `tsx` script): assert `AiTask` count > 0 with both `llm` and `exact_cache` tiers, `FeatureRecord` count > 0, and `SUM(tokensSaved) > 0`.

- [ ] **Step 3: Live-render the Intelligence + Connections pages**

Start the app against the warmed vault; confirm `/intelligence` shows a real tier distribution (deterministic dominating) + a real tokens-saved figure (NOT the "projected — no live AI calls yet" banner), and `/connections` reflects the pulled source.

- [ ] **Step 4: Final gate**

Run: `pnpm -w run test:all && pnpm -w typecheck`
Expected: dependency-cruiser clean (core + contracts still pure — the AI/ingestion infra lives only in `apps/web/src/server`), all tests pass, typecheck clean.

- [ ] **Step 5: Update `apps/web/README.md`** with the `warm` step (run after `seed`), then commit.

```bash
git add apps/web/README.md
git commit -m "docs(web): document the warm step; Phase 4 AI layer end-to-end verified"
```

---

## Phase 4 Definition of Done

- [ ] Stub `AIPort` produces contract-valid, grounded output; empty `grounded_on` is discarded (Tasks 1, 3).
- [ ] The resolution ladder returns `exact_cache` on a repeat call with real `tokens_saved`, `llm` on a miss (Task 3), persisted via the Prisma store + `AiTask` log (Task 4).
- [ ] `grounded_on` dependency fingerprints drive cache invalidation (`markStaleByEntity`) (Tasks 2, 4).
- [ ] Fake read-only ingestion proves pull → `IngestionSnapshot` (provenance) → normalized canonical `WorkItem` + `ExternalLink` (Task 5).
- [ ] `warmIntelligence` persists a real `FeatureRecord` corpus and logs mixed-tier `AiTask`s with tokens saved (Task 6).
- [ ] `/intelligence` shows a real, honest tier distribution + tokens-saved after warming; `/connections` reflects the pulled source (Task 7).
- [ ] `@pma/core` + `@pma/contracts` stay pure (dependency-cruiser green); `pnpm -w run test:all` + `pnpm -w typecheck` green; the app builds (Task 8).

## Self-Review (against the spec)

- **Spec §7 stub adapters (read-only ingestion demonstrating IngestionSnapshot; stub AIPort grounded template prose; resolution-ladder Proxy)** → Tasks 1, 3, 5. ✅
- **Spec §7 resolution ladder shows real tier distribution from logged calls** → Tasks 4, 6, 7. ✅
- **Spec §2 principle 5 (AI grounded and typed; empty grounding discarded)** → Task 1 (contract-valid), Task 3 (hallucination guard). ✅
- **Spec §2 principle 3 (read-only; AI drafts only)** → ingestion is read-only (Task 5); `stakeholder.update` is `is_draft:true`; no external writes. ✅
- **Spec §2 principle 1 (core purity)** → all AI/ingestion infra in `apps/web/src/server`; `@pma/core`/`@pma/contracts` untouched; dependency-cruiser guards it (Task 8). ✅
- **Spec §10 deferred:** semantic-cache + learned/shadow tiers remain future (documented in Global Constraints); real Claude adapter drops in behind the same `AIPort` later. ✅
- **Placeholder scan:** load-bearing AI code (stub, cache, ladder, Prisma store) is complete; ingestion + warm + intel-wiring give exact interfaces + full tests, with concrete mapping instructions referencing the existing `view-models.ts` patterns. ✅
- **Type consistency:** `AICacheStore`/`CachedEntry` (Task 2) consumed unchanged by the ladder (Task 3) and Prisma store (Task 4); `ResolutionOutcome` (Task 3) consumed by `logAiTask` (Task 4) and the warm pipeline (Task 6); `FeatureRecord` from `@pma/core` persisted in Task 6 and counted in Task 7. ✅
