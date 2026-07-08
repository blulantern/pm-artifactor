import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

type NavItem = { v: string; ic: string; l: string; href: string; tag?: string };

const NAV_GROUPS: { head: string; items: NavItem[] }[] = [
  {
    head: "Command",
    items: [
      { v: "today", ic: "◉", l: "Today", href: "/", tag: "7" },
      { v: "inbox", ic: "✉", l: "Inbox", href: "/inbox", tag: "4" },
    ],
  },
  {
    head: "Manage",
    items: [
      { v: "portfolio", ic: "◆", l: "Portfolio", href: "/portfolio" },
      { v: "programs", ic: "◈", l: "Programs", href: "/programs", tag: "2" },
      { v: "projects", ic: "▤", l: "Projects", href: "/projects", tag: "3" },
      { v: "prioritize", ic: "⇅", l: "Prioritize", href: "/prioritize" },
    ],
  },
  {
    head: "Deliver",
    items: [
      { v: "releases", ic: "⛴", l: "Releases", href: "/releases" },
      { v: "dora", ic: "◗", l: "Deploy Health", href: "/deploy-health" },
    ],
  },
  {
    head: "People",
    items: [
      { v: "team", ic: "◇", l: "Team", href: "/team", tag: "4" },
      { v: "stakeholders", ic: "⌘", l: "Stakeholders", href: "/stakeholders", tag: "4" },
    ],
  },
  {
    head: "System",
    items: [
      { v: "intel", ic: "❖", l: "Intelligence", href: "/intelligence" },
      { v: "connections", ic: "⊚", l: "Connections", href: "/connections" },
      { v: "vault", ic: "⛁", l: "Vault", href: "/vault" },
    ],
  },
];

const navHeadStyle: CSSProperties = {
  fontFamily: "'IBM Plex Mono',monospace",
  fontSize: 9.5,
  letterSpacing: ".13em",
  textTransform: "uppercase",
  color: "#6f9c96",
  margin: "14px 10px 5px",
};

function NavGroup({ head, items, active }: { head: string; items: NavItem[]; active: string }) {
  return (
    <>
      <div style={navHeadStyle}>{head}</div>
      {items.map((n) => (
        <Link
          key={n.v}
          href={n.href}
          className={`nav${active === n.v ? " on" : ""}`}
          style={{ textDecoration: "none" }}
        >
          <span className="ic">{n.ic}</span>
          {n.l}
          {n.tag ? (
            <span
              className="tag"
              style={{ marginLeft: "auto", borderColor: "rgba(255,255,255,.18)", color: "#9fc7c1" }}
            >
              {n.tag}
            </span>
          ) : null}
        </Link>
      ))}
    </>
  );
}

export function Shell({
  active,
  crumb,
  children,
}: {
  active: string;
  crumb: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <div
        style={{
          width: 230,
          flex: "none",
          background: "linear-gradient(200deg,#0b3d39,#0f4f49)",
          display: "flex",
          flexDirection: "column",
          padding: "14px 11px",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "3px 5px" }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "rgba(255,255,255,.14)",
              border: "1px solid rgba(255,255,255,.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              color: "#fff",
            }}
          >
            A
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 14, lineHeight: 1 }}>PM Artifactor</div>
            <div className="mono" style={{ fontSize: 9, color: "#7fb5ad", letterSpacing: ".1em", marginTop: 2 }}>
              LOCAL · POC
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", marginTop: 4 }}>
          {NAV_GROUPS.map((g) => (
            <NavGroup key={g.head} head={g.head} items={g.items} active={active} />
          ))}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 10, marginTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              className="live"
              style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", flex: "none" }}
            />
            <div style={{ fontSize: 11, color: "#cddbd8", fontWeight: 600 }}>Local · encrypted</div>
          </div>
          <div className="mono" style={{ fontSize: 9.5, color: "#7fb5ad", marginTop: 3, paddingLeft: 15 }}>
            ~/PM-Vault · 4.1 MB
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            height: 54,
            flex: "none",
            background: "#fff",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            padding: "0 22px",
            gap: 12,
            position: "sticky",
            top: 0,
            zIndex: 5,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{crumb}</div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 9 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 600,
                color: "var(--teal)",
                background: "var(--share-bg)",
                padding: "5px 10px",
                borderRadius: 20,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--teal3)" }} />
              Read-only · offline-ready
            </span>
            <button className="ghost">↻ Enrich · 1h ago</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}
