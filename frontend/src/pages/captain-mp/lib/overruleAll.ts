// "Overrule all" — apply one deviation reason to every order line that
// currently requires a reason and does not have one yet, in a single batched
// update. Fill-empties only: a line where the Captain already picked a reason
// is NEVER touched — there is deliberately no "overwrite all" variant (mirrors
// the safe-by-default `fillEmpties` in CaptainMP.tsx, not the destructive
// `overwriteAll`).
//
// "Requires a reason" is `computeRowState(item, line).requiresReason` — reused
// as-is so this never re-derives (and risks drifting from) the deviation /
// critical-under / over-MAX gate logic that already lives in compute.ts.
//
// OTHER requires a comment (mirrors ReasonPicker.tsx's `commentRequired`):
// applying OTHER with a blank/whitespace-only comment is a no-op — nothing is
// written, so a batch action can never leave an incomplete OTHER reason behind.

import type { OrderableItem, OrderLine, ReasonCode } from "../types";
import { computeRowState } from "./compute";

/**
 * Returns a patched copy of `lines` with `reason` (+ `comment`, only stored
 * when `reason === "OTHER"`) applied to every line in `items` that:
 *   - currently requires a reason (`computeRowState(...).requiresReason`), AND
 *   - has no `reason_code` set yet.
 *
 * A line with any `reason_code` already set is left untouched, even if it is
 * an incomplete `OTHER` pick with no comment yet — the Captain already made a
 * choice there, and this function never replaces one.
 *
 * Returns the SAME `lines` reference, unchanged, when there is nothing to
 * apply (OTHER without a comment, or no matching lines) — lets a caller do a
 * single `setLines(...)` unconditionally without an extra no-op check.
 */
export function overruleAll(
  items: OrderableItem[],
  lines: Record<string, OrderLine>,
  reason: ReasonCode,
  comment: string,
): Record<string, OrderLine> {
  const trimmedComment = comment.trim();
  if (reason === "OTHER" && trimmedComment.length === 0) {
    return lines;
  }

  let next: Record<string, OrderLine> | null = null;

  for (const item of items) {
    const line = lines[item.product_id];
    if (!line) continue;
    if (line.reason_code) continue; // already picked — never replace it
    if (!computeRowState(item, line).requiresReason) continue;

    if (next === null) next = { ...lines };
    next[item.product_id] = {
      ...line,
      reason_code: reason,
      captain_comment: reason === "OTHER" ? trimmedComment : line.captain_comment,
    };
  }

  return next ?? lines;
}
