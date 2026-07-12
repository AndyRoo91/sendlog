/* Buddy species — shared constants for the Crag rig and the Settings picker.
   Lives outside Crag.tsx so the component file only exports components
   (react-refresh) and pages can pull picker copy without the whole rig. */

// Keep in sync with BUDDY_SPECIES in backend/main.py — the server rejects
// anything outside its set, and asSpecies() maps unknowns back to gecko.
export type CragSpecies = "gecko" | "ibex" | "galah" | "wombat";

// Picker copy — one voice everywhere the buddy is offered.
export const SPECIES_INFO: Record<CragSpecies, { name: string; tagline: string }> = {
  gecko:  { name: "GECKO",  tagline: "the original. sticky fingers, big heart." },
  ibex:   { name: "IBEX",   tagline: "alpine unit. horns grow with your build." },
  galah:  { name: "GALAH",  tagline: "loud, pink, zero fear." },
  wombat: { name: "WOMBAT", tagline: "built like a boulder. digs a rest day." },
};

export const CRAG_SPECIES = Object.keys(SPECIES_INFO) as CragSpecies[];

// Coerce a server-side species string (possibly stale/unknown) to a real one.
export function asSpecies(s: string | null | undefined): CragSpecies {
  return s && s in SPECIES_INFO ? (s as CragSpecies) : "gecko";
}
