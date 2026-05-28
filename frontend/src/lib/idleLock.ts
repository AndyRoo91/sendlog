import { useEffect, useRef, useState } from "react";

const IDLE_MS = 5 * 60 * 1000;        // 5 minutes
const LOCKED_KEY = "sendlog.locked";  // survives reload so a refresh doesn't sneak past

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "pointerdown", "pointermove", "keydown", "touchstart", "wheel",
];

/**
 * Track idle time; when it exceeds IDLE_MS the user is "locked" and the
 * LockScreen overlay should be rendered. Activity events while locked do
 * NOT clear the lock (you have to type your PIN).
 *
 * Persists locked-state in sessionStorage so a refresh while locked stays
 * locked. (Idle timer doesn't persist — refresh always counts as activity.)
 *
 * No-op when `enabled` is false (e.g. user has no PIN configured).
 */
export function useIdleLock(enabled: boolean) {
  const [locked, setLocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return sessionStorage.getItem(LOCKED_KEY) === "1"; }
    catch { return false; }
  });
  const lastActivity = useRef<number>(Date.now());

  // Persist locked state so a refresh doesn't drop the gate.
  useEffect(() => {
    try {
      if (locked) sessionStorage.setItem(LOCKED_KEY, "1");
      else sessionStorage.removeItem(LOCKED_KEY);
    } catch { /* private mode */ }
  }, [locked]);

  // If we just got disabled (user cleared PIN or logged out), drop the lock.
  useEffect(() => {
    if (!enabled && locked) setLocked(false);
  }, [enabled, locked]);

  useEffect(() => {
    if (!enabled) return;

    function bump() {
      if (!locked) lastActivity.current = Date.now();
    }

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, bump, { passive: true });
    }

    const tick = window.setInterval(() => {
      if (locked) return;
      if (Date.now() - lastActivity.current >= IDLE_MS) {
        setLocked(true);
      }
    }, 15_000); // check every 15s — accurate enough at minute-scale, cheap

    // Re-evaluate as soon as the tab comes back from being hidden in case
    // the JS timer was throttled while backgrounded.
    function onVisible() {
      if (!locked && document.visibilityState === "visible" &&
          Date.now() - lastActivity.current >= IDLE_MS) {
        setLocked(true);
      }
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, bump);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(tick);
    };
  }, [enabled, locked]);

  return {
    locked,
    lockNow: () => setLocked(true),
    unlock: () => { lastActivity.current = Date.now(); setLocked(false); },
  };
}
