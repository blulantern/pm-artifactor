# Atlassian OAuth Connect (Spec B1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the app to a real Atlassian Cloud site over OAuth 2.0 (3LO), keeping tokens encrypted in the Spec A vault and alive across refresh-token rotation.

**Architecture:** Pure decidable logic (token expiry, connection state) lives in `packages/core`; everything that speaks HTTP or touches the vault/Prisma lives under `apps/web/src/server/integrations/atlassian/`. One consent yields one token blob in the vault under `authRef = "atlassian:<cloudId>"`, referenced by two `SyncConnection` rows (`vendor=jira`, `vendor=confluence`). No schema change.

**Tech Stack:** TypeScript (ESM, `.js`-suffixed relative imports), Next.js App Router (Route Handler for the OAuth callback), Prisma/SQLite, vitest, `node:crypto` for `state`.

**Spec:** `docs/superpowers/specs/2026-07-16-atlassian-oauth-connect-design.md`

## Global Constraints

- **Core purity:** `packages/core` imports zero infra — no `fetch` wrappers, no Prisma, no `node:*` beyond pure computation. Enforced by `.dependency-cruiser.cjs`. Only `connection-state.ts` goes in core.
- **DB boundary:** only `apps/web/src/server` touches Prisma. Modules take `prisma: PrismaClient` as a parameter; call sites pass `db()` from `@/server/db`.
- **Read-only ingestion:** never write to Atlassian. Only these scopes, verbatim: `offline_access`, `read:jira-work`, `read:confluence-space.summary`, `read:confluence-content.summary`.
- **Secrets:** tokens and the client secret exist only as ciphertext in the vault. Never logged, never returned to the browser, never in `SyncConnection.authRef` (which stores the *reference* `atlassian:<cloudId>`).
- **Redirect URI, verbatim:** `http://localhost:3000/api/atlassian/callback` (an app registers exactly one).
- **No real network in the suite.** Every HTTP call goes through an injected `fetchImpl`; tests pass a fake.
- **ESM:** relative imports carry a `.js` suffix; `@/*` → `apps/web/src/*`; `@pma/core` for core.
- **Tests:** colocated `*.test.ts`, vitest. Vault tests set `process.env.PMA_VAULT_PATH` to a temp file in `beforeEach` and `lock()` + `delete` it in `afterEach`.
- **Commits:** conventional; author is the repo owner; **no `Co-Authored-By` trailer**.
- **The gate:** `pnpm -w run test:all` must be green before each commit.

---

### Task 1: Pure connection state (core)

**Files:**
- Create: `packages/core/src/domain/integrations/connection-state.ts`
- Test: `packages/core/src/domain/integrations/connection-state.test.ts`
- Modify: `packages/core/src/index.ts` (add the export line)

**Interfaces:**
- Consumes: nothing.
- Produces: `type ConnectionState = "connected" | "expired" | "needs_reconsent"`; `CLOCK_SKEW_MS: number`; `isExpired(expiresAt: number, now: number, skewMs?: number): boolean`; `interface ConnectionSnapshot { expiresAt: number; hasRefresh: boolean; reconsentRequired?: boolean }`; `connectionState(snap: ConnectionSnapshot, now: number, skewMs?: number): ConnectionState`. Task 3 imports `isExpired` from `@pma/core`; Task 6 imports `connectionState`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/domain/integrations/connection-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isExpired, connectionState, CLOCK_SKEW_MS } from "./connection-state.js";

const NOW = 1_700_000_000_000;

describe("isExpired", () => {
  it("is false for a token well in the future", () => {
    expect(isExpired(NOW + 3_600_000, NOW)).toBe(false);
  });

  it("is true for a token already past", () => {
    expect(isExpired(NOW - 1, NOW)).toBe(true);
  });

  it("treats a token inside the skew margin as expired, so it refreshes before use", () => {
    expect(isExpired(NOW + 30_000, NOW)).toBe(true); // 30s < 60s skew
    expect(isExpired(NOW + CLOCK_SKEW_MS + 1_000, NOW)).toBe(false);
  });

  it("honors an explicit skew", () => {
    expect(isExpired(NOW + 30_000, NOW, 0)).toBe(false);
  });
});

describe("connectionState", () => {
  it("is connected when the token is live and refreshable", () => {
    expect(connectionState({ expiresAt: NOW + 3_600_000, hasRefresh: true }, NOW)).toBe("connected");
  });

  it("is expired — not dead — when the access token lapsed but a refresh token remains", () => {
    expect(connectionState({ expiresAt: NOW - 1, hasRefresh: true }, NOW)).toBe("expired");
  });

  it("needs reconsent when there is no refresh token", () => {
    expect(connectionState({ expiresAt: NOW + 3_600_000, hasRefresh: false }, NOW)).toBe("needs_reconsent");
  });

  it("needs reconsent when flagged, even if the token looks live", () => {
    expect(
      connectionState({ expiresAt: NOW + 3_600_000, hasRefresh: true, reconsentRequired: true }, NOW),
    ).toBe("needs_reconsent");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/core/src/domain/integrations/connection-state.test.ts`
Expected: FAIL — `Failed to resolve import "./connection-state.js"`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/domain/integrations/connection-state.ts`:

```ts
/**
 * Pure connection-state logic for external integrations. No infra: the adapter
 * supplies `now` so expiry is testable without a clock.
 */

export type ConnectionState = "connected" | "expired" | "needs_reconsent";

/** Refresh a token this close to expiry rather than risk it lapsing mid-request. */
export const CLOCK_SKEW_MS = 60_000;

export function isExpired(expiresAt: number, now: number, skewMs: number = CLOCK_SKEW_MS): boolean {
  return expiresAt - skewMs <= now;
}

export interface ConnectionSnapshot {
  expiresAt: number;
  hasRefresh: boolean;
  /** Set once a refresh has been rejected — rotation means retrying cannot help. */
  reconsentRequired?: boolean;
}

export function connectionState(
  snap: ConnectionSnapshot,
  now: number,
  skewMs: number = CLOCK_SKEW_MS,
): ConnectionState {
  if (snap.reconsentRequired || !snap.hasRefresh) return "needs_reconsent";
  return isExpired(snap.expiresAt, now, skewMs) ? "expired" : "connected";
}
```

- [ ] **Step 4: Add the core export**

In `packages/core/src/index.ts`, append after the existing `provenance` exports:

```ts
export * from "./domain/integrations/connection-state.js";
```

- [ ] **Step 5: Run the gate**

Run: `pnpm -w run test:all`
Expected: PASS — new tests green, depcruise still clean (core imports nothing infra).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/domain/integrations/ packages/core/src/index.ts
git commit -m "feat(core): pure connection state + token expiry for integrations"
```

---

### Task 2: Atlassian OAuth client

**Files:**
- Create: `apps/web/src/server/integrations/atlassian/oauth-client.ts`
- Test: `apps/web/src/server/integrations/atlassian/oauth-client.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: constants `ATLASSIAN_AUTHORIZE_URL`, `ATLASSIAN_TOKEN_URL`, `ATLASSIAN_RESOURCES_URL`, `ATLASSIAN_SCOPES: readonly string[]`, `ATLASSIAN_REDIRECT_URI`; `type FetchLike = typeof fetch`; `interface OAuthDeps { fetchImpl?: FetchLike; now?: () => number }`; `interface TokenSet { access: string; refresh: string; expiresAt: number; scopes: string[] }`; `interface AccessibleSite { cloudId: string; siteUrl: string; siteName: string }`; `class AtlassianOAuthError extends Error { status?: number }`; `authorizeUrl(clientId: string, state: string): string`; `exchangeCode(a: { clientId: string; clientSecret: string; code: string }, deps?: OAuthDeps): Promise<TokenSet>`; `refreshTokens(a: { clientId: string; clientSecret: string; refresh: string }, deps?: OAuthDeps): Promise<TokenSet>`; `fetchAccessibleSites(access: string, deps?: OAuthDeps): Promise<AccessibleSite[]>`. Tasks 3 and 4 consume these.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/server/integrations/atlassian/oauth-client.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  authorizeUrl,
  exchangeCode,
  refreshTokens,
  fetchAccessibleSites,
  AtlassianOAuthError,
  ATLASSIAN_SCOPES,
  ATLASSIAN_REDIRECT_URI,
} from "./oauth-client.js";

const NOW = 1_700_000_000_000;
const deps = (fetchImpl: typeof fetch) => ({ fetchImpl, now: () => NOW });

const jsonRes = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as unknown as Response;

describe("authorizeUrl", () => {
  it("requests exactly the read-only scopes, our redirect, and the state", () => {
    const u = new URL(authorizeUrl("client-abc", "state-xyz"));
    expect(u.origin + u.pathname).toBe("https://auth.atlassian.com/authorize");
    expect(u.searchParams.get("client_id")).toBe("client-abc");
    expect(u.searchParams.get("state")).toBe("state-xyz");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("audience")).toBe("api.atlassian.com");
    expect(u.searchParams.get("redirect_uri")).toBe(ATLASSIAN_REDIRECT_URI);
    expect(u.searchParams.get("scope")).toBe(ATLASSIAN_SCOPES.join(" "));
  });

  it("requests no write scopes — ingestion is read-only", () => {
    expect(ATLASSIAN_SCOPES.some((s) => s.startsWith("write:") || s.startsWith("manage:"))).toBe(false);
  });
});

describe("exchangeCode", () => {
  it("posts the code and returns a token set with an absolute expiry", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ access_token: "at-1", refresh_token: "rt-1", expires_in: 3600, scope: "read:jira-work offline_access" }),
    );
    const t = await exchangeCode(
      { clientId: "cid", clientSecret: "csec", code: "code-1" },
      deps(fetchImpl as unknown as typeof fetch),
    );
    expect(t).toEqual({
      access: "at-1",
      refresh: "rt-1",
      expiresAt: NOW + 3_600_000,
      scopes: ["read:jira-work", "offline_access"],
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://auth.atlassian.com/oauth/token");
    expect(JSON.parse(init.body as string)).toEqual({
      grant_type: "authorization_code",
      client_id: "cid",
      client_secret: "csec",
      code: "code-1",
      redirect_uri: ATLASSIAN_REDIRECT_URI,
    });
  });

  it("throws AtlassianOAuthError carrying the status on rejection", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ error: "invalid_grant" }, false, 400));
    await expect(
      exchangeCode({ clientId: "cid", clientSecret: "csec", code: "bad" }, deps(fetchImpl as unknown as typeof fetch)),
    ).rejects.toBeInstanceOf(AtlassianOAuthError);
  });

  it("never puts the client secret in the URL", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ access_token: "a", refresh_token: "r", expires_in: 60, scope: "" }));
    await exchangeCode({ clientId: "cid", clientSecret: "top-secret", code: "c" }, deps(fetchImpl as unknown as typeof fetch));
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).not.toContain("top-secret");
  });
});

