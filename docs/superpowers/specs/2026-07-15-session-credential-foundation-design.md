# Session & Credential Foundation — Design Spec

**Date:** 2026-07-15
**Status:** Approved (design), pending spec review
**Builds on:** the PPM manual foundation (`2026-07-10-ppm-manual-foundation-design.md`, merged to `main`).
**Enables:** Spec B — Atlassian OAuth connector + onboarding + mapping + sync (the follow-on).
**Target repo:** `/home/jfox/Projects/pm-artifactor/pm-artifactor` (git, `main`)

---

## 1. Purpose & scope

Give the app a **passphrase-gated vault lock** ("logout") and a **secure, encrypted-at-rest credential store**, both behind ports so a multi-user/server backend can replace the local implementations later without touching callers. This is the security groundwork that Spec B's OAuth needs (somewhere real to keep tokens) and delivers the **logout** the user asked for.

- **In scope:** a `SessionPort` (configure passphrase / unlock / lock / status) with a local implementation; a `CredentialStorePort` (named secrets, encrypted with a passphrase-derived key, usable only while unlocked) with a local file-backed implementation; the set-passphrase / unlock / logout UX; app-entry gating when locked. Fully buildable and verifiable **now** — no external accounts needed.
- **Out of scope (later specs / deferred):** OAuth flows and connectors (Spec B); migrating the existing plaintext AI-provider keys into the store (optional follow-up); full domain-DB-at-rest encryption (SQLCipher); OS-keychain integration; the real multi-user server session/credential backends (the ports make them drop-in).

### Approved decisions (from brainstorming)

