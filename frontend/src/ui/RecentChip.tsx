interface Props {
  grade: string;
  style: string;
  color: string;
  text?: string;
  onClick?: () => void;
}

/** One-tap-repeat chip for the recents strip. */
export default function RecentChip({ grade, style, color, text = "var(--cream)", onClick }: Props) {
  return (
    <div
      onClick={onClick}
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
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>{grade}</span>
        <span style={{ fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.08em", marginTop: 2 }}>{style}</span>
      </div>
      <div
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
