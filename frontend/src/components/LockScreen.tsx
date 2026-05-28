import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../lib/auth";
import { Ribbon } from "../ui";

interface Props {
  onUnlock: () => void;
}

const PIN_MAX = 8;

/**
 * Full-screen overlay shown after the idle timer fires (or LOCK NOW is tapped)
 * when a PIN is configured. The session cookie is untouched — verify_pin is a
 * pure yes/no check, and the lock is purely a client-side UI gate.
 *
 * If the cookie has expired, verify_pin returns 401 and the AuthGate kicks
 * the user back to the full login screen instead.
 */
export default function LockScreen({ onUnlock }: Props) {
  const { user, logout } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Auto-submit once we've got at least 4 digits — feels native on mobile.
  useEffect(() => {
    if (pin.length >= 4) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.verifyPin(pin);
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
      onUnlock();
    } catch {
      setError("Wrong PIN");
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([60, 40, 60]);
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  function press(digit: string) {
    setError(null);
    setPin((p) => (p.length >= PIN_MAX ? p : p + digit));
  }
  function backspace() {
    setError(null);
    setPin((p) => p.slice(0, -1));
  }

  // Reveal dots that always show PIN_MAX positions so the user knows the cap.
  const dots = Array.from({ length: Math.max(4, pin.length || 4) }, (_, i) =>
    i < pin.length ? "●" : "○"
  ).join(" ");

  return (
    <div role="dialog" aria-modal="true" aria-label="Locked"
      style={{
        position: "fixed", inset: 0, zIndex: 200, background: "var(--ink)",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "32px 18px",
      }}
    >
      <div style={{ marginBottom: 18, transform: "rotate(-2deg)" }}>
        <Ribbon color="var(--red)" font="display">★ LOCKED ★</Ribbon>
      </div>
      <div style={{
        color: "var(--mustard)", fontFamily: "var(--font-banner)", fontSize: 11,
        letterSpacing: "0.12em", marginBottom: 20,
      }}>
        {user ? `HELLO, ${user.username.toUpperCase()}` : ""}
      </div>

      <div aria-live="polite" style={{
        color: "var(--cream)", fontFamily: "var(--font-display)", fontSize: 26,
        letterSpacing: "0.4em", marginBottom: 6, minHeight: 36,
      }}>
        {dots}
      </div>
      <div role="alert" style={{
        color: "var(--red)", fontFamily: "var(--font-banner)", fontSize: 11,
        letterSpacing: "0.08em", minHeight: 18, marginBottom: 18,
      }}>
        {error?.toUpperCase() ?? ""}
      </div>

      {/* Big tap pad — three rows of 1–9, then ← 0 OK */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 72px)", gap: 12,
        marginBottom: 18,
      }}>
        {["1","2","3","4","5","6","7","8","9"].map((d) => (
          <button key={d} type="button"
            onClick={() => press(d)}
            aria-label={`Digit ${d}`}
            style={{
              fontFamily: "var(--font-display)", fontSize: 28,
              padding: "14px 0", background: "var(--cream)", color: "var(--ink)",
              border: "var(--bw) solid var(--mustard)",
              boxShadow: "3px 3px 0 var(--mustard)",
            }}>
            {d}
          </button>
        ))}
        <button type="button" onClick={backspace} aria-label="Backspace"
          style={{
            fontFamily: "var(--font-banner)", fontSize: 14, letterSpacing: "0.08em",
            background: "var(--ink-2)", color: "var(--cream)",
            border: "var(--bw) solid var(--mustard)", boxShadow: "3px 3px 0 var(--mustard)",
          }}>
          ←
        </button>
        <button type="button" onClick={() => press("0")} aria-label="Digit 0"
          style={{
            fontFamily: "var(--font-display)", fontSize: 28,
            background: "var(--cream)", color: "var(--ink)",
            border: "var(--bw) solid var(--mustard)", boxShadow: "3px 3px 0 var(--mustard)",
          }}>
          0
        </button>
        <button type="button" onClick={submit} disabled={busy || pin.length < 4}
          aria-label="Unlock"
          style={{
            fontFamily: "var(--font-banner)", fontSize: 14, letterSpacing: "0.08em",
            background: "var(--red)", color: "var(--cream)",
            border: "var(--bw) solid var(--mustard)", boxShadow: "3px 3px 0 var(--mustard)",
            opacity: busy || pin.length < 4 ? 0.45 : 1,
          }}>
          OK
        </button>
      </div>

      <div role="button" tabIndex={0}
        onClick={logout}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); logout(); } }}
        style={{
          color: "var(--cream)", fontFamily: "var(--font-banner)", fontSize: 10,
          letterSpacing: "0.1em", opacity: 0.6, cursor: "pointer",
          padding: "8px 12px",
        }}>
        FORGOT PIN? · LOG OUT
      </div>
    </div>
  );
}
