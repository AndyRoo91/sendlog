/* Pull-to-refresh for window-scrolled list pages.
 *
 * The app's pages scroll the window (the `.page` div has no own scroller), so
 * we only engage a pull when `window.scrollY` is at the very top. Dragging down
 * from there accumulates a rubber-banded distance; releasing past `threshold`
 * fires `onRefresh` and holds a "refreshing" state until the promise settles.
 *
 * Touch listeners are attached non-passively (so we can `preventDefault` the
 * native overscroll while actively pulling) and only on coarse-pointer devices
 * — desktop gets nothing, which is the right call. Returns the live pull
 * distance + phase so a caller can render an indicator. */
import { useCallback, useEffect, useRef, useState } from "react";

export type PullPhase = "idle" | "pulling" | "armed" | "refreshing";

interface Options {
  /** Drag distance (px, post-resistance) needed to arm a refresh. */
  threshold?: number;
  /** Cap on how far the indicator travels. */
  max?: number;
  /** Divisor applied to raw finger travel for the rubber-band feel. */
  resistance?: number;
}

export function usePullToRefresh(
  onRefresh: () => Promise<unknown>,
  { threshold = 64, max = 96, resistance = 2 }: Options = {}
) {
  const [distance, setDistance] = useState(0);
  const [phase, setPhase] = useState<PullPhase>("idle");

  // Refs so the listeners (attached once) always see live values.
  const startY = useRef<number | null>(null);
  const refreshing = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  const reset = useCallback(() => {
    startY.current = null;
    setDistance(0);
    setPhase("idle");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Coarse pointer only — mice don't pull-to-refresh.
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;

    function onStart(e: TouchEvent) {
      if (refreshing.current) return;
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
    }

    function onMove(e: TouchEvent) {
      if (startY.current === null || refreshing.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        // Scrolling up / no pull — bail and let the page behave normally.
        if (distance !== 0) reset();
        return;
      }
      // Pulling down at the top: own the gesture.
      e.preventDefault();
      const d = Math.min(delta / resistance, max);
      setDistance(d);
      setPhase(d >= threshold ? "armed" : "pulling");
    }

    async function onEnd() {
      if (startY.current === null || refreshing.current) return;
      const armed = distance >= threshold;
      startY.current = null;
      if (!armed) {
        reset();
        return;
      }
      refreshing.current = true;
      setPhase("refreshing");
      setDistance(threshold);
      try {
        await onRefreshRef.current();
      } finally {
        refreshing.current = false;
        reset();
      }
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [distance, threshold, max, resistance, reset]);

  return { distance, phase, threshold };
}
