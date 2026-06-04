import { onKey } from "../lib/a11y";
import { StyleRibbonRow } from "../ui";
import type { StyleId, ClimbMode } from "../ui";

interface Props {
  mode: ClimbMode;
  /** The grade the user just tapped — echoed in the header. */
  grade: string;
  falls: number;
  onFalls: (next: number) => void;
  onPick: (styleId: StyleId) => void;
  onDismiss: () => void;
}

/** Sticky bottom style tray. Surfaces the moment a grade is selected so the
 *  whole tick — style (+ falls for lead) — lands in the one-handed thumb zone,
 *  instead of reaching up to a mid-page row. Pins just above the tab bar and
 *  slides up; committing a style clears the selection and unmounts it. */
export default function StylePicker({ mode, grade, falls, onFalls, onPick, onDismiss }: Props) {
  return (
    <div
      role="group"
      aria-label={`Pick a style for ${grade}`}
      style={{
        position: "fixed", left: "50%", bottom: 84, transform: "translateX(-50%)",
        width: "100%", maxWidth: 440, zIndex: 60, padding: "0 12px", pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          background: "var(--cream)", border: "var(--bw) solid var(--ink)",
          boxShadow: "0 -4px 0 var(--red), 5px 0 0 var(--ink), -5px 0 0 var(--ink)",
          padding: "12px 14px 14px",
          animation: "sendlog-picker-up 180ms cubic-bezier(0.34, 1.3, 0.64, 1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontFamily: "var(--font-banner)", fontSize: 12, color: "var(--ink)", letterSpacing: "0.06em" }}>
            ★ {grade} — HOW'D IT GO?
          </span>
          <div role="button" tabIndex={0} aria-label="Cancel grade selection" className="chunky"
            onClick={onDismiss} onKeyDown={onKey(onDismiss)}
            style={{
              width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--cream)", boxShadow: "2px 2px 0 var(--ink)", fontFamily: "var(--font-banner)", fontSize: 14,
            }}>
            ✕
          </div>
        </div>

        <StyleRibbonRow mode={mode} onPick={onPick} />

        {mode === "lead" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, justifyContent: "center" }}>
            <span style={{ fontFamily: "var(--font-banner)", fontSize: 11, color: "var(--ink-2)", letterSpacing: "0.08em" }}>FALLS</span>
            <div role="button" tabIndex={0} aria-label="Decrease falls" className="chunky"
              onClick={() => onFalls(Math.max(0, falls - 1))}
              onKeyDown={onKey(() => onFalls(Math.max(0, falls - 1)))}
              style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cream)", boxShadow: "2px 2px 0 var(--ink)" }}>–</div>
            <div aria-live="polite" aria-label={`${falls} falls`} style={{ fontFamily: "var(--font-display)", fontSize: 28, minWidth: 28, textAlign: "center" }}>{falls}</div>
            <div role="button" tabIndex={0} aria-label="Increase falls" className="chunky"
              onClick={() => onFalls(falls + 1)}
              onKeyDown={onKey(() => onFalls(falls + 1))}
              style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--mustard)", boxShadow: "2px 2px 0 var(--ink)" }}>+</div>
          </div>
        )}
      </div>
    </div>
  );
}
