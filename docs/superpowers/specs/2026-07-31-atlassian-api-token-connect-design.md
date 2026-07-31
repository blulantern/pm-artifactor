# Atlassian API-Token Connect (Spec B1b) — Design Spec

**Date:** 2026-07-31
**Status:** Approved (design), pending spec review
**Builds on:** Atlassian OAuth Connect (`2026-07-16-atlassian-oauth-connect-design.md`, merged to `main`) and the
Session & Credential Foundation vault (`2026-07-15-...`).
**Enables:** the same downstream slices as B1 — B2 (discovery + mapping), B3 (inbound sync) — for
connections made by either method.
**Target repo:** `/home/jfox/Projects/pm-artifactor/pm-artifactor` (git, `main`)

---

## 1. Purpose & scope

Add **Atlassian API-token authentication** as a second, simpler way to connect a site on
`/connections`, **alongside** the existing OAuth 3LO flow. An API token needs no developer-console
app, no client ID/secret, no callback, and no consent redirect: the user pastes their site, email,
and a token created at `id.atlassian.com`, and the site connects. This is the low-friction path for
the local single-user case; OAuth remains for the multi-user/shipping story.

- **In scope:** an API-token connect form; Basic-auth validation on save (confirm the token works,
  fetch the site's `cloudId`); storing the token connection in the vault; creating the same two
  `SyncConnection` rows (jira + confluence); showing the connection with its auth method; disconnect.
- **Out of scope (later slices, same as B1):** actually fetching Jira/Confluence data with the token
  (B2/B3); mapping external containers to Project/Product/Program (B2); the onboarding wizard (B4).
  Any write to Atlassian is **permanently** out of scope — read-only ingestion.

### Approved decisions (from brainstorming)

1. **Add alongside OAuth**, do not replace it. Mirrors the AI-layer philosophy: a low-friction path
   for personal use, the robust path kept for shipping. OAuth code is untouched.
2. **Same data model as OAuth.** One credential per site → one vault blob under `atlassian:<cloudId>`
   → two `SyncConnection` rows (`vendor=jira`, `vendor=confluence`) sharing that `authRef`,
   `direction="inbound"`. A site is connected once, by one method; reconnecting by the other replaces it.
3. **No refresh.** API tokens don't expire or rotate. A revoked token surfaces as a `401` at sync
   time (B3) and flags the connection for re-entry — until then a token connection reads `connected`.
4. **Validate before storing.** Nothing is written to the vault until the credentials authenticate.

### Accepted trade-off (named explicitly)

An Atlassian API token carries the **user's full account access (read AND write)**, unlike OAuth's
scope-limited read-only grant. The app never writes to Atlassian, but the *stored credential* is not
itself scope-restricted. It lives encrypted in the vault exactly like the OAuth tokens, is never
returned to the browser, never logged, and never placed in a URL. This breadth is the inherent cost
of the simpler flow; the user opted into it deliberately for the local single-user case.

---

## 2. Non-negotiable principles (inherited)

- **Core purity:** `packages/core` imports zero infra. Only the pure connection-state extension goes
  in core; all HTTP and vault access live under `apps/web/src/server`. Depcruise-enforced.
- **Read-only ingestion:** the app never writes to Atlassian. Validation uses read-only endpoints
  (`/rest/api/3/myself`, `/_edge/tenant_info`).
- **Secrets discipline (the red line):** the API token exists only as ciphertext in the vault;
  `SyncConnection.authRef` stores only the reference `atlassian:<cloudId>`. The token is never
  returned to the browser, never logged, never in a URL. The (non-secret) email and site may be shown.
- **The gate** (`pnpm -w run test:all`) stays green; conventional commits; no `Co-Authored-By` trailer.

---

## 3. What the user provides

Three fields on the API-token method of the `/connections` Atlassian card:

| Field | Example | Notes |
|---|---|---|
| Site | `blulantern.atlassian.net` (or `blulantern`) | Normalized (§4) to a full `https://<host>` origin. |
| Email | `jfox@blulantern.com` | The Atlassian account email; the Basic-auth username. |
| API token | (from `id.atlassian.com/manage-profile/security/api-tokens`) | The secret; write-only into the vault. |

On **Save**, the app validates immediately (§5) and, on success, the site appears connected. No
redirect, no second step.

## 4. Auth mechanism

- **Host normalization:** trim the input; strip any `https://`/`http://` scheme and any trailing
  path or slash; if the result contains no dot, append `.atlassian.net` (so `blulantern` →
  `blulantern.atlassian.net`); the origin is `https://<host>`. Reject an empty host.
- **Basic auth:** `Authorization: Basic base64("<email>:<apiToken>")`, addressed at the site origin.
- **Validate the token:** `GET https://<host>/rest/api/3/myself` — `200` confirms the credentials;
  `401`/`403` means rejected.
- **Fetch the cloudId:** `GET https://<host>/_edge/tenant_info` → `{ cloudId }`. The `cloudId` keys
  the connection so token and OAuth connections share the same identity space (and the same two-rows
  invariant). `siteName` is the host's first label (e.g. `blulantern`).

## 5. Flow

1. User fills Site / Email / API token → **Save** (a server action, synchronous — no redirect).
2. The action requires an unlocked vault, normalizes the host, and calls validate + tenant_info with
   an injected `fetchImpl`.
3. `401`/`403` → `{ ok:false, error:"Atlassian rejected these credentials." }`; a network/5xx error →
   a transient error message; neither writes anything.
4. On success: write the token blob to the vault under `atlassian:<cloudId>` (`kind:"api_token"`,
   `{ siteUrl, siteName, email, apiToken }` — no access/refresh/expiry) and upsert the two
   `SyncConnection` rows via the **existing** `upsertConnectionRows` (jira + confluence, shared
   `authRef`, `direction="inbound"`).

## 6. Connection state

A token connection has no expiry, so it is `connected` until a `401` at sync time (B3) sets a
`reconsentRequired`-equivalent flag. The pure `connectionState` in core is extended to accept the
connection `kind`: for `api_token`, return `needs_reconsent` when the flag is set, else `connected`
(the `expiresAt`/skew path is skipped — it doesn't apply). OAuth connections are unaffected.

## 7. Data model — `StoredConnection` gains a discriminant

`StoredConnection` (in `atlassian-store.ts`) becomes a discriminated union on `kind`:

```ts
type StoredConnection =
  | { kind: "oauth"; cloudId; siteUrl; siteName; access; refresh; expiresAt; scopes; reconsentRequired? }
  | { kind: "api_token"; cloudId; siteUrl; siteName; email; apiToken; reconsentRequired? };
```

Existing OAuth blobs written before this change have no `kind`; readers treat a missing `kind` as
`"oauth"` (backward compatible). The OAuth refresh path (`accessTokenFor`, single-flight, rotation)
is untouched and applies only to `kind:"oauth"`; token connections never enter it. A later slice
(B3) adds an `authHeaderFor(cloudId)` that branches on `kind` to produce either a Bearer (OAuth) or
Basic (token) header — out of scope here.

## 8. Architecture placement

| Concern | Location |
|---|---|
| `connectionState` extension for token connections (pure) | `packages/core/src/domain/integrations/connection-state.ts` |
| Basic-auth header + `validateApiToken` (HTTP; injected fetch) | `apps/web/src/server/integrations/atlassian/api-token-client.ts` (new) |
| `StoredConnection` union + token connection read/write | `apps/web/src/server/integrations/atlassian/atlassian-store.ts` |
| `saveAtlassianApiToken` server action | `apps/web/src/app/connections/actions.ts` |
| API-token method on the Atlassian card + method label per connection | `apps/web/src/ui/atlassian-card.tsx`, `apps/web/src/server/view-models.ts` |
| Token storage | the Spec A vault (`CredentialStorePort`) |

## 9. UX

The Atlassian card offers **two labeled methods**: "API token (simplest)" and "OAuth app". The
API-token method shows the three fields + Save, with a one-line pointer to
`id.atlassian.com/.../api-tokens`. Each connection in the list shows which method it used
(`API token` / `OAuth`) alongside its state. Disconnect works identically for both (reuses the
existing path). Vault-locked / unconfigured behaves as it already does for OAuth. Credentials remain
updatable/clearable (the fix already on `main`).

## 10. Testing & verification

- **Pure (core):** token-connection state — `connected` by default, `needs_reconsent` when flagged;
  OAuth path unchanged.
- **Client (fake fetch — no network in the suite):** the Basic-auth header is
  `base64(email:token)`; `validateApiToken` returns `{ cloudId, ... }` on `200`; `401`/`403` →
  typed error; the token never appears in a request URL.
- **Store:** a token connection round-trips; `listConnections` includes it with `kind`; a legacy
  no-`kind` blob reads as `oauth`; the on-disk `vault.enc` plaintext never contains the token.
- **Action:** `saveAtlassianApiToken` validates then creates the two rows; bad token → `{ok:false}`
  and nothing written; locked vault refused; the two rows share `authRef` and are `inbound`.
- **View:** a token connection shows with its method; no token value is serialized into the view.
- **Live drive (with the user):** create a token at `id.atlassian.com`, paste site/email/token,
  confirm the site connects and the two rows exist; disconnect. This is the check the fakes can't do.
- Full gate green; depcruise confirms core stays pure.

## 11. Explicitly deferred

- Using the token to fetch Jira issues / Confluence pages (B2/B3) — connect-only here.
- `authHeaderFor(cloudId)` branching Bearer vs Basic (B3).
- Token-expiry handling for the newer Atlassian expiring-token option (treated as static until a
  `401`); per-connection health polling.

## 12. Build order

1. Pure core: extend `connectionState` for token connections + tests.
2. `api-token-client.ts`: Basic-auth header + `validateApiToken` (injected fetch) + tests.
3. `atlassian-store.ts`: `StoredConnection` union + token read/write (+ legacy-blob compatibility) + tests.
4. `saveAtlassianApiToken` action + tests.
5. Card: the API-token method + per-connection method label; view-model surfaces `kind` + tests.
6. Verify: gate green + live drive with the user's real token.
