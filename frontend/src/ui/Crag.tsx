/* Crag.tsx — "Crag" the climbing buddy.
   Ported from design_handoff_climbing_buddy/buddy.jsx.
   Grungy early-MTV cel style: cut-out puppet rig + animated turbulence boil.
   Keep the GRIME palette local — the slight grime offset from app tokens is the point.

   The rig is species-agnostic: poses, eyes, mouths, motion and extras are
   shared, and each species (gecko / ibex / galah / wombat) plugs in its own
   palette, head, limb-ends and tail. Same moods, same build tiers, new animal.
*/
import { useState, useEffect } from "react";
import type { FC } from "react";
import type { CragSpecies } from "./cragSpecies";

// ---- grimed palette (intentionally slightly different from app tokens) ----
const GRIME = {
  ink:          "#1c1710",
  ink2:         "#3a2f22",
  paper:        "#e7d9b6",
  cream:        "#f2e6c4",
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
type SkinTone  = "fit" | "flat" | "soft";
type ShadeTone = "fit" | "soft";

interface PoseConfig {
  label:    string;
  sub:      string;
  tone:     SkinTone;    // body colour key into the species palette
  shade:    ShadeTone;   // shadow colour key
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

// Every species supplies the same colour slots so any pose works on any animal.
interface Palette {
  fit:       string;   // in-form coat
  fitSh:     string;
  flat:      string;   // worked / mid coat
  soft:      string;   // gone-to-seed coat
  softSh:    string;
  belly:     string;   // chest plate
  bellySoft: string;
  head?:     string;   // head override (galah's pink face); defaults to body skin
  headSh?:   string;
}

interface HeadProps  { p: PoseConfig; skin: string; skinSh: string; pal: Palette; uid: string; build: number; }
interface EndProps   { skin: string; ink: string; fist?: boolean; }   // hand / hoof / wingtip / paw
interface TailProps  { skin: string; skinSh: string; ink: string; }

interface SpeciesConfig {
  pal:     Palette;
  texture: "spots" | "fur" | "none";  // torso overlay
  Head:    FC<HeadProps>;
  End:     FC<EndProps>;
  Tail:    FC<TailProps>;
}

export interface CragProps {
  state?:   CragState;
  species?: CragSpecies;  // default "gecko" — the original
  size?:    number;       // px, default 300
  showBg?:  boolean;      // default true; false = transparent
  uid?:     string;       // unique id for SVG filter/pattern defs — use when multiple Crags on one page
  build?:   number;       // 0..3 physique tier — scales musculature (default 0 = scrawny)
  still?:   boolean;      // freeze boil + motion (picker previews — one animated buddy per screen)
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

      {/* sticker halo — a dilated cream copy of the silhouette drawn behind
          the figure so the coat never melts into a same-hue wash panel */}
      <filter id={`halo-${id}`} x="-15%" y="-15%" width="130%" height="130%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="4.5" result="fat" />
        <feFlood floodColor={GRIME.cream} result="tint" />
        <feComposite in="tint" in2="fat" operator="in" result="halo" />
        <feMerge>
          <feMergeNode in="halo" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
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

      {/* mottle dots on skin (gecko) */}
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
    tone: "fit", shade: "fit",
    belly: 0.74, ripped: true,
    eyes: "wide", mouth: "grin", brow: "up",
    armL: -38, armR: 28, legL: 18, legR: -14, tail: -22, headTilt: -4,
    motion: "headbang", extras: ["chalk"],
    bg: GRIME.sea,
  },
  detrained: {
    label: "OFF-SEASON", sub: "quiet stretch · taking it easy",
    tone: "soft", shade: "soft",
    belly: 1.32, ripped: false, slouch: true,
    eyes: "stoned", mouth: "lazy", brow: "flat",
    armL: 8, armR: -64, legL: 70, legR: 52, tail: 40, headTilt: 10,
    motion: "slouch", extras: ["couch", "snack"],
    bg: GRIME.couch,
  },
  stoked: {
    label: "STOKED", sub: "SEND ✓ — buzzing for you",
    tone: "fit", shade: "fit",
    belly: 0.8, ripped: true,
    eyes: "joy", mouth: "yell", brow: "up",
    armL: -120, armR: 118, legL: 26, legR: -22, tail: -54, headTilt: -2,
    motion: "jump", extras: ["chalk", "sparks"],
    bg: GRIME.mustard,
  },
  shakeoff: {
    label: "SHAKE IT OFF", sub: "came off? go again",
    tone: "flat", shade: "fit",
    belly: 0.9, ripped: true,
    eyes: "focus", mouth: "grin", brow: "up", grip: "fist",
    armL: -8, armR: 128, legL: 22, legR: -18, tail: -24, headTilt: -3,
    motion: "pump", extras: ["lines"],
    bg: GRIME.sea,
  },
  resting: {
    label: "RESTING", sub: "rest day · do not disturb",
    tone: "flat", shade: "fit",
    belly: 1.05, ripped: false,
    eyes: "closed", mouth: "snore", brow: "flat",
    armL: -10, armR: 10, legL: 40, legR: -36, tail: 30, headTilt: 8,
    motion: "breathe", extras: ["zzz"],
    bg: GRIME.cobalt,
  },
  training: {
    label: "TRAINING", sub: "rebuilding · eye of the tiger",
    tone: "fit", shade: "fit",
    belly: 0.86, ripped: true,
    eyes: "focus", mouth: "grit", brow: "down", band: true, grip: "fist",
    armL: -112, armR: 112, legL: 20, legR: -16, tail: -28, headTilt: -2,
    motion: "pump", extras: ["sweat", "dumbbell", "lines"],
    bg: GRIME.cobalt,
  },
  cooked: {
    label: "COOKED", sub: "pumped silly · arms gone to jelly",
    tone: "flat", shade: "soft",
    belly: 1.02, ripped: true, slouch: true,
    eyes: "dizzy", mouth: "loll", brow: "flat",
    armL: -4, armR: 4, legL: 46, legR: -40, tail: 36, headTilt: 9,
    motion: "breathe", extras: ["sweat", "lines"],
    bg: GRIME.couch,
  },
  nervous: {
    label: "NERVOUS", sub: "new grade · heart in the throat",
    tone: "fit", shade: "fit",
    belly: 0.84, ripped: true,
    eyes: "wide", mouth: "grit", brow: "up",
    armL: -52, armR: 22, legL: -34, legR: -14, tail: -8, headTilt: -3,
    motion: "breathe", extras: ["sweat"],
    bg: GRIME.sea,
  },
  focused: {
    label: "FOCUSED", sub: "long session · dialled right in",
    tone: "fit", shade: "fit",
    belly: 0.82, ripped: true,
    eyes: "focus", mouth: "grit", brow: "down", grip: "fist",
    armL: -72, armR: 66, legL: 14, legR: -12, tail: -16, headTilt: 0,
    motion: "breathe", extras: ["chalk"],
    bg: GRIME.cobalt,
  },
};

// ---- eyes ----
interface EyesProps { kind: EyeKind; lidFill: string; }

function Eyes({ kind, lidFill }: EyesProps) {
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
          fill={lidFill} stroke={ink} strokeWidth="2.6"
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

// ---- brows (shared across species — placed in head-local coords) ----
function Brows({ kind }: { kind: BrowKind }) {
  const ink = GRIME.ink;
  if (kind === "up")   return <path d="M -38 -36 q 14 -12 30 -6 M 6 -38 q 16 -10 30 -2" fill="none" stroke={ink} strokeWidth="3"   strokeLinecap="round" />;
  if (kind === "down") return <path d="M -36 -20 q 16 -8 28 4 M 8 -22 q 14 -8 28 2"    fill="none" stroke={ink} strokeWidth="3.4" strokeLinecap="round" />;
  return <path d="M -36 -30 l 28 2 M 8 -30 l 28 0" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />;
}

// ---- sweatband (training) — shared; heads position it ----
function Band() {
  const ink = GRIME.ink;
  return (
    <g>
      <path d="M -58 -6 Q 12 -22 82 -4 L 80 14 Q 12 -4 -56 12 Z"
        fill={GRIME.red} stroke={ink} strokeWidth="2.8" strokeLinejoin="round" />
      <rect x="-3" y="-16" width="11" height="13" rx="1.5" fill={GRIME.cream} stroke={ink} strokeWidth="1.8" />
      <path d="M -56 4 l -17 4 l 4 11 l 15 -7 Z"
        fill={GRIME.red} stroke={ink} strokeWidth="2.4" strokeLinejoin="round" />
    </g>
  );
}

// ===========================================================
// GECKO — the original
// ===========================================================

function GeckoEnd({ skin, ink, fist }: EndProps) {
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

function GeckoTail({ skin, ink }: TailProps) {
  return (
    <g>
      <circle cx="6" cy="6" r="20" fill={skin} stroke={ink} strokeWidth="3.4" />
      <path d="M 0 0 Q 60 6 96 -34 Q 120 -58 132 -40 Q 116 -30 104 -10 Q 78 26 18 28 Z"
        fill={skin} stroke={ink} strokeWidth="3.4" strokeLinejoin="round" />
      <path d="M 18 6 Q 64 8 96 -24" fill="none" stroke={ink} strokeWidth="2" opacity="0.4" />
    </g>
  );
}

function GeckoHead({ p, skin, skinSh, uid }: HeadProps) {
  const ink = GRIME.ink;
  return (
    <g>
      {/* dorsal crest spikes — drawn first so the skull covers their bases
          and only the pointed tips read as a frill */}
      <g>
        <path d="M -36 -50 L -26 -80 L -12 -54 Z" fill={skinSh} stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M -14 -54 L 0 -88 L 16 -56 Z"    fill={skin}   stroke={ink} strokeWidth="2.8" strokeLinejoin="round" />
        <path d="M 14 -54 L 30 -84 L 46 -52 Z"    fill={skin}   stroke={ink} strokeWidth="2.8" strokeLinejoin="round" />
        <path d="M 42 -48 L 54 -72 L 64 -44 Z"    fill={skinSh} stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />
      </g>
      {/* unified cranium + muzzle silhouette */}
      <path d="M -58 -12 C -70 -56 -26 -74 16 -70 C 56 -66 84 -46 82 -12
               C 81 8 72 22 54 28 C 58 40 52 54 30 58 C 16 62 -2 62 -16 56
               C -34 50 -52 42 -58 22 C -64 6 -64 4 -58 -12 Z"
        fill={skin} stroke={ink} strokeWidth="3.8" strokeLinejoin="round" />
      {/* muzzle crease */}
      <path d="M -50 16 Q 6 30 60 16" fill="none" stroke={ink} strokeWidth="2" opacity="0.4" />
      {/* nostrils */}
      <circle cx="-4" cy="30" r="2.6" fill={ink} />
      <circle cx="18" cy="31" r="2.6" fill={ink} />
      <Brows kind={p.brow} />
      {/* head crest bumps */}
      <path d="M -18 -68 q 6 -10 14 -2 q 8 -8 16 0 q 8 -8 16 2"
        fill="none" stroke={ink} strokeWidth="2.4" opacity="0.6" />
      {p.band && <g transform="translate(0 -48)"><Band /></g>}
      {/* eyes sit high on the cranium */}
      <g transform="translate(0 -34)"><Eyes kind={p.eyes} lidFill={skinSh} /></g>
      {/* mouth centered on the muzzle */}
      <g transform="translate(6 40)"><Mouth kind={p.mouth} /></g>
      {/* cheek mottle */}
      <path d="M -58 -12 C -70 -56 -26 -74 16 -70 C 56 -66 84 -46 82 -12 C 81 8 72 22 54 28 C 58 40 52 54 30 58 C 16 62 -2 62 -16 56 C -34 50 -52 42 -58 22 C -64 6 -64 4 -58 -12 Z"
        fill={`url(#spots-${uid})`} opacity="0.7" />
    </g>
  );
}

// ===========================================================
// IBEX — the alpine unit. Horns grow with the build tier.
// ===========================================================
const HORN = "#b59a6e";
const HORN_SH = "#8a7350";

// Right-sweeping horn per build tier (0 = young spikes … 3 = full-curl legend).
// The far horn is this path mirrored. The rig clips ≈ y −92 head-local, so
// horns grow BACKWARDS (lateral sweep) like the real animal, never straight up.
const HORN_F = [
  "M 14 -56 Q 22 -82 36 -88 Q 44 -80 34 -64 Q 26 -54 22 -48 Z",
  "M 12 -54 Q 28 -90 58 -84 Q 66 -76 52 -64 Q 34 -54 24 -46 Z",
  "M 12 -52 Q 32 -96 70 -82 Q 86 -72 80 -56 Q 68 -48 48 -50 Q 28 -50 22 -46 Z",
  "M 10 -50 Q 30 -100 70 -90 Q 94 -80 92 -52 Q 90 -32 74 -30 Q 62 -32 66 -44 Q 78 -48 80 -60 Q 78 -78 58 -82 Q 36 -82 26 -60 Q 20 -50 18 -44 Z",
];
// Matching ridge ticks along the horn spine.
const HORN_RIDGE = [
  "M 20 -62 q 8 -8 12 -14",
  "M 22 -60 q 10 -8 16 -12 M 40 -74 q 8 -2 12 0",
  "M 24 -60 q 10 -10 18 -12 M 46 -74 q 10 -2 14 2 M 66 -68 q 6 6 8 12",
  "M 24 -58 q 10 -10 18 -14 M 46 -78 q 10 -2 16 2 M 70 -72 q 8 6 10 14",
];

function IbexHead({ p, skin, skinSh, uid, build }: HeadProps) {
  const ink = GRIME.ink;
  const tier = Math.max(0, Math.min(3, Math.round(build)));
  return (
    <g>
      {/* ears first — the full-curl horn sweeps back over the near ear */}
      <path d="M -40 -34 Q -64 -44 -70 -30 Q -62 -18 -42 -24 Z" fill={skin}   stroke={ink} strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M 58 -30 Q 80 -38 84 -24 Q 76 -14 58 -20 Z"      fill={skinSh} stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />
      {/* horns — a mirrored pair; the far one darker and a touch smaller so
          the pair reads with depth instead of as symmetric handles */}
      <g transform="translate(-8 -2) scale(-0.86 0.92)">
        <path d={HORN_F[tier]} fill={HORN_SH} stroke={ink} strokeWidth="2.8" strokeLinejoin="round" />
      </g>
      <path d={HORN_F[tier]} fill={HORN} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      <path d={HORN_RIDGE[tier]} fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />
      {/* cranium + long muzzle (shared gecko silhouette reads goat-long already) */}
      <path d="M -58 -12 C -70 -56 -26 -74 16 -70 C 56 -66 84 -46 82 -12
               C 81 8 72 22 54 28 C 58 40 52 54 30 58 C 16 62 -2 62 -16 56
               C -34 50 -52 42 -58 22 C -64 6 -64 4 -58 -12 Z"
        fill={skin} stroke={ink} strokeWidth="3.8" strokeLinejoin="round" />
      {/* muzzle bridge + crease */}
      <path d="M 2 -14 Q 6 6 6 18" fill="none" stroke={ink} strokeWidth="2" opacity="0.3" />
      <path d="M -50 16 Q 6 30 60 16" fill="none" stroke={ink} strokeWidth="2" opacity="0.4" />
      {/* goat nostril slits */}
      <path d="M -8 27 q -5 5 -1 10" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M 17 28 q 5 5 1 10"  fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      <Brows kind={p.brow} />
      {/* fur hatch on the crown */}
      <path d="M -20 -64 q 4 -8 10 -2 m 4 -2 q 4 -8 10 -2 m 4 -2 q 4 -6 9 -1"
        fill="none" stroke={ink} strokeWidth="2" opacity="0.5" />
      {p.band && <g transform="translate(0 -46)"><Band /></g>}
      <g transform="translate(0 -34)"><Eyes kind={p.eyes} lidFill={skinSh} /></g>
      <g transform="translate(6 38)"><Mouth kind={p.mouth} /></g>
      {/* the beard — non-negotiable on an ibex */}
      <path d="M -6 52 Q -12 76 2 86 Q 14 76 16 54 Q 4 62 -6 52 Z"
        fill={skinSh} stroke={ink} strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M 0 60 Q 2 70 3 78 M 8 58 Q 9 68 8 74" fill="none" stroke={ink} strokeWidth="1.4" opacity="0.5" />
      {/* cheek fur */}
      <path d="M -52 26 l -8 6 M -46 36 l -8 5" fill="none" stroke={ink} strokeWidth="1.8" opacity="0.4" />
      <g opacity="0.25"><path d="M -58 -12 C -70 -56 -26 -74 16 -70 C 56 -66 84 -46 82 -12 C 81 8 72 22 54 28 C 58 40 52 54 30 58 C 16 62 -2 62 -16 56 C -34 50 -52 42 -58 22 C -64 6 -64 4 -58 -12 Z"
        fill={`url(#hatch2-${uid})`} /></g>
    </g>
  );
}

function IbexEnd({ skin, ink }: EndProps) {
  // cloven hoof — fist or open, a hoof is a hoof
  return (
    <g>
      <path d="M -12 -6 Q 0 -12 12 -6 L 13 6 Q 0 12 -13 6 Z" fill={skin} stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M -13 -4 L -14 -22 Q -8 -28 -2 -24 L -1 -8 M 1 -8 L 2 -24 Q 8 -28 14 -22 L 13 -4 Q 0 -12 -13 -4 Z"
        fill="#453626" stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M 0 -8 L 0 -24" stroke={ink} strokeWidth="2" />
    </g>
  );
}

function IbexTail({ skin, ink }: TailProps) {
  return (
    <g>
      <circle cx="4" cy="6" r="16" fill={skin} stroke={ink} strokeWidth="3.2" />
      <path d="M 0 0 Q 24 -2 34 -20 Q 38 -32 28 -32 Q 16 -26 6 -10 Q 0 -4 0 0 Z"
        fill={skin} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      <path d="M 12 -8 q 8 -8 14 -16" fill="none" stroke={ink} strokeWidth="1.6" opacity="0.5" />
    </g>
  );
}

// ===========================================================
// GALAH — loud, pink, zero fear.
// ===========================================================
const CREST = "#e3b7a4";
const BEAK = "#c4b28a";
const BEAK_SH = "#9a8a64";

function GalahHead({ p, skinSh, pal }: HeadProps) {
  const ink = GRIME.ink;
  const face = pal.head ?? pal.fit;
  const faceSh = pal.headSh ?? skinSh;
  // crest fans upright when psyched, sweeps back when flat or gritting
  const crest = p.brow === "up" ? [-42, -20, 2, 24, 46] : [22, 40, 57, 73, 87];
  return (
    <g>
      {/* crest feathers — bases hidden under the skull */}
      <g transform="translate(6 -56)">
        {crest.map((a, i) => (
          <g key={i} transform={`rotate(${a})`}>
            <path d="M 0 6 Q -9 -18 -2 -42 Q 2 -48 7 -42 Q 11 -16 0 6 Z"
              fill={i % 2 ? CREST : "#d8a692"} stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M 2 -8 L 2 -34" stroke={ink} strokeWidth="1.4" opacity="0.4" />
          </g>
        ))}
      </g>
      {/* round pink skull */}
      <path d="M -52 -8 C -62 -50 -18 -72 20 -68 C 58 -64 80 -42 78 -8
               C 76 18 62 36 38 44 C 18 52 -12 52 -30 42 C -46 34 -58 18 -52 -8 Z"
        fill={face} stroke={ink} strokeWidth="3.8" strokeLinejoin="round" />
      {/* bare eye-rings — the galah stare */}
      <ellipse cx="-24" cy="-34" rx="21" ry="19" fill="#e9ddc0" stroke={ink} strokeWidth="2" opacity="0.85" />
      <ellipse cx="21"  cy="-34" rx="16" ry="15" fill="#e9ddc0" stroke={ink} strokeWidth="2" opacity="0.85" />
      <Brows kind={p.brow} />
      {p.band && <g transform="translate(0 -46)"><Band /></g>}
      <g transform="translate(0 -34)"><Eyes kind={p.eyes} lidFill={faceSh} /></g>
      {/* hooked upper beak over the mouth — cere dots on top */}
      <path d="M -20 4 Q 8 -6 36 4 Q 36 24 21 32 Q 15 44 8 47 Q 1 44 -5 32 Q -18 24 -20 4 Z"
        fill={BEAK} stroke={ink} strokeWidth="3.2" strokeLinejoin="round" />
      {/* underside shade sells the hook */}
      <path d="M -5 32 Q 8 38 21 32 Q 15 43 8 46 Q 1 43 -5 32 Z" fill={BEAK_SH} stroke={ink} strokeWidth="1.6" />
      <path d="M -10 10 Q 8 4 26 10" fill="none" stroke={ink} strokeWidth="1.6" opacity="0.4" />
      <circle cx="2" cy="7" r="1.8" fill={ink} opacity="0.7" />
      <circle cx="15" cy="7" r="1.8" fill={ink} opacity="0.7" />
      {/* mouth reads as the open lower beak */}
      <g transform="translate(6 52) scale(0.9)"><Mouth kind={p.mouth} /></g>
    </g>
  );
}

function GalahEnd({ skin, ink, fist }: EndProps) {
  if (fist) {
    // folded wing knuckle
    return (
      <g>
        <path d="M -14 -18 Q 0 -26 14 -18 Q 16 -6 12 2 Q 0 -4 -12 2 Q -16 -6 -14 -18 Z"
          fill={skin} stroke={ink} strokeWidth="2.8" strokeLinejoin="round" />
        <path d="M -8 -14 Q 0 -18 8 -14 M -10 -7 Q 0 -12 10 -7" fill="none" stroke={ink} strokeWidth="1.6" opacity="0.5" />
      </g>
    );
  }
  const feathers = [-34, -13, 7, 27];
  return (
    <g>
      {feathers.map((a, i) => (
        <g key={i} transform={`rotate(${a})`}>
          <path d="M -4 0 Q -7 -14 0 -31 Q 7 -14 4 0 Q 0 5 -4 0 Z"
            fill={skin} stroke={ink} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M 0 -6 L 0 -24" stroke={ink} strokeWidth="1.3" opacity="0.4" />
        </g>
      ))}
    </g>
  );
}

function GalahTail({ skin, skinSh, ink }: TailProps) {
  const angles = [-32, -16, 0];
  return (
    <g>
      <circle cx="4" cy="6" r="15" fill={skin} stroke={ink} strokeWidth="3.2" />
      {angles.map((a, i) => (
        <g key={i} transform={`rotate(${a})`}>
          <path d="M 0 -7 L 74 -14 Q 86 -10 76 -1 L 0 7 Q -6 0 0 -7 Z"
            fill={i === 1 ? skinSh : skin} stroke={ink} strokeWidth="2.8" strokeLinejoin="round" />
          <path d="M 8 -1 L 62 -7" stroke={ink} strokeWidth="1.3" opacity="0.4" />
        </g>
      ))}
    </g>
  );
}

// ===========================================================
// WOMBAT — built like a boulder.
// ===========================================================

function WombatHead({ p, skin, skinSh, uid }: HeadProps) {
  const ink = GRIME.ink;
  return (
    <g>
      {/* small round ears, bases under the skull */}
      <g>
        <path d="M -44 -46 Q -50 -74 -28 -70 Q -14 -64 -22 -44 Z" fill={skin}   stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="M 26 -44 Q 30 -72 52 -66 Q 64 -58 52 -40 Z"      fill={skin}   stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="M -38 -52 Q -40 -64 -30 -62 Z" fill={skinSh} stroke={ink} strokeWidth="1.8" />
        <path d="M 34 -50 Q 38 -60 46 -56 Z"    fill={skinSh} stroke={ink} strokeWidth="1.8" />
      </g>
      {/* broad low skull — all cheek */}
      <path d="M -64 -6 C -72 -48 -28 -70 16 -68 C 60 -66 88 -44 86 -8
               C 84 20 70 36 48 44 C 26 54 -16 56 -38 46 C -58 38 -70 24 -64 -6 Z"
        fill={skin} stroke={ink} strokeWidth="3.8" strokeLinejoin="round" />
      <Brows kind={p.brow} />
      {p.band && <g transform="translate(0 -48)"><Band /></g>}
      <g transform="translate(0 -34)"><Eyes kind={p.eyes} lidFill={skinSh} /></g>
      {/* the big nose pad */}
      <rect x="-12" y="6" width="48" height="32" rx="14" fill="#3f332a" stroke={ink} strokeWidth="3" />
      <path d="M 2 20 q -4 5 0 10 M 22 20 q 4 5 0 10" fill="none" stroke="#cbbd9c" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
      <path d="M -2 8 Q 12 4 26 8" fill="none" stroke="#cbbd9c" strokeWidth="1.6" opacity="0.4" />
      {/* whiskers */}
      <path d="M -18 26 l -22 -4 M -16 32 l -21 2 M 40 26 l 22 -4 M 38 32 l 21 2"
        fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      <circle cx="-24" cy="24" r="1.4" fill={ink} opacity="0.5" />
      <circle cx="-22" cy="31" r="1.4" fill={ink} opacity="0.5" />
      <circle cx="46" cy="24" r="1.4" fill={ink} opacity="0.5" />
      <circle cx="44" cy="31" r="1.4" fill={ink} opacity="0.5" />
      {/* mouth tucked under the nose */}
      <g transform="translate(10 48) scale(0.86)"><Mouth kind={p.mouth} /></g>
      {/* cheek fur tufts */}
      <path d="M -60 14 l -9 4 M -58 24 l -9 3 M 82 12 l 9 4 M 80 22 l 9 3"
        fill="none" stroke={ink} strokeWidth="1.8" opacity="0.4" />
      <g opacity="0.22"><path d="M -64 -6 C -72 -48 -28 -70 16 -68 C 60 -66 88 -44 86 -8 C 84 20 70 36 48 44 C 26 54 -16 56 -38 46 C -58 38 -70 24 -64 -6 Z"
        fill={`url(#hatch2-${uid})`} /></g>
    </g>
  );
}

function WombatEnd({ skin, ink, fist }: EndProps) {
  if (fist) {
    return (
      <g>
        <circle cx="0" cy="-10" r="14" fill={skin} stroke={ink} strokeWidth="2.8" />
        <path d="M -9 -22 L -7 -30 L -3 -22 M -2 -23 L 1 -31 L 4 -23 M 6 -21 L 9 -28 L 11 -20 Z"
          fill="#e8ddc2" stroke={ink} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M -12 -10 q 12 9 24 0" fill="none" stroke={ink} strokeWidth="2.2" />
      </g>
    );
  }
  return (
    <g>
      <circle cx="0" cy="-8" r="13" fill={skin} stroke={ink} strokeWidth="2.8" />
      {[-9, 0, 9].map((x, i) => (
        <path key={i} d={`M ${x - 3.4} -16 L ${x} -32 L ${x + 3.4} -16 Z`}
          fill="#e8ddc2" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      ))}
      <path d="M -8 -4 q 8 6 16 0" fill="none" stroke={ink} strokeWidth="1.8" opacity="0.5" />
    </g>
  );
}

function WombatTail({ skin, ink }: TailProps) {
  // wombats barely have one — that's the gag
  return (
    <g>
      <circle cx="6" cy="6" r="16" fill={skin} stroke={ink} strokeWidth="3.2" />
      <path d="M 2 -2 Q 20 -4 25 -12 Q 27 -20 17 -19 Q 7 -16 0 -6 Z"
        fill={skin} stroke={ink} strokeWidth="2.8" strokeLinejoin="round" />
    </g>
  );
}

// ---- the species table ----
const SPECIES: Record<CragSpecies, SpeciesConfig> = {
  gecko: {
    pal: {
      fit: "#8a9a4e", fitSh: "#5f6c34", flat: "#7c8550",
      soft: "#8f9270", softSh: "#646650",
      belly: "#cdcf9a", bellySoft: "#c2bd92",
    },
    texture: "spots",
    Head: GeckoHead, End: GeckoEnd, Tail: GeckoTail,
  },
  ibex: {
    pal: {
      fit: "#97764a", fitSh: "#6a5232", flat: "#8b7350",
      soft: "#9a8a68", softSh: "#6b604a",
      belly: "#d9c99f", bellySoft: "#cbbc93",
    },
    texture: "fur",
    Head: IbexHead, End: IbexEnd, Tail: IbexTail,
  },
  galah: {
    pal: {
      fit: "#8f887a", fitSh: "#625c50", flat: "#857e70",
      soft: "#948e82", softSh: "#67614f",
      belly: "#c97f72", bellySoft: "#bd8378",
      head: "#c97f72", headSh: "#9e5c50",
    },
    texture: "none",
    Head: GalahHead, End: GalahEnd, Tail: GalahTail,
  },
  wombat: {
    pal: {
      fit: "#82705c", fitSh: "#574a3a", flat: "#7a6a58",
      soft: "#877b6a", softSh: "#5c5344",
      belly: "#c6b493", bellySoft: "#b9ab8c",
    },
    texture: "fur",
    Head: WombatHead, End: WombatEnd, Tail: WombatTail,
  },
};

// ===========================================================
// The buddy
// ===========================================================
export default function Crag({ state = "primed", species = "gecko", size = 300, showBg = true, uid, build = 0, still = false }: CragProps) {
  const id = uid ?? state;
  const p = POSES[state];
  const sp = SPECIES[species] ?? SPECIES.gecko;
  const pal = sp.pal;
  const skin   = pal[p.tone];
  const skinSh = p.shade === "fit" ? pal.fitSh : pal.softSh;
  const ink = GRIME.ink;
  const reduced = useReducedMotion();
  const frozen = reduced || still;
  const motionClass = frozen ? "mv" : `mv mv-${p.motion}`;
  const { Head, End, Tail } = sp;

  // Physique tier (0..3) drives muscle definition. Bloated poses (detrained
  // couch-belly) stay soft regardless — the gag is they've gone to seed.
  const tier = Math.max(0, Math.min(3, Math.round(build)));
  // -1 = no abs; 0 = baseline pose ripple; 1..3 = progressively jacked.
  const absLevel = p.belly > 1.1 ? -1 : tier >= 1 ? tier : p.ripped ? 0 : -1;
  // Build must read in a 90px thumbnail, so it changes the silhouette, not
  // just the line work: fatter shoulder caps, scaled-up limb masses (they
  // pivot at the joint, so scaling beefs them in place) and a shoulder
  // flare on the torso for the V-taper. Gone-to-seed poses stay soft.
  const soft = p.belly > 1.1;
  const armR = 13 + (soft ? 0 : tier * 2.5);
  const armScale = soft ? 1 : 1 + tier * 0.11;
  const legScale = soft ? 1 : 1 + tier * 0.06;
  const shoulderW = soft ? 1 : 1 + tier * 0.08;

  const torsoOutline = "M 0 -52 Q 44 -44 44 8 Q 46 50 0 58 Q -44 50 -44 8 Q -44 -44 0 -52 Z";

  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg viewBox="0 0 260 300" width={size} height={size} style={{ display: "block" }}>
        <BuddyDefs id={id} frozen={frozen} />

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

        {/* ground shadow — anchors the figure to the panel floor (the couch
            already does that job for detrained, so skip it there) */}
        {!p.extras.includes("couch") && (
          <ellipse cx="130" cy="257" rx="66" ry="9" fill={ink} opacity="0.16"
            filter={`url(#boilbg-${id})`} />
        )}

        {/* the boiling character — halo'd against wash panels so the coat
            silhouette never sinks into a same-hue background */}
        <g filter={showBg ? `url(#halo-${id})` : undefined}>
        <g filter={`url(#boil-${id})`}>
          <g transform="translate(130 156) scale(0.86) translate(-130 -150)">
          <g className={motionClass} transform="translate(130 150)">

            {/* TAIL — root cap keeps it fused to the torso under rotation */}
            <g transform={`translate(-20 40) rotate(${p.tail})`}>
              <Tail skin={skin} skinSh={skinSh} ink={ink} />
            </g>

            {/* BACK LEG — hip cap (cx/cy at pivot so it stays put under rotation) */}
            <g transform={`translate(30 54) rotate(${p.legR}) scale(${legScale})`}>
              <circle cx="0" cy="0" r="17" fill={skinSh} stroke={ink} strokeWidth="3.2" />
              <path d="M 0 -10 Q 26 4 30 40 Q 30 56 16 58 Q 6 40 -8 24 Q -10 6 0 -10 Z"
                fill={skinSh} stroke={ink} strokeWidth="3.2" strokeLinejoin="round" />
              <g transform="translate(22 56) rotate(150) scale(0.7)">
                <End skin={skinSh} ink={ink} />
              </g>
            </g>

            {/* FRONT LEG — hip cap */}
            <g transform={`translate(-28 54) rotate(${p.legL}) scale(${legScale})`}>
              <circle cx="0" cy="0" r="17" fill={skin} stroke={ink} strokeWidth="3.2" />
              <path d="M 0 -10 Q -26 4 -30 40 Q -30 56 -16 58 Q -6 40 8 24 Q 10 6 0 -10 Z"
                fill={skin} stroke={ink} strokeWidth="3.2" strokeLinejoin="round" />
              <g transform="translate(-22 56) rotate(210) scale(0.7)">
                <End skin={skin} ink={ink} />
              </g>
            </g>

            {/* BODY / torso + belly */}
            <g>
              <path
                d={`M 0 -52 Q ${40 * p.belly * shoulderW} -44 ${44 * p.belly} 8
                    Q ${46 * p.belly} ${44 + (p.belly - 1) * 30} 0 ${58 + (p.belly - 1) * 26}
                    Q ${-44 * p.belly} ${44 + (p.belly - 1) * 30} ${-44 * p.belly} 8
                    Q ${-40 * p.belly * shoulderW} -44 0 -52 Z`}
                fill={skin} stroke={ink} strokeWidth="3.6" strokeLinejoin="round"
              />
              {/* belly plate */}
              <ellipse
                cx="0" cy={20 + (p.belly - 1) * 22}
                rx={26 * p.belly} ry={30 + (p.belly - 1) * 22}
                fill={p.belly > 1.1 ? pal.bellySoft : pal.belly}
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
              {/* coat texture */}
              {sp.texture === "spots" && <path d={torsoOutline} fill={`url(#spots-${id})`} />}
              {sp.texture === "fur"   && <path d={torsoOutline} fill={`url(#hatch2-${id})`} opacity="0.4" />}
            </g>

            {/* BACK ARM */}
            <g transform={`translate(30 -28) rotate(${p.armR}) scale(${armScale})`}>
              <circle cx="0" cy="0" r={armR} fill={skinSh} stroke={ink} strokeWidth="2.6" />
              <path d="M 0 0 Q 30 6 44 30 Q 50 42 40 48 Q 26 36 6 22 Q -2 10 0 0 Z"
                fill={skinSh} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
              {(p.ripped || absLevel >= 1) && <path d="M 12 10 q 12 8 22 22" fill="none" stroke={ink} strokeWidth="1.6" opacity="0.5" />}
              {absLevel >= 2 && <path d="M 4 2 q 14 -4 20 10" fill="none" stroke={ink} strokeWidth="1.5" opacity="0.5" />}
              <g transform="translate(42 46) rotate(20) scale(0.62)">
                <End skin={skinSh} ink={ink} fist={p.grip === "fist"} />
              </g>
            </g>

            {/* FRONT ARM */}
            <g transform={`translate(-30 -28) rotate(${p.armL}) scale(${armScale})`}>
              <circle cx="0" cy="0" r={armR} fill={skin} stroke={ink} strokeWidth="2.6" />
              <path d="M 0 0 Q -30 6 -44 30 Q -50 42 -40 48 Q -26 36 -6 22 Q 2 10 0 0 Z"
                fill={skin} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
              {(p.ripped || absLevel >= 1) && <path d="M -12 10 q -12 8 -22 22" fill="none" stroke={ink} strokeWidth="1.6" opacity="0.5" />}
              {absLevel >= 2 && <path d="M -4 2 q -14 -4 -20 10" fill="none" stroke={ink} strokeWidth="1.5" opacity="0.5" />}
              <g transform="translate(-42 46) rotate(-20) scale(0.62)">
                <End skin={skin} ink={ink} fist={p.grip === "fist"} />
              </g>
            </g>

            {/* HEAD */}
            <g className="mv-head" transform={`translate(2 -84) rotate(${p.headTilt})`}>
              <Head p={p} skin={skin} skinSh={skinSh} pal={pal} uid={id} build={tier} />
            </g>

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
