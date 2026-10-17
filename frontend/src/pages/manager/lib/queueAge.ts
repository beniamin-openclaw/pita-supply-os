// Queue-age helpers (week2-feedback-quantities Phase 5). Pure functions kept
// out of ManagerQueue.tsx so that file exports only components (react-refresh)
// and so the impure `Date` read is never render-time work.

import { daysSince } from "../../../lib/dates";
import type { ManagerQueueItem } from "../../../types";

/** Days in the queue after which a claimed order gets the amber chip, and
 *  days after the last receipt after which a closed order leaves the lane for
 *  the archive (week2-feedback-quantities Phase 5). */
export const QUEUE_AGE_DAYS = 3;

/** Days a claimed order has been waiting since the captain submitted it, or
 *  null when under the threshold / no timestamp. Keyed on captain_submitted_at
 *  because `Order` carries no claim timestamp (plan-review amendment). Kept
 *  outside the component so the impure `Date` read isn't render-time work. */
export function inQueueDays(item: ManagerQueueItem, now: Date = new Date()): number | null {
  const days = daysSince(item.captain_submitted_at, now);
  return days !== null && days >= QUEUE_AGE_DAYS ? days : null;
}

/** Split the closed lane: rows received within QUEUE_AGE_DAYS (or with no
 *  timestamp at all) stay visible; the rest are only counted, and the count
 *  links to /manager/archive. An order closed without a receipt (D5) has no
 *  `last_received_at`, so it ages by `manager_sent_at`: closing a stale order
 *  sends it straight to the archive count. */
export function splitClosedLane(
  items: ManagerQueueItem[] | null,
  now: Date = new Date(),
): { recent: ManagerQueueItem[] | null; archived: number } {
  if (items === null) return { recent: null, archived: 0 };
  const recent: ManagerQueueItem[] = [];
  let archived = 0;
  for (const q of items) {
    const days = daysSince(q.last_received_at ?? q.manager_sent_at, now);
    if (days === null || days <= QUEUE_AGE_DAYS) recent.push(q);
    else archived += 1;
  }
  return { recent, archived };
}

/** Hours after the captain's send at which a still-claimed order is flagged
 *  "przejęte > 24 h" (manager-queue-control, D16). */
export const CLAIMED_OVERDUE_HOURS = 24;

/** Hours after the manager's send at which an order still without a receipt
 *  is flagged "wysłane > 3 dni bez przyjęcia" (manager-queue-control, D16). */
export const SENT_UNRECEIVED_HOURS = 72;

/** Orders loaded per claimed/sent lane (the backend's clamp). The lane is
 *  newest-first, so past this cap the oldest (stalled) orders drop out. */
export const QUEUE_LANE_LIMIT = 200;

const MS_PER_HOUR = 3_600_000;

/** Elapsed hours since `iso` (fractional, not calendar days), or null for a missing
 *  or unparseable timestamp. */
function hoursSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return (now.getTime() - then) / MS_PER_HOUR;
}

/** A claimed order still unsent more than 24 h after the captain sent it.
 *  Measured from captain_submitted_at because the app stores no claim time
 *  (`manager_claim` writes only the status), so this is when the captain
 *  started waiting, not when the manager took the order. */
export function isClaimedOverdue(item: ManagerQueueItem, now: Date = new Date()): boolean {
  if (item.status !== "manager_claimed") return false;
  const hours = hoursSince(item.captain_submitted_at, now);
  return hours !== null && hours > CLAIMED_OVERDUE_HOURS;
}

/** A sent order with no receipt more than 3 days (72 h) after it was sent. */
export function isSentUnreceived(item: ManagerQueueItem, now: Date = new Date()): boolean {
  if (item.status !== "manager_sent" || item.received_count > 0) return false;
  const hours = hoursSince(item.manager_sent_at, now);
  return hours !== null && hours > SENT_UNRECEIVED_HOURS;
}

/** A closed order with no receipt: the Manager closed it without a delivery
 *  (close-without-receipt, D5). Closed is otherwise reached only by a receipt
 *  (or a Transport reopen revert of a received member), so the receipt count
 *  tells the two apart; a late receipt clears it by itself. */
export function isClosedWithoutReceipt(item: ManagerQueueItem): boolean {
  return item.status === "closed" && (item.received_count ?? 0) === 0;
}

/** Archive age of a row: last receipt for closed orders, submission for
 *  cancelled ones (the queue item carries no cancelled_at). A row closed
 *  without a receipt (D5) is always shown (null): it has no close time on the
 *  queue item, and the stale orders it is meant for are older than any day
 *  window. */
export function archiveAgeDays(item: ManagerQueueItem, now: Date = new Date()): number | null {
  if (isClosedWithoutReceipt(item)) return null;
  return daysSince(item.last_received_at ?? item.captain_submitted_at, now);
}
