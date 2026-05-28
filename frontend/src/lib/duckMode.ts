import { useEffect, useState } from "react";

const KEY = "sendlog.duckMode";
const EVENT = "sendlog-duck-toggle";

export function isDuckOn(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function setDuck(on: boolean): void {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
}

/** Subscribe to duck-mode toggles so the consumer re-renders on change. */
export function useDuckMode(): boolean {
  const [on, setOn] = useState(isDuckOn);
  useEffect(() => {
    const handler = (e: Event) => setOn(Boolean((e as CustomEvent).detail));
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return on;
}

/** Listens for the Konami sequence ↑↑↓↓←→←→BA on the window; calls onTrigger. */
export function useKonami(onTrigger: () => void): void {
  useEffect(() => {
    const seq = [
      "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
      "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
      "b", "a",
    ];
    let idx = 0;
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === seq[idx]) {
        idx += 1;
        if (idx === seq.length) {
          idx = 0;
          onTrigger();
        }
      } else {
        // Allow a fresh start from this key if it matches the first step.
        idx = k === seq[0] ? 1 : 0;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onTrigger]);
}
