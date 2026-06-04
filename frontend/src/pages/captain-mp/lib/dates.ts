// Date utilities. After i18n integration we keep only logic functions
// (returning Dates / ISO strings / urgency enums) — UI text is composed at the
// component level via the i18n hook.

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0, ndz: 0, niedziela: 0,
  mon: 1, monday: 1, pn: 1, poniedzialek: 1, poniedziałek: 1,
  tue: 2, tuesday: 2, wt: 2, wtorek: 2,
  wed: 3, wednesday: 3, sr: 3, śr: 3, sroda: 3, środa: 3,
  thu: 4, thursday: 4, czw: 4, czwartek: 4,
  fri: 5, friday: 5, pt: 5, piatek: 5, piątek: 5,
  sat: 6, saturday: 6, sob: 6, sobota: 6,
};

/** Parse Supplier.delivery_days into the next concrete delivery date (Europe/Warsaw,
 * ISO YYYY-MM-DD). On null / unparseable input falls back to today + 1 day. */
export function getRequestedDeliveryDate(deliveryDays: string | null | undefined): string {
  const today = new Date();
  let nextDate = new Date(today);

  if (!deliveryDays || deliveryDays.trim() === "") {
    nextDate.setDate(today.getDate() + 1);
  } else {
    const trimmed = deliveryDays.trim();
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum) && asNum > 0) {
      nextDate.setDate(today.getDate() + Math.floor(asNum));
    } else {
      const targets = trimmed
        .split(/[,;\s]+/)
        .map((s) => WEEKDAY_MAP[s.toLowerCase()])
        .filter((d): d is number => typeof d === "number");
      if (targets.length === 0) {
        nextDate.setDate(today.getDate() + 1);
      } else {
        for (let offset = 1; offset <= 14; offset += 1) {
          const candidate = new Date(today);
          candidate.setDate(today.getDate() + offset);
          if (targets.includes(candidate.getDay())) {
            nextDate = candidate;
            break;
          }
        }
      }
    }
  }
  return nextDate.toISOString().split("T")[0];
}

export type CutoffUrgency = "danger" | "warn" | "ok";

export function getCutoffUrgency(cutoffTime: string | null | undefined): CutoffUrgency {
  if (!cutoffTime || cutoffTime.trim() === "") return "ok";
  const match = /^(\d{1,2}):(\d{2})$/.exec(cutoffTime.trim());
  if (!match) return "ok";
  const hour = Number(match[1]);
  const minute = Number(match[2]);

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(hour, minute, 0, 0);
  const diffMs = cutoff.getTime() - now.getTime();
  const diffH = diffMs / 3_600_000;

  if (diffH < 0) return "danger";
  if (diffH < 1) return "danger";
  if (diffH < 6) return "warn";
  return "ok";
}

/** Parse delivery_days into a structured form for UI rendering.
 * Returns null if blank/unparseable (UI shows generic "delivery as agreed"). */
export function parseDeliveryDays(
  raw: string | null | undefined,
): { kind: "days"; n: number } | { kind: "weekdays"; literal: string } | null {
  if (!raw || raw.trim() === "") return null;
  const trimmed = raw.trim();
  const asNum = Number(trimmed);
  if (Number.isFinite(asNum) && asNum > 0) {
    return { kind: "days", n: Math.floor(asNum) };
  }
  // Anything else (e.g., "Tue,Fri") — UI shows literal value as-is.
  return { kind: "weekdays", literal: trimmed };
}
