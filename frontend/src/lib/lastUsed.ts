// Sticky logging context (Phase R1): remember the last gym you logged at and,
// per gym, the last wall + hold colour — so repeat visits don't re-pick everything.
// All localStorage-backed and best-effort (private browsing etc. degrades to no-ops).

const GYM_KEY = "sendlog.lastGym";
const wallKey = (gymId: number) => `sendlog.lastWall.${gymId}`;
const colorKey = (gymId: number) => `sendlog.lastColor.${gymId}`;

function get(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function set(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* best-effort */ }
}

export function lastGymId(): number | null {
  const raw = get(GYM_KEY);
  const n = raw === null ? NaN : Number(raw);
  return Number.isInteger(n) ? n : null;
}

export function rememberGym(gymId: number | null): void {
  set(GYM_KEY, gymId === null ? null : String(gymId));
}

export function lastWallId(gymId: number): number | null {
  const raw = get(wallKey(gymId));
  const n = raw === null ? NaN : Number(raw);
  return Number.isInteger(n) ? n : null;
}

export function rememberWall(gymId: number, wallId: number | null): void {
  set(wallKey(gymId), wallId === null ? null : String(wallId));
}

export function lastColor(gymId: number): string | null {
  return get(colorKey(gymId));
}

export function rememberColor(gymId: number, hex: string | null): void {
  set(colorKey(gymId), hex);
}
