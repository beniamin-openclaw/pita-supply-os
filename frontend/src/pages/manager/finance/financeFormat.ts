// Number/date formatting shared by the finance reconciliation screen. Pinned
// to pl-PL regardless of the UI language toggle — the invoices themselves
// (amounts, dates) are Polish accounting documents (task/operator decision),
// unlike the rest of the app's labels which do switch with `lang`.
//
// `timeZone: "Europe/Warsaw"` is set explicitly for the same reason
// src/i18n/index.ts's `formatDateTime` does: an ISO date string like
// "2026-09-05" parses as UTC midnight, and formatting it in the browser's
// local zone can silently shift the displayed date by a day.

const NUMBER_FMT = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 });
const DATE_FMT = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const DATETIME_FMT = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "—" for null/undefined; otherwise a pl-PL grouped number (≤2 decimals). */
export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return NUMBER_FMT.format(n);
}

/** "—" for null/undefined; otherwise a pl-PL grouped number (≤2 decimals). */
export function formatQty(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return NUMBER_FMT.format(n);
}

/** dd.MM.yyyy, or "—" for a missing/empty ISO date string. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return DATE_FMT.format(new Date(iso));
}

/** dd.MM.yyyy HH:mm, or "—" for a missing/empty ISO datetime string. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return DATETIME_FMT.format(new Date(iso));
}
