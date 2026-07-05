import { useEffect, useState } from "react";
import { onKey } from "../lib/a11y";
import Ray from "./Ray";
import type { Achievement } from "../api/client";

interface Props {
  queue: Achievement[];
  onDone: () => void;
  holdMs?: number;
}

/** Larger celebratory overlay shown when an achievement is unlocked.
 *  Pops one card at a time from `queue`; tap or wait `holdMs` to advance. */
export default function AchievementOverlay({ queue, onDone, holdMs = 2200 }: Props) {
  const [visible, setVisible] = useState(false);
  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    setVisible(true);
    // Long pulse for unlocks.
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([80, 60, 80, 60, 140]);
    }
    const fade = setTimeout(() => setVisible(false), holdMs);
    const advance = setTimeout(onDone, holdMs + 200);
    return () => { clearTimeout(fade); clearTimeout(advance); };
  }, [current, holdMs, onDone]);

  if (!current) return null;

  const dismiss = () => { setVisible(false); onDone(); };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Dismiss achievement"
      onClick={dismiss}
      onKeyDown={onKey(dismiss)}
      style={{
        position: "fixed", inset: 0, zIndex: 110,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 12, background: "rgba(26,22,18,0.35)",
        opacity: visible ? 1 : 0, transition: "opacity 180ms steps(3, end)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div className="boil-frame" style={{
        background: "var(--red)", color: "var(--cream)",
        padding: "6px 16px", fontFamily: "var(--font-banner)", fontSize: 14,
        letterSpacing: "0.16em", border: "var(--bw) solid transparent",
        boxShadow: "3px 3px 0 var(--ink)", transform: "rotate(-1.5deg)",
      }}>
        ★ ACHIEVEMENT UNLOCKED ★
      </div>

      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Ray size={340} color="var(--mustard)" />
        <div
          className="boil-frame boil-frame-round"
          style={{
            position: "absolute", width: 160, height: 160, borderRadius: "50%",
            background: "var(--cream)", border: "var(--bw) solid transparent",
            boxShadow: "6px 6px 0 var(--ink)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 72, lineHeight: 1,
            transform: visible ? "scale(1) rotate(-3deg)" : "scale(0.4) rotate(-3deg)",
            transition: "transform 220ms steps(3, end)",
          }}
        >
          {current.emoji}
        </div>
      </div>

      <div className="boil-frame" style={{
        background: "var(--ink)", color: "var(--mustard)",
        padding: "8px 18px", fontFamily: "var(--font-display)", fontSize: 26,
        border: "var(--bw) solid transparent", transform: "rotate(1.5deg)",
        boxShadow: "4px 4px 0 var(--red)", letterSpacing: "0.03em", textAlign: "center",
      }}>
        {current.title}
      </div>
      <div style={{
        fontFamily: "var(--font-hand)", fontSize: 17, color: "var(--cream)",
        background: "var(--ink-2)", padding: "4px 12px", transform: "rotate(-0.8deg)",
        maxWidth: 280, textAlign: "center",
      }}>
        {current.description}
      </div>
      {queue.length > 1 && (
        <div style={{
          fontFamily: "var(--font-banner)", fontSize: 10, color: "var(--cream)",
          letterSpacing: "0.08em", opacity: 0.8, marginTop: 6,
        }}>
          +{queue.length - 1} MORE — TAP TO CONTINUE
        </div>
      )}
    </div>
  );
}
