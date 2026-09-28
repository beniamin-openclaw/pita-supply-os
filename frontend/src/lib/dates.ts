// Cross-feature date helpers (week2-feedback-quantities Phase 5). Pure
// functions, no React — the locale-aware `formatDateTime` stays in `useT()`
// (i18n/index.ts); this module only does calendar arithmetic.

const WARSAW_TZ = "Europe/Warsaw";
const MS_PER_DAY = 86_400_000;

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: WARSAW_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar day of `d` in Europe/Warsaw, as a UTC-midnight epoch (ms). Used so
 *  two instants compare by their Warsaw calendar dates, not by 24h windows. */
function warsawDayEpoch(d: Date): number {
  const parts = ymdFormatter.formatToParts(d);
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return Date.UTC(get("year"), get("month") - 1, get("day"));
}

/**
 * Whole calendar days (Europe/Warsaw) elapsed since `iso`, relative to `now`.
 * 23:59 → 00:01 across Warsaw midnight counts as 1; the same Warsaw day is 0.
 * A future timestamp yields a negative number. Returns `null` for a missing or
 * unparseable input so callers can render nothing instead of "NaN dni".
 */
export function daysSince(
  iso: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.round((warsawDayEpoch(now) - warsawDayEpoch(then)) / MS_PER_DAY);
}

/** Today's calendar date in Europe/Warsaw as "YYYY-MM-DD" (delivery-calendar).
 *  Independent of the browser's timezone — `toISOString()` would return the
 *  UTC date, one day early between 00:00 and 02:00 Warsaw. */
export function warsawTodayIso(now: Date = new Date()): string {
  return ymdFormatter.format(now);
}

/** "YYYY-MM-DD" + n calendar days → "YYYY-MM-DD" (pure date arithmetic, no
 *  timezone involved). */
export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Weekday of a "YYYY-MM-DD" date, 0 = Sunday (JS `getDay` convention). */
export function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Delivery-date display format for `useT().formatDateTime` (delivery-calendar):
 *  weekday + day + month, e.g. "śr., 07.10". Never combined with `dateStyle`. */
export const DELIVERY_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
};