describe("refreshTokens", () => {
  it("posts the refresh grant and returns the rotated pair", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ access_token: "at-2", refresh_token: "rt-2", expires_in: 3600, scope: "read:jira-work" }),
    );
    const t = await refreshTokens(
      { clientId: "cid", clientSecret: "csec", refresh: "rt-1" },
      deps(fetchImpl as unknown as typeof fetch),
    );
    expect(t.access).toBe("at-2");
    expect(t.refresh).toBe("rt-2"); // rotation: a NEW refresh token
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      grant_type: "refresh_token",
      client_id: "cid",
      client_secret: "csec",
      refresh_token: "rt-1",
    });
  });
});

describe("fetchAccessibleSites", () => {
  it("maps the resource list to cloudId/url/name", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes([
        { id: "cloud-1", url: "https://blulantern.atlassian.net", name: "blulantern", scopes: [] },
        { id: "cloud-2", url: "https://other.atlassian.net", name: "other", scopes: [] },
      ]),
    );
    const sites = await fetchAccessibleSites("at-1", deps(fetchImpl as unknown as typeof fetch));
    expect(sites).toEqual([
      { cloudId: "cloud-1", siteUrl: "https://blulantern.atlassian.net", siteName: "blulantern" },
      { cloudId: "cloud-2", siteUrl: "https://other.atlassian.net", siteName: "other" },
    ]);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.atlassian.com/oauth/token/accessible-resources");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer at-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/server/integrations/atlassian/oauth-client.test.ts`
Expected: FAIL — cannot resolve `./oauth-client.js`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/server/integrations/atlassian/oauth-client.ts`:

```ts
/**
 * Atlassian OAuth 2.0 (3LO) HTTP client. Endpoints verified against
 * developer.atlassian.com on 2026-07-16. Confidential client (client_secret),
 * so no PKCE — the 3LO guide documents only this flow.
 *
 * `fetch` and `now` are injected so the suite never touches the network.
 */

export const ATLASSIAN_AUTHORIZE_URL = "https://auth.atlassian.com/authorize";
export const ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token";
export const ATLASSIAN_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources";

/** An app registers exactly ONE callback URL, so dev must run on :3000. */
export const ATLASSIAN_REDIRECT_URI = "http://localhost:3000/api/atlassian/callback";

/**
 * Classic scopes (Atlassian recommends classic over granular), all read-only.
 * Covers B1-B3 so sync does not force a re-consent. read:jira-user is
 * deliberately absent until the People work needs it.
 */
export const ATLASSIAN_SCOPES: readonly string[] = [
  "offline_access",
  "read:jira-work",
  "read:confluence-space.summary",
  "read:confluence-content.summary",
];

export type FetchLike = typeof fetch;

export interface OAuthDeps {
  fetchImpl?: FetchLike;
  now?: () => number;
}

export interface TokenSet {
  access: string;
  refresh: string;
  /** Absolute epoch ms, computed once at receipt from expires_in. */
  expiresAt: number;
  scopes: string[];
}

export interface AccessibleSite {
  cloudId: string;
  siteUrl: string;
  siteName: string;
}

export class AtlassianOAuthError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AtlassianOAuthError";
  }
}

