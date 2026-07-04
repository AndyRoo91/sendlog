import { useEffect, useState } from "react";
import { queueSize, subscribe, flush } from "../lib/syncQueue";
import { onKey } from "../lib/a11y";

// Global connectivity / sync indicator (Phase R3). The offline tick queue used
// to surface only inside the Tick Sheet, so edits made elsewhere while offline
// vanished with no feedback. This floating pill lives in the app shell and
// shows on every screen: OFFLINE while the network is down, and a tap-to-retry
// count whenever ticks are parked waiting to sync.
export default function OfflineStatus() {
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine
  );
  const [pending, setPending] = useState(() => queueSize());

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    // Keep the count live; nudge a flush once on mount (covers a reload with
    // items already parked — the queue also flushes on the `online` event).
    const unsub = subscribe(() => setPending(queueSize()));
    void flush();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      unsub();
    };
  }, []);

  if (online && pending === 0) return null;

  const retryable = online && pending > 0;
  const label = !online
    ? pending > 0
      ? `⚡ OFFLINE · ${pending} SAVED HERE`
      : "⚡ OFFLINE · CHANGES SAVE HERE"
    : `⟳ ${pending} TICK${pending === 1 ? "" : "S"} WAITING · TAP TO RETRY`;

  return (
    <div
      role={retryable ? "button" : "status"}
      aria-live="polite"
      tabIndex={retryable ? 0 : undefined}
      onClick={retryable ? () => void flush() : undefined}
      onKeyDown={retryable ? onKey(() => void flush()) : undefined}
      style={{
        position: "fixed", bottom: 76, left: "50%", transform: "translateX(-50%) rotate(-0.5deg)",
        zIndex: 85, maxWidth: "calc(100% - 24px)", whiteSpace: "nowrap",
        padding: "6px 14px", cursor: retryable ? "pointer" : "default",
        background: online ? "var(--mustard)" : "var(--ink)",
        color: online ? "var(--ink)" : "var(--cream)",
        border: "var(--b) solid var(--ink)", boxShadow: "2px 2px 0 var(--ink)",
        fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.08em",
      }}
    >
      {label}
    </div>
  );
}
