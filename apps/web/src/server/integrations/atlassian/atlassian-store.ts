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
