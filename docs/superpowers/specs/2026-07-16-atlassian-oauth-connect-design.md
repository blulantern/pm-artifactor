# Atlassian OAuth Connect (Spec B1) — Design Spec

**Date:** 2026-07-16
**Status:** Approved (design), pending spec review
**Builds on:** the Session & Credential Foundation (`2026-07-15-session-credential-foundation-design.md`, merged to `main` at `7427d45`).
**Enables:** B2 (container discovery + manual mapping), B3 (read-only inbound sync), B4 (onboarding wizard).
**Target repo:** `/home/jfox/Projects/pm-artifactor/pm-artifactor` (git, `main`)

---

## 1. Purpose & scope

Connect the app to a real Atlassian Cloud site over OAuth 2.0 (3LO), keep the resulting tokens
encrypted in the vault, and keep them alive across rotation. This is the first slice of Spec B; the
original Spec B (connect + discover + map + sync + wizard) was decomposed because each piece is an
independent subsystem with its own failure modes.

- **In scope:** the 3LO authorization-code flow; token exchange; site selection via
  `accessible-resources`; tokens + client secret encrypted in the vault; rotating-refresh handling;
  connection state on `/connections`; **disconnect**.
- **Out of scope (later slices):** listing Jira projects / Confluence spaces (B2); mapping external
  containers → Project/Product/Program (B2); inbound sync of issues/pages (B3); the onboarding
  wizard (B4); any write back to Atlassian (**permanently** out of scope — read-only ingestion).

### Approved decisions (from brainstorming)

1. **Slice B1 only** — OAuth connect is the hard prerequisite for B2/B3/B4.
2. **Two `SyncConnection` rows share one token.** One consent → one token blob in the vault under a
   single `authRef` → a `vendor=jira` row and a `vendor=confluence` row both referencing it. No
   schema change; B2/B3 stay per-product (Jira and Confluence sync are genuinely different code).
   **Invariant:** the shared `authRef` means disconnecting revokes both.
3. **Client secret lives in the vault**, with the tokens. The user registers the OAuth app under
   their own Atlassian account, so the secret is genuinely their credential — not a shared secret
   baked into a distributed binary. Honors the no-plaintext red line. **Consequence:** connect and
   refresh require an unlocked vault; a locked vault pauses integrations (accepted deliberately).
4. **Classic scopes, all read-only** — Atlassian recommends classic over granular for both products.
5. **Callback pinned to port 3000** — an app registers exactly one callback URL.

---

## 2. Non-negotiable principles (inherited)

- **Core purity:** `packages/core` imports zero infra. The OAuth client speaks HTTP, so it lives
  under `apps/web/src/server/`. Only pure decidable logic (token expiry, connection state) goes in
  core. Dependency-cruiser enforced.
- **Read-only ingestion:** the app never writes back to Atlassian. No write scopes are requested.
- **Secrets never in SQLite/plaintext:** tokens and the client secret exist only as ciphertext in
  `vault.enc`; `SyncConnection.authRef` stores a *reference*, never the token. Secret values are
  never returned to the browser.
- **The gate** (`pnpm -w run test:all`) stays green; conventional commits; no `Co-Authored-By`
  trailer.

---

## 3. Prerequisite — the OAuth app registration (user-performed)

Live 3LO requires an OAuth 2.0 app registered at `developer.atlassian.com` under the user's
Atlassian account. **Claude cannot do this step** (it requires logging in as the user; account
creation and credential entry are out of bounds). Everything else is buildable and testable against
a fake token endpoint without it, so this is not a blocker to starting.

The user performs, once:

| Field | Value |
|---|---|
| App type | OAuth 2.0 integration (3LO) |
| Callback URL | `http://localhost:3000/api/atlassian/callback` |
| Scopes | `offline_access`, `read:jira-work`, `read:confluence-space.summary`, `read:confluence-content.summary` |

That scope set covers B1–B3, so sync will not force a re-consent. `read:jira-user` is deliberately
excluded until the People sub-project needs it. The console then issues a **client ID + client
secret**; the user enters both **in the app, on `/connections`** — a write-only server action
mirroring the AI-keys pattern (`/settings` stays the AI-provider surface; integration credentials
belong with the integration). The secret is never pasted into chat, never logged, never rendered;
the view exposes presence only, never values.

## 4. Architecture

```
apps/web/src/server/integrations/atlassian/
  oauth-client.ts     # authorize URL, code→token exchange, refresh (HTTP; injectable fetch)
  atlassian-store.ts  # vault-backed token read/write + single-flight refresh
  connect-service.ts  # orchestration: state, exchange, site selection, SyncConnection rows
packages/core/src/domain/integrations/
  connection-state.ts # PURE: isExpired(expiresAt, now, skew), connectionState(...)
apps/web/src/app/api/atlassian/callback/route.ts   # redirect target (Route Handler)
apps/web/src/app/connections/actions.ts            # startConnect / selectSite / disconnect
```

**Endpoints** (verified against Atlassian docs, 2026-07-16):

- Authorize: `https://auth.atlassian.com/authorize`
- Token: `https://auth.atlassian.com/oauth/token`
- Sites: `GET https://api.atlassian.com/oauth/token/accessible-resources`

**No PKCE.** The 3LO guide documents only the confidential-client flow with `client_secret`, which
is what we are. CSRF is handled by `state`.

## 5. The flow

1. `/connections` → **Connect Atlassian** (server action). Requires an unlocked vault and a stored
   client ID/secret; otherwise the UI says which is missing.
