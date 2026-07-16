# Session & Credential Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A passphrase-gated vault lock ("logout") + an encrypted-at-rest credential store, both behind ports so a multi-user backend can drop in later.

**Architecture:** Two pure port interfaces in `@pma/core` (`SessionPort`, `CredentialStorePort`); a local adapter under `apps/web/src/server/vault/` using `node:crypto` (scrypt KDF + AES-256-GCM) over a gitignored `vault.enc` file with a process-memory unlocked-key singleton; `"use server"` actions + `/vault/setup` and `/unlock` pages + a sidebar Lock/Log-out control + a status gate in the shell.

**Tech Stack:** TypeScript ESM, `node:crypto`/`node:fs`, Next.js App Router (server components + server actions), Vitest, dependency-cruiser.

## Global Constraints

- **Core purity:** `packages/core` imports zero infra. The port INTERFACES + `VaultLockedError` + `SessionStatus` live in `packages/core/src/ports` (pure). All `node:crypto`/`node:fs`/adapter code lives under `apps/web/src/server`. Dependency-cruiser enforced.
- **Secrets never in SQLite/plaintext:** `vault.enc` holds only ciphertext; the passphrase is never stored or compared (verified via an AES-GCM verifier). Never log/echo the passphrase; never return secret values to the client.
- **Gate:** `pnpm -w run test:all` (dependency-cruiser + `vitest run` + typecheck of all 4 packages) must pass before every commit.
- **ESM/TS:** relative imports carry a `.js` suffix; `@/*` → `apps/web/src/*`. `noUncheckedIndexedAccess` + `verbatimModuleSyntax` are ON (use `import type` for type-only imports).
- **Commits:** conventional (`feat(core):`, `feat(web):`…); authored by the repo user; **NO `Co-Authored-By` trailer**.
- **Test isolation for the vault singleton:** the adapter holds a process-level in-memory key. Every vault test sets a fresh `env.PMA_VAULT_PATH` (via `mkdtempSync`) AND calls `await vaultSession.lock()` in `beforeEach` to reset the in-memory state between tests.

---

### Task 1: Ports — SessionPort, CredentialStorePort, VaultLockedError

**Files:**
- Create: `packages/core/src/ports/session-port.ts`
- Create: `packages/core/src/ports/credential-store-port.ts`
- Modify: `packages/core/src/index.ts` (add two `export *` lines)
- Test: `packages/core/src/ports/vault-ports.test.ts`

**Interfaces:**
- Produces: `SessionStatus` (`"unconfigured"|"locked"|"unlocked"`); `SessionPort` (`status()`, `configure(passphrase)`, `unlock(passphrase)→Promise<boolean>`, `lock()`); `CredentialStorePort` (`get(name)→Promise<string|null>`, `set(name,value)`, `has(name)→Promise<boolean>`, `remove(name)`, `names()→Promise<string[]>`); `VaultLockedError extends Error`. Consumed by the adapter (Task 3) and actions (Task 4).

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/ports/vault-ports.test.ts`:

```ts
import { expect, test } from "vitest";
import { VaultLockedError } from "./credential-store-port.js";

