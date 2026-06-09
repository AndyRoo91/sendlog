// Standard gym hold/circuit colours. Tapping one stamps its hex on a boulder
// tick; the "+" in the picker lets you sample any other colour (custom hex).
export interface HoldColor {
  name: string;
  hex: string;
}

export const STANDARD_COLORS: HoldColor[] = [
  { name: "Yellow", hex: "#f2c200" },
  { name: "Green", hex: "#4aa84a" },
  { name: "Blue", hex: "#2a6fdb" },
  { name: "Red", hex: "#d23b3b" },
  { name: "Orange", hex: "#e8801f" },
  { name: "Purple", hex: "#7b3fb5" },
  { name: "Pink", hex: "#e85aa0" },
  { name: "Teal", hex: "#1ba39c" },
  { name: "Black", hex: "#1a1612" },
  { name: "White", hex: "#f5f0e6" },
];

/** A readable name for a hex if it's a standard colour, else the hex itself. */
export function colorName(hex: string): string {
  const hit = STANDARD_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
  return hit ? hit.name : hex.toUpperCase();
}
