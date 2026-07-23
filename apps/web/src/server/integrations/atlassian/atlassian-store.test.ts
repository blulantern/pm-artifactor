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
