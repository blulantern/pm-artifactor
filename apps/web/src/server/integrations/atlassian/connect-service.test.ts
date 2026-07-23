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
    String(url).endsWith("/oauth/token")
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
    String(url).endsWith("/oauth/token")
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
    String(url).endsWith("/oauth/token")
      ? jsonRes({ access_token: "at-1", refresh_token: "rt-1", expires_in: 3600, scope: "" })
      : jsonRes([{ id: "cloud-1", url: "https://blulantern.atlassian.net", name: "blulantern" }]),
  );
  await completeConnect(prisma, "code-1", state, { fetchImpl: fetchImpl as unknown as typeof fetch, now: () => NOW });

  await disconnect(prisma, "cloud-1");
  expect(await readConnection("cloud-1")).toBeNull();
  expect(Object.values(prisma._tables.syncConnections)).toHaveLength(0);
});
