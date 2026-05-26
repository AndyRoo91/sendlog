import { STYLES } from "./styleMap";
import type { StyleId } from "./styleMap";

interface Props {
  selected?: StyleId | null;
  big?: boolean;
  onPick?: (id: StyleId) => void;
}

/** The 4-up FLASH / SEND / WORK / FALL ribbon grid. */
export default function StyleRibbonRow({ selected = null, big = false, onPick }: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
      {STYLES.map((s) => {
        const isSel = selected === s.id;
        return (
          <div
            key={s.id}
            className="chunky"
            onClick={onPick ? () => onPick(s.id) : undefined}
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
