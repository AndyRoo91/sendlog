/* Crag.tsx — "Crag" the climbing gecko.
   Ported from design_handoff_climbing_buddy/buddy.jsx.
   Grungy early-MTV cel style: cut-out puppet rig + animated turbulence boil.
   Keep the GRIME palette local — the slight grime offset from app tokens is the point.
*/
import { useState, useEffect } from "react";

// ---- grimed palette (intentionally slightly different from app tokens) ----
const GRIME = {
  ink:          "#1c1710",
  ink2:         "#3a2f22",
  paper:        "#e7d9b6",
  cream:        "#f2e6c4",
  skinPrimed:   "#8a9a4e",
  skinPrimedSh: "#5f6c34",
  skinFlat:     "#7c8550",
  skinDetrain:  "#8f9270",
  skinDetrSh:   "#646650",
  belly:        "#cdcf9a",
  bellyDet:     "#c2bd92",
  red:          "#bd3a2c",
  mustard:      "#cf9a36",
  sea:          "#2f7d68",
  cobalt:       "#33486f",
  couch:        "#7a4a3c",
  couchSh:      "#5c3529",
  chalk:        "#efe7cf",
} as const;

// ---- types ----
export type CragState = "primed" | "training" | "detrained" | "stoked" | "shakeoff" | "resting" | "cooked" | "nervous" | "focused";
type EyeKind   = "wide" | "joy" | "stoned" | "sad" | "focus" | "closed" | "dizzy";
type MouthKind = "grin" | "yell" | "lazy" | "frown" | "snore" | "grit" | "loll";
type BrowKind  = "up" | "down" | "flat";
type MotionKind = "headbang" | "slouch" | "jump" | "breathe" | "pump";
type ExtraKind = "chalk" | "sparks" | "couch" | "snack" | "dumbbell" | "lines" | "zzz" | "sweat";

interface PoseConfig {
  label:    string;
  sub:      string;
  skin:     string;
  skinSh:   string;
  belly:    number;
  ripped:   boolean;
  slouch?:  boolean;
  eyes:     EyeKind;
  mouth:    MouthKind;
  brow:     BrowKind;
  armL:     number;
  armR:     number;
  legL:     number;
  legR:     number;
  tail:     number;
  headTilt: number;
  motion:   MotionKind;
  extras:   ExtraKind[];
  bg:       string;
  band?:    boolean;
  grip?:    "fist";
}

export interface CragProps {
  state?:  CragState;
  size?:   number;       // px, default 300
  showBg?: boolean;      // default true; false = transparent
  uid?:    string;       // unique id for SVG filter/pattern defs — use when multiple Crags on one page
  build?:  number;       // 0..3 physique tier — scales musculature (default 0 = scrawny)
}

// ---- reduced-motion hook ----
function useReducedMotion(): boolean {
  const q = "(prefers-reduced-motion: reduce)";
  const [r, setR] = useState<boolean>(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(q).matches
      : false
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const m = window.matchMedia(q);
    const h = (e: MediaQueryListEvent) => setR(e.matches);
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, []);
  return r;
}

// ---- shared defs: boil filter + grime textures ----
interface BuddyDefsProps { id: string; frozen: boolean; }

