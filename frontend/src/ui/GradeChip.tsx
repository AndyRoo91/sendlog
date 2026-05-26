import type { CSSProperties, MouseEvent } from "react";

interface Props {
  grade: string;
  color?: string;
  tally?: number;
  big?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
  style?: CSSProperties;
}

/** Chunky outlined grade rectangle with an optional tally badge. */
export default function GradeChip({
  grade,
  color = "var(--cream)",
  tally = 0,
  big = false,
  onClick,
  onContextMenu,
  style = {},
}: Props) {
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        width: big ? 80 : 64,
        height: big ? 80 : 60,
        border: "var(--bw) solid var(--ink)",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontSize: big ? 32 : 24,
        color: "var(--ink)",
        position: "relative",
        boxShadow: "3px 3px 0 var(--ink)",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        ...style,
      }}
    >
      {grade}
      {tally > 0 && (
        <div
          style={{
            position: "absolute",
            top: -10,
            right: -10,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "var(--red)",
            color: "var(--cream)",
            border: "2px solid var(--ink)",
            fontFamily: "var(--font-banner)",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {tally}
        </div>
      )}
    </div>
  );
}
