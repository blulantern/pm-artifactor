import { afterEach, beforeEach, expect, test, vi } from "vitest";
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

test("unlocked state is shared across module instances (Next compiles actions and RSC in separate layers)", async () => {
  await vaultSession.configure("correct-horse");
  expect(await vaultSession.status()).toBe("unlocked");
  vi.resetModules(); // simulate Next instantiating the module a second time
  const fresh = await import("./vault-store.js");
  expect(await fresh.vaultSession.status()).toBe("unlocked"); // was "locked" before the fix
});
