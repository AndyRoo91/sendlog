import { GradeChip, StarBurst } from "../ui";
import { useLongPress } from "../lib/useLongPress";

interface Props {
  grade: string;
  color: string;
  tally: number;
  selected: boolean;
  /** ms — drives the visible countdown ring while selected. */
  selectionMs: number;
  onTap: () => void;
  onLong: () => void;
}

/** A single grade chip in the Tick Sheet grid:
 *  - tap: select (with starburst + countdown ring)
 *  - long-press (≥450ms): open detail sheet for that grade
 *  Uses pointer events so iOS Safari doesn't fire the OS callout. */
export default function GradeChipSlot({ grade, color, tally, selected, selectionMs, onTap, onLong }: Props) {
  const { handlers, didFire } = useLongPress(onLong);
  return (
    <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
      {selected && (
        <div style={{ position: "absolute", inset: -12, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <StarBurst size={96} color="var(--red)" />
        </div>
      )}
      <div
        {...handlers}
        style={{ position: "relative", zIndex: 1, transform: selected ? "scale(1.06)" : "none", transition: "transform 160ms ease" }}
      >
        <GradeChip
          grade={grade}
          color={color}
          tally={tally}
          onClick={() => { if (didFire()) return; onTap(); }}
        />
        {selected && <CountdownRing ms={selectionMs} />}
      </div>
    </div>
  );
}

/** SVG ring overlay that shrinks the visible stroke from full → empty over `ms`. */
function CountdownRing({ ms }: { ms: number }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  return (
    <svg
      width={80} height={80}
      style={{
        position: "absolute", inset: -10, margin: "auto",
        pointerEvents: "none", overflow: "visible",
      }}
    >
      <circle
        cx={40} cy={40} r={r}
        fill="none" stroke="var(--mustard)" strokeWidth={3.5}
        strokeLinecap="round" transform="rotate(-90 40 40)"
        style={{
          strokeDasharray: circ,
          animation: `sendlog-countdown ${ms}ms linear forwards`,
        }}
      />
    </svg>
  );
}