export function authorizeUrl(clientId: string, state: string): string {
  const p = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: clientId,
    scope: ATLASSIAN_SCOPES.join(" "),
    redirect_uri: ATLASSIAN_REDIRECT_URI,
    state,
    response_type: "code",
    prompt: "consent",
  });
  return `${ATLASSIAN_AUTHORIZE_URL}?${p.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

async function postToken(body: Record<string, string>, deps: OAuthDeps): Promise<TokenSet> {
  const doFetch = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const res = await doFetch(ATLASSIAN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new AtlassianOAuthError(`atlassian token request failed (${res.status})`, res.status);
  const j = (await res.json()) as TokenResponse;
  if (!j.access_token || !j.refresh_token) {
    throw new AtlassianOAuthError("atlassian token response missing access or refresh token");
  }
  return {
    access: j.access_token,
    refresh: j.refresh_token,
    expiresAt: now() + (j.expires_in ?? 0) * 1000,
    scopes: (j.scope ?? "").split(" ").filter(Boolean),
  };
}

export function exchangeCode(
  a: { clientId: string; clientSecret: string; code: string },
  deps: OAuthDeps = {},
): Promise<TokenSet> {
  return postToken(
    {
      grant_type: "authorization_code",
      client_id: a.clientId,
      client_secret: a.clientSecret,
      code: a.code,
      redirect_uri: ATLASSIAN_REDIRECT_URI,
    },
    deps,
  );
}

export function refreshTokens(
  a: { clientId: string; clientSecret: string; refresh: string },
  deps: OAuthDeps = {},
): Promise<TokenSet> {
  return postToken(
    {
      grant_type: "refresh_token",
      client_id: a.clientId,
      client_secret: a.clientSecret,
      refresh_token: a.refresh,
    },
    deps,
  );
}

interface ResourceRow {
  id: string;
  url: string;
  name: string;
}

export async function fetchAccessibleSites(access: string, deps: OAuthDeps = {}): Promise<AccessibleSite[]> {
  const doFetch = deps.fetchImpl ?? fetch;
  const res = await doFetch(ATLASSIAN_RESOURCES_URL, {
    headers: { Authorization: `Bearer ${access}`, Accept: "application/json" },
  });
  if (!res.ok) throw new AtlassianOAuthError(`accessible-resources failed (${res.status})`, res.status);
  const rows = (await res.json()) as ResourceRow[];
  return rows.map((r) => ({ cloudId: r.id, siteUrl: r.url, siteName: r.name }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run apps/web/src/server/integrations/atlassian/oauth-client.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Run the gate and commit**

Run: `pnpm -w run test:all` → green.

```bash
git add apps/web/src/server/integrations/atlassian/
git commit -m "feat(web): Atlassian OAuth 3LO client (authorize, exchange, refresh, sites)"
```

---

### Task 3: Vault-backed token store with single-flight refresh

**Files:**
- Create: `apps/web/src/server/integrations/atlassian/atlassian-store.ts`
- Test: `apps/web/src/server/integrations/atlassian/atlassian-store.test.ts`

**Interfaces:**
- Consumes: `isExpired` from `@pma/core` (Task 1); `refreshTokens`, `OAuthDeps`, `TokenSet` from `./oauth-client.js` (Task 2); `credentialStore` from `@/server/vault/vault-store`.
- Produces: `interface AtlassianClientCreds { clientId: string; clientSecret: string }`; `interface StoredConnection { cloudId: string; siteUrl: string; siteName: string; access: string; refresh: string; expiresAt: number; scopes: string[]; reconsentRequired?: boolean }`; `class NeedsReconsentError extends Error`; `readClientCreds(): Promise<AtlassianClientCreds | null>`; `writeClientCreds(c: AtlassianClientCreds): Promise<void>`; `hasClientCreds(): Promise<boolean>`; `readConnection(cloudId: string): Promise<StoredConnection | null>`; `writeConnection(c: StoredConnection): Promise<void>`; `removeConnection(cloudId: string): Promise<void>`; `listConnections(): Promise<StoredConnection[]>`; `writePending(t: PendingGrant): Promise<void>`; `readPending(): Promise<PendingGrant | null>`; `clearPending(): Promise<void>`; `interface PendingGrant { access: string; refresh: string; expiresAt: number; scopes: string[]; sites: AccessibleSite[] }` (carries `sites` so the picker can render them after a page load — Task 6 reads `.sites`); `accessTokenFor(cloudId: string, deps?: OAuthDeps): Promise<string>`; `authRefFor(cloudId: string): string`. Tasks 4 and 6 consume these.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/server/integrations/atlassian/atlassian-store.test.ts`:

```ts
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VaultLockedError } from "@pma/core";
import { vaultSession } from "@/server/vault/vault-store";
import {
  writeClientCreds,
  readClientCreds,
  hasClientCreds,
  writeConnection,
  readConnection,
  removeConnection,
  listConnections,
  accessTokenFor,
  authRefFor,
  NeedsReconsentError,
  type StoredConnection,
} from "./atlassian-store.js";

let dir: string;
const NOW = 1_700_000_000_000;

const conn = (over: Partial<StoredConnection> = {}): StoredConnection => ({
  cloudId: "cloud-1",
  siteUrl: "https://blulantern.atlassian.net",
  siteName: "blulantern",
  access: "at-1",
  refresh: "rt-1",
  expiresAt: NOW + 3_600_000,
  scopes: ["read:jira-work"],
  ...over,
});

const jsonRes = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as unknown as Response;

beforeEach(async () => {
  await vaultSession.lock();
  dir = mkdtempSync(join(tmpdir(), "pma-atl-"));
  process.env.PMA_VAULT_PATH = join(dir, "vault.enc");
  await vaultSession.configure("correct-horse");
});

afterEach(async () => {
  await vaultSession.lock();
  delete process.env.PMA_VAULT_PATH;
  rmSync(dir, { recursive: true, force: true });
});

test("client creds round-trip through the vault and report presence", async () => {
  expect(await hasClientCreds()).toBe(false);
  await writeClientCreds({ clientId: "cid", clientSecret: "csec" });
  expect(await hasClientCreds()).toBe(true);
  expect(await readClientCreds()).toEqual({ clientId: "cid", clientSecret: "csec" });
});

test("connections round-trip, list, and remove", async () => {
  await writeConnection(conn());
  await writeConnection(conn({ cloudId: "cloud-2", siteName: "other" }));
  expect((await listConnections()).map((c) => c.cloudId).sort()).toEqual(["cloud-1", "cloud-2"]);
  expect((await readConnection("cloud-1"))?.siteName).toBe("blulantern");
  await removeConnection("cloud-1");
  expect(await readConnection("cloud-1")).toBeNull();
  expect((await listConnections()).map((c) => c.cloudId)).toEqual(["cloud-2"]);
});

test("authRef is the vault reference, never the token", () => {
  expect(authRefFor("cloud-1")).toBe("atlassian:cloud-1");
});

test("the on-disk vault never contains a token or the client secret in plaintext", async () => {
  await writeClientCreds({ clientId: "cid", clientSecret: "super-secret-value" });
  await writeConnection(conn({ access: "access-token-plain", refresh: "refresh-token-plain" }));
  const bytes = readFileSync(process.env.PMA_VAULT_PATH as string, "utf8");
  expect(bytes).not.toContain("super-secret-value");
  expect(bytes).not.toContain("access-token-plain");
  expect(bytes).not.toContain("refresh-token-plain");
});

test("a live token is returned without any refresh request", async () => {
  await writeClientCreds({ clientId: "cid", clientSecret: "csec" });
  await writeConnection(conn());
  const fetchImpl = vi.fn();
  const token = await accessTokenFor("cloud-1", { fetchImpl: fetchImpl as unknown as typeof fetch, now: () => NOW });
  expect(token).toBe("at-1");
  expect(fetchImpl).not.toHaveBeenCalled();
});

test("an expired token refreshes and PERSISTS the rotated refresh token before returning", async () => {
  await writeClientCreds({ clientId: "cid", clientSecret: "csec" });
  await writeConnection(conn({ expiresAt: NOW - 1 }));
  const fetchImpl = vi.fn(async () =>
    jsonRes({ access_token: "at-2", refresh_token: "rt-2", expires_in: 3600, scope: "read:jira-work" }),
  );
  const token = await accessTokenFor("cloud-1", { fetchImpl: fetchImpl as unknown as typeof fetch, now: () => NOW });
  expect(token).toBe("at-2");
  const stored = await readConnection("cloud-1");
  expect(stored?.refresh).toBe("rt-2"); // rotation: old rt-1 is dead, must not survive
  expect(stored?.access).toBe("at-2");
  expect(stored?.expiresAt).toBe(NOW + 3_600_000);
});

test("concurrent callers share ONE refresh — rotation cannot be burned twice", async () => {
  await writeClientCreds({ clientId: "cid", clientSecret: "csec" });
  await writeConnection(conn({ expiresAt: NOW - 1 }));
  const fetchImpl = vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 10));
    return jsonRes({ access_token: "at-2", refresh_token: "rt-2", expires_in: 3600, scope: "" });
  });
  const deps = { fetchImpl: fetchImpl as unknown as typeof fetch, now: () => NOW };
  const [a, b, c] = await Promise.all([
    accessTokenFor("cloud-1", deps),
    accessTokenFor("cloud-1", deps),
    accessTokenFor("cloud-1", deps),
  ]);
  expect([a, b, c]).toEqual(["at-2", "at-2", "at-2"]);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test("a rejected refresh flags needs_reconsent and does not retry", async () => {
  await writeClientCreds({ clientId: "cid", clientSecret: "csec" });
  await writeConnection(conn({ expiresAt: NOW - 1 }));
  const fetchImpl = vi.fn(async () => jsonRes({ error: "invalid_grant" }, false, 400));
  const deps = { fetchImpl: fetchImpl as unknown as typeof fetch, now: () => NOW };
  await expect(accessTokenFor("cloud-1", deps)).rejects.toBeInstanceOf(NeedsReconsentError);
  expect((await readConnection("cloud-1"))?.reconsentRequired).toBe(true);
  // A second call must not hammer the rotated token again.
  await expect(accessTokenFor("cloud-1", deps)).rejects.toBeInstanceOf(NeedsReconsentError);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test("a locked vault refuses to hand out tokens", async () => {
  await writeClientCreds({ clientId: "cid", clientSecret: "csec" });
  await writeConnection(conn());
  await vaultSession.lock();
  await expect(accessTokenFor("cloud-1")).rejects.toBeInstanceOf(VaultLockedError);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/server/integrations/atlassian/atlassian-store.test.ts`
