interface Props {
  where?: string;
  elapsed?: string;
  date?: string;
}

/** Sticky ink top header showing location + elapsed timer. */
export default function SessionStrip({ where = "BLOC SHOP", elapsed = "47:23", date = "TUE · 26 MAY" }: Props) {
  return (
    <div
      className="torn-bottom"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 16px 12px",
        background: "var(--ink)",
        color: "var(--cream)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontFamily: "var(--font-banner)", fontSize: 11, color: "var(--mustard)", letterSpacing: "0.1em" }}>
          ★ SESSION IN PROGRESS
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: "0.02em" }}>{where}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        <div style={{ fontFamily: "var(--font-banner)", fontSize: 10, color: "var(--paper)", opacity: 0.6, letterSpacing: "0.1em" }}>
          {date}
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--cream)", fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>
          {elapsed}
        </div>
      </div>
    </div>
  );
}