2. Generate a random `state` (32 bytes, base64url), hold it on `globalThis` with a **10-minute TTL**
   (Next compiles server actions and RSC into separate module layers, so a module-level map is
   instantiated more than once per process — the Spec A lesson), redirect to the authorize URL.
   `state` is single-use: consumed on callback, whether or not the exchange succeeds.
3. The user consents in their own browser (their Atlassian/Google login — never automated).
4. Atlassian redirects to `/api/atlassian/callback?code=…&state=…`. The handler rejects a missing,
   unknown, or expired `state` before touching the code.
5. Exchange the code for `{ access_token, refresh_token, expires_in, scope }`.
6. `GET accessible-resources` → the sites this grant reaches. Present them; the user picks one.
   (Exactly one site → auto-select. More sites are added by connecting again.)
7. Write the token blob to the vault under `atlassian:<cloudId>`; upsert `ExternalSystem`
   (`vendor=jira`, `vendor=confluence`, `baseUrl` = site URL) and one `SyncConnection` each, both
   with `authRef = "atlassian:<cloudId>"`, `direction = "inbound"`.

**Vault entries:**

| Name | Value (JSON, encrypted) |
|---|---|
| `atlassian:client` | `{ clientId, clientSecret }` |
| `atlassian:<cloudId>` | `{ access, refresh, expiresAt, scopes, siteUrl, siteName }` |

## 6. Token refresh — rotation is the hazard

Atlassian issues **rotating** refresh tokens: every refresh returns a new refresh token and
**invalidates the one just used** (10-minute reuse leeway for breach detection; 90-day idle
expiry). Three rules follow, and they are the core of this spec:

1. **Persist before use.** Write the new token pair to the vault *before* using the new access
   token. A crash after refresh but before persist would otherwise leave a dead connection needing
   re-consent. This is why vault writes are atomic (tmp+rename).
2. **Single-flight.** At most one in-flight refresh per connection; concurrent callers await the
   same promise. Parallel refreshes burn the rotation and can trip replay/breach detection.
3. **Fail to `needs_reconsent`, don't retry.** If refresh is rejected, mark the connection and tell
   the user to reconnect. Retrying a rotated token is exactly what breach detection punishes.

Refresh is triggered lazily (on use), not by a timer: `isExpired(expiresAt, now, skew)` with a
**60-second** skew margin, so a token about to expire mid-request is refreshed first. `expiresAt` is
stored as epoch milliseconds, computed once at token receipt from `expires_in`.

## 7. UX

- `/connections` shows each Atlassian connection: site name, products (Jira/Confluence), state
  (`connected` / `expired` / `needs_reconsent`), and **Disconnect**. Never any token value.
- **Vault locked** → the connect affordance is disabled with "Unlock the vault to connect."
  **Vault unconfigured** → link to `/vault/setup` (connecting requires a configured vault, per
  Spec A decision 3).
- **Disconnect** removes the vault entry and the two `SyncConnection` rows. Once B2/B3 create
  `ExternalLink` rows, disconnect delegates to the existing `severLinks` seam so linked entities
  become `formerly_synced` rather than losing data — the provenance model already handles this.

## 8. Architecture placement

| Concern | Location |
|---|---|
| `isExpired`, `connectionState` (pure) | `packages/core/src/domain/integrations/` |
| OAuth HTTP, vault token store, single-flight refresh, orchestration | `apps/web/src/server/integrations/atlassian/` |
| Callback Route Handler | `apps/web/src/app/api/atlassian/callback/route.ts` |
| Connect/disconnect actions, connection UI | `apps/web/src/app/connections/`, `apps/web/src/ui/` |
| Token + client-secret storage | the Spec A vault (`CredentialStorePort`) |

## 9. Testing & verification

- **Pure (core):** expiry math incl. clock skew; connection-state transitions.
- **Adapter (fake token endpoint, injected fetch — no network in the suite):** code→token exchange;
  refresh persists the NEW refresh token and discards the old; single-flight (two concurrent
  refreshes ⇒ one token request); refresh failure ⇒ `needs_reconsent`; `state` mismatch/expiry
  rejected; locked vault ⇒ `VaultLockedError`.
- **Secret discipline:** assert no token/secret appears in `vault.enc` plaintext or in rendered HTML.
- **Live drive (with the user, after registration):** real consent → connected site shown →
  disconnect. The consent screen is the one thing fakes cannot prove.
- Full gate green; dependency-cruiser confirms core stays pure.

## 10. Explicitly deferred

- B2: list Jira projects / Confluence spaces; manual per-container mapping to Project/Product/Program.
- B3: read-only inbound sync of issues/pages onto the mapped containers.
- B4: the onboarding wizard that stitches B1–B3 into a first-run flow.
- Multi-site beyond "pick one site, connect again to add another"; token revocation at Atlassian on
  disconnect (we drop our copy); a distributed single-app-registration model (a bundled client
  secret isn't secret — that fork is taken deliberately if the app ever ships).

## 11. Build order

1. Pure core: `isExpired` + `connectionState` + tests.
2. `oauth-client.ts`: authorize URL builder, code exchange, refresh (injectable fetch) + tests.
3. `atlassian-store.ts`: vault-backed token read/write + single-flight refresh + tests.
4. Client ID/secret entry (write-only action) + vault wiring.
5. `connect-service.ts` + the callback Route Handler + `state` handling + tests.
6. `/connections` UI: connect, site picker, state, disconnect.
7. Verify: gate green + live drive with the user's registered app.
