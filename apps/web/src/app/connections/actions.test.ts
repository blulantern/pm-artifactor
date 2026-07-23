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
