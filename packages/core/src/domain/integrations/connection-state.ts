/**
 * Pure connection-state logic for external integrations. No infra: the adapter
 * supplies `now` so expiry is testable without a clock.
 */

export type ConnectionState = "connected" | "expired" | "needs_reconsent";

/** Refresh a token this close to expiry rather than risk it lapsing mid-request. */
export const CLOCK_SKEW_MS = 60_000;

export function isExpired(expiresAt: number, now: number, skewMs: number = CLOCK_SKEW_MS): boolean {
  return expiresAt - skewMs <= now;
}

export interface ConnectionSnapshot {
  expiresAt: number;
  hasRefresh: boolean;
  /** Set once a refresh has been rejected — rotation means retrying cannot help. */
  reconsentRequired?: boolean;
}

export function connectionState(
  snap: ConnectionSnapshot,
  now: number,
  skewMs: number = CLOCK_SKEW_MS,
): ConnectionState {
  if (snap.reconsentRequired || !snap.hasRefresh) return "needs_reconsent";
  return isExpired(snap.expiresAt, now, skewMs) ? "expired" : "connected";
}
