/**
 * Atlassian OAuth 2.0 (3LO) HTTP client. Endpoints verified against
 * developer.atlassian.com on 2026-07-16. Confidential client (client_secret),
 * so no PKCE — the 3LO guide documents only this flow.
 *
 * `fetch` and `now` are injected so the suite never touches the network.
 */

export const ATLASSIAN_AUTHORIZE_URL = "https://auth.atlassian.com/authorize";
export const ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token";
export const ATLASSIAN_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources";

/** An app registers exactly ONE callback URL, so dev must run on :3000. */
export const ATLASSIAN_REDIRECT_URI = "http://localhost:3000/api/atlassian/callback";

/**
 * Classic scopes (Atlassian recommends classic over granular), all read-only.
 * Covers B1-B3 so sync does not force a re-consent. read:jira-user is
 * deliberately absent until the People work needs it.
 */
export const ATLASSIAN_SCOPES: readonly string[] = [
  "offline_access",
  "read:jira-work",
  "read:confluence-space.summary",
  "read:confluence-content.summary",
];

export type FetchLike = typeof fetch;

export interface OAuthDeps {
  fetchImpl?: FetchLike;
  now?: () => number;
}

export interface TokenSet {
  access: string;
  refresh: string;
  /** Absolute epoch ms, computed once at receipt from expires_in. */
  expiresAt: number;
  scopes: string[];
}

export interface AccessibleSite {
  cloudId: string;
  siteUrl: string;
  siteName: string;
}

export class AtlassianOAuthError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** The OAuth2 `error` code from the response body (e.g. "invalid_grant"), when present. */
    readonly oauthError?: string,
  ) {
    super(message);
    this.name = "AtlassianOAuthError";
  }
}

export function authorizeUrl(clientId: string, state: string): string {
  const p = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: clientId,
    scope: ATLASSIAN_SCOPES.join(" "),
    redirect_uri: ATLASSIAN_REDIRECT_URI,
    state,
    response_type: "code",
    prompt: "consent",
  });
  return `${ATLASSIAN_AUTHORIZE_URL}?${p.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

async function postToken(body: Record<string, string>, deps: OAuthDeps): Promise<TokenSet> {
  const doFetch = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const res = await doFetch(ATLASSIAN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let oauthError: string | undefined;
    try {
      oauthError = ((await res.json()) as { error?: string })?.error;
    } catch {
      // Non-JSON error body (e.g. a 5xx HTML page) — leave oauthError undefined; treated as transient.
    }
    throw new AtlassianOAuthError(`atlassian token request failed (${res.status})`, res.status, oauthError);
  }
  const j = (await res.json()) as TokenResponse;
  if (!j.access_token || !j.refresh_token) {
    throw new AtlassianOAuthError("atlassian token response missing access or refresh token");
  }
  return {
    access: j.access_token,
    refresh: j.refresh_token,
    expiresAt: now() + (j.expires_in ?? 0) * 1000,
    scopes: (j.scope ?? "").split(" ").filter(Boolean),
  };
}

export function exchangeCode(
  a: { clientId: string; clientSecret: string; code: string },
  deps: OAuthDeps = {},
): Promise<TokenSet> {
  return postToken(
    {
      grant_type: "authorization_code",
      client_id: a.clientId,
      client_secret: a.clientSecret,
      code: a.code,
      redirect_uri: ATLASSIAN_REDIRECT_URI,
    },
    deps,
  );
}

export function refreshTokens(
  a: { clientId: string; clientSecret: string; refresh: string },
  deps: OAuthDeps = {},
): Promise<TokenSet> {
  return postToken(
    {
      grant_type: "refresh_token",
      client_id: a.clientId,
      client_secret: a.clientSecret,
      refresh_token: a.refresh,
    },
    deps,
  );
}

interface ResourceRow {
  id: string;
  url: string;
  name: string;
}

export async function fetchAccessibleSites(access: string, deps: OAuthDeps = {}): Promise<AccessibleSite[]> {
  const doFetch = deps.fetchImpl ?? fetch;
  const res = await doFetch(ATLASSIAN_RESOURCES_URL, {
    headers: { Authorization: `Bearer ${access}`, Accept: "application/json" },
  });
  if (!res.ok) throw new AtlassianOAuthError(`accessible-resources failed (${res.status})`, res.status);
  const rows = (await res.json()) as ResourceRow[];
  return rows.map((r) => ({ cloudId: r.id, siteUrl: r.url, siteName: r.name }));
}
