import type { CSSProperties } from "react";

interface Props {
  size?: number;
  color?: string;
  style?: CSSProperties;
}

/** 16-wedge conic starburst behind big focal moments. */
export default function Ray({ size = 220, color = "var(--mustard)", style = {} }: Props) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ display: "block", ...style }}>
      {Array.from({ length: 16 }).map((_, i) => (
        <polygon
          key={i}
          points="100,10 95,100 105,100"
          fill={color}
          stroke="var(--ink)"
          strokeWidth="2"
          transform={`rotate(${(i * 360) / 16} 100 100)`}
        />
      ))}
      <circle cx="100" cy="100" r="42" fill="var(--cream)" stroke="var(--ink)" strokeWidth="3" />
    </svg>
  );
}
