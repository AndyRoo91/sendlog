import type { CSSProperties } from "react";

interface Props {
  size?: number;
  color?: string;
  style?: CSSProperties;
}

/** 16-wedge conic starburst behind big focal moments. */
export default function Ray({ size = 220, color = "var(--mustard)", style = {} }: Props) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ display: "block", overflow: "visible", ...style }}>
      {/* Local gentle boil — the global chrome-boil's scale is tuned for card
          borders and turns the thin wedges thorny. Same id in every Ray is
          fine: the defs are identical, so any instance resolves the same. */}
      <defs>
        <filter id="ray-rough" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={2} seed={9} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={2.5} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter="url(#ray-rough)">
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
      </g>
    </svg>
  );
}
