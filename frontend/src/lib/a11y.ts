import type { KeyboardEvent } from "react";

/** onKeyDown handler that fires the callback on Enter or Space, matching native button behaviour. */
export function onKey(fn: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
}
