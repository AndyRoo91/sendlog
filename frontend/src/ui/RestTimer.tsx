import { useCallback, useEffect, useState } from "react";
import { onKey } from "../lib/a11y";

/** Rest-between-burns countdown. Tap a preset (3/4/5 min) to start; the chip
 *  row collapses into a big mm:ss readout with a draining progress bar. At zero
 *  it buzzes and flips to a "REST OVER" state until tapped. Fully self-contained
 *  — owns its own interval keyed off a target end-timestamp, so it survives the
 *  parent's re-renders and stays accurate even if a tick is dropped. */
const PRESETS = [3, 4, 5] as const; // minutes

function mmss(secs: number): string {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function RestTimer() {
  const [totalSecs, setTotalSecs] = useState(0);     // chosen duration (0 = idle)
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        // Flip to "done" and buzz exactly once — the updater only fires the
        // haptic on the false→true transition, so repeat ticks are harmless.
        setDone((prev) => {
          if (!prev && typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([120, 80, 120]);
          }
          return true;
        });
      }
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [endsAt]);

  const start = useCallback((mins: number) => {
    setDone(false);
    setTotalSecs(mins * 60);
    setEndsAt(Date.now() + mins * 60 * 1000);
  }, []);

  const reset = useCallback(() => {
    setDone(false);
    setEndsAt(null);
    setTotalSecs(0);
    setRemaining(0);
  }, []);

  // Idle — show the preset chips.
  if (endsAt === null) {
    return (
      <div style={{ marginTop: 14 }}>
        <div style={{ fontFamily: "var(--font-banner)", fontSize: 11, color: "var(--ink-2)", letterSpacing: "0.1em", marginBottom: 8 }}>
          ⏱ REST BETWEEN BURNS
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {PRESETS.map((m) => (
            <div key={m} role="button" tabIndex={0} aria-label={`Rest ${m} minutes`} className="chunky"
              onClick={() => start(m)} onKeyDown={onKey(() => start(m))}
              style={{
                flex: 1, textAlign: "center", padding: "8px 0",
                fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.06em",
                background: "var(--cream)", color: "var(--ink)", boxShadow: "2px 2px 0 var(--ink)",
              }}>
              {m}:00
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Running or finished — one big tappable readout.
  const pct = totalSecs > 0 ? Math.max(0, Math.min(1, remaining / totalSecs)) : 0;
  return (
    <div role="button" tabIndex={0}
      aria-label={done ? "Rest over — tap to clear" : "Resting — tap to cancel"}
      onClick={() => reset()} onKeyDown={onKey(() => reset())}
      style={{
        marginTop: 14, cursor: "pointer", position: "relative", overflow: "hidden",
        border: "var(--b) solid var(--ink)",
        boxShadow: done ? "3px 3px 0 var(--sea)" : "3px 3px 0 var(--ink)",
        background: done ? "var(--sea)" : "var(--ink)",
        color: "var(--cream)", padding: "10px 14px",
        animation: done ? "sendlog-rest-done 0.6s steps(2) 4" : undefined,
      }}>
      {/* Draining progress bar (only while counting down). */}
      {!done && (
        <div aria-hidden style={{
          position: "absolute", inset: 0, transformOrigin: "left",
          transform: `scaleX(${pct})`, background: "rgba(232,168,59,0.22)",
          transition: "transform 0.25s steps(3, end)", pointerEvents: "none",
        }} />
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.08em", color: done ? "var(--cream)" : "var(--mustard)" }}>
          {done ? "⏱ REST OVER · SEND IT" : "⏱ RESTING"}
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 26, lineHeight: 1 }}>
          {done ? "GO!" : mmss(remaining)}
        </span>
        <span aria-hidden style={{ fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.06em", opacity: 0.7 }}>
          TAP TO {done ? "CLEAR" : "CANCEL"}
        </span>
      </div>
    </div>
  );
}
