interface Props {
  message: string | null;
  onDismiss: () => void;
}

/** Fixed-position error toast. Tap to dismiss. Auto-dismisses via useToast. */
export default function Toast({ message, onDismiss }: Props) {
  if (!message) return null;
  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 200, maxWidth: 380, width: "calc(100% - 32px)",
        background: "var(--red)", color: "var(--cream)",
        border: "var(--bw) solid var(--ink)", boxShadow: "4px 4px 0 var(--ink)",
        padding: "10px 16px",
        fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.06em",
        textAlign: "center", cursor: "pointer",
      }}
    >
      ⚠ {message}
    </div>
  );
}
