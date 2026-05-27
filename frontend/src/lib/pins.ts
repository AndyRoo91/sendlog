export interface PinKind {
  id: string;
  label: string;
  color: string;
  star?: boolean;
}

export const PIN_KINDS: PinKind[] = [
  { id: "highpoint", label: "High-point", color: "var(--mustard)" },
  { id: "fall", label: "Fall", color: "var(--red)" },
  { id: "rest", label: "Rest", color: "var(--cobalt)" },
  { id: "crux", label: "Crux", color: "var(--pink)" },
  { id: "clip", label: "Clip", color: "var(--ink)" },
  { id: "send", label: "Send", color: "var(--sea)", star: true },
];

export const PIN_BY_ID: Record<string, PinKind> = Object.fromEntries(
  PIN_KINDS.map((k) => [k.id, k])
);

export function pinKind(id: string): PinKind {
  return PIN_BY_ID[id] ?? PIN_KINDS[0];
}
