import type { FingerboardProtocol } from "../api/client";

// Standard hangboard protocols. Tapping one prefills the fingerboard logger;
// users can also save their own (stored server-side). Built-ins have no id.
export const BUILTIN_PROTOCOLS: FingerboardProtocol[] = [
  {
    name: "Max Hangs",
    edge_mm: 20, hang_duration_s: 10, num_sets: 5, added_weight_kg: null,
    notes: "Heavy added weight, 7–10s near-max hangs. ~3 min rest between sets.",
  },
  {
    name: "7/3 Repeaters",
    edge_mm: 20, hang_duration_s: 7, num_sets: 6, added_weight_kg: 0,
    notes: "7s on / 3s off ×6 per set. ~3 min rest between sets.",
  },
  {
    name: "Min Edge",
    edge_mm: 8, hang_duration_s: 10, num_sets: 5, added_weight_kg: 0,
    notes: "Smallest edge you can hold ~10s at bodyweight.",
  },
  {
    name: "Density Hangs",
    edge_mm: 20, hang_duration_s: 20, num_sets: 4, added_weight_kg: null,
    notes: "Long sub-maximal hangs, 20s+. Moderate load.",
  },
];
