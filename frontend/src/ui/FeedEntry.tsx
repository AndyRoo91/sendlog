import { onKey } from "../lib/a11y";

interface Props {
  grade: string;
  style: string;
  color: string;
  text?: string;
  time?: string;
  tilt?: number;
  onClick?: () => void;
}

/** Logged-tick chip shown in the session feed strip. */
export default function FeedEntry({ grade, style, color, text = "var(--cream)", time, tilt = 0, onClick }: Props) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `Edit ${grade} ${style} tick` : undefined}
      onClick={onClick}
      onKeyDown={onClick ? onKey(onClick) : undefined}
      style={{
        border: "var(--b) solid var(--ink)",
        background: color,
        color: text,
        boxShadow: "3px 3px 0 var(--ink)",
        padding: "6px 9px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minWidth: 54,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        transform: `rotate(${tilt}deg)`,
      }}
    >
      <span style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: 1 }}>{grade}</span>
      <span style={{ fontFamily: "var(--font-banner)", fontSize: 9, letterSpacing: "0.08em", marginTop: 3 }}>{style}</span>
      {time && (
        <span style={{ fontFamily: "var(--font-banner)", fontSize: 8, opacity: 0.7, marginTop: 2 }}>{time}</span>
      )}
    </div>
  );
}
