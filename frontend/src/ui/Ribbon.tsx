import type { CSSProperties, ReactNode } from "react";
import { useDuckMode } from "../lib/duckMode";

type RibbonFont = "banner" | "display" | "hand";

/** Recursively walk children and swap ★ → 🦆 in any string nodes. */
function duckify(node: ReactNode): ReactNode {
  if (typeof node === "string") return node.replaceAll("★", "🦆");
  if (Array.isArray(node)) return node.map(duckify);
  return node;
}

interface Props {
  children: ReactNode;
  color?: string;
  textColor?: string;
  rotate?: number;
  font?: RibbonFont;
  style?: CSSProperties;
}

const FONT_MAP: Record<RibbonFont, string> = {
  banner: "var(--font-banner)",
  display: "var(--font-display)",
  hand: "var(--font-hand)",
};

/** Tattoo-scroll banner with notched tails. Colours via prop. */
export default function Ribbon({
  children,
  color = "var(--ink)",
  textColor = "var(--cream)",
  rotate = 0,
  font = "banner",
  style = {},
}: Props) {
  const duck = useDuckMode();
  const content = duck ? duckify(children) : children;
  return (
    <div style={{ display: "inline-flex", alignItems: "stretch", transform: `rotate(${rotate}deg)`, ...style }}>
      <svg width="14" viewBox="0 0 14 40" preserveAspectRatio="none" style={{ display: "block" }}>
        <polygon points="14,0 0,20 14,40" fill={color} stroke="var(--ink)" strokeWidth="2" />
      </svg>
      <div
        style={{
          background: color,
          color: textColor,
          padding: "7px 12px",
          fontFamily: FONT_MAP[font],
          borderTop: "2px solid var(--ink)",
          borderBottom: "2px solid var(--ink)",
          letterSpacing: "0.05em",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
        }}
      >
        {content}
      </div>
      <svg width="14" viewBox="0 0 14 40" preserveAspectRatio="none" style={{ display: "block" }}>
        <polygon points="0,0 14,20 0,40" fill={color} stroke="var(--ink)" strokeWidth="2" />
      </svg>
    </div>
  );
}
