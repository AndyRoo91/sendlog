import { GradeChip, StarBurst } from "../ui";
import { useLongPress } from "../lib/useLongPress";

interface Props {
  grade: string;
  color: string;
  tally: number;
  selected: boolean;
  onTap: () => void;
  onLong: () => void;
}

/** A single grade chip in the Tick Sheet grid:
 *  - tap: select (with starburst halo)
 *  - long-press (≥450ms): open detail sheet for that grade
 *  Uses pointer events so iOS Safari doesn't fire the OS callout. */
export default function GradeChipSlot({ grade, color, tally, selected, onTap, onLong }: Props) {
  const { handlers, didFire } = useLongPress(onLong);
  return (
    <div style={{ display: "flex", justifyContent: "center", position: "relative", zIndex: selected ? 5 : undefined }}>
      {selected && (
        <div style={{ position: "absolute", inset: -20, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <StarBurst size={112} color="var(--red)" />
        </div>
      )}
      <div
        {...handlers}
        style={{ position: "relative", zIndex: 1, transform: selected ? "scale(1.06)" : "none", transition: "transform 160ms steps(2, end)" }}
      >
        <GradeChip
          grade={grade}
          color={color}
          tally={tally}
          onClick={() => { if (didFire()) return; onTap(); }}
        />
      </div>
    </div>
  );
}
