import type { CSSProperties, ReactNode } from "react";
import { healthColor, initials } from "./format.js";

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="card" style={style}>
      {children}
    </div>
  );
}

export function Panel({
  title,
  sub,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div className="h2">{title}</div>
        {sub ? (
          <div
            style={{
              fontSize: 10,
              color: "var(--faint)",
              maxWidth: 210,
              textAlign: "right",
              lineHeight: 1.3,
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function Chip({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span className="chip" style={style}>
      {children}
    </span>
  );
}

export function Tag({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span className="tag" style={style}>
      {children}
    </span>
  );
}

export function Kpi({
  value,
  label,
  color,
}: {
  value: ReactNode;
  label: ReactNode;
  color?: string;
}) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="kpi" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="sub">{label}</div>
    </div>
  );
}

export function Bars({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ height: 8, background: "var(--bg)", borderRadius: 5, overflow: "hidden" }}>
      <div
        className="bar"
        style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 5 }}
      />
    </div>
  );
}

export function Spark({ points, color }: { points: number[]; color?: string }) {
  const mx = Math.max(...points);
  const width = 8 + points.length * 20;
  const pts = points.map((v, i) => `${8 + i * 20},${34 - (v / mx) * 24}`).join(" ");
  return (
    <svg width={width} height={38}>
      <polyline
        className="spark"
        points={pts}
        fill="none"
        stroke={color || "var(--teal2)"}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HealthDot({ health }: { health: number }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: healthColor(health),
        display: "inline-block",
      }}
    />
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.35) }}
    >
      {initials(name)}
    </div>
  );
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="eyebrow" style={style}>
      {children}
    </div>
  );
}