Expected: FAIL — cannot resolve `./atlassian-store.js`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/server/integrations/atlassian/atlassian-store.ts`:

```ts
/**
 * Vault-backed storage for Atlassian OAuth material, plus refresh.
 *
 * Rotation is the hazard: every refresh returns a NEW refresh token and
 * invalidates the one just used. Hence two rules, both load-bearing:
 *   1. persist the new pair BEFORE returning it (atomic vault write), so a
 *      crash cannot strand us holding a dead token;
 *   2. single-flight per connection, so parallel callers cannot burn the
 *      rotation twice and trip Atlassian's replay/breach detection.
 * A rejected refresh is terminal: flag needs_reconsent rather than retry.
 */
import { isExpired } from "@pma/core";
import { credentialStore } from "@/server/vault/vault-store";
import { refreshTokens, type OAuthDeps, type AccessibleSite } from "./oauth-client.js";

const CLIENT_KEY = "atlassian:client";
const PENDING_KEY = "atlassian:pending";
const CONN_PREFIX = "atlassian:";

export interface AtlassianClientCreds {
  clientId: string;
  clientSecret: string;
}

export interface StoredConnection {
  cloudId: string;
  siteUrl: string;
  siteName: string;
  access: string;
  refresh: string;
  expiresAt: number;
  scopes: string[];
  reconsentRequired?: boolean;
}

/**
 * A grant in hand before the user has picked which site to attach it to.
 * Carries `sites` so the picker survives a page load — the callback redirects,
 * so the site list cannot live in memory across the round trip.
 */
export interface PendingGrant {
  access: string;
  refresh: string;
  expiresAt: number;
  scopes: string[];
  sites: AccessibleSite[];
}

export class NeedsReconsentError extends Error {
  constructor(readonly cloudId: string) {
    super("atlassian connection needs reconsent");
    this.name = "NeedsReconsentError";
  }
}

export function authRefFor(cloudId: string): string {
  return `${CONN_PREFIX}${cloudId}`;
}

export async function writeClientCreds(c: AtlassianClientCreds): Promise<void> {
  await credentialStore.set(CLIENT_KEY, JSON.stringify(c));
}
export async function readClientCreds(): Promise<AtlassianClientCreds | null> {
  const raw = await credentialStore.get(CLIENT_KEY);
  return raw ? (JSON.parse(raw) as AtlassianClientCreds) : null;
}
export async function hasClientCreds(): Promise<boolean> {
  return credentialStore.has(CLIENT_KEY);
}

export async function writeConnection(c: StoredConnection): Promise<void> {
  await credentialStore.set(authRefFor(c.cloudId), JSON.stringify(c));
}
export async function readConnection(cloudId: string): Promise<StoredConnection | null> {
  const raw = await credentialStore.get(authRefFor(cloudId));
  return raw ? (JSON.parse(raw) as StoredConnection) : null;
}
export async function removeConnection(cloudId: string): Promise<void> {
  await credentialStore.remove(authRefFor(cloudId));
}
export async function listConnections(): Promise<StoredConnection[]> {
  const names = await credentialStore.names();
  const keys = names.filter((n) => n.startsWith(CONN_PREFIX) && n !== CLIENT_KEY && n !== PENDING_KEY);
  const out: StoredConnection[] = [];
  for (const k of keys) {
    const raw = await credentialStore.get(k);
    if (raw) out.push(JSON.parse(raw) as StoredConnection);
  }
  return out;
}

export async function writePending(t: PendingGrant): Promise<void> {
  await credentialStore.set(PENDING_KEY, JSON.stringify(t));
}
export async function readPending(): Promise<PendingGrant | null> {
  const raw = await credentialStore.get(PENDING_KEY);
  return raw ? (JSON.parse(raw) as PendingGrant) : null;
}
export async function clearPending(): Promise<void> {
  await credentialStore.remove(PENDING_KEY);
}

// In-flight refreshes, on globalThis: Next compiles server actions and RSC into
// separate module layers, so a module-level Map would not be shared (Spec A lesson).
const globalRef = globalThis as typeof globalThis & {
  __pmaAtlassianRefresh?: Map<string, Promise<StoredConnection>>;
};
const inflight: Map<string, Promise<StoredConnection>> = (globalRef.__pmaAtlassianRefresh ??= new Map());

async function doRefresh(conn: StoredConnection, deps: OAuthDeps): Promise<StoredConnection> {
  const creds = await readClientCreds();
  if (!creds) throw new Error("atlassian client credentials are not configured");
  let next;
  try {
    next = await refreshTokens(
      { clientId: creds.clientId, clientSecret: creds.clientSecret, refresh: conn.refresh },
      deps,
    );
  } catch {
    await writeConnection({ ...conn, reconsentRequired: true });
    throw new NeedsReconsentError(conn.cloudId);
  }
  const updated: StoredConnection = {
    ...conn,
    access: next.access,
    refresh: next.refresh,
    expiresAt: next.expiresAt,
    scopes: next.scopes,
  };
  await writeConnection(updated); // persist BEFORE the caller uses it
  return updated;
}