test("VaultLockedError is an Error subclass with a stable name", () => {
  const e = new VaultLockedError();
  expect(e).toBeInstanceOf(Error);
  expect(e.name).toBe("VaultLockedError");
  expect(new VaultLockedError("custom").message).toBe("custom");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pma/core exec vitest run src/ports/vault-ports.test.ts`
Expected: FAIL — `./credential-store-port.js` not found.

- [ ] **Step 3: Create the two port files**

`packages/core/src/ports/session-port.ts`:

```ts
export type SessionStatus = "unconfigured" | "locked" | "unlocked";

/** The app's lock/identity abstraction. Local now (process memory); a server session store later. */
export interface SessionPort {
  status(): Promise<SessionStatus>;
  configure(passphrase: string): Promise<void>; // first run: set the passphrase, create the vault
  unlock(passphrase: string): Promise<boolean>; // false on wrong passphrase; true unlocks
  lock(): Promise<void>; // "logout" — drop the in-memory key
}
```

`packages/core/src/ports/credential-store-port.ts`:

```ts
/** Thrown by credential-store operations when the vault is locked or unconfigured. */
export class VaultLockedError extends Error {
  constructor(message = "vault is locked") {
    super(message);
    this.name = "VaultLockedError";
  }
}

/** Named secrets, encrypted at rest, usable only while the vault is unlocked. */
export interface CredentialStorePort {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  has(name: string): Promise<boolean>;
  remove(name: string): Promise<void>;
  names(): Promise<string[]>; // credential names only — never values
}
```

- [ ] **Step 4: Export from core index + run test**

Add to `packages/core/src/index.ts` (following the existing `./ports/ai-port.js` export):

```ts
export * from "./ports/session-port.js";
export * from "./ports/credential-store-port.js";
```

Run: `pnpm --filter @pma/core exec vitest run src/ports/vault-ports.test.ts && pnpm -w run test:all`
Expected: PASS (gate green; core stays pure).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ports/session-port.ts packages/core/src/ports/credential-store-port.ts packages/core/src/ports/vault-ports.test.ts packages/core/src/index.ts
git commit -m "feat(core): SessionPort + CredentialStorePort + VaultLockedError"
```

---

### Task 2: Crypto — scrypt KDF + AES-256-GCM + verifier

**Files:**
- Create: `apps/web/src/server/vault/crypto.ts`
- Test: `apps/web/src/server/vault/crypto.test.ts`

**Interfaces:**
- Consumes: `node:crypto`.
- Produces: `Kdf` (`{name:"scrypt",N,r,p,salt}`); `newKdf()→Kdf`; `deriveKey(passphrase,kdf)→Buffer`(32B); `encrypt(key,plaintext)→string`(base64 of iv‖ct‖tag); `decrypt(key,blob)→string` (throws on wrong key); `makeVerifier(key)→string`; `checkVerifier(key,verifier)→boolean`. Consumed by the vault adapter (Task 3).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/server/vault/crypto.test.ts`:

```ts
import { expect, test } from "vitest";
import { newKdf, deriveKey, encrypt, decrypt, makeVerifier, checkVerifier } from "./crypto.js";

test("deriveKey is deterministic for a given passphrase + kdf", () => {
  const kdf = newKdf();
  expect(deriveKey("hunter2hunter2", kdf).equals(deriveKey("hunter2hunter2", kdf))).toBe(true);
  expect(deriveKey("hunter2hunter2", kdf).equals(deriveKey("different-pass", kdf))).toBe(false);
});

test("encrypt → decrypt round-trips; wrong key fails", () => {
  const kdf = newKdf();
  const key = deriveKey("correct-horse", kdf);
  const blob = encrypt(key, "s3cr3t-token");
  expect(blob).not.toContain("s3cr3t-token"); // ciphertext, not plaintext
  expect(decrypt(key, blob)).toBe("s3cr3t-token");
  const wrong = deriveKey("battery-staple", kdf);
  expect(() => decrypt(wrong, blob)).toThrow(); // GCM auth-tag mismatch
});

test("verifier confirms the right key and rejects the wrong one", () => {
  const kdf = newKdf();
  const key = deriveKey("pass-one-two", kdf);
  const v = makeVerifier(key);
  expect(checkVerifier(key, v)).toBe(true);
  expect(checkVerifier(deriveKey("nope-nope-nope", kdf), v)).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/server/vault/crypto.test.ts` (from repo root)
Expected: FAIL — `./crypto.js` not found.

- [ ] **Step 3: Create `apps/web/src/server/vault/crypto.ts`**

```ts
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from "node:crypto";

const SCRYPT = { N: 16384, r: 8, p: 1, keyLen: 32 } as const;
const VERIFIER_PLAINTEXT = "pma-vault-v1";

export interface Kdf {
  name: "scrypt";
  N: number;
  r: number;
  p: number;
  salt: string; // base64
}

export function newKdf(): Kdf {
  return { name: "scrypt", N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, salt: randomBytes(16).toString("base64") };
}

export function deriveKey(passphrase: string, kdf: Kdf): Buffer {
  return scryptSync(passphrase, Buffer.from(kdf.salt, "base64"), SCRYPT.keyLen, { N: kdf.N, r: kdf.r, p: kdf.p });
}

/** base64( iv(12) ‖ ciphertext ‖ tag(16) ) */
export function encrypt(key: Buffer, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, ct, cipher.getAuthTag()]).toString("base64");
}

/** Throws if the key is wrong (GCM auth-tag failure) or the blob is malformed. */
export function decrypt(key: Buffer, blob: string): string {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const ct = buf.subarray(12, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function makeVerifier(key: Buffer): string {
  return encrypt(key, VERIFIER_PLAINTEXT);
}

export function checkVerifier(key: Buffer, verifier: string): boolean {
  try {
    return decrypt(key, verifier) === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run apps/web/src/server/vault/crypto.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/vault/crypto.ts apps/web/src/server/vault/crypto.test.ts
git commit -m "feat(web): vault crypto — scrypt KDF + AES-256-GCM + verifier"
```

---

### Task 3: Vault adapter — SessionPort + CredentialStorePort over vault.enc

**Files:**
- Create: `apps/web/src/server/vault/vault-store.ts`
- Test: `apps/web/src/server/vault/vault-store.test.ts`

**Interfaces:**
- Consumes: `crypto.ts` (Task 2); `SessionPort`, `SessionStatus`, `CredentialStorePort`, `VaultLockedError` (`@pma/core`).
- Produces: `vaultSession: SessionPort` and `credentialStore: CredentialStorePort` (module singletons sharing the in-memory unlocked key). File path from `env.PMA_VAULT_PATH` else `<cwd>/.pma/vault.enc`. Consumed by actions (Task 4) + the shell gate (Task 5).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/server/vault/vault-store.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vaultSession, credentialStore } from "./vault-store.js";
import { VaultLockedError } from "@pma/core";

let dir: string;

beforeEach(async () => {
  await vaultSession.lock(); // reset the process-singleton in-memory key between tests
  dir = mkdtempSync(join(tmpdir(), "pma-vault-"));
  process.env.PMA_VAULT_PATH = join(dir, "vault.enc");
});
afterEach(async () => {
  await vaultSession.lock();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.PMA_VAULT_PATH;
});

test("configure → unlocked; lock → locked; status reflects state", async () => {
  expect(await vaultSession.status()).toBe("unconfigured");
  await vaultSession.configure("correct-horse");
  expect(await vaultSession.status()).toBe("unlocked");
  await vaultSession.lock();
  expect(await vaultSession.status()).toBe("locked");
});

test("wrong passphrase returns false and does not unlock; right one recovers secrets", async () => {
  await vaultSession.configure("correct-horse");
  await credentialStore.set("jira", "tok-123");
  await vaultSession.lock();
  expect(await vaultSession.unlock("bad-guess-xx")).toBe(false);
  expect(await vaultSession.status()).toBe("locked");
  expect(await vaultSession.unlock("correct-horse")).toBe(true);
  expect(await credentialStore.get("jira")).toBe("tok-123");
});

test("credential CRUD round-trips; locked access throws VaultLockedError", async () => {
  await vaultSession.configure("correct-horse");
  await credentialStore.set("a", "1");
  await credentialStore.set("b", "2");
  expect(await credentialStore.get("a")).toBe("1");
  expect(await credentialStore.has("b")).toBe(true);
  expect((await credentialStore.names()).sort()).toEqual(["a", "b"]);
  await credentialStore.remove("a");
  expect(await credentialStore.get("a")).toBeNull();
  await vaultSession.lock();
  await expect(credentialStore.get("b")).rejects.toBeInstanceOf(VaultLockedError);
});

test("the on-disk file contains only ciphertext, never the secret value", async () => {
  await vaultSession.configure("correct-horse");
  await credentialStore.set("jira", "super-secret-token");
  const bytes = readFileSync(process.env.PMA_VAULT_PATH as string, "utf8");
  expect(bytes).not.toContain("super-secret-token");
  expect(bytes).not.toContain("correct-horse");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/server/vault/vault-store.test.ts`
Expected: FAIL — `./vault-store.js` not found.

- [ ] **Step 3: Create `apps/web/src/server/vault/vault-store.ts`**

```ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { SessionPort, SessionStatus, CredentialStorePort } from "@pma/core";
import { VaultLockedError } from "@pma/core";
import { newKdf, deriveKey, encrypt, decrypt, makeVerifier, checkVerifier, type Kdf } from "./crypto.js";

interface VaultFile {
  v: 1;
  kdf: Kdf;
  verifier: string; // encrypted VERIFIER_PLAINTEXT
  secrets: string; // encrypted JSON map { name: value }
}

function vaultPath(): string {
  return process.env.PMA_VAULT_PATH ?? join(process.cwd(), ".pma", "vault.enc");
}
function readVault(): VaultFile | null {
  const p = vaultPath();
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as VaultFile;
}
function writeVault(f: VaultFile): void {
  const p = vaultPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(f), { mode: 0o600 });
}

// Process-level unlocked state — correct for local single-user (a multi-user server swaps this for a per-session store).
let key: Buffer | null = null;
let secrets: Record<string, string> | null = null;

export const vaultSession: SessionPort = {
  async status(): Promise<SessionStatus> {
    if (!readVault()) return "unconfigured";
    return key && secrets ? "unlocked" : "locked";
  },
  async configure(passphrase: string): Promise<void> {
    if (readVault()) throw new Error("vault already configured");
    const kdf = newKdf();
    const k = deriveKey(passphrase, kdf);
    writeVault({ v: 1, kdf, verifier: makeVerifier(k), secrets: encrypt(k, JSON.stringify({})) });
    key = k;
    secrets = {};
  },
  async unlock(passphrase: string): Promise<boolean> {
    const f = readVault();
    if (!f) throw new Error("vault not configured");
    const k = deriveKey(passphrase, f.kdf);
    if (!checkVerifier(k, f.verifier)) return false;
    key = k;
    secrets = JSON.parse(decrypt(k, f.secrets)) as Record<string, string>;
    return true;
  },
  async lock(): Promise<void> {
    key = null;
    secrets = null;
  },
};

function requireUnlocked(): { k: Buffer; s: Record<string, string> } {
  if (!key || !secrets) throw new VaultLockedError();
  return { k: key, s: secrets };
}
function persist(k: Buffer, s: Record<string, string>): void {
  const f = readVault();
  if (!f) throw new Error("vault not configured");
  writeVault({ ...f, secrets: encrypt(k, JSON.stringify(s)) });
}

export const credentialStore: CredentialStorePort = {
  async get(name: string): Promise<string | null> {
    const { s } = requireUnlocked();
    return s[name] ?? null;
  },
  async set(name: string, value: string): Promise<void> {
    const { k, s } = requireUnlocked();
    s[name] = value;
    persist(k, s);
  },
  async has(name: string): Promise<boolean> {
    const { s } = requireUnlocked();
    return Object.prototype.hasOwnProperty.call(s, name);
  },
  async remove(name: string): Promise<void> {
    const { k, s } = requireUnlocked();
    delete s[name];
    persist(k, s);
  },
  async names(): Promise<string[]> {
    const { s } = requireUnlocked();
    return Object.keys(s);
  },
};
```

- [ ] **Step 4: Run test to verify it passes + gate**

Run: `pnpm vitest run apps/web/src/server/vault/vault-store.test.ts && pnpm -w run test:all`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/vault/vault-store.ts apps/web/src/server/vault/vault-store.test.ts
git commit -m "feat(web): local vault adapter (SessionPort + CredentialStorePort over vault.enc)"
```

---

### Task 4: Server actions — setup / unlock / lock

**Files:**
- Create: `apps/web/src/app/vault/actions.ts`
- Test: `apps/web/src/app/vault/actions.test.ts`

**Interfaces:**
- Consumes: `vaultSession` (Task 3).
- Produces `"use server"` async functions: `setupVault(passphrase)→Promise<{ok:boolean;error?:string}>`, `unlockVault(passphrase)→Promise<{ok:boolean;error?:string}>`, `lockVault()→Promise<never>` (redirects to `/unlock`). Consumed by the forms + lock control (Task 5).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/vault/actions.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vaultSession } from "@/server/vault/vault-store";
import { setupVault, unlockVault } from "./actions.js";

let dir: string;
beforeEach(async () => {
  await vaultSession.lock();
  dir = mkdtempSync(join(tmpdir(), "pma-vault-act-"));
  process.env.PMA_VAULT_PATH = join(dir, "vault.enc");
});
afterEach(async () => {
  await vaultSession.lock();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.PMA_VAULT_PATH;
});

test("setupVault rejects a short passphrase and configures a valid one", async () => {
  expect(await setupVault("short")).toMatchObject({ ok: false });
  expect(await setupVault("long-enough-pass")).toEqual({ ok: true });
  expect(await vaultSession.status()).toBe("unlocked");
});

test("unlockVault reports an incorrect passphrase without unlocking", async () => {
  await setupVault("long-enough-pass");
  await vaultSession.lock();
  expect(await unlockVault("wrong-passphrase")).toMatchObject({ ok: false });
  expect(await vaultSession.status()).toBe("locked");
  expect(await unlockVault("long-enough-pass")).toEqual({ ok: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/web/src/app/vault/actions.test.ts`
Expected: FAIL — `./actions.js` not found.

- [ ] **Step 3: Create `apps/web/src/app/vault/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { vaultSession } from "@/server/vault/vault-store";

const MIN_LEN = 8;

export async function setupVault(passphrase: string): Promise<{ ok: boolean; error?: string }> {
  if (passphrase.length < MIN_LEN) return { ok: false, error: `Passphrase must be at least ${MIN_LEN} characters.` };
  await vaultSession.configure(passphrase);
  return { ok: true };
}

export async function unlockVault(passphrase: string): Promise<{ ok: boolean; error?: string }> {
  const ok = await vaultSession.unlock(passphrase);
  return ok ? { ok: true } : { ok: false, error: "Incorrect passphrase." };
}

export async function lockVault(): Promise<never> {
  await vaultSession.lock();
  redirect("/unlock");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run apps/web/src/app/vault/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/vault/actions.ts apps/web/src/app/vault/actions.test.ts
git commit -m "feat(web): vault server actions (setup / unlock / lock)"
```

---

### Task 5: UI — setup + unlock pages, lock control, shell status gate

**Files:**
- Create: `apps/web/src/app/vault/setup/page.tsx`, `apps/web/src/app/unlock/page.tsx`
- Create: `apps/web/src/ui/vault-setup-form.tsx`, `apps/web/src/ui/unlock-form.tsx`, `apps/web/src/ui/lock-control.tsx` (all `"use client"`)
- Modify: `apps/web/src/ui/shell.tsx` (make it async; gate + footer control)
- Test: none (client/UI; verified live in Task 6). Typecheck is the gate.

**Interfaces:**
- Consumes: `setupVault`/`unlockVault`/`lockVault` (Task 4); `vaultSession.status()` (Task 3).
- Produces: the two bare pages (NOT wrapped in `<Shell>`), the two client forms, `<LockControl>`, and the shell gate.

- [ ] **Step 1: The two bare pages**

`apps/web/src/app/unlock/page.tsx` (server component; redirect away if not locked):

```tsx
import { redirect } from "next/navigation";
import { vaultSession } from "@/server/vault/vault-store";
import { UnlockForm } from "@/ui/unlock-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const status = await vaultSession.status();
  if (status === "unconfigured") redirect("/vault/setup");
  if (status === "unlocked") redirect("/");
  return <UnlockForm />;
}
```

`apps/web/src/app/vault/setup/page.tsx` (redirect away if already configured):

```tsx
import { redirect } from "next/navigation";
import { vaultSession } from "@/server/vault/vault-store";
import { VaultSetupForm } from "@/ui/vault-setup-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  if ((await vaultSession.status()) !== "unconfigured") redirect("/");
  return <VaultSetupForm />;
}
```

- [ ] **Step 2: The client forms + lock control**

Create `apps/web/src/ui/unlock-form.tsx` and `apps/web/src/ui/vault-setup-form.tsx` (`"use client"`), mirroring `ai-settings.tsx`'s style (centered `card`, `label`, `inputStyle`, `btn`, `useState` + `useTransition` + `useRouter`). Behavior:
- `UnlockForm`: one password `<input>` → on submit call `unlockVault(passphrase)`; on `{ok:true}` `router.push("/")` + `router.refresh()`; on `{ok:false}` show `result.error` inline. A short "🔒 Vault locked — enter your passphrase" heading.
- `VaultSetupForm`: passphrase + confirm `<input type="password">`; require they match and length ≥ 8 client-side (disable Save otherwise); on Save call `setupVault(passphrase)`; on `{ok:true}` `router.push("/")`; on `{ok:false}` show error. Copy: "Set a vault passphrase — it encrypts your stored credentials and gates the app. There's no recovery if you lose it."

Create `apps/web/src/ui/lock-control.tsx` (`"use client"`): a `<form action={lockVault}>` with a `<button className="ghost" type="submit">⏻ Lock / Log out</button>` (using the server action as a form action so the redirect runs server-side). Import `lockVault` from `@/app/vault/actions`.

- [ ] **Step 3: Shell gate + footer control**

Modify `apps/web/src/ui/shell.tsx`:
- Make the `Shell` function `async`.
- At the top of the body, gate: `const status = await vaultSession.status(); if (status === "locked") redirect("/unlock");` (import `vaultSession` from `@/server/vault/vault-store` and `redirect` from `next/navigation`). `unconfigured` and `unlocked` render normally.
- In the sidebar footer (near the existing "Local · encrypted" block): when `status === "unlocked"`, render `<LockControl />`; when `status === "unconfigured"`, render a `<Link href="/vault/setup" className="...">🔒 Secure this vault</Link>` prompt.

(`Shell` is a server component — importing the server-only `vaultSession` is fine; it is never a `"use client"` module.)

- [ ] **Step 4: Typecheck + gate**

Run: `pnpm -w run test:all`
Expected: PASS (typecheck clean; existing tests unaffected).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/vault apps/web/src/app/unlock apps/web/src/ui/vault-setup-form.tsx apps/web/src/ui/unlock-form.tsx apps/web/src/ui/lock-control.tsx apps/web/src/ui/shell.tsx
git commit -m "feat(web): vault setup/unlock pages + lock control + shell status gate"
```

---

### Task 6: Verify — gate + live drive

**Files:** add `.pma/` is already gitignored from the AI-config work — confirm; no code beyond that.

- [ ] **Step 1: Confirm `.pma/` (holding `vault.enc`) is gitignored**

Run: `git check-ignore apps/web/.pma/vault.enc` → expect it prints the path (ignored). If not, add `.pma/` to `.gitignore`.

- [ ] **Step 2: Full gate**

Run: `pnpm -w run test:all`
Expected: PASS.

- [ ] **Step 3: Live drive (Playwright; fresh vault path)**

Start `next dev` with a scratch `DATABASE_URL` + a scratch `PMA_VAULT_PATH` (so no real vault is touched). Drive and verify:
1. Fresh (`unconfigured`): the app is open; the sidebar shows "🔒 Secure this vault".
2. Go to `/vault/setup`, set an 8+ char passphrase (confirm must match) → redirected to the app; sidebar now shows "⏻ Lock / Log out".
3. Click Lock / Log out → redirected to `/unlock`; navigating to any protected route also lands on `/unlock`.
4. Wrong passphrase → inline "Incorrect passphrase." and still locked.
5. Correct passphrase → back into the app.
6. Confirm the on-disk `vault.enc` contains only ciphertext (grep it for a known secret string set via the unit tests — N/A live; instead confirm the file exists and is JSON with `kdf`/`verifier`/`secrets` and no plaintext passphrase).
Capture a screenshot of the unlock screen and **look at it**.

- [ ] **Step 4: Update CLAUDE.md Current state**

Edit `/home/jfox/Projects/pm-artifactor/CLAUDE.md` → note Spec A (vault lock + encrypted credential store + logout) shipped; Spec B (Atlassian OAuth) next.

- [ ] **Step 5: Commit any Task-6 changes (e.g. .gitignore)**

```bash
git commit -am "chore: gitignore vault.enc / record Spec A in current state" || echo "nothing to commit"
```
