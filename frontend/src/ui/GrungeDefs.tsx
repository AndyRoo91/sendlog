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
      </defs>
    </svg>
  );
}
