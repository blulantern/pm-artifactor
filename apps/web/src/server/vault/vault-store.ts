import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
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
  // Write-then-rename: a crash mid-write must not leave a truncated vault. The file holds every
  // credential and there is no recovery path, and status() parses it on every request — so a
  // partial write would take down /unlock and /vault/setup too. The tmp file is 0600 as well, so
  // the ciphertext is never briefly world-readable.
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(f), { mode: 0o600 });
  renameSync(tmp, p);
}

// Process-level unlocked state — correct for local single-user (a multi-user server swaps this for
// a per-session store). Next compiles server actions and server components into separate module
// layers, so a module-level singleton is instantiated more than once per process. Hold the
// unlocked state on globalThis so every layer shares one vault session.
interface VaultState {
  key: Buffer | null;
  secrets: Record<string, string> | null;
}
const globalRef = globalThis as typeof globalThis & { __pmaVaultState?: VaultState };
const state: VaultState = (globalRef.__pmaVaultState ??= { key: null, secrets: null });

export const vaultSession: SessionPort = {
  async status(): Promise<SessionStatus> {
    if (!readVault()) return "unconfigured";
    return state.key && state.secrets ? "unlocked" : "locked";
  },
  async configure(passphrase: string): Promise<void> {
    if (readVault()) throw new Error("vault already configured");
    const kdf = newKdf();
    const k = deriveKey(passphrase, kdf);
    writeVault({ v: 1, kdf, verifier: makeVerifier(k), secrets: encrypt(k, JSON.stringify({})) });
    state.key = k;
    state.secrets = {};
  },
  async unlock(passphrase: string): Promise<boolean> {
    const f = readVault();
    if (!f) throw new Error("vault not configured");
    const k = deriveKey(passphrase, f.kdf);
    if (!checkVerifier(k, f.verifier)) return false;
    state.key = k;
    state.secrets = JSON.parse(decrypt(k, f.secrets)) as Record<string, string>;
    return true;
  },
  async lock(): Promise<void> {
    state.key?.fill(0);
    state.key = null;
    state.secrets = null;
  },
};

function requireUnlocked(): { k: Buffer; s: Record<string, string> } {
  if (!state.key || !state.secrets) throw new VaultLockedError();
  return { k: state.key, s: state.secrets };
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
