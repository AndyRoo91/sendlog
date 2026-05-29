/* StickerRating — rate a route out of 3 friend stickers.
   Each slot gets a deterministic sticker (seeded by routeId + slot index),
   so the same route always shows the same three faces and they don't
   reshuffle on every render. Tap a slot to set the rating; tap slot 1 again
   when rating is already 1 to clear it. */
import { useCallback } from "react";

// All sticker filenames in public/stickers/. Keep this list in sync with the
// directory when you add/remove files.
const STICKERS: string[] = [
  "STK-20240831-WA0001.webp",
  "STK-20250208-WA0008.webp",
  "STK-20250208-WA0009.webp",
  "STK-20250208-WA0026.webp",
  "STK-20250223-WA0005.webp",
  "STK-20250223-WA0006.webp",
  "STK-20250403-WA0002.webp",
  "STK-20250512-WA0002.webp",
  "STK-20250606-WA0000.webp",
  "STK-20251213-WA0005.webp",
  "STK-20251228-WA0000.webp",
  "STK-20260405-WA0002.webp",
  "STK-20260519-WA0006.webp",
];

/** Tiny deterministic hash — splitmix-ish int hash, plenty for picking 1 of N. */
function pickStickerForSlot(seed: number, slot: number): number {
  let h = (seed * 31 + slot * 2654435761) | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return Math.abs(h) % STICKERS.length;
}

/** Stable seeded list of N unique stickers for the given seed. If N > pool
 *  size we fall back to allowing repeats (shouldn't happen with 5 of 13). */
function pickerFor(seed: number, slots: number): string[] {
  const used = new Set<number>();
  const out: string[] = [];
  for (let i = 0; i < slots; i++) {
    let idx = pickStickerForSlot(seed, i);
    // Walk forward through the pool until we find an unused one.
    let probe = 0;
    while (used.has(idx) && probe < STICKERS.length) {
      idx = (idx + 1) % STICKERS.length;
      probe++;
    }
    used.add(idx);
    out.push(STICKERS[idx]);
  }
  return out;
}

interface Props {
  seed: number;                          // typically the route or tick id
  value: number | null | undefined;      // 1..slots, or null/undefined for unrated
  onChange?: (next: number | null) => void;  // omit for read-only display
  size?: number;                          // px per sticker, default 36
  slots?: number;                         // total slots, default 5
}

export default function StickerRating({ seed, value, onChange, size = 36, slots = 5 }: Props) {
  const picks = pickerFor(seed, slots);
  const rating = value ?? 0;
  const readOnly = !onChange;

  const handle = useCallback((slot: number) => {
    if (!onChange) return;
    // Tap the current rating's slot to clear; otherwise set rating = slot+1.
    const next = rating === slot + 1 ? null : slot + 1;
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
    onChange(next);
  }, [onChange, rating]);

  return (
    <div role="radiogroup" aria-label="Friend rating"
      style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {picks.map((file, i) => {
        const filled = i < rating;
        const label = `${i + 1} of ${slots}`;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={filled}
            aria-label={label}
            disabled={readOnly}
            onClick={() => handle(i)}
            style={{
              padding: 0,
              width: size,
              height: size,
              border: "var(--b) solid var(--ink)",
              background: filled ? "var(--cream)" : "var(--paper)",
              boxShadow: filled ? "2px 2px 0 var(--ink)" : "none",
              cursor: readOnly ? "default" : "pointer",
              transform: filled ? "rotate(-2deg)" : "rotate(0)",
              transition: "transform 120ms ease, box-shadow 120ms ease",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <img
              src={`/stickers/${file}`}
              alt=""
              draggable={false}
              style={{
                width: "100%", height: "100%", objectFit: "contain",
                filter: filled ? "none" : "grayscale(0.85) opacity(0.35)",
                transition: "filter 120ms ease",
                pointerEvents: "none",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
