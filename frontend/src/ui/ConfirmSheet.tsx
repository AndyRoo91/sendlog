import { useEffect, useRef } from "react";

// Themed replacement for native confirm() (Phase R1). Renders a paper card over
// a dim backdrop; Escape or backdrop-tap cancels, the red button confirms.
interface Props {
  title: string;          // banner heading, e.g. "DELETE SESSION?"
  message: string;
  confirmLabel?: string;  // defaults to "DELETE"
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmSheet({ title, message, confirmLabel = "DELETE", onConfirm, onCancel }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onCancel]);

  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, zIndex: 130, background: "rgba(26,22,18,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
    }}>
      <div role="alertdialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 340,
          background: "var(--paper)", border: "var(--bw) solid var(--ink)",
          boxShadow: "6px 6px 0 var(--ink)", padding: "18px 16px 16px",
          transform: "rotate(-0.6deg)",
        }}>
        <div style={{
          fontFamily: "var(--font-banner)", fontSize: 13, letterSpacing: "0.1em",
          marginBottom: 8,
        }}>{title}</div>
        <div style={{
          fontFamily: "var(--font-hand)", fontSize: 16, color: "var(--ink-2)",
          lineHeight: 1.35, marginBottom: 16,
        }}>{message}</div>
        <div className="gap-row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
          <button type="button" ref={confirmRef} className="btn-danger btn-sm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
