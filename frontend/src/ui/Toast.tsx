import { onKey } from "../lib/a11y";
import type { ToastAction } from "../lib/useToast";

interface Props {
  message: string | null;
  onDismiss: () => void;
  /** Optional action button (e.g. UNDO). When present the toast renders in a
   *  neutral notice style rather than the red error style. */
  action?: ToastAction | null;
}

/** Fixed-position toast. Tap the body to dismiss; auto-dismisses via useToast.
 *  With an `action`, shows a tappable button and reads as a notice, not an error. */
export default function Toast({ message, onDismiss, action }: Props) {
  if (!message) return null;
  const isNotice = Boolean(action);
  return (
    <div
      role="alert"
      aria-live="assertive"
      tabIndex={0}
      onClick={onDismiss}
      onKeyDown={onKey(onDismiss)}
      style={{
        position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 200, maxWidth: 380, width: "calc(100% - 32px)",
        background: isNotice ? "var(--ink)" : "var(--red)", color: "var(--cream)",
        border: "var(--bw) solid var(--ink)", boxShadow: "4px 4px 0 var(--ink)",
        padding: "10px 16px",
        fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.06em",
        display: "flex", alignItems: "center", gap: 12,
        textAlign: isNotice ? "left" : "center", cursor: "pointer",
      }}
    >
      <span style={{ flex: 1 }}>{isNotice ? message : `⚠ ${message}`}</span>
      {action && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); action.run(); onDismiss(); }}
          style={{
            flexShrink: 0, background: "var(--mustard)", color: "var(--ink)",
            border: "var(--b) solid var(--cream)", boxShadow: "2px 2px 0 var(--cream)",
            padding: "4px 12px", fontFamily: "var(--font-banner)", fontSize: 12,
            letterSpacing: "0.08em", cursor: "pointer",
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
