import type { PlanDetail } from "../api/client";

/** "2026-06-08" → Date at local midnight (no UTC drift). */
export function day(iso: string): Date { return new Date(iso + "T00:00:00"); }

/** 1-based current week of a plan, clamped to its length. */
export function planWeek(plan: PlanDetail): number {
  const start = day(plan.start_date);
  const elapsed = Math.floor((Date.now() - start.getTime()) / (7 * 86400_000));
  return Math.min(plan.weeks, Math.max(1, elapsed + 1));
}
