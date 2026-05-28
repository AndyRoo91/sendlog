import { useEffect, useState } from "react";
import Ray from "./Ray";
import { STYLE_BY_ID } from "./styleMap";
import type { StyleId } from "./styleMap";

export interface CommitTick {
  grade: string;
  styleId: StyleId;
  key: number;
  isNewMax?: boolean;
}

interface Props {
  tick: CommitTick | null;
  onDone: () => void;
  holdMs?: number;
}

const PHRASES = ["burned it!", "send city!", "filthy!", "money.", "boom.", "crushed it.", "yewww!", "too easy.", "get in!", "laps.", "cooked it.", "heaps good."];
const NEW_MAX_PHRASES = ["NEW MAX! 🔥", "fresh ceiling!", "limit crusher.", "that's a PB!", "uncharted grades!", "new territory!"];

/** ~600ms celebratory overlay: green tick, mustard rays, ink banner. */
export default function AfterCommitOverlay({ tick, onDone, holdMs = 400 }: Props) {
  const [visible, setVisible] = useState(false);
  const [phrase, setPhrase] = useState(PHRASES[0]);

  useEffect(() => {
    if (!tick) return;
    const pool = tick.isNewMax ? NEW_MAX_PHRASES : PHRASES;
    setPhrase(pool[Math.floor(Math.random() * pool.length)]);
    setVisible(true);
    const fadeOut = setTimeout(() => setVisible(false), 100 + holdMs);
    const done = setTimeout(onDone, 100 + holdMs + 100);
    return () => { clearTimeout(fadeOut); clearTimeout(done); };
  }, [tick, holdMs, onDone]);

  if (!tick) return null;

  const style = STYLE_BY_ID[tick.styleId];

  return (
    <div
      onClick={() => { setVisible(false); onDone(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 8, background: "rgba(26,22,18,0.12)",
        opacity: visible ? 1 : 0, transition: "opacity 100ms ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Ray size={300} color="var(--mustard)" />
        <div
          style={{
            position: "absolute", width: 130, height: 130, borderRadius: "50%",
            background: "var(--sea)", border: "var(--bw) solid var(--ink)",
            boxShadow: "5px 5px 0 var(--ink)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transform: visible ? "scale(1)" : "scale(0.6)", transition: "transform 140ms ease",
          }}
        >
          <svg width="70" height="70" viewBox="0 0 70 70" fill="none" stroke="var(--cream)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 36 L30 52 L58 18" />
          </svg>
        </div>
      </div>
      <div
        style={{
          background: "var(--ink)", color: "var(--mustard)",
          padding: "6px 14px", fontFamily: "var(--font-display)", fontSize: 22,
          border: "var(--bw) solid var(--ink)", transform: "rotate(-2deg)",
          boxShadow: "3px 3px 0 var(--red)", letterSpacing: "0.04em",
        }}
      >
        {tick.grade} · {style.label} ✓
      </div>
      <div style={{ fontFamily: "var(--font-hand)", fontSize: 16, color: "var(--red)", transform: "rotate(1deg)" }}>
        {phrase}
      </div>
    </div>
  );
}
