import { useRef, useCallback } from "react";

type PointerLike = {
  pointerId: number;
  clientX: number;
  clientY: number;
};

interface Options {
  ms?: number;
  moveThreshold?: number;
}

/** Pointer-based long-press: fires `onLong` after `ms` of held press without
 *  moving past `moveThreshold` pixels. Returns a `fired` flag (via the second
 *  arg of consumers) so callers can suppress a subsequent click that would
 *  otherwise both fire.
 *
 *  Usage:
 *    const { handlers, didFire } = useLongPress(() => openDetail(...));
 *    <div {...handlers} onClick={() => { if (didFire()) return; selectGrade(); }} />
 */
export function useLongPress(onLong: () => void, opts: Options = {}) {
  const ms = opts.ms ?? 450;
  const threshold = opts.moveThreshold ?? 8;
  const timer = useRef<number | null>(null);
  const startPt = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    startPt.current = null;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    fired.current = false;
    startPt.current = { x: e.clientX, y: e.clientY };
    timer.current = window.setTimeout(() => {
      fired.current = true;
      timer.current = null;
      onLong();
    }, ms);
  }, [ms, onLong]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!startPt.current) return;
    const dx = e.clientX - startPt.current.x;
    const dy = e.clientY - startPt.current.y;
    if (dx * dx + dy * dy > threshold * threshold) cancel();
  }, [threshold, cancel]);

  const onPointerUp = useCallback(() => cancel(), [cancel]);
  const onPointerCancel = useCallback(() => cancel(), [cancel]);
  const onPointerLeave = useCallback(() => cancel(), [cancel]);

  /** Returns true and resets if the long-press fired; use in onClick to skip
   *  the click that would have otherwise also fired. */
  const didFire = useCallback(() => {
    const f = fired.current;
    fired.current = false;
    return f;
  }, []);

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave },
    didFire,
  };
}
