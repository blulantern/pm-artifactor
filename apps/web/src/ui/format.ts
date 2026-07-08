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
