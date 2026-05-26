/** Canonical send-style identity (colour mapping is strict across the app). */
export type StyleId = "flash" | "send" | "proj" | "fall";

export interface StyleDef {
  id: StyleId;
  label: string;
  color: string;
  text: string;
}

export const STYLES: StyleDef[] = [
  { id: "flash", label: "FLASH", color: "var(--mustard)", text: "var(--ink)" },
  { id: "send", label: "SEND", color: "var(--sea)", text: "var(--cream)" },
  { id: "proj", label: "WORK", color: "var(--cobalt)", text: "var(--cream)" },
  { id: "fall", label: "FALL", color: "var(--red)", text: "var(--cream)" },
];

export const STYLE_BY_ID: Record<StyleId, StyleDef> = Object.fromEntries(
  STYLES.map((s) => [s.id, s])
) as Record<StyleId, StyleDef>;

/** The send_type string persisted for each visual style. */
export const STYLE_TO_SEND_TYPE: Record<StyleId, string> = {
  flash: "flash",
  send: "redpoint",
  proj: "working",
  fall: "fall",
};

/**
 * Map the backend `send_type` strings onto the four visual styles.
 *   flash / onsight        → FLASH (mustard)
 *   redpoint / toprope-send → SEND  (sea)
 *   working                → WORK  (cobalt)
 *   fall                   → FALL  (red)
 */
export function sendTypeToStyle(sendType: string): StyleId {
  switch (sendType) {
    case "flash":
    case "onsight":
      return "flash";
    case "redpoint":
    case "pinkpoint":
    case "toprope":
      return "send";
    case "working":
      return "proj";
    case "fall":
      return "fall";
    default:
      return "send";
  }
}
