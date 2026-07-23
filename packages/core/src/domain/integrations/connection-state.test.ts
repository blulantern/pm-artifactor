import { describe, expect, it } from "vitest";
import { isExpired, connectionState, CLOCK_SKEW_MS } from "./connection-state.js";

const NOW = 1_700_000_000_000;

describe("isExpired", () => {
  it("is false for a token well in the future", () => {
    expect(isExpired(NOW + 3_600_000, NOW)).toBe(false);
  });

  it("is true for a token already past", () => {
    expect(isExpired(NOW - 1, NOW)).toBe(true);
  });

  it("treats a token inside the skew margin as expired, so it refreshes before use", () => {
    expect(isExpired(NOW + 30_000, NOW)).toBe(true); // 30s < 60s skew
    expect(isExpired(NOW + CLOCK_SKEW_MS + 1_000, NOW)).toBe(false);
  });

  it("honors an explicit skew", () => {
    expect(isExpired(NOW + 30_000, NOW, 0)).toBe(false);
  });
});

describe("connectionState", () => {
  it("is connected when the token is live and refreshable", () => {
    expect(connectionState({ expiresAt: NOW + 3_600_000, hasRefresh: true }, NOW)).toBe("connected");
  });

  it("is expired — not dead — when the access token lapsed but a refresh token remains", () => {
    expect(connectionState({ expiresAt: NOW - 1, hasRefresh: true }, NOW)).toBe("expired");
  });

  it("needs reconsent when there is no refresh token", () => {
    expect(connectionState({ expiresAt: NOW + 3_600_000, hasRefresh: false }, NOW)).toBe("needs_reconsent");
  });

  it("needs reconsent when flagged, even if the token looks live", () => {
    expect(
      connectionState({ expiresAt: NOW + 3_600_000, hasRefresh: true, reconsentRequired: true }, NOW),
    ).toBe("needs_reconsent");
  });
});
