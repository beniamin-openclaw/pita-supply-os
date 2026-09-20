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
 *  receipt timestamp) stay visible; the rest are only counted, and the count
 *  links to /manager/archive. */
export function splitClosedLane(
  items: ManagerQueueItem[] | null,
  now: Date = new Date(),
): { recent: ManagerQueueItem[] | null; archived: number } {
  if (items === null) return { recent: null, archived: 0 };
  const recent: ManagerQueueItem[] = [];
  let archived = 0;
  for (const q of items) {
    const days = daysSince(q.last_received_at, now);
    if (days === null || days <= QUEUE_AGE_DAYS) recent.push(q);
    else archived += 1;
  }
  return { recent, archived };
}
