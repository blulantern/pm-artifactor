import { describe, expect, it, vi } from "vitest";
import {
  authorizeUrl,
  exchangeCode,
  refreshTokens,
  fetchAccessibleSites,
  AtlassianOAuthError,
  ATLASSIAN_SCOPES,
  ATLASSIAN_REDIRECT_URI,
} from "./oauth-client.js";

const NOW = 1_700_000_000_000;
const deps = (fetchImpl: typeof fetch) => ({ fetchImpl, now: () => NOW });

const jsonRes = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as unknown as Response;

describe("authorizeUrl", () => {
  it("requests exactly the read-only scopes, our redirect, and the state", () => {
    const u = new URL(authorizeUrl("client-abc", "state-xyz"));
    expect(u.origin + u.pathname).toBe("https://auth.atlassian.com/authorize");
    expect(u.searchParams.get("client_id")).toBe("client-abc");
    expect(u.searchParams.get("state")).toBe("state-xyz");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("audience")).toBe("api.atlassian.com");
    expect(u.searchParams.get("redirect_uri")).toBe(ATLASSIAN_REDIRECT_URI);
    expect(u.searchParams.get("scope")).toBe(ATLASSIAN_SCOPES.join(" "));
  });

  it("requests no write scopes — ingestion is read-only", () => {
    expect(ATLASSIAN_SCOPES.some((s) => s.startsWith("write:") || s.startsWith("manage:"))).toBe(false);
  });
});

describe("exchangeCode", () => {
  it("posts the code and returns a token set with an absolute expiry", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ access_token: "at-1", refresh_token: "rt-1", expires_in: 3600, scope: "read:jira-work offline_access" }),
    );
    const t = await exchangeCode(
      { clientId: "cid", clientSecret: "csec", code: "code-1" },
      deps(fetchImpl as unknown as typeof fetch),
    );
    expect(t).toEqual({
      access: "at-1",
      refresh: "rt-1",
      expiresAt: NOW + 3_600_000,
      scopes: ["read:jira-work", "offline_access"],
    });
    const [url, init] = (fetchImpl.mock.calls[0] as unknown) as [string, RequestInit];
    expect(url).toBe("https://auth.atlassian.com/oauth/token");
    expect(JSON.parse(init.body as string)).toEqual({
      grant_type: "authorization_code",
      client_id: "cid",
      client_secret: "csec",
      code: "code-1",
      redirect_uri: ATLASSIAN_REDIRECT_URI,
    });
  });

  it("throws AtlassianOAuthError carrying the status on rejection", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ error: "invalid_grant" }, false, 400));
    await expect(
      exchangeCode({ clientId: "cid", clientSecret: "csec", code: "bad" }, deps(fetchImpl as unknown as typeof fetch)),
    ).rejects.toBeInstanceOf(AtlassianOAuthError);
  });

  it("never puts the client secret in the URL", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ access_token: "a", refresh_token: "r", expires_in: 60, scope: "" }));
    await exchangeCode({ clientId: "cid", clientSecret: "top-secret", code: "c" }, deps(fetchImpl as unknown as typeof fetch));
    const [url] = (fetchImpl.mock.calls[0] as unknown) as [string];
    expect(url).not.toContain("top-secret");
  });
});

describe("refreshTokens", () => {
  it("posts the refresh grant and returns the rotated pair", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ access_token: "at-2", refresh_token: "rt-2", expires_in: 3600, scope: "read:jira-work" }),
    );
    const t = await refreshTokens(
      { clientId: "cid", clientSecret: "csec", refresh: "rt-1" },
      deps(fetchImpl as unknown as typeof fetch),
    );
    expect(t.access).toBe("at-2");
    expect(t.refresh).toBe("rt-2"); // rotation: a NEW refresh token
    const [, init] = (fetchImpl.mock.calls[0] as unknown) as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      grant_type: "refresh_token",
      client_id: "cid",
      client_secret: "csec",
      refresh_token: "rt-1",
    });
  });
});

describe("fetchAccessibleSites", () => {
  it("maps the resource list to cloudId/url/name", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes([
        { id: "cloud-1", url: "https://blulantern.atlassian.net", name: "blulantern", scopes: [] },
        { id: "cloud-2", url: "https://other.atlassian.net", name: "other", scopes: [] },
      ]),
    );
    const sites = await fetchAccessibleSites("at-1", deps(fetchImpl as unknown as typeof fetch));
    expect(sites).toEqual([
      { cloudId: "cloud-1", siteUrl: "https://blulantern.atlassian.net", siteName: "blulantern" },
      { cloudId: "cloud-2", siteUrl: "https://other.atlassian.net", siteName: "other" },
    ]);
    const [url, init] = (fetchImpl.mock.calls[0] as unknown) as [string, RequestInit];
    expect(url).toBe("https://api.atlassian.com/oauth/token/accessible-resources");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer at-1");
  });
});
