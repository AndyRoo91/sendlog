import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { onKey } from "../lib/a11y";

interface Props {
  imageSrc: string;
  onClose: () => void;
}

const DEFAULT_TOLERANCE = 32;       // RGB Euclidean distance default
const MIN_TOLERANCE = 8;
const MAX_TOLERANCE = 90;
const OUTLINE_INK: [number, number, number, number] = [26, 22, 18, 230]; // var(--ink) at ~90% alpha
const SAMPLE_RADIUS_PX = 3;         // average a 7×7 patch when sampling for resilience to JPEG noise

/**
 * Tap a hold in a gym topo → outline every same-colour hold on the wall.
 *
 * Implementation: draw the loaded image to an offscreen canvas, pull its
 * ImageData once, then on each tap (a) average a small RGB patch at the tap
 * point, (b) build a boolean mask of pixels within `tolerance` RGB Euclidean
 * distance, (c) emit only the *edges* of the mask onto a transparent overlay
 * canvas as dark ink. Result reads as a hand-inked outline over the photo.
 */
export default function ColourPickOverlay({ imageSrc, onClose }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const naturalRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const [loaded, setLoaded] = useState(false);
  const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE);
  const [sample, setSample] = useState<[number, number, number] | null>(null);
  const [working, setWorking] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);

  // ---- Load image into the offscreen canvas. -----------------------------
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = imgCanvasRef.current;
      const overlay = overlayRef.current;
      if (!canvas || !overlay) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      overlay.width = img.naturalWidth;
      overlay.height = img.naturalHeight;
      naturalRef.current = { w: img.naturalWidth, h: img.naturalHeight };
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      try {
        imageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setLoaded(true);
      } catch {
        // tainted canvas — same-origin fix needed; tell the user something at least.
        setLoaded(true);
      }
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // ---- Re-run the scan whenever sample or tolerance changes. -------------
  useEffect(() => {
    if (!sample) return;
    runScan(sample, tolerance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sample, tolerance]);

  const runScan = useCallback((rgb: [number, number, number], tol: number) => {
    const overlay = overlayRef.current;
    const data = imageDataRef.current;
    if (!overlay || !data) return;
    setWorking(true);
    // Defer one tick so the spinner state can render on the slow first pass.
    requestAnimationFrame(() => {
      const { width: w, height: h, data: px } = data;
      const mask = new Uint8Array(w * h);
      const tolSq = tol * tol;
      const [r0, g0, b0] = rgb;
      let matched = 0;
      // 1) Mask pass: 1 if pixel within RGB distance of sample.
      for (let i = 0, p = 0; i < px.length; i += 4, p++) {
        const dr = px[i] - r0;
        const dg = px[i + 1] - g0;
        const db = px[i + 2] - b0;
        if (dr * dr + dg * dg + db * db <= tolSq) {
          mask[p] = 1;
          matched++;
        }
      }
      // 2) Edge pass: emit a pixel where mask=1 and any 4-neighbour is 0 (or
      // boundary). Dilate slightly by also stamping the immediate neighbour
      // for legibility.
      const out = new Uint8ClampedArray(w * h * 4);
      const [oR, oG, oB, oA] = OUTLINE_INK;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = y * w + x;
          if (!mask[p]) continue;
          const isEdge =
            x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
            !mask[p - 1] || !mask[p + 1] || !mask[p - w] || !mask[p + w];
          if (!isEdge) continue;
          // 2-px stroke for legibility — paint a 2×2 patch.
          for (let dy = 0; dy <= 1; dy++) {
            for (let dx = 0; dx <= 1; dx++) {
              const xx = x + dx, yy = y + dy;
              if (xx >= w || yy >= h) continue;
              const oi = (yy * w + xx) * 4;
              out[oi] = oR;
              out[oi + 1] = oG;
              out[oi + 2] = oB;
              out[oi + 3] = oA;
            }
          }
        }
      }
      const ctx = overlay.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, w, h);
        ctx.putImageData(new ImageData(out, w, h), 0, 0);
      }
      setMatchCount(matched);
      setWorking(false);
    });
  }, []);

  // ---- Sample the tap point and seed the scan. ---------------------------
  function onPointerDown(e: ReactPointerEvent) {
    const data = imageDataRef.current;
    if (!data) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const xCss = e.clientX - rect.left;
    const yCss = e.clientY - rect.top;
    const { w, h } = naturalRef.current;
    const x = Math.round((xCss / rect.width) * w);
    const y = Math.round((yCss / rect.height) * h);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    // Average a small patch to dodge JPEG noise.
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -SAMPLE_RADIUS_PX; dy <= SAMPLE_RADIUS_PX; dy++) {
      for (let dx = -SAMPLE_RADIUS_PX; dx <= SAMPLE_RADIUS_PX; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const i = (yy * w + xx) * 4;
        r += data.data[i];
        g += data.data[i + 1];
        b += data.data[i + 2];
        n++;
      }
    }
    if (!n) return;
    setSample([Math.round(r / n), Math.round(g / n), Math.round(b / n)]);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
  }

  function clearOverlay() {
    setSample(null);
    setMatchCount(null);
    const overlay = overlayRef.current;
    const ctx = overlay?.getContext("2d");
    if (ctx && overlay) ctx.clearRect(0, 0, overlay.width, overlay.height);
  }

  const swatch = sample ? `rgb(${sample[0]}, ${sample[1]}, ${sample[2]})` : "transparent";

  return (
    <div role="dialog" aria-modal="true" aria-label="Colour picker"
      style={{
        position: "fixed", inset: 0, zIndex: 120, background: "rgba(26,22,18,0.92)",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", background: "var(--ink)", color: "var(--cream)",
        borderBottom: "var(--b) solid var(--mustard)",
      }}>
        <div style={{
          fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.12em",
          color: "var(--mustard)",
        }}>
          ★ COLOUR PICKER ★
        </div>
        <div role="button" tabIndex={0} aria-label="Close colour picker"
          onClick={onClose} onKeyDown={onKey(onClose)}
          style={{
            padding: "4px 12px", background: "var(--red)", color: "var(--cream)",
            fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.08em",
            boxShadow: "2px 2px 0 var(--cream)", cursor: "pointer",
          }}>
          ✕ CLOSE
        </div>
      </div>

      {/* Image + overlay */}
      <div style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
        <div ref={wrapRef} onPointerDown={loaded ? onPointerDown : undefined}
          style={{
            position: "relative", maxWidth: "100%", border: "var(--b) solid var(--cream)",
            cursor: loaded ? "crosshair" : "wait", lineHeight: 0,
          }}>
          <canvas ref={imgCanvasRef} style={{ display: "block", maxWidth: "100%", height: "auto" }} />
          <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
          {!loaded && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-banner)", fontSize: 11, color: "var(--cream)", letterSpacing: "0.08em",
            }}>LOADING…</div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{
        padding: "12px 16px 16px", background: "var(--ink)", color: "var(--cream)",
        borderTop: "var(--b) solid var(--mustard)",
      }}>
        {!sample ? (
          <div style={{
            fontFamily: "var(--font-hand)", fontSize: 16, color: "var(--mustard)",
            textAlign: "center", padding: "6px 0",
          }}>
            tap a hold to outline every match.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div aria-label="Sampled colour" style={{
                width: 36, height: 36, background: swatch,
                border: "var(--b) solid var(--cream)", boxShadow: "2px 2px 0 var(--mustard)",
              }} />
              <div style={{ flex: 1, fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.08em" }}>
                {working ? "SCANNING…" : matchCount !== null
                  ? `${matchCount.toLocaleString()} PIXELS MATCHED`
                  : "TAP TO SAMPLE"}
              </div>
              <div role="button" tabIndex={0} aria-label="Clear selection"
                onClick={clearOverlay} onKeyDown={onKey(clearOverlay)}
                style={{
                  padding: "4px 10px", background: "var(--cream)", color: "var(--ink)",
                  fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.08em",
                  boxShadow: "2px 2px 0 var(--mustard)", cursor: "pointer",
                }}>
                CLEAR
              </div>
            </div>
            <label style={{
              display: "flex", alignItems: "center", gap: 12,
              fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.08em",
              color: "var(--mustard)",
            }}>
              TOLERANCE
              <input type="range" min={MIN_TOLERANCE} max={MAX_TOLERANCE} value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                style={{ flex: 1, accentColor: "var(--mustard)" }} />
              <span style={{ minWidth: 28, textAlign: "right", color: "var(--cream)" }}>{tolerance}</span>
            </label>
          </>
        )}
      </div>
    </div>
  );
}
