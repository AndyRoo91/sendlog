import { onKey } from "../lib/a11y";

interface Props {
  grade: string;
  style: string;
  color: string;
  text?: string;
  tilt?: number;
  onClick?: () => void;
}

/** One-tap-repeat chip for the recents strip. */
export default function RecentChip({ grade, style, color, text = "var(--cream)", tilt = 0, onClick }: Props) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `Repeat ${grade} ${style}` : undefined}
      onClick={onClick}
      onKeyDown={onClick ? onKey(onClick) : undefined}
      style={{
        flex: 1,
        minWidth: 0,
        border: "var(--bw) solid var(--ink)",
        background: color,
        color: text,
        boxShadow: "3px 3px 0 var(--ink)",
        padding: "8px 10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        transform: `rotate(${tilt}deg)`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>{grade}</span>
        <span style={{ fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.08em", marginTop: 2 }}>{style}</span>
      </div>
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--cream)",
          color: "var(--ink)",
          border: "var(--b) solid var(--ink)",
          fontFamily: "var(--font-display)",
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        +1
      </div>
    </div>
  );
}
