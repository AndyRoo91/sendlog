import { useCallback, useRef, useState } from "react";

/** An optional action button rendered inside the toast (e.g. "UNDO"). */
export interface ToastAction {
  label: string;
  run: () => void;
}

/** Lightweight toast state hook. Returns the current message (and optional
 *  action) plus helpers to show (auto-dismisses after `durationMs`) and
 *  manually dismiss it. Pass an action to render a tappable button — handy for
 *  undo-style affordances that need a few seconds of dwell time. */
export function useToast(durationMs = 3500) {
  const [state, setState] = useState<{ message: string; action?: ToastAction } | null>(null);
  const timer = useRef<number | null>(null);

  const toast = useCallback(
    (msg: string, action?: ToastAction) => {
      setState({ message: msg, action });
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setState(null), durationMs);
    },
    [durationMs]
  );

  const dismiss = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setState(null);
  }, []);

  return { message: state?.message ?? null, action: state?.action ?? null, toast, dismiss };
}
