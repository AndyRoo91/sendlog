/** Canonical send-style identity (colour mapping is strict across the app). */
export type StyleId = "flash" | "send" | "onsight" | "toprope" | "proj" | "fall";

export interface StyleDef {
  id: StyleId;
  label: string;
  color: string;
  text: string;
}

export const STYLES: StyleDef[] = [
  { id: "onsight", label: "ONSIGHT", color: "var(--pink)", text: "var(--ink)" },
  { id: "flash", label: "FLASH", color: "var(--mustard)", text: "var(--ink)" },
  { id: "send", label: "SEND", color: "var(--sea)", text: "var(--cream)" },
  { id: "toprope", label: "TR", color: "var(--ink-2)", text: "var(--cream)" },
  { id: "proj", label: "WORK", color: "var(--cobalt)", text: "var(--cream)" },
  { id: "fall", label: "FALL", color: "var(--red)", text: "var(--cream)" },
];

/** Styles offered in quick-log for each climbing mode. Boulder stays at 4. */
export const STYLES_BY_MODE: Record<"boulder" | "lead", StyleId[]> = {
  boulder: ["flash", "send", "proj", "fall"],
  lead: ["onsight", "flash", "send", "toprope", "proj", "fall"],
};

export const STYLE_BY_ID: Record<StyleId, StyleDef> = Object.fromEntries(
  STYLES.map((s) => [s.id, s])
) as Record<StyleId, StyleDef>;

/** The send_type string persisted for each visual style. */
export const STYLE_TO_SEND_TYPE: Record<StyleId, string> = {
  flash: "flash",
  send: "redpoint",
  onsight: "onsight",
  toprope: "toprope",
  proj: "working",
  fall: "fall",
};

/** Map the backend `send_type` strings onto the visual styles. */
export function sendTypeToStyle(sendType: string): StyleId {
  switch (sendType) {
    case "onsight":
      return "onsight";
    case "flash":
      return "flash";
    case "toprope":
      return "toprope";
    case "redpoint":
    case "pinkpoint":
      return "send";
    case "working":
      return "proj";
    case "fall":
      return "fall";
    default:
      return "send";
  }
}
