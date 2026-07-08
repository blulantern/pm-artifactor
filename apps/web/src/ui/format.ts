export const initials = (n: string): string =>
  n.split(" ").map((w) => w[0]).slice(0, 2).join("");

export const healthColor = (h: number): string =>
  h >= 75 ? "var(--win)" : h >= 60 ? "var(--amber)" : "var(--flag)";

export const URGENCY_COLOR: Record<string, string> = {
  high: "var(--flag)", med: "var(--amber)", low: "var(--faint)",
};

export const EMAIL_KIND: Record<string, [string, string]> = {
  needs_reply: ["var(--flag)", "Needs reply"],
  decision: ["var(--violet)", "Decision"],
  risk: ["var(--amber)", "Risk"],
  fyi: ["var(--faint)", "FYI"],
};

/** Badge color+label for an email's kind, falling back to the neutral FYI styling for unclassified mail. */
export const emailKindMeta = (kind: string | null): [string, string] =>
  EMAIL_KIND[kind ?? "fyi"] ?? (EMAIL_KIND.fyi as [string, string]);

/** Coarse relative-time label for a past Date — used where we display real pull/receipt timestamps. */
export function timeAgo(d: Date | null | undefined): string {
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