export async function accessTokenFor(cloudId: string, deps: OAuthDeps = {}): Promise<string> {
  const conn = await readConnection(cloudId);
  if (!conn) throw new Error(`no atlassian connection for ${cloudId}`);
  if (conn.reconsentRequired) throw new NeedsReconsentError(cloudId);
  const now = deps.now?.() ?? Date.now();
  if (!isExpired(conn.expiresAt, now)) return conn.access;

  const existing = inflight.get(cloudId);
  if (existing) return (await existing).access;

  const p = doRefresh(conn, deps);
  inflight.set(cloudId, p);
  try {
    return (await p).access;
  } finally {
    inflight.delete(cloudId);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run apps/web/src/server/integrations/atlassian/atlassian-store.test.ts`
Expected: PASS (9 tests). If the locked-vault test leaks into others, confirm `afterEach` locks and unsets `PMA_VAULT_PATH`.

- [ ] **Step 5: Run the gate and commit**

Run: `pnpm -w run test:all` → green.

```bash
git add apps/web/src/server/integrations/atlassian/
git commit -m "feat(web): vault-backed Atlassian token store with single-flight rotating refresh"
```

---

### Task 4: Connect service (CSRF state + orchestration + connection rows)

**Files:**
- Create: `apps/web/src/server/integrations/atlassian/connect-service.ts`
- Test: `apps/web/src/server/integrations/atlassian/connect-service.test.ts`

**Interfaces:**
- Consumes: `authorizeUrl`, `exchangeCode`, `fetchAccessibleSites`, `OAuthDeps`, `AccessibleSite` (Task 2); `readClientCreds`, `writeConnection`, `readConnection`, `removeConnection`, `writePending`, `readPending`, `clearPending`, `authRefFor` (Task 3); `PrismaClient` from `@prisma/client`.
- Produces: `issueState(now?: number): string`; `consumeState(state: string, now?: number): boolean`; `STATE_TTL_MS: number`; `beginConnect(): Promise<string>`; `completeConnect(prisma: PrismaClient, code: string, state: string, deps?: OAuthDeps): Promise<{ chosen: StoredConnection | null; sites: AccessibleSite[] }>`; `chooseSite(prisma: PrismaClient, site: AccessibleSite): Promise<StoredConnection>`; `disconnect(prisma: PrismaClient, cloudId: string): Promise<void>`. Tasks 5 and 6 consume these.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/server/integrations/atlassian/connect-service.test.ts`:

```ts
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vaultSession } from "@/server/vault/vault-store";
import { writeClientCreds, readConnection, authRefFor } from "./atlassian-store.js";
import {
  issueState,
  consumeState,
  STATE_TTL_MS,
  beginConnect,
  completeConnect,
  chooseSite,
  disconnect,
} from "./connect-service.js";

let dir: string;
const NOW = 1_700_000_000_000;

const jsonRes = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as unknown as Response;

/** Minimal in-memory Prisma stand-in: only the calls this service makes. */
function fakePrisma() {
  const externalSystems: Record<string, { id: string; vendor: string; baseUrl: string | null }> = {};
  const syncConnections: Record<string, { id: string; externalSystemId: string; authRef: string; direction: string }> = {};
  let n = 0;
  return {
    externalSystem: {
      findFirst: async ({ where }: any) =>
        Object.values(externalSystems).find((s) => s.vendor === where.vendor && s.baseUrl === where.baseUrl) ?? null,
      create: async ({ data }: any) => {
        const id = `es-${++n}`;
        externalSystems[id] = { id, ...data };
        return externalSystems[id];
      },
    },
    syncConnection: {
      findFirst: async ({ where }: any) =>
        Object.values(syncConnections).find(
          (c) => c.authRef === where.authRef && c.externalSystemId === where.externalSystemId,
        ) ?? null,
      create: async ({ data }: any) => {
        const id = `sc-${++n}`;
        syncConnections[id] = { id, ...data };
        return syncConnections[id];
      },
      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (const [k, v] of Object.entries(syncConnections)) {
          if (v.authRef === where.authRef) {
            delete syncConnections[k];
            count++;
          }
        }
        return { count };
      },
    },
    _tables: { externalSystems, syncConnections },
  } as any;
}

beforeEach(async () => {
  await vaultSession.lock();
  dir = mkdtempSync(join(tmpdir(), "pma-conn-"));
  process.env.PMA_VAULT_PATH = join(dir, "vault.enc");
  await vaultSession.configure("correct-horse");
  await writeClientCreds({ clientId: "cid", clientSecret: "csec" });
});

afterEach(async () => {
  await vaultSession.lock();
  delete process.env.PMA_VAULT_PATH;
  rmSync(dir, { recursive: true, force: true });
});

test("state is single-use", () => {
  const s = issueState(NOW);
  expect(consumeState(s, NOW)).toBe(true);
  expect(consumeState(s, NOW)).toBe(false); // replay rejected
});

test("state expires after its TTL", () => {
  const s = issueState(NOW);
  expect(consumeState(s, NOW + STATE_TTL_MS + 1)).toBe(false);
});

test("an unknown state is rejected", () => {
  expect(consumeState("never-issued", NOW)).toBe(false);
});

test("beginConnect returns an authorize URL whose state we then accept exactly once", async () => {
  const url = new URL(await beginConnect());
  const state = url.searchParams.get("state") as string;
  expect(state).toBeTruthy();
  expect(url.searchParams.get("client_id")).toBe("cid");
  expect(consumeState(state)).toBe(true);
});

test("beginConnect refuses when client creds are missing", async () => {
  await vaultSession.lock();
  rmSync(dir, { recursive: true, force: true });
  dir = mkdtempSync(join(tmpdir(), "pma-conn-"));
  process.env.PMA_VAULT_PATH = join(dir, "vault.enc");
  await vaultSession.configure("correct-horse");
  await expect(beginConnect()).rejects.toThrow(/client credentials/i);
});

test("completeConnect rejects a bad state before exchanging the code", async () => {
  const prisma = fakePrisma();
  const fetchImpl = vi.fn();
  await expect(
    completeConnect(prisma, "code-1", "forged-state", { fetchImpl: fetchImpl as unknown as typeof fetch }),
  ).rejects.toThrow(/state/i);
  expect(fetchImpl).not.toHaveBeenCalled(); // the code was never sent
});

test("a single accessible site is auto-selected and creates both connection rows", async () => {
  const prisma = fakePrisma();
  const state = issueState();
  const fetchImpl = vi.fn(async (url: string) =>
    String(url).includes("/oauth/token")
      ? jsonRes({ access_token: "at-1", refresh_token: "rt-1", expires_in: 3600, scope: "read:jira-work" })
      : jsonRes([{ id: "cloud-1", url: "https://blulantern.atlassian.net", name: "blulantern" }]),
  );
  const res = await completeConnect(prisma, "code-1", state, {
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => NOW,
  });
  expect(res.chosen?.cloudId).toBe("cloud-1");
  expect(await readConnection("cloud-1")).not.toBeNull();

  const vendors = Object.values(prisma._tables.externalSystems).map((s: any) => s.vendor).sort();
  expect(vendors).toEqual(["confluence", "jira"]);
  const conns = Object.values(prisma._tables.syncConnections) as any[];
  expect(conns).toHaveLength(2);
  expect(conns.every((c) => c.authRef === authRefFor("cloud-1"))).toBe(true); // ONE token, two rows
  expect(conns.every((c) => c.direction === "inbound")).toBe(true); // read-only
});

test("multiple sites are returned for the user to pick, and chooseSite attaches the grant", async () => {
  const prisma = fakePrisma();
  const state = issueState();
  const fetchImpl = vi.fn(async (url: string) =>
    String(url).includes("/oauth/token")
      ? jsonRes({ access_token: "at-1", refresh_token: "rt-1", expires_in: 3600, scope: "" })
      : jsonRes([
          { id: "cloud-1", url: "https://a.atlassian.net", name: "a" },
          { id: "cloud-2", url: "https://b.atlassian.net", name: "b" },
        ]),
  );
  const res = await completeConnect(prisma, "code-1", state, {
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => NOW,
  });
  expect(res.chosen).toBeNull();
  expect(res.sites).toHaveLength(2);
  expect(await readConnection("cloud-1")).toBeNull(); // nothing attached yet

  const chosen = await chooseSite(prisma, { cloudId: "cloud-2", siteUrl: "https://b.atlassian.net", siteName: "b" });
  expect(chosen.access).toBe("at-1");
  expect(await readConnection("cloud-2")).not.toBeNull();
  expect(Object.values(prisma._tables.syncConnections)).toHaveLength(2);
});

test("disconnect removes the stored grant and both connection rows", async () => {
  const prisma = fakePrisma();
  const state = issueState();
  const fetchImpl = vi.fn(async (url: string) =>
    String(url).includes("/oauth/token")
      ? jsonRes({ access_token: "at-1", refresh_token: "rt-1", expires_in: 3600, scope: "" })
      : jsonRes([{ id: "cloud-1", url: "https://blulantern.atlassian.net", name: "blulantern" }]),
  );
  await completeConnect(prisma, "code-1", state, { fetchImpl: fetchImpl as unknown as typeof fetch, now: () => NOW });

  await disconnect(prisma, "cloud-1");
  expect(await readConnection("cloud-1")).toBeNull();
  expect(Object.values(prisma._tables.syncConnections)).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/server/integrations/atlassian/connect-service.test.ts`
Expected: FAIL — cannot resolve `./connect-service.js`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/server/integrations/atlassian/connect-service.ts`:

```ts
/**
 * Orchestrates the 3LO connect flow: issue CSRF state -> authorize URL ->
 * callback -> exchange -> pick a site -> persist the grant + connection rows.
 *
 * One consent yields ONE token blob in the vault, referenced by TWO
 * SyncConnection rows (jira + confluence) sharing an authRef. Disconnecting
 * therefore revokes both — the invariant the spec calls out.
 */
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  authorizeUrl,
  exchangeCode,
  fetchAccessibleSites,
  type AccessibleSite,
  type OAuthDeps,
} from "./oauth-client.js";
import {
  readClientCreds,
  writeConnection,
  removeConnection,
  writePending,
  readPending,
  clearPending,
  authRefFor,
  type StoredConnection,
} from "./atlassian-store.js";

export const STATE_TTL_MS = 10 * 60_000;

/** Issued CSRF states, on globalThis (Next's separate module layers — Spec A lesson). */
const globalRef = globalThis as typeof globalThis & { __pmaAtlassianStates?: Map<string, number> };
const states: Map<string, number> = (globalRef.__pmaAtlassianStates ??= new Map());

export function issueState(now: number = Date.now()): string {
  const s = randomBytes(32).toString("base64url");
  states.set(s, now);
  return s;
}

/** Single-use and TTL-bound: consumed on callback whether or not the exchange succeeds. */
export function consumeState(state: string, now: number = Date.now()): boolean {
  const issuedAt = states.get(state);
  if (issuedAt === undefined) return false;
  states.delete(state);
  return now - issuedAt <= STATE_TTL_MS;
}

export async function beginConnect(): Promise<string> {
  const creds = await readClientCreds();
  if (!creds) throw new Error("atlassian client credentials are not configured");
  return authorizeUrl(creds.clientId, issueState());
}

/** vendor rows we create per connected site — one grant serves both products. */
const VENDORS = ["jira", "confluence"] as const;

async function upsertConnectionRows(prisma: PrismaClient, site: AccessibleSite): Promise<void> {
  const authRef = authRefFor(site.cloudId);
  for (const vendor of VENDORS) {
    const system =
      (await prisma.externalSystem.findFirst({ where: { vendor, baseUrl: site.siteUrl } })) ??
      (await prisma.externalSystem.create({ data: { vendor, baseUrl: site.siteUrl } }));
    const existing = await prisma.syncConnection.findFirst({
      where: { authRef, externalSystemId: system.id },
    });
    if (!existing) {
      await prisma.syncConnection.create({
        data: { externalSystemId: system.id, authRef, direction: "inbound" },
      });
    }
  }
}

export async function chooseSite(prisma: PrismaClient, site: AccessibleSite): Promise<StoredConnection> {
  const pending = await readPending();
  if (!pending) throw new Error("no pending atlassian grant — start the connect flow again");
  const conn: StoredConnection = {
    cloudId: site.cloudId,
    siteUrl: site.siteUrl,
    siteName: site.siteName,
    access: pending.access,
    refresh: pending.refresh,
    expiresAt: pending.expiresAt,
    scopes: pending.scopes,
  };
  await writeConnection(conn);
  await upsertConnectionRows(prisma, site);
  await clearPending();
  return conn;
}

export async function completeConnect(
  prisma: PrismaClient,
  code: string,
  state: string,
  deps: OAuthDeps = {},
): Promise<{ chosen: StoredConnection | null; sites: AccessibleSite[] }> {
  if (!consumeState(state, deps.now?.())) throw new Error("invalid or expired OAuth state");
  const creds = await readClientCreds();
  if (!creds) throw new Error("atlassian client credentials are not configured");

  const tokens = await exchangeCode({ clientId: creds.clientId, clientSecret: creds.clientSecret, code }, deps);
  const sites = await fetchAccessibleSites(tokens.access, deps);
  if (sites.length === 0) throw new Error("this Atlassian account has no accessible sites");

  await writePending({
    access: tokens.access,
    refresh: tokens.refresh,
    expiresAt: tokens.expiresAt,
    scopes: tokens.scopes,
    sites,
  });

  const only = sites[0];
  if (sites.length === 1 && only) return { chosen: await chooseSite(prisma, only), sites };
  return { chosen: null, sites };
}

export async function disconnect(prisma: PrismaClient, cloudId: string): Promise<void> {
  await prisma.syncConnection.deleteMany({ where: { authRef: authRefFor(cloudId) } });
  await removeConnection(cloudId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run apps/web/src/server/integrations/atlassian/connect-service.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Run the gate and commit**

Run: `pnpm -w run test:all` → green.

```bash
git add apps/web/src/server/integrations/atlassian/
git commit -m "feat(web): Atlassian connect service — CSRF state, code exchange, site selection"
```

---

### Task 5: Callback Route Handler + server actions

**Files:**
- Create: `apps/web/src/app/api/atlassian/callback/route.ts`
- Create: `apps/web/src/app/connections/actions.ts`
- Test: `apps/web/src/app/connections/actions.test.ts`

**Interfaces:**
- Consumes: `beginConnect`, `completeConnect`, `chooseSite`, `disconnect` (Task 4); `writeClientCreds`, `hasClientCreds`, `readPending` (Task 3); `vaultSession` from `@/server/vault/vault-store`; `db` from `@/server/db`.
- Produces (all async — a `"use server"` module may export only async functions): `saveAtlassianClient(input: { clientId: string; clientSecret: string }): Promise<{ ok: boolean; error?: string }>`; `startAtlassianConnect(): Promise<never>` (redirects); `chooseAtlassianSite(site: { cloudId: string; siteUrl: string; siteName: string }): Promise<{ ok: boolean; error?: string }>`; `disconnectAtlassian(cloudId: string): Promise<{ ok: boolean; error?: string }>`. Task 6's UI consumes these.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/connections/actions.test.ts`:

```ts
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vaultSession } from "@/server/vault/vault-store";
import { hasClientCreds, readClientCreds } from "@/server/integrations/atlassian/atlassian-store";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/db", () => ({ db: () => ({}) }));

import { saveAtlassianClient, startAtlassianConnect } from "./actions.js";

let dir: string;

beforeEach(async () => {
  await vaultSession.lock();
  dir = mkdtempSync(join(tmpdir(), "pma-act-"));
  process.env.PMA_VAULT_PATH = join(dir, "vault.enc");
  await vaultSession.configure("correct-horse");
});

afterEach(async () => {
  await vaultSession.lock();
  delete process.env.PMA_VAULT_PATH;
  rmSync(dir, { recursive: true, force: true });
});

test("saveAtlassianClient stores both values in the vault", async () => {
  const r = await saveAtlassianClient({ clientId: "cid", clientSecret: "csec" });
  expect(r.ok).toBe(true);
  expect(await hasClientCreds()).toBe(true);
  expect(await readClientCreds()).toEqual({ clientId: "cid", clientSecret: "csec" });
});

test("saveAtlassianClient rejects blank input rather than storing junk", async () => {
  const r = await saveAtlassianClient({ clientId: "  ", clientSecret: "csec" });
  expect(r.ok).toBe(false);
  expect(await hasClientCreds()).toBe(false);
});

test("saveAtlassianClient refuses when the vault is locked", async () => {
  await vaultSession.lock();
  const r = await saveAtlassianClient({ clientId: "cid", clientSecret: "csec" });
  expect(r.ok).toBe(false);
  expect(r.error).toMatch(/unlock/i);
});

test("startAtlassianConnect redirects to Atlassian's authorize URL", async () => {
  await saveAtlassianClient({ clientId: "cid", clientSecret: "csec" });
  await expect(startAtlassianConnect()).rejects.toThrow(/REDIRECT:https:\/\/auth\.atlassian\.com\/authorize\?/);
});

test("startAtlassianConnect surfaces missing creds instead of a blank redirect", async () => {
  await expect(startAtlassianConnect()).rejects.toThrow(/REDIRECT:\/connections\?error=/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/app/connections/actions.test.ts`
Expected: FAIL — cannot resolve `./actions.js`.

- [ ] **Step 3: Write the server actions**

Create `apps/web/src/app/connections/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { vaultSession } from "@/server/vault/vault-store";
import { writeClientCreds } from "@/server/integrations/atlassian/atlassian-store";
import { beginConnect, chooseSite, disconnect } from "@/server/integrations/atlassian/connect-service";

/**
 * Write-only: the client secret goes in and is never read back to the browser
 * (the view exposes presence only). Mirrors the AI-keys pattern.
 */
export async function saveAtlassianClient(input: {
  clientId: string;
  clientSecret: string;
}): Promise<{ ok: boolean; error?: string }> {
  if ((await vaultSession.status()) !== "unlocked") {
    return { ok: false, error: "Unlock the vault before saving Atlassian credentials." };
  }
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  if (!clientId || !clientSecret) return { ok: false, error: "Client ID and client secret are both required." };
  await writeClientCreds({ clientId, clientSecret });
  revalidatePath("/connections");
  return { ok: true };
}

export async function startAtlassianConnect(): Promise<never> {
  if ((await vaultSession.status()) !== "unlocked") {
    redirect("/connections?error=" + encodeURIComponent("Unlock the vault to connect."));
  }
  let url: string;
  try {
    url = await beginConnect();
  } catch {
    redirect("/connections?error=" + encodeURIComponent("Add your Atlassian client ID and secret first."));
  }
  redirect(url);
}

export async function chooseAtlassianSite(site: {
  cloudId: string;
  siteUrl: string;
  siteName: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await chooseSite(db(), site);
    revalidatePath("/connections");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not attach that site." };
  }
}

export async function disconnectAtlassian(cloudId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await disconnect(db(), cloudId);
    revalidatePath("/connections");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not disconnect." };
  }
}
```

- [ ] **Step 4: Write the callback Route Handler**

Create `apps/web/src/app/api/atlassian/callback/route.ts`:

```ts
/**
 * OAuth redirect target. A Route Handler, not a server action, because Atlassian
 * redirects the browser here with query params. Registered callback (the only
 * one an app may have): http://localhost:3000/api/atlassian/callback
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { completeConnect } from "@/server/integrations/atlassian/connect-service";

export const dynamic = "force-dynamic";

const back = (req: NextRequest, params: Record<string, string>) =>
  NextResponse.redirect(new URL(`/connections?${new URLSearchParams(params)}`, req.url));

export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = req.nextUrl.searchParams;

  // Atlassian reports user-denied consent here — surface it, don't treat it as a bug.
  const denied = q.get("error");
  if (denied) return back(req, { error: q.get("error_description") ?? denied });

  const code = q.get("code");
  const state = q.get("state");
  if (!code || !state) return back(req, { error: "Atlassian callback was missing its code or state." });

  try {
    const { chosen } = await completeConnect(db(), code, state);
    return chosen ? back(req, { connected: chosen.siteName }) : back(req, { choose: "1" });
  } catch (e) {
    return back(req, { error: e instanceof Error ? e.message : "Could not complete the Atlassian connection." });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run apps/web/src/app/connections/actions.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the gate and commit**

Run: `pnpm -w run test:all` → green.

```bash
git add apps/web/src/app/api/atlassian/ apps/web/src/app/connections/
git commit -m "feat(web): Atlassian OAuth callback route + connect/disconnect actions"
```

---

### Task 6: Connections UI + view-model

**Files:**
- Modify: `apps/web/src/server/view-models.ts` (extend `buildConnectionsView` around line 586)
- Create: `apps/web/src/ui/atlassian-card.tsx`
- Modify: `apps/web/src/ui/connections.tsx` (render the card above the existing catalog grid)
- Modify: `apps/web/src/app/connections/page.tsx` (pass `searchParams` through)
- Test: `apps/web/src/server/view-models.test.ts` (add one case)

**Interfaces:**
- Consumes: `listConnections`, `hasClientCreds`, `readPending` (Task 3); `connectionState` from `@pma/core` (Task 1); `saveAtlassianClient`, `startAtlassianConnect`, `chooseAtlassianSite`, `disconnectAtlassian` (Task 5).
- Produces: `getAtlassianView(): Promise<AtlassianView>` where `interface AtlassianView { vaultStatus: SessionStatus; hasClient: boolean; connections: { cloudId: string; siteName: string; siteUrl: string; state: ConnectionState }[]; pendingSites: AccessibleSite[] }`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/server/view-models.test.ts`:

```ts
test("atlassian view reports state and presence — never a token value", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { vaultSession } = await import("./vault/vault-store.js");
  const { writeClientCreds, writeConnection } = await import("./integrations/atlassian/atlassian-store.js");
  const { getAtlassianView } = await import("./view-models.js");

  const dir = mkdtempSync(join(tmpdir(), "pma-view-"));
  process.env.PMA_VAULT_PATH = join(dir, "vault.enc");
  try {
    await vaultSession.lock();
    await vaultSession.configure("correct-horse");
    await writeClientCreds({ clientId: "cid", clientSecret: "csec" });
    await writeConnection({
      cloudId: "cloud-1",
      siteUrl: "https://blulantern.atlassian.net",
      siteName: "blulantern",
      access: "at-1",
      refresh: "rt-1",
      expiresAt: Date.now() + 3_600_000,
      scopes: ["read:jira-work"],
    });

    const view = await getAtlassianView();
    expect(view.hasClient).toBe(true);
    expect(view.vaultStatus).toBe("unlocked");
    expect(view.connections).toEqual([
      { cloudId: "cloud-1", siteName: "blulantern", siteUrl: "https://blulantern.atlassian.net", state: "connected" },
    ]);
    expect(JSON.stringify(view)).not.toContain("at-1");
    expect(JSON.stringify(view)).not.toContain("rt-1");
  } finally {
    await vaultSession.lock();
    delete process.env.PMA_VAULT_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/server/view-models.test.ts -t "atlassian view"`
Expected: FAIL — `getAtlassianView` is not exported.

- [ ] **Step 3: Add the view-model**

In `apps/web/src/server/view-models.ts`, add these to the **existing import block at the top of the file** (merge the `@pma/core` names into the existing `@pma/core` import if one is present):

```ts
import { connectionState, type ConnectionState, type SessionStatus } from "@pma/core";
import { vaultSession } from "./vault/vault-store.js";
import { listConnections, hasClientCreds, readPending } from "./integrations/atlassian/atlassian-store.js";
import type { AccessibleSite } from "./integrations/atlassian/oauth-client.js";
```

Then append to the **end** of the file:

```ts
export interface AtlassianView {
  vaultStatus: SessionStatus;
  hasClient: boolean;
  connections: { cloudId: string; siteName: string; siteUrl: string; state: ConnectionState }[];
  /** Sites awaiting a pick, when one grant reaches several sites. */
  pendingSites: AccessibleSite[];
}

/** Presence and state only — token values never reach the browser. */
export async function getAtlassianView(): Promise<AtlassianView> {
  const vaultStatus = await vaultSession.status();
  if (vaultStatus !== "unlocked") {
    return { vaultStatus, hasClient: false, connections: [], pendingSites: [] };
  }
  const now = Date.now();
  const stored = await listConnections();
  return {
    vaultStatus,
    hasClient: await hasClientCreds(),
    connections: stored.map((c) => ({
      cloudId: c.cloudId,
      siteName: c.siteName,
      siteUrl: c.siteUrl,
      state: connectionState({ expiresAt: c.expiresAt, hasRefresh: Boolean(c.refresh), reconsentRequired: c.reconsentRequired }, now),
    })),
    pendingSites: (await readPending())?.sites ?? [],
  };
}
```

- [ ] **Step 4: Build the card**

Create `apps/web/src/ui/atlassian-card.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AtlassianView } from "@/server/view-models";
import { saveAtlassianClient, startAtlassianConnect, chooseAtlassianSite, disconnectAtlassian } from "@/app/connections/actions";

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 13,
  background: "#fff",
} as const;

const STATE_LABEL: Record<string, string> = {
  connected: "Connected",
  expired: "Refreshing on next use",
  needs_reconsent: "Reconnect required",
};

export function AtlassianCard({ view, notice }: { view: AtlassianView; notice?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await saveAtlassianClient({ clientId, clientSecret });
      if (r.ok) {
        setClientSecret("");
        router.refresh();
      } else setError(r.error ?? "Could not save.");
    });
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 16 }}>
      <div className="h2">Atlassian · Jira + Confluence</div>
      <div className="sub" style={{ marginTop: 4 }}>
        Read-only. One consent covers both products on a site.
      </div>

      {notice ? <div style={{ color: "#c0392b", fontSize: 12.5, marginTop: 8 }}>{notice}</div> : null}
      {error ? <div style={{ color: "#c0392b", fontSize: 12.5, marginTop: 8 }}>{error}</div> : null}

      {view.vaultStatus !== "unlocked" ? (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          {view.vaultStatus === "unconfigured" ? (
            <>Connecting stores tokens in the vault. <a href="/vault/setup">Secure this vault</a> to continue.</>
          ) : (
            <>The vault is locked. <a href="/unlock">Unlock it</a> to connect.</>
          )}
        </div>
      ) : (
        <>
          {view.connections.map((c) => (
            <div
              key={c.cloudId}
              style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{c.siteName}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{c.siteUrl}</div>
              </div>
              <span className="tag">{STATE_LABEL[c.state] ?? c.state}</span>
              <button
                className="ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await disconnectAtlassian(c.cloudId);
                    if (r.ok) router.refresh();
                    else setError(r.error ?? "Could not disconnect.");
                  })
                }
              >
                Disconnect
              </button>
            </div>
          ))}

          {view.pendingSites.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Pick a site to connect</div>
              {view.pendingSites.map((s) => (
                <button
                  key={s.cloudId}
                  className="btn"
                  disabled={pending}
                  style={{ marginRight: 8, marginBottom: 8 }}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await chooseAtlassianSite(s);
                      if (r.ok) router.refresh();
                      else setError(r.error ?? "Could not attach that site.");
                    })
                  }
                >
                  {s.siteName}
                </button>
              ))}
            </div>
          ) : null}

          {view.hasClient ? (
            <form action={startAtlassianConnect} style={{ marginTop: 14 }}>
              <button className="btn" type="submit" disabled={pending}>
                {view.connections.length ? "Connect another site" : "Connect Atlassian"}
              </button>
            </form>
          ) : (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>
                Register an OAuth 2.0 (3LO) app at developer.atlassian.com with callback{" "}
                <code>http://localhost:3000/api/atlassian/callback</code>, then paste its credentials here. They are
                stored encrypted in your vault and never shown again.
              </div>
              <label>Client ID</label>
              <input style={inputStyle} value={clientId} onChange={(e) => setClientId(e.target.value)} />
              <label style={{ marginTop: 8, display: "block" }}>Client secret</label>
              <input
                type="password"
                autoComplete="off"
                style={inputStyle}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
              <button
                className="btn"
                style={{ marginTop: 10 }}
                disabled={pending || !clientId || !clientSecret}
                onClick={save}
              >
                Save credentials
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wire the card into the page**

In `apps/web/src/ui/connections.tsx`, make exactly three edits.

1. Add after the existing imports at the top of the file:

```tsx
import { AtlassianCard } from "./atlassian-card.js";
import type { AtlassianView } from "@/server/view-models";
```

2. Replace the component signature at line 67:

```tsx
export function Connections({ view }: { view: ConnectionsViewModel }) {
```

with:

```tsx
export function Connections({
  view,
  atlassian,
  notice,
}: {
  view: ConnectionsViewModel;
  atlassian: AtlassianView;
  notice?: string;
}) {
```

3. Render the card between the existing `<div className="sub">…</div>` block and the `<div className="grid" …>` that follows it:

```tsx
      <AtlassianCard view={atlassian} notice={notice} />
```

Leave the existing `CATALOG` grid untouched — the static Jira/Confluence cards stay as the catalog of what's connectable; the new card is the live connection above them.

In `apps/web/src/app/connections/page.tsx`:

```tsx
import { Shell } from "@/ui/shell";
import { Connections } from "@/ui/connections";
import { getConnectionsView, getAtlassianView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const notice = first(sp.error) ?? (first(sp.connected) ? `Connected to ${first(sp.connected)}.` : undefined);
  const [view, atlassian] = await Promise.all([getConnectionsView(), getAtlassianView()]);
  return (
    <Shell active="connections" crumb="Connections">
      <Connections view={view} atlassian={atlassian} notice={notice} />
    </Shell>
  );
}
```

- [ ] **Step 6: Run the gate and commit**

Run: `pnpm -w run test:all`
Expected: PASS — including the new view-model test.

```bash
git add apps/web/src/server/view-models.ts apps/web/src/ui/ apps/web/src/app/connections/
git commit -m "feat(web): Atlassian connection card — connect, pick site, status, disconnect"
```

---

### Task 7: Verify (gate + live drive)

**Files:** none created; this task proves the feature and updates the notes.

**Interfaces:** consumes everything above.

- [ ] **Step 1: Run the full gate**

Run: `pnpm -w run test:all`
Expected: all four packages typecheck, depcruise clean, every test green. Record the test count.

- [ ] **Step 2: Confirm core purity held**

Run: `pnpm -w run depcruise 2>&1 | tail -5` (or the `test:all` depcruise leg)
Expected: no violations — `packages/core` still imports nothing infra, and all `fetch`/Prisma/`node:crypto` for this feature lives under `apps/web/src/server`.

- [ ] **Step 3: Prove no secret reaches the browser**

Run the dev server on **3000** (`cd apps/web && pnpm dev`), configure a vault, save a dummy client ID/secret, then:

```bash
curl -s http://localhost:3000/connections | grep -c "dummy-secret-value"
```
Expected: `0`. Also confirm `vault.enc` is `-rw-------` and that `grep -c dummy-secret-value apps/web/.pma/vault.enc` is `0`.

- [ ] **Step 4: Live drive with the user (requires their registered app)**

**Stop and hand this to the user** — this step needs their Atlassian login (Google auth) and their OAuth app. Do not attempt to log in, create the app, or enter their credentials.

Ask them to register the app (callback `http://localhost:3000/api/atlassian/callback`; scopes `offline_access`, `read:jira-work`, `read:confluence-space.summary`, `read:confluence-content.summary`), then paste the client ID + secret into `/connections` themselves.

Then verify together, on port 3000:
1. Click **Connect Atlassian** → lands on Atlassian's consent screen showing only read-only scopes.
2. Approve → returns to `/connections` showing the connected site by name.
3. `ExternalSystem` has `jira` + `confluence` rows for the site URL, and two `SyncConnection` rows share `authRef = atlassian:<cloudId>`.
4. Restart the dev server → vault locks → `/connections` shows "unlock to connect" rather than crashing.
5. Unlock → the connection still reads `connected`.
6. **Disconnect** → the site disappears and the vault entry is gone.

- [ ] **Step 5: Update the notes and commit**

Update the **Current state** section of `/home/jfox/Projects/pm-artifactor/CLAUDE.md`: Spec B1 done, the new test count, the OAuth-app prerequisite, the `:3000` pin for the callback, and that B2 (discovery + mapping) is next.

```bash
git add -A
git commit -m "docs: record Spec B1 (Atlassian OAuth connect) completion"
```
