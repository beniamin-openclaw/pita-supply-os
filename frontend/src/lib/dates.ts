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