1. **Identity:** local now, multi-user later — everything behind `SessionPort` + `CredentialStorePort`.
2. **"Logout" = lock the vault.** A passphrase, set during onboarding, gates the app and derives the key that encrypts stored secrets; locking drops the in-memory key.
3. **Backward-compatible rollout:** an **unconfigured** vault leaves the app open (today's behavior). Setting a passphrase enables the lock + the encrypted credential store. Connecting an integration (Spec B) requires a configured vault.
4. **Secrets encrypted at rest** (not SQLite plaintext) — resolves the no-plaintext red line properly.

---

## 2. Non-negotiable principles (inherited)

- **Core purity:** `packages/core` imports zero infra. The two **port interfaces** live in `packages/core/src/ports` (pure types, no impl); the crypto/fs **adapters** live under `apps/web/src/server` (they use `node:crypto`/`node:fs`). Dependency-cruiser enforced.
- **Secrets never in SQLite/plaintext.** The credential store persists only ciphertext (in a gitignored local file), and only the passphrase-derived key (held in memory while unlocked) can decrypt it.
- **The gate** (`pnpm -w run test:all`) stays green; conventional commits; no `Co-Authored-By` trailer.

---

## 3. Architecture — two ports, local adapters

Two segregated ports (ISP), mirroring the existing `packages/core/src/ports` style:

```ts
// packages/core/src/ports/session-port.ts
export type SessionStatus = "unconfigured" | "locked" | "unlocked";
export interface SessionPort {
  status(): Promise<SessionStatus>;
  configure(passphrase: string): Promise<void>;      // first run: set the passphrase, create the vault
  unlock(passphrase: string): Promise<boolean>;      // false on wrong passphrase; true unlocks
  lock(): Promise<void>;                              // "logout" — drop the in-memory key
}

// packages/core/src/ports/credential-store-port.ts
export interface CredentialStorePort {
  get(name: string): Promise<string | null>;         // decrypted value, or null if absent
  set(name: string, value: string): Promise<void>;
  has(name: string): Promise<boolean>;               // presence without returning the value
  remove(name: string): Promise<void>;
  names(): Promise<string[]>;                         // credential names only (never values)
}
```

All `CredentialStorePort` operations require the vault to be **unlocked**; when locked (or unconfigured) they throw a typed `VaultLockedError`. Callers check `SessionPort.status()` first (the app gates on it — §6).

**Local adapters** (`apps/web/src/server/vault/`): one module owns the in-memory unlocked key + decrypted secrets (a process-level singleton — correct for local single-user; a multi-user server swaps it for a per-session store). The `SessionPort` and `CredentialStorePort` local adapters read/write the same in-memory state and the on-disk encrypted file.

---

## 4. Encryption & the on-disk vault file

- **Location:** `apps/web/.pma/vault.enc` (gitignored; server-only; NOT SQLite). Path override `PMA_VAULT_PATH` (tests).
- **File shape (JSON):** `{ v: 1, kdf: { name: "scrypt", N, r, p, salt }, verifier: <b64 nonce+ciphertext+tag>, secrets: <b64 nonce+ciphertext+tag> }`.
- **Key derivation:** `scrypt(passphrase, salt, 32)` (Node `crypto.scryptSync`) → a 256-bit key. Salt is 16 random bytes, stored in the file.
- **Verifier:** on `configure`, encrypt a known constant (`"pma-vault-v1"`) with AES-256-GCM under the key. On `unlock`, derive the key and decrypt the verifier — success ⇒ correct passphrase; GCM auth-tag failure ⇒ wrong passphrase (return `false`). This never stores or compares the passphrase.
- **Secrets blob:** a single AES-256-GCM ciphertext of the JSON map `{ name: value }`. `unlock` decrypts it into memory; `set`/`remove` mutate the in-memory map and re-encrypt+rewrite the file; `lock` zeroes the in-memory key + map.
- **`configure`** requires an unconfigured vault (no existing file); it errors if already configured (changing the passphrase is a deferred re-key operation). **`configure` on an existing plaintext AI-config file does nothing to it** (AI migration is out of scope here).

*(Approach note: a single encrypted secrets blob — vs. per-secret files — keeps the adapter tiny and the whole set atomically re-written; fine for the handful of credentials expected.)*

## 5. Session state & "logout"

- The unlocked **key + decrypted secrets** live only in the vault module's process memory — for local single-user, the server process's unlocked state *is* the session (no cookie needed now).
- `unlock(passphrase)` → derive+verify → decrypt secrets into memory. `lock()` → zero the in-memory key + secrets. `status()` returns `unconfigured` (no vault file), `locked` (file exists but no key in memory), or `unlocked` (key in memory).
- **Multi-user later:** the process singleton becomes a per-session (per-user) key store keyed by a session id (and a signed session cookie is introduced then); the ports are unchanged, so pages/actions don't change.

## 6. UX — set passphrase, unlock, logout

Gating happens via a **server-component check** (Node runtime, so it can call the vault module directly — NOT edge middleware) in the app shell/layout, on `SessionPort.status()`:

- `unconfigured` → the app runs **open** (today's behavior), with a dismissible "Secure this vault" prompt linking to **`/vault/setup`** (set a passphrase). This keeps the current local experience intact.
- `locked` → redirect to **`/unlock`** (passphrase field → `unlock` server action → on success go to the app; on `false`, inline error). No other page renders while locked.
- `unlocked` → normal app, plus a **Lock / Log out** control in the sidebar footer (→ `lock` server action → `/unlock`).
- `/vault/setup`: set a passphrase (with confirm) → `configure` → vault becomes `unlocked`.

Server actions live in `apps/web/src/app/vault/actions.ts` (`"use server"`): `setupVault(passphrase)`, `unlockVault(passphrase)`, `lockVault()`. Never log or echo the passphrase; never return secret values to the client.

## 7. Architecture placement

| Concern | Location |
|---|---|
| `SessionPort`, `CredentialStorePort` interfaces, `SessionStatus`, `VaultLockedError` | `packages/core/src/ports` (pure) |
| scrypt/AES-GCM crypto, the on-disk `vault.enc`, in-memory unlocked state, the two local adapters | `apps/web/src/server/vault/` (uses `node:crypto`/`node:fs`) |
| `/unlock`, `/vault/setup` pages, the lock/log-out control, the status gate | `apps/web/src/app` + `apps/web/src/ui` |

## 8. Testing & verification

- **Crypto/adapter unit tests** (temp `PMA_VAULT_PATH`): configure→unlock round-trip; wrong passphrase → `unlock` returns `false` (GCM tag mismatch, not a crash); `set`/`get`/`has`/`remove`/`names` round-trip; `lock` then `get` throws `VaultLockedError`; `status` transitions `unconfigured → unlocked → locked`; a re-`unlock` after lock recovers the secrets; the on-disk file contains only ciphertext (assert the plaintext value string does not appear in the file bytes).
- **Server-action tests**: `setupVault`/`unlockVault`/`lockVault` drive the port correctly and never surface secrets.
- **Live drive** (Playwright): first-run `unconfigured` app is open; set a passphrase at `/vault/setup`; add a credential via a throwaway server action and confirm it round-trips; **Log out** → `/unlock`; wrong passphrase shows an error; correct passphrase restores access. Confirm the secret never appears in page HTML.
- Full gate green; dependency-cruiser confirms the ports stay pure and `node:crypto`/`node:fs` live only under `apps/web/src/server`.

## 9. Explicitly deferred

- OAuth flows, connectors, onboarding wizard, sync, per-container mapping — **Spec B** (Atlassian: Jira + Confluence), built on this credential store.
- Migrating the existing plaintext AI-provider keys (`.pma/ai-config.json`) into the encrypted store — optional follow-up (would put AI behind the vault lock; kept separate here to avoid disrupting the working AI flow).
- Changing/rotating the passphrase (re-key); domain-DB-at-rest encryption (SQLCipher); OS keychain; the real multi-user server session/credential backends (the ports make these drop-in).

## 10. Build order

1. Ports: `SessionPort`, `CredentialStorePort`, `SessionStatus`, `VaultLockedError` (pure, in core).
2. Crypto module in the adapter (`apps/web/src/server/vault/crypto.ts`, uses `node:crypto`): scrypt KDF + AES-256-GCM encrypt/decrypt + verifier helpers, with round-trip + wrong-key unit tests. (Not in core — it needs `node:crypto`; core holds only the port interfaces + `VaultLockedError` + `SessionStatus`.)
3. Local vault adapter: on-disk `vault.enc` + in-memory unlocked state implementing both ports; adapter tests.
4. Server actions (`setupVault`/`unlockVault`/`lockVault`) + tests.
5. UI: `/vault/setup`, `/unlock`, the sidebar Lock/Log-out control, the status gate in the shell/layout.
6. Verify: gate green + Playwright drive (setup → store a secret → logout → unlock).
