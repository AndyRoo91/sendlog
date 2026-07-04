/* Date/time handling (Phase R3 consolidation).
 *
 * The backend uses two conventions, and mixing them up causes off-by-one days:
 *
 *  • Date-only fields ("YYYY-MM-DD": session.date, scheduled_date, set_on,
 *    progress-point dates, …) name a calendar day. They must be read at LOCAL
 *    midnight — a bare `new Date("2026-07-04")` parses as UTC midnight and
 *    slides to the previous day in any negative-offset zone.
 *
 *  • Timestamp fields (logged_at, started_at, ended_at, feed `at`,
 *    unlocked_at) are naive UTC — an ISO datetime with no timezone suffix.
 *    Append `Z` so they're read as UTC, then rendered in the viewer's zone.
 *
 * Everything that turns a backend string into a Date should go through here.
 */
import { format, formatDistanceToNowStrict } from "date-fns";

// True when a timestamp string already carries a zone (Z or ±HH[:]MM).
const HAS_TZ = /[zZ]|[+-]\d\d:?\d\d$/;

/** A date-only "YYYY-MM-DD" → Date at local midnight. */
export function localDay(isoDate: string): Date {
  return new Date(isoDate.slice(0, 10) + "T00:00:00");
}

/** A naive-UTC timestamp → Date (appends `Z` when no zone marker is present). */
export function parseUTC(iso: string): Date {
  return new Date(HAS_TZ.test(iso) ? iso : iso + "Z");
}

/** Format a date-only field (interpreted at local midnight). */
export function fmtDay(isoDate: string, pattern: string): string {
  return format(localDay(isoDate), pattern);
}

/** Format a naive-UTC timestamp in the viewer's local zone. */
export function fmtTime(iso: string, pattern: string): string {
  return format(parseUTC(iso), pattern);
}

/** "2 days ago" from a naive-UTC timestamp. */
export function relativeTime(iso: string): string {
  return formatDistanceToNowStrict(parseUTC(iso), { addSuffix: true });
}

/** Whole days from a date-only field to today (local, never negative). */
export function daysAgo(isoDate: string): number {
  const then = localDay(isoDate).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - then) / 86_400_000));
}
