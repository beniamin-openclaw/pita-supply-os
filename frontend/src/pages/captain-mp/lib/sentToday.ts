// "Sent today" state of the Captain supplier tabs (captain-sent-today, WP6 +
// D10 A). The server reports, per supplier, the location's newest order
// submitted today (Europe/Warsaw) and its newest open order from the week
// before (GET /api/captain/suppliers → sent_today / open_order). This
// session's own submits are layered on top so the ✓ shows at once — also on the
// seed backend, which stores no orders. Pure functions, no React.

import { warsawTodayIso } from "../../../lib/dates";
import type { OrderStatus } from "../../../types";
import type { CaptainSupplier, CaptainSupplierOrderRef } from "../types";

/** `useT().formatDateTime` options for the submit time in the notices ("09:15"). */
export const SENT_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
};

/** Epoch ms of the ref's submit timestamp; 0 without one (or unparseable). */
function submittedMs(ref: CaptainSupplierOrderRef): number {
  if (!ref.captain_submitted_at) return 0;
  const ms = new Date(ref.captain_submitted_at).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** The newer of two refs: later `submitted_on`, then later
 *  `captain_submitted_at`, then the larger `order_id` — the backend's order. */
export function newerOrderRef(
  a: CaptainSupplierOrderRef | null | undefined,
  b: CaptainSupplierOrderRef | null | undefined,
): CaptainSupplierOrderRef | null {
  if (!a) return b ?? null;
  if (!b) return a;
  if (a.submitted_on !== b.submitted_on) return a.submitted_on > b.submitted_on ? a : b;
  const diff = submittedMs(a) - submittedMs(b);
  if (diff !== 0) return diff > 0 ? a : b;
  return a.order_id >= b.order_id ? a : b;
}

/**
 * Per supplier: the server's `sent_today` merged with the orders this session
 * submitted (the newer wins), keeping only refs counted on `todayIso` — a
 * screen left open past midnight drops yesterday's ✓ without a reload.
 */
export function sentTodayBySupplier(
  suppliers: CaptainSupplier[],
  sentThisSession: Record<string, CaptainSupplierOrderRef>,
  todayIso: string = warsawTodayIso(),
): Record<string, CaptainSupplierOrderRef> {
  const out: Record<string, CaptainSupplierOrderRef> = {};
  const consider = (supplierId: string, ref: CaptainSupplierOrderRef | null | undefined) => {
    if (!ref || ref.submitted_on !== todayIso) return;
    const newer = newerOrderRef(out[supplierId], ref);
    if (newer) out[supplierId] = newer;
  };
  for (const s of suppliers) consider(s.supplier_id, s.sent_today);
  for (const [supplierId, ref] of Object.entries(sentThisSession)) consider(supplierId, ref);
  return out;
}

/** Ref for an order this session just submitted. The submit response carries
 *  no timestamp, so the browser clock stands in until the next server read. */
export function localSentRef(
  orderId: string,
  status: OrderStatus,
  now: Date = new Date(),
): CaptainSupplierOrderRef {
  const today = warsawTodayIso(now);
  return {
    order_id: orderId,
    status,
    order_date: today,
    submitted_on: today,
    captain_submitted_at: now.toISOString(),
  };
}

/** Refresh the order fields of the current tabs from a fresh server read —
 *  never adds, removes or reorders a tab (the active one must stay put). */
export function mergeSupplierOrders(
  current: CaptainSupplier[],
  fresh: CaptainSupplier[],
): CaptainSupplier[] {
  const byId = new Map<string, CaptainSupplier>(fresh.map((s) => [s.supplier_id, s]));
  return current.map((s) => {
    const f = byId.get(s.supplier_id);
    return f ? { ...s, sent_today: f.sent_today ?? null, open_order: f.open_order ?? null } : s;
  });
}
