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
  /** Spot-colour misregistration plate behind the banner text (P1). Defaults
   *  to ink — critique round 2 found the original mustard plate under cream
   *  type read as a soft glow, not a registration slip; a dark contrasting
   *  plate reads off-plate. Pass a colour to override per-ribbon. */
  misregColor?: string;
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
  misregColor = "var(--ink)",
}: Props) {
  const duck = useDuckMode();
  const content = duck ? duckify(children) : children;
  return (
    <div style={{ display: "inline-flex", alignItems: "stretch", transform: `rotate(${rotate}deg)`, ...style }}>
      <svg width="14" viewBox="0 0 14 40" preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
        <polygon points="14,0 0,20 14,40" fill={color} stroke="var(--ink)" strokeWidth="3.5" filter="url(#chrome-boil-still)" />
      </svg>
      <div
        style={{
          background: color,
          color: textColor,
          padding: "7px 12px",
          fontFamily: FONT_MAP[font],
          letterSpacing: "0.05em",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          position: "relative",
        }}
      >
        {/* Hand-drawn top/bottom rules replacing the straight 2px borders.
            Absolutely positioned so the banner keeps its exact box. */}
        <span aria-hidden="true" className="rough-rule" style={{ position: "absolute", left: -1, right: -1, top: -3, backgroundColor: "var(--ink)" }} />
        <span className="misreg" style={{ "--misreg": misregColor } as CSSProperties}>{content}</span>
        <span aria-hidden="true" className="rough-rule rough-rule-b" style={{ position: "absolute", left: -1, right: -1, bottom: -3, backgroundColor: "var(--ink)" }} />
      </div>
      <svg width="14" viewBox="0 0 14 40" preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
        <polygon points="0,0 14,20 0,40" fill={color} stroke="var(--ink)" strokeWidth="3.5" filter="url(#chrome-boil-still)" />
      </svg>
    </div>
  );
}
