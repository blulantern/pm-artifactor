import { Card, Chip, Kpi } from "./primitives.js";
import { emailKindMeta, timeAgo } from "./format.js";
import type { getInboxView } from "@/server/view-models";

type InboxViewModel = Awaited<ReturnType<typeof getInboxView>>;

/** Kind buckets shown as count cards, in the POC's display order. */
const KIND_ORDER: [string, string][] = [
  ["needs_reply", "Needs reply"],
  ["decision", "Decisions"],
  ["risk", "Risks"],
  ["fyi", "FYI"],
];

function EmailRow({ email }: { email: InboxViewModel["emails"][number] }) {
  const [color, label] = emailKindMeta(email.kind);
  return (
    <div
      className="row"
      style={{ display: "flex", gap: 12, alignItems: "start", padding: "13px 16px", borderBottom: "1px solid var(--line)" }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color,
          background: `${color}18`,
          padding: "3px 8px",
          borderRadius: 6,
          flex: "none",
          minWidth: 78,
          textAlign: "center",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, lineHeight: 1.4 }}>{email.snippet}</div>
        <div className="mono" style={{ fontSize: 10, color: "var(--faint)", marginTop: 3 }}>
          {email.from}
          {email.linkLabel ? ` · linked to ${email.linkLabel}` : ""}
        </div>
      </div>
      {email.kind === "needs_reply" ? <button className="ghost">Draft reply</button> : null}
    </div>
  );
}

export function Inbox({ view }: { view: InboxViewModel }) {
  const newest = view.emails[0]?.receivedAt ?? null;

  return (
    <div className="view" style={{ maxWidth: 860 }}>
      <div className="h1">Inbox</div>
      <div className="sub" style={{ margin: "3px 0 16px" }}>
        Email pulled read-only and turned into signal every 2 hours — action items, decisions, and risks, linked to
        the work they touch. Nothing auto-sends.
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        {KIND_ORDER.map(([kind, label]) => {
          const [color] = emailKindMeta(kind);
          const count = view.emails.filter((e) => (e.kind ?? "fyi") === kind).length;
          return <Kpi key={kind} value={count} label={label} color={color} />;
        })}
      </div>

      <Card style={{ overflow: "hidden" }}>
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div className="h2">
            Digest · {view.emails.length} pulled{newest ? ` · newest ${timeAgo(newest)}` : ""}
          </div>
          <Chip style={{ background: "var(--share-bg)", color: "var(--teal)" }}>{view.unreadCount} unread</Chip>
        </div>
        {view.emails.length > 0 ? (
          view.emails.map((e) => <EmailRow key={e.id} email={e} />)
        ) : (
          <div className="sub" style={{ padding: 16 }}>
            No email connected yet.
          </div>
        )}
      </Card>
    </div>
  );
}
