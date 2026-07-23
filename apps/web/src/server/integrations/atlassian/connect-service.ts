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
