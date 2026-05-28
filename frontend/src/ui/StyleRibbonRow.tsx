import { STYLES, STYLE_BY_ID, STYLES_BY_MODE } from "./styleMap";
import type { StyleId } from "./styleMap";
import { onKey } from "../lib/a11y";

interface Props {
  selected?: StyleId | null;
  big?: boolean;
  onPick?: (id: StyleId) => void;
  /** Restrict to a mode's chip set; omit to show all six. */
  mode?: "boulder" | "lead";
  /** Or pass an explicit ordered list (overrides `mode`). */
  styles?: StyleId[];
}

/** Style ribbon grid. Auto-adapts grid columns to the chip count. */
export default function StyleRibbonRow({ selected = null, big = false, onPick, mode, styles }: Props) {
  const ids = styles ?? (mode ? STYLES_BY_MODE[mode] : STYLES.map((s) => s.id));
  const cols = ids.length >= 6 ? 3 : ids.length === 5 ? 5 : 4;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
      {ids.map((id) => {
        const s = STYLE_BY_ID[id];
        const isSel = selected === s.id;
        return (
          <div
            key={s.id}
            className="chunky"
            role={onPick ? "button" : undefined}
            tabIndex={onPick ? 0 : undefined}
            aria-label={`${s.label} style`}
            aria-pressed={isSel}
            onClick={onPick ? () => onPick(s.id) : undefined}
            onKeyDown={onPick ? onKey(() => onPick(s.id)) : undefined}
            style={{
              background: s.color,
              color: s.text,
              padding: big ? "18px 4px" : "14px 4px",
              textAlign: "center",
              fontSize: big ? 15 : 13,
              boxShadow: isSel ? "5px 5px 0 var(--ink)" : "3px 3px 0 var(--ink)",
              transform: isSel ? "translate(-2px,-2px)" : "none",
              outline: isSel ? "3px solid var(--ink)" : "none",
              outlineOffset: isSel ? 4 : 0,
            }}
          >
            {s.label}
          </div>
        );
      })}
    </div>
  );
}
