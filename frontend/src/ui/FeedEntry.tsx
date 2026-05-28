import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { onKey } from "../lib/a11y";

interface Props {
  grade: string;
  style: string;
  color: string;
  text?: string;
  time?: string;
  tilt?: number;
  onClick?: () => void;
  onDelete?: () => void;
  isPB?: boolean;
}

const DRAG_TRIGGER = -110;          // px past which release fires delete
const DRAG_REVEAL = 24;              // px before the red ✕ starts fading in
const VERTICAL_CANCEL = 12;          // px of vertical move → bail out (let page scroll)
const CLICK_SUPPRESS = 6;            // px of horizontal move → suppress the tap

/** Logged-tick chip shown in the session feed strip. Supports swipe-left to delete. */
export default function FeedEntry({ grade, style, color, text = "var(--cream)", time, tilt = 0, onClick, onDelete, isPB = false }: Props) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const cancelledRef = useRef(false);
  const movedRef = useRef(false);

  const swipeEnabled = Boolean(onDelete);

  function reset() {
    setDx(0);
    setDragging(false);
    startRef.current = null;
    cancelledRef.current = false;
    movedRef.current = false;
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (!swipeEnabled) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    cancelledRef.current = false;
    movedRef.current = false;
    setDragging(true);
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!startRef.current || cancelledRef.current) return;
    const ddx = e.clientX - startRef.current.x;
    const ddy = e.clientY - startRef.current.y;
    // Vertical scroll wins — bail.
    if (Math.abs(ddy) > VERTICAL_CANCEL && Math.abs(ddy) > Math.abs(ddx)) {
      cancelledRef.current = true;
      setDx(0);
      setDragging(false);
      return;
    }
    // Only track leftwards drag (with a tiny rightward overshoot allowed).
    const next = Math.min(8, ddx);
    if (Math.abs(next) > CLICK_SUPPRESS) movedRef.current = true;
    setDx(next);
    if (next < -CLICK_SUPPRESS) {
      // Once we know it's a horizontal swipe, capture so the parent doesn't steal it.
      try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* iOS sometimes throws */ }
    }
  }

  function onPointerUp() {
    if (!startRef.current) return;
    const released = dx;
    const moved = movedRef.current;
    reset();
    if (released <= DRAG_TRIGGER && onDelete) {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
      onDelete();
      return;
    }
    if (!moved && onClick) onClick();
  }

  const revealProgress = Math.min(1, Math.max(0, (-dx - DRAG_REVEAL) / (-DRAG_TRIGGER - DRAG_REVEAL)));

  return (
    <div style={{ position: "relative", display: "inline-block", touchAction: swipeEnabled ? "pan-y" : undefined }}>
      {swipeEnabled && revealProgress > 0 && (
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-end",
          paddingRight: 10, background: "var(--red)", color: "var(--cream)",
          border: "var(--b) solid var(--ink)", boxShadow: "3px 3px 0 var(--ink)",
          fontFamily: "var(--font-banner)", fontSize: 18, opacity: revealProgress,
          transform: `rotate(${tilt}deg)`,
        }}>✕</div>
      )}
      <div
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={onClick ? `${isPB ? "Personal best — " : ""}Edit ${grade} ${style} tick` : undefined}
        className={isPB && dx === 0 ? "pb-pulse" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={reset}
        onKeyDown={onClick ? onKey(onClick) : undefined}
        style={{
          // --tilt feeds into the pb-shake keyframe so the chip's resting
          // rotation is preserved across the animation.
          ["--tilt" as string]: `rotate(${tilt}deg)`,
          position: "relative",
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
          transform: `translateX(${dx}px) rotate(${tilt}deg)`,
          transition: dragging ? "none" : "transform 180ms ease",
        }}
      >
        <span style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: 1 }}>{grade}</span>
        <span style={{ fontFamily: "var(--font-banner)", fontSize: 9, letterSpacing: "0.08em", marginTop: 3 }}>{style}</span>
        {time && (
          <span style={{ fontFamily: "var(--font-banner)", fontSize: 8, opacity: 0.7, marginTop: 2 }}>{time}</span>
        )}
      </div>
    </div>
  );
}