function BuddyDefs({ id, frozen }: BuddyDefsProps) {
  return (
    <defs>
      {/* the BOIL — discrete seed swap ~8fps wobbles every stroke */}
      <filter id={`boil-${id}`} x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.024" numOctaves={2} seed={1} result="n">
          {!frozen && <animate attributeName="seed" values="1;4;7;2;6" dur="0.5s" calcMode="discrete" repeatCount="indefinite" />}
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="n" scale={4} xChannelSelector="R" yChannelSelector="G" />
      </filter>

      {/* rougher boil for big wash shapes */}
      <filter id={`boilbg-${id}`} x="-25%" y="-25%" width="150%" height="150%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={2} seed={2} result="n">
          {!frozen && <animate attributeName="seed" values="2;5;9;3" dur="0.6s" calcMode="discrete" repeatCount="indefinite" />}
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="n" scale={6.5} xChannelSelector="R" yChannelSelector="G" />
      </filter>

      {/* paper grain / dirty TV noise */}
      <filter id={`grain-${id}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" result="g" />
        <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0" result="gg" />
        <feComposite in="gg" in2="SourceGraphic" operator="in" />
      </filter>

      {/* cross-hatch shading patterns */}
      <pattern id={`hatch-${id}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
        <line x1="0" y1="0" x2="0" y2="7" stroke={GRIME.ink} strokeWidth="1" opacity="0.55" />
      </pattern>
      <pattern id={`hatch2-${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-50)">
        <line x1="0" y1="0" x2="0" y2="6" stroke={GRIME.ink} strokeWidth="0.8" opacity="0.4" />
      </pattern>

      {/* mottle dots on skin */}
      <pattern id={`spots-${id}`} width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="5"  cy="6"  r="2.3" fill={GRIME.ink} opacity="0.22" />
        <circle cx="15" cy="15" r="1.6" fill={GRIME.ink} opacity="0.18" />
        <circle cx="18" cy="3"  r="1.2" fill={GRIME.ink} opacity="0.15" />
      </pattern>
    </defs>
  );
}

// ---- pose table ----
const POSES: Record<CragState, PoseConfig> = {
  primed: {
    label: "PRIMED", sub: "active weeks · lean & psyched",
    skin: GRIME.skinPrimed, skinSh: GRIME.skinPrimedSh,
    belly: 0.74, ripped: true,
    eyes: "wide", mouth: "grin", brow: "up",
    armL: -38, armR: 28, legL: 18, legR: -14, tail: -22, headTilt: -4,
    motion: "headbang", extras: ["chalk"],
    bg: GRIME.sea,
  },
  detrained: {
    label: "OFF-SEASON", sub: "quiet stretch · taking it easy",
    skin: GRIME.skinDetrain, skinSh: GRIME.skinDetrSh,
    belly: 1.32, ripped: false, slouch: true,
    eyes: "stoned", mouth: "lazy", brow: "flat",
    armL: 8, armR: -64, legL: 70, legR: 52, tail: 40, headTilt: 10,
    motion: "slouch", extras: ["couch", "snack"],
    bg: GRIME.couch,
  },
  stoked: {
    label: "STOKED", sub: "SEND ✓ — buzzing for you",
    skin: GRIME.skinPrimed, skinSh: GRIME.skinPrimedSh,
    belly: 0.8, ripped: true,
    eyes: "joy", mouth: "yell", brow: "up",
    armL: -120, armR: 118, legL: 26, legR: -22, tail: -54, headTilt: -2,
    motion: "jump", extras: ["chalk", "sparks"],
    bg: GRIME.mustard,
  },
  shakeoff: {
    label: "SHAKE IT OFF", sub: "came off? go again",
    skin: GRIME.skinFlat, skinSh: GRIME.skinPrimedSh,
    belly: 0.9, ripped: true,
    eyes: "focus", mouth: "grin", brow: "up", grip: "fist",
    armL: -8, armR: 128, legL: 22, legR: -18, tail: -24, headTilt: -3,
    motion: "pump", extras: ["lines"],
    bg: GRIME.sea,
  },
  resting: {
    label: "RESTING", sub: "rest day · do not disturb",
    skin: GRIME.skinFlat, skinSh: GRIME.skinPrimedSh,
    belly: 1.05, ripped: false,
    eyes: "closed", mouth: "snore", brow: "flat",
    armL: -10, armR: 10, legL: 40, legR: -36, tail: 30, headTilt: 8,
    motion: "breathe", extras: ["zzz"],
    bg: GRIME.cobalt,
  },
  training: {
    label: "TRAINING", sub: "rebuilding · eye of the tiger",
    skin: GRIME.skinPrimed, skinSh: GRIME.skinPrimedSh,
    belly: 0.86, ripped: true,
    eyes: "focus", mouth: "grit", brow: "down", band: true, grip: "fist",
    armL: -112, armR: 112, legL: 20, legR: -16, tail: -28, headTilt: -2,
    motion: "pump", extras: ["sweat", "dumbbell", "lines"],
    bg: GRIME.cobalt,
  },
  cooked: {
    label: "COOKED", sub: "pumped silly · arms gone to jelly",
    skin: GRIME.skinFlat, skinSh: GRIME.skinDetrSh,
    belly: 1.02, ripped: true, slouch: true,
    eyes: "dizzy", mouth: "loll", brow: "flat",
    armL: -4, armR: 4, legL: 46, legR: -40, tail: 36, headTilt: 9,
    motion: "breathe", extras: ["sweat", "lines"],
    bg: GRIME.couch,
  },
  nervous: {
    label: "NERVOUS", sub: "new grade · heart in the throat",
    skin: GRIME.skinPrimed, skinSh: GRIME.skinPrimedSh,
    belly: 0.84, ripped: true,
    eyes: "wide", mouth: "grit", brow: "up",
    armL: -52, armR: 22, legL: -34, legR: -14, tail: -8, headTilt: -3,
    motion: "breathe", extras: ["sweat"],
    bg: GRIME.sea,
  },
  focused: {
    label: "FOCUSED", sub: "long session · dialled right in",
    skin: GRIME.skinPrimed, skinSh: GRIME.skinPrimedSh,
    belly: 0.82, ripped: true,
    eyes: "focus", mouth: "grit", brow: "down", grip: "fist",
    armL: -72, armR: 66, legL: 14, legR: -12, tail: -16, headTilt: 0,
    motion: "breathe", extras: ["chalk"],
    bg: GRIME.cobalt,
  },
};

// ---- toe-pad hand ----
interface HandProps { skin: string; ink: string; fist?: boolean; }

function Hand({ skin, ink, fist }: HandProps) {
  if (fist) {
    return (
      <g>
        <circle cx="0" cy="-10" r="14" fill={skin} stroke={ink} strokeWidth="2.8" />
        <path d="M -11 -16 q 11 -6 22 0 M -11 -9 q 11 -6 22 0 M -11 -2 q 11 -6 22 0"
          fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M -12 -10 q 12 9 24 0" fill="none" stroke={ink} strokeWidth="2.2" />
      </g>
    );
  }
  const toes = [-32, -14, 6, 26];
  return (
    <g>
      {toes.map((a, i) => (
        <g key={i} transform={`rotate(${a})`}>
          <rect x="-3.4" y="-22" width="6.8" height="20" rx="3" fill={skin} stroke={ink} strokeWidth="2.4" />
          <circle cx="0" cy="-23" r="6.2" fill={skin} stroke={ink} strokeWidth="2.4" />
          <circle cx="0" cy="-23" r="2.2" fill={ink} opacity="0.35" />
        </g>
      ))}
    </g>
  );
}

// ---- eyes ----
interface EyesProps { kind: EyeKind; }

function Eyes({ kind }: EyesProps) {
  const ink = GRIME.ink;
  const white = "#efe9d6";

  interface EyeballProps { x: number; r: number; px: number; py: number; pr: number; lid?: number; }
  const Eyeball = ({ x, r, px, py, pr, lid }: EyeballProps) => (
    <g transform={`translate(${x},0)`}>
      <circle cx="0" cy="0" r={r} fill={white} stroke={ink} strokeWidth="3" />
      <circle cx={px} cy={py} r={pr} fill={ink} />
      {lid != null && (
        <path
          d={`M ${-r - 1} ${-r * 0.2} A ${r + 1} ${r + 1} 0 0 1 ${r + 1} ${-r * 0.2} L ${r + 1} ${-r - 2} L ${-r - 1} ${-r - 2} Z`}
          fill={GRIME.skinPrimedSh} stroke={ink} strokeWidth="2.6"
          transform={`translate(0 ${lid})`} opacity="0.96"
        />
      )}
    </g>
  );

  switch (kind) {
    case "wide":
      return (<g><Eyeball x={-24} r={19} px={5}  py={-4} pr={6} /><Eyeball x={21} r={14} px={2} py={-1} pr={5} /></g>);
    case "joy":
      return (<g>
        <path d="M -38 2 Q -22 -20 -6 2" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
        <path d="M 6 2 Q 20 -18 34 2"    fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
      </g>);
    case "stoned":
      return (<g><Eyeball x={-22} r={17} px={2} py={4} pr={6} lid={-9} /><Eyeball x={20} r={14} px={1} py={4} pr={5} lid={-7} /></g>);
    case "sad":
      return (<g>
        <g transform="rotate(-12 -22 0)"><Eyeball x={-22} r={16} px={-3} py={5} pr={6} lid={-10} /></g>
        <g transform="rotate(12 20 0)"> <Eyeball x={20}  r={14} px={3}  py={5} pr={5} lid={-9}  /></g>
      </g>);
    case "focus":
      return (<g>
        <Eyeball x={-22} r={16} px={7} py={2} pr={6} lid={-12} />
        <Eyeball x={20}  r={14} px={7} py={2} pr={5} lid={-11} />
      </g>);
    case "closed":
      return (<g>
        <path d="M -38 0 Q -22 9 -6 0" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
        <path d="M 6 0 Q 20 8 34 0"    fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
      </g>);
    case "dizzy": {
      const swirl = "M 0 0 q 3 0 3 3.5 q 0 5 -5.5 5 q -7.5 0 -7.5 -7.5 q 0 -9.5 9.5 -9.5 q 11.5 0 11.5 11.5";
      return (<g>
        <g transform="translate(-22,0)">
          <circle cx="0" cy="0" r={17} fill={white} stroke={ink} strokeWidth="3" />
          <path d={swirl} fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
        </g>
        <g transform="translate(20,0)">
          <circle cx="0" cy="0" r={14} fill={white} stroke={ink} strokeWidth="3" />
          <path d={swirl} fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
        </g>
      </g>);
    }
    default:
      return (<g><Eyeball x={-22} r={17} px={2} py={-2} pr={6} /><Eyeball x={20} r={14} px={2} py={-1} pr={5} /></g>);
  }
}

// ---- mouth ----
interface MouthProps { kind: MouthKind; }

function Mouth({ kind }: MouthProps) {
  const ink = GRIME.ink;
  switch (kind) {
    case "grin":
      return (<g>
        <path d="M -26 0 Q 0 26 30 2 Q 4 12 -26 0 Z" fill={GRIME.ink} />
        <path d="M -26 0 Q 0 26 30 2" fill="none" stroke={ink} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M -17 2 l 3 13 l 6 -9 Z" fill={GRIME.cream} stroke={ink} strokeWidth="1.8" />
        <path d="M -5 5 l 6 11 l 2 -10 Z"  fill={GRIME.cream} stroke={ink} strokeWidth="1.8" />
        <path d="M 8 4 l 2 7 l 4 -6 Z"     fill={GRIME.cream} stroke={ink} strokeWidth="1.6" />
      </g>);
    case "yell":
      return (<g>
        <path d="M -22 -2 Q 0 8 22 -2 Q 18 34 0 36 Q -18 34 -22 -2 Z" fill={GRIME.ink} />
        <path d="M -14 0 q 14 6 28 0 l -2 8 q -12 4 -24 0 Z" fill={GRIME.red} opacity="0.85" />
        <ellipse cx="0" cy="26" rx="8" ry="6" fill={GRIME.red} />
      </g>);
    case "lazy":
      return (<g>
        <path d="M -22 2 Q -2 12 24 4"  fill="none" stroke={ink} strokeWidth="3.6" strokeLinecap="round" />
        <path d="M 6 6 q 5 9 11 2"      fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
      </g>);
    case "frown":
      return (<g>
        <path d="M -22 12 Q 0 -8 24 12" fill="none" stroke={ink} strokeWidth="3.8" strokeLinecap="round" />
        <path d="M -10 7 l 3 8 l 4 -7 Z" fill={GRIME.cream} stroke={ink} strokeWidth="1.5" />
      </g>);
    case "snore":
      return (<g>
        <ellipse cx="0" cy="6"  rx="13" ry="9" fill={GRIME.ink} />
        <ellipse cx="0" cy="9"  rx="6"  ry="4" fill={GRIME.red} opacity="0.7" />
      </g>);
    case "grit":
      return (<g>
        <path d="M -24 0 Q 4 -10 28 0 L 26 4 Q 2 -4 -22 4 Z" fill={GRIME.ink} />
        <rect x="-22" y="0" width="46" height="15" rx="2" fill={GRIME.cream} stroke={GRIME.ink} strokeWidth="2.4" />
        {[-13, -5, 3, 11, 18].map((x, i) => (
          <line key={i} x1={x} y1="0" x2={x} y2="15" stroke={GRIME.ink} strokeWidth="1.5" />
        ))}
        <path d="M -24 16 Q 2 24 28 16" fill="none" stroke={GRIME.ink} strokeWidth="2.6" strokeLinecap="round" />
      </g>);
    case "loll":
      return (<g>
        {/* slack open mouth, jaw hanging */}
        <path d="M -20 -2 Q 0 6 20 -2 Q 17 16 0 18 Q -17 16 -20 -2 Z" fill={GRIME.ink} />
        {/* tongue lolling out and down past the chin */}
        <path d="M -7 10 Q -12 32 1 41 Q 15 35 11 13 Q 3 19 -7 10 Z"
          fill={GRIME.red} stroke={ink} strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M 2 18 Q 1 30 2 37" fill="none" stroke={ink} strokeWidth="1.5" opacity="0.5" />
      </g>);
    default:
      return <path d="M -20 4 Q 0 14 22 4" fill="none" stroke={ink} strokeWidth="3.4" strokeLinecap="round" />;
  }
}

// ===========================================================
// The Gecko
// ===========================================================
export default function Crag({ state = "primed", size = 300, showBg = true, uid, build = 0 }: CragProps) {
  const id = uid ?? state;
  const p = POSES[state];
  const ink = GRIME.ink;
  const reduced = useReducedMotion();
  const motionClass = reduced ? "mv" : `mv mv-${p.motion}`;

  // Physique tier (0..3) drives muscle definition. Bloated poses (detrained
  // couch-belly) stay soft regardless — the gag is they've gone to seed.
  const tier = Math.max(0, Math.min(3, Math.round(build)));
  // -1 = no abs; 0 = baseline pose ripple; 1..3 = progressively jacked.
  const absLevel = p.belly > 1.1 ? -1 : tier >= 1 ? tier : p.ripped ? 0 : -1;
  const armR = 13 + tier * 1.7;   // beefier shoulders as build climbs

  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg viewBox="0 0 260 300" width={size} height={size} style={{ display: "block" }}>
        <BuddyDefs id={id} frozen={reduced} />

        {/* grungy background */}
        {showBg && (
          <g>
            <rect x="0" y="0" width="260" height="300" fill={GRIME.paper} />
            <g filter={`url(#boilbg-${id})`}>
              <path d="M 18 40 Q 130 10 244 46 Q 256 160 232 262 Q 130 290 26 258 Q 6 150 18 40 Z"
                fill={p.bg} opacity="0.5" />
              <path d="M 40 70 Q 130 50 214 78 Q 222 170 196 232 Q 130 252 60 228 Q 40 150 40 70 Z"
                fill={p.bg} opacity="0.35" />
            </g>
            <rect x="0" y="0"   width="260" height="300" fill={`url(#hatch-${id})`}  opacity="0.25" />
            <rect x="0" y="200" width="260" height="100" fill={`url(#hatch2-${id})`} opacity="0.3"  />
          </g>
        )}

        {/* couch (detrained) sits behind the body */}
        {p.extras.includes("couch") && (
          <g filter={`url(#boil-${id})`}>
            <path d="M 6 196 Q 6 168 36 166 L 224 166 Q 252 168 252 196 L 252 286 L 6 286 Z"
              fill={GRIME.couch} stroke={ink} strokeWidth="3.4" />
            <path d="M 30 196 Q 30 180 50 180 L 210 180 Q 230 180 230 196 L 230 250 L 30 250 Z"
              fill={GRIME.couchSh} stroke={ink} strokeWidth="2.6" />
            <rect x="0" y="196" width="260" height="92" fill={`url(#hatch2-${id})`} opacity="0.25" />
          </g>
        )}

        {/* the boiling character */}
        <g filter={`url(#boil-${id})`}>
          <g transform="translate(130 156) scale(0.86) translate(-130 -150)">
          <g className={motionClass} transform="translate(130 150)">

            {/* TAIL — root cap keeps it fused to the torso under rotation */}
            <g transform={`translate(-20 40) rotate(${p.tail})`}>
              <circle cx="6" cy="6" r="20" fill={p.skin} stroke={ink} strokeWidth="3.4" />
              <path d="M 0 0 Q 60 6 96 -34 Q 120 -58 132 -40 Q 116 -30 104 -10 Q 78 26 18 28 Z"
                fill={p.skin} stroke={ink} strokeWidth="3.4" strokeLinejoin="round" />
              <path d="M 18 6 Q 64 8 96 -24" fill="none" stroke={ink} strokeWidth="2" opacity="0.4" />
            </g>

            {/* BACK LEG — hip cap (cx/cy at pivot so it stays put under rotation) */}
            <g transform={`translate(30 54) rotate(${p.legR})`}>
              <circle cx="0" cy="0" r="17" fill={p.skinSh} stroke={ink} strokeWidth="3.2" />
              <path d="M 0 -10 Q 26 4 30 40 Q 30 56 16 58 Q 6 40 -8 24 Q -10 6 0 -10 Z"
                fill={p.skinSh} stroke={ink} strokeWidth="3.2" strokeLinejoin="round" />
              <g transform="translate(22 56) rotate(150) scale(0.7)">
                <Hand skin={p.skinSh} ink={ink} />
              </g>
            </g>

            {/* FRONT LEG — hip cap */}
            <g transform={`translate(-28 54) rotate(${p.legL})`}>
              <circle cx="0" cy="0" r="17" fill={p.skin} stroke={ink} strokeWidth="3.2" />
              <path d="M 0 -10 Q -26 4 -30 40 Q -30 56 -16 58 Q -6 40 8 24 Q 10 6 0 -10 Z"
                fill={p.skin} stroke={ink} strokeWidth="3.2" strokeLinejoin="round" />
              <g transform="translate(-22 56) rotate(210) scale(0.7)">
                <Hand skin={p.skin} ink={ink} />
              </g>
            </g>

            {/* BODY / torso + belly */}
            <g>
              <path
                d={`M 0 -52 Q ${40 * p.belly} -44 ${44 * p.belly} 8
                    Q ${46 * p.belly} ${44 + (p.belly - 1) * 30} 0 ${58 + (p.belly - 1) * 26}
                    Q ${-44 * p.belly} ${44 + (p.belly - 1) * 30} ${-44 * p.belly} 8
                    Q ${-40 * p.belly} -44 0 -52 Z`}
                fill={p.skin} stroke={ink} strokeWidth="3.6" strokeLinejoin="round"
              />
              {/* belly plate */}
              <ellipse
                cx="0" cy={20 + (p.belly - 1) * 22}
                rx={26 * p.belly} ry={30 + (p.belly - 1) * 22}
                fill={p.belly > 1.1 ? GRIME.bellyDet : GRIME.belly}
                stroke={ink} strokeWidth="2.4" opacity="0.95"
              />
              {/* belly hatch segments */}
              <g opacity="0.5">
                {[-12, 2, 16, 30].map((yy, i) => (
                  <path key={i}
                    d={`M ${-20 * p.belly} ${yy + 12} Q 0 ${yy + 20} ${20 * p.belly} ${yy + 12}`}
                    fill="none" stroke={ink} strokeWidth="1.6"
                  />
                ))}
              </g>
              {/* abs — baseline ripple when in form, graduating to a full
                  six-pack + obliques as the all-time build tier climbs */}
              {absLevel >= 0 && (
                <g opacity="0.6" fill="none" stroke={ink}>
                  {/* pec line + two verticals (baseline, matches build 0) */}
                  <path d="M -16 -34 q 16 8 32 0" strokeWidth="2" />
                  <path d="M -6 -30 l 0 30 M 4 -30 l 0 30" strokeWidth="1.6" />
                  {/* upper ab divider */}
                  {absLevel >= 1 && <path d="M -14 -16 q 14 6 28 0" strokeWidth="1.6" />}
                  {/* lower ab divider — completes the six-pack */}
                  {absLevel >= 2 && <path d="M -13 -2 q 13 6 26 0" strokeWidth="1.5" />}
                  {/* serratus / obliques flanking the core */}
                  {absLevel >= 3 && (
                    <path d="M -21 -12 q 6 8 4 20 M 21 -12 q -6 8 -4 20"
                      strokeWidth="1.4" opacity="0.7" />
                  )}
                </g>
              )}
              {/* mottle */}
              <path
                d="M 0 -52 Q 44 -44 44 8 Q 46 50 0 58 Q -44 50 -44 8 Q -44 -44 0 -52 Z"
                fill={`url(#spots-${id})`}
              />
            </g>

            {/* BACK ARM */}
            <g transform={`translate(30 -28) rotate(${p.armR})`}>
              <circle cx="0" cy="0" r={armR} fill={p.skinSh} stroke={ink} strokeWidth="2.6" />
              <path d="M 0 0 Q 30 6 44 30 Q 50 42 40 48 Q 26 36 6 22 Q -2 10 0 0 Z"
                fill={p.skinSh} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
              {(p.ripped || absLevel >= 1) && <path d="M 12 10 q 12 8 22 22" fill="none" stroke={ink} strokeWidth="1.6" opacity="0.5" />}
              {absLevel >= 2 && <path d="M 4 2 q 14 -4 20 10" fill="none" stroke={ink} strokeWidth="1.5" opacity="0.5" />}
              <g transform="translate(42 46) rotate(20) scale(0.62)">
                <Hand skin={p.skinSh} ink={ink} fist={p.grip === "fist"} />
              </g>
            </g>

            {/* FRONT ARM */}
            <g transform={`translate(-30 -28) rotate(${p.armL})`}>
              <circle cx="0" cy="0" r={armR} fill={p.skin} stroke={ink} strokeWidth="2.6" />
              <path d="M 0 0 Q -30 6 -44 30 Q -50 42 -40 48 Q -26 36 -6 22 Q 2 10 0 0 Z"
                fill={p.skin} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
              {(p.ripped || absLevel >= 1) && <path d="M -12 10 q -12 8 -22 22" fill="none" stroke={ink} strokeWidth="1.6" opacity="0.5" />}
              {absLevel >= 2 && <path d="M -4 2 q -14 -4 -20 10" fill="none" stroke={ink} strokeWidth="1.5" opacity="0.5" />}
              <g transform="translate(-42 46) rotate(-20) scale(0.62)">
                <Hand skin={p.skin} ink={ink} fist={p.grip === "fist"} />
              </g>
            </g>

            {/* HEAD */}
            <g className="mv-head" transform={`translate(2 -84) rotate(${p.headTilt})`}>
              {/* dorsal crest spikes — drawn first so the skull covers their bases
                  and only the pointed tips read as a frill */}
              <g>
                <path d="M -36 -50 L -26 -80 L -12 -54 Z" fill={p.skinSh} stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />
                <path d="M -14 -54 L 0 -88 L 16 -56 Z"    fill={p.skin}   stroke={ink} strokeWidth="2.8" strokeLinejoin="round" />
                <path d="M 14 -54 L 30 -84 L 46 -52 Z"    fill={p.skin}   stroke={ink} strokeWidth="2.8" strokeLinejoin="round" />
                <path d="M 42 -48 L 54 -72 L 64 -44 Z"    fill={p.skinSh} stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />
              </g>
              {/* unified cranium + muzzle silhouette */}
              <path d="M -58 -12 C -70 -56 -26 -74 16 -70 C 56 -66 84 -46 82 -12
                       C 81 8 72 22 54 28 C 58 40 52 54 30 58 C 16 62 -2 62 -16 56
                       C -34 50 -52 42 -58 22 C -64 6 -64 4 -58 -12 Z"
                fill={p.skin} stroke={ink} strokeWidth="3.8" strokeLinejoin="round" />
              {/* muzzle crease */}
              <path d="M -50 16 Q 6 30 60 16" fill="none" stroke={ink} strokeWidth="2" opacity="0.4" />
              {/* nostrils */}
              <circle cx="-4" cy="30" r="2.6" fill={ink} />
              <circle cx="18" cy="31" r="2.6" fill={ink} />
              {/* brow ridge */}
              {p.brow === "up"   && <path d="M -38 -36 q 14 -12 30 -6 M 6 -38 q 16 -10 30 -2" fill="none" stroke={ink} strokeWidth="3"   strokeLinecap="round" />}
              {p.brow === "down" && <path d="M -36 -20 q 16 -8 28 4 M 8 -22 q 14 -8 28 2"    fill="none" stroke={ink} strokeWidth="3.4" strokeLinecap="round" />}
              {p.brow === "flat" && <path d="M -36 -30 l 28 2 M 8 -30 l 28 0"                fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />}
              {/* head crest bumps */}
              <path d="M -18 -68 q 6 -10 14 -2 q 8 -8 16 0 q 8 -8 16 2"
                fill="none" stroke={ink} strokeWidth="2.4" opacity="0.6" />
              {/* sweatband (training) */}
              {p.band && (
                <g transform="translate(0 -48)">
                  <path d="M -58 -6 Q 12 -22 82 -4 L 80 14 Q 12 -4 -56 12 Z"
                    fill={GRIME.red} stroke={ink} strokeWidth="2.8" strokeLinejoin="round" />
                  <rect x="-3" y="-16" width="11" height="13" rx="1.5" fill={GRIME.cream} stroke={ink} strokeWidth="1.8" />
                  <path d="M -56 4 l -17 4 l 4 11 l 15 -7 Z"
                    fill={GRIME.red} stroke={ink} strokeWidth="2.4" strokeLinejoin="round" />
                </g>
              )}
              {/* eyes sit high on the cranium */}
              <g transform="translate(0 -34)"><Eyes kind={p.eyes} /></g>
              {/* mouth centered on the muzzle */}
              <g transform="translate(6 40)"><Mouth kind={p.mouth} /></g>
              {/* cheek mottle */}
              <path d="M -58 -12 C -70 -56 -26 -74 16 -70 C 56 -66 84 -46 82 -12 C 81 8 72 22 54 28 C 58 40 52 54 30 58 C 16 62 -2 62 -16 56 C -34 50 -52 42 -58 22 C -64 6 -64 4 -58 -12 Z"
                fill={`url(#spots-${id})`} opacity="0.7" />
            </g>

          </g>
          </g>
        </g>

        {/* per-state extras — front layer */}
        {p.extras.includes("chalk") && (
          <g filter={`url(#boilbg-${id})`} opacity="0.85">
            <circle cx="60"  cy="250" r="20" fill={GRIME.chalk} opacity="0.7"  />
            <circle cx="90"  cy="262" r="13" fill={GRIME.chalk} opacity="0.6"  />
            <circle cx="200" cy="246" r="16" fill={GRIME.chalk} opacity="0.65" />
          </g>
        )}
        {p.extras.includes("sparks") && (
          <g className="mv-sparks">
            {([[40,70],[214,64],[58,150],[210,150],[130,30]] as [number,number][]).map(([x,y],i) => (
              <path key={i}
                d={`M ${x} ${y-9} L ${x+3} ${y-2} L ${x+10} ${y} L ${x+3} ${y+3} L ${x} ${y+10} L ${x-3} ${y+3} L ${x-10} ${y} L ${x-3} ${y-2} Z`}
                fill={GRIME.cream} stroke={GRIME.ink} strokeWidth="1.6"
              />
            ))}
          </g>
        )}
        {p.extras.includes("sweat") && (
          <g className="mv-sweat">
            <path d="M 196 96 q -7 12 0 18 q 7 -6 0 -18 Z" fill="#9fc6d6" stroke={GRIME.ink} strokeWidth="1.8" />
          </g>
        )}
        {p.extras.includes("snack") && (
          <g filter={`url(#boil-${id})`}>
            <ellipse cx="70" cy="276" rx="16" ry="7" fill={GRIME.mustard} stroke={GRIME.ink} strokeWidth="2.6" />
            <circle cx="62" cy="274" r="2"   fill={GRIME.ink} />
            <circle cx="74" cy="277" r="1.6" fill={GRIME.ink} />
          </g>
        )}
        {p.extras.includes("dumbbell") && (
          <g filter={`url(#boil-${id})`} transform="translate(58 280) rotate(-4)">
            <rect x="-22" y="-5" width="44" height="9"  fill={GRIME.ink2}   stroke={GRIME.ink} strokeWidth="2"   />
            <rect x="-34" y="-13" width="13" height="25" rx="2" fill={GRIME.cobalt} stroke={GRIME.ink} strokeWidth="2.6" />
            <rect x="21"  y="-13" width="13" height="25" rx="2" fill={GRIME.cobalt} stroke={GRIME.ink} strokeWidth="2.6" />
          </g>
        )}
        {p.extras.includes("lines") && (
          <g className="mv-sparks" stroke={GRIME.ink} strokeWidth="2.6" strokeLinecap="round" opacity="0.45">
            <path d="M 36 116 l -16 0 M 224 116 l 16 0 M 30 150 l -14 0 M 230 150 l 14 0" fill="none" />
          </g>
        )}
        {p.extras.includes("zzz") && (
          <g className="mv-zzz" fill={GRIME.ink} fontFamily="'Bungee', sans-serif">
            <text x="188" y="78"  fontSize="22" transform="rotate(-8 188 78)">Z</text>
            <text x="206" y="58"  fontSize="16" transform="rotate(-8 206 58)">z</text>
            <text x="218" y="44"  fontSize="11">z</text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ---- lobby condition helper (exported for Dashboard + TickSheet) ----
// sessions14 = number of sessions with started_at in the last 14 days
export function lobbyCondition(sessions14: number): CragState {
  if (sessions14 === 0) return "detrained";
  if (sessions14 <= 3)  return "training";
  return "primed";
}
