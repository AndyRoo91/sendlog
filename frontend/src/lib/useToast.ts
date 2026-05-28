import { useCallback, useRef, useState } from "react";

/** Lightweight toast state hook. Returns the current message plus helpers to
 *  show (auto-dismisses after `durationMs`) and manually dismiss it. */
export function useToast(durationMs = 3500) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const toast = useCallback(
    (msg: string) => {
      setMessage(msg);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs]
  );

  const dismiss = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setMessage(null);
  }, []);

  return { message, toast, dismiss };
}
