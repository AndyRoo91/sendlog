// Global SVG filter defs for the grungy chrome (tier 3 of GRUNGY-CHROME.md).
// Mounted once at the App root; `.boil-frame` pseudo-borders in index.css
// reference these by id. Same visual language as Crag's boil: fractal noise
// displacing the stroke, with a discrete seed animation so the line "boils".
// The `-still` twin is identical minus the animation — prefers-reduced-motion
// swaps to it via a media query in index.css.
export default function GrungeDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="chrome-boil" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={3} result="n">
            <animate attributeName="seed" values="3;8;5;11;6" dur="0.55s" calcMode="discrete" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="n" scale={5} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="chrome-boil-still" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={3} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={5} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Wave 3 · P3: two-ink photo duotone — luminance mapped through a
            3-stop table: shadows print ink, midtones the red plate,
            highlights the paper. Display-time only (.print-photo).
            Shadow stops lifted from pure ink after critique round 2 — full
            crush turned subjects into silhouettes; a warm dark grey keeps
            photo content legible while still reading printed. */}
        <filter id="print-photo">
          <feColorMatrix
            type="matrix"
            values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"
          />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.19 0.839 0.984" />
            <feFuncG type="table" tableValues="0.155 0.227 0.941" />
            <feFuncB type="table" tableValues="0.13 0.165 0.831" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
