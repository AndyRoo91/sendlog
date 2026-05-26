import type { CSSProperties, ReactNode } from "react";

interface Props {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}

/** Scroll-shaped banner with curled ends — for section headers. */
export default function Scroll({ children, color = "var(--mustard)", style = {} }: Props) {
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", ...style }}>
      <svg width="22" height="44" viewBox="0 0 22 44">
        <path d="M22 0 L8 0 Q0 0 0 12 L0 32 Q0 44 8 44 L22 44 Z" fill={color} stroke="var(--ink)" strokeWidth="2.5" />
        <circle cx="8" cy="22" r="5" fill="var(--cream)" stroke="var(--ink)" strokeWidth="2" />
      </svg>
      <div
        style={{
          background: color,
          borderTop: "2.5px solid var(--ink)",
          borderBottom: "2.5px solid var(--ink)",
          padding: "8px 16px",
          fontFamily: "var(--font-banner)",
          fontSize: 14,
          color: "var(--ink)",
          letterSpacing: "0.05em",
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </div>
      <svg width="22" height="44" viewBox="0 0 22 44">
        <path d="M0 0 L14 0 Q22 0 22 12 L22 32 Q22 44 14 44 L0 44 Z" fill={color} stroke="var(--ink)" strokeWidth="2.5" />
        <circle cx="14" cy="22" r="5" fill="var(--cream)" stroke="var(--ink)" strokeWidth="2" />
      </svg>
    </div>
  );
}
