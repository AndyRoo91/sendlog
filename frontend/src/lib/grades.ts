export const BOULDER_GRADES = [
  "V0","V1","V2","V3","V4","V5","V6","V7","V8","V9","V10","V11","V12","V13","V14","V15","V16",
];

export const EWBANK_GRADES = Array.from({ length: 38 }, (_, i) => String(i + 1));

export const YDS_GRADES = [
  "5.6","5.7","5.8","5.9",
  "5.10a","5.10b","5.10c","5.10d","5.11a","5.11b","5.11c","5.11d",
  "5.12a","5.12b","5.12c","5.12d","5.13a","5.13b","5.13c","5.13d",
  "5.14a","5.14b","5.14c","5.14d","5.15a","5.15b","5.15c","5.15d",
];

export const FRENCH_GRADES = [
  "5a","5b","5c","6a","6a+","6b","6b+","6c","6c+",
  "7a","7a+","7b","7b+","7c","7c+","8a","8a+","8b","8b+","8c","8c+","9a","9a+","9b","9b+","9c",
];

export type GradeSystem = "ewbank" | "yds" | "french";

export const LEAD_GRADE_OPTIONS: Record<GradeSystem, string[]> = {
  ewbank: EWBANK_GRADES,
  yds: YDS_GRADES,
  french: FRENCH_GRADES,
};

export const LEAD_DEFAULT_GRADE: Record<GradeSystem, string> = {
  ewbank: "20",
  yds: "5.10a",
  french: "6b",
};

/** Pyramid window for the Tick Sheet (12 chips, centred on a sensible band). */
export function leadGradeWindow(system: GradeSystem): string[] {
  if (system === "ewbank") return EWBANK_GRADES.slice(15, 27); // 16–27
  if (system === "yds") return YDS_GRADES.slice(4, 16);        // 5.10a–5.12d
  return FRENCH_GRADES.slice(3, 15);                            // 6a–7c+
}

export function gradeOrder(system: GradeSystem | "vscale", grade: string): number {
  const arr = system === "vscale" ? BOULDER_GRADES : LEAD_GRADE_OPTIONS[system];
  const i = arr.indexOf(grade);
  return i < 0 ? -1 : i;
}
