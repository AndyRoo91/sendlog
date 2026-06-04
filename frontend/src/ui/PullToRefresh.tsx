import type { PullPhase } from "../lib/usePullToRefresh";

interface Props {
  distance: number;
  phase: PullPhase;
  threshold: number;
}

/** Fixed banner that drops in from the top edge as the user pulls. Tracks the
 *  live pull distance, snaps to a spinning state while refreshing, and reads as
 *  part of the zine system (ink banner, mustard type). Render it once near the
 *  top of a page that uses `usePullToRefresh`. */
export default function PullToRefresh({ distance, phase, threshold }: Props) {
  if (phase === "idle") return null;
  const progress = Math.min(distance / threshold, 1);
  const spinning = phase === "refreshing";
  const label =
    phase === "refreshing" ? "REFRESHING…" : phase === "armed" ? "RELEASE TO REFRESH" : "PULL TO REFRESH";

  return (
    <div
      aria-hidden
      style={{
        position: "fixed", top: 0, left: "50%",
        transform: `translateX(-50%) translateY(${Math.max(distance - 28, 0)}px)`,
        zIndex: 150, pointerEvents: "none",
        display: "flex", alignItems: "center", gap: 8,
        background: "var(--ink)", color: "var(--mustard)",
        border: "var(--b) solid var(--ink)", boxShadow: "3px 3px 0 var(--red)",
        padding: "6px 14px",
        fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.08em",
      }}
    >
      <span
        style={{
          display: "inline-block", width: 14, height: 14,
          border: "2.5px solid var(--mustard)", borderTopColor: "transparent",
          borderRadius: "50%",
          transform: spinning ? undefined : `rotate(${progress * 270}deg)`,
          animation: spinning ? "sendlog-ptr-spin 0.7s linear infinite" : undefined,
        }}
      />
      {label}
    </div>
  );
}
