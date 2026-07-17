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
