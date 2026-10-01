// "Overrule all" (bulk reason) — apply one deviation reason to every order line
// that currently requires a reason, in a single batched update.
//
// Two modes (feedback-1001 D10):
//   - "overwrite"   — the Captain's explicit Apply: the reason REPLACES whatever
//                     reason the line already carried.
//   - "fillMissing" — the automatic, sticky pass run whenever lines change while
//                     a bulk reason is active: fills only lines that have no
//                     reason yet, so a reason the Captain hand-picked on a line
//                     afterwards is never touched.
//
// "Requires a reason" is `computeRowState(item, line).requiresReason` — reused
// as-is so this never re-derives (and risks drifting from) the deviation /
// critical-under / over-MAX gate logic that already lives in compute.ts. For a
// supplier with suggestion alerts off that is always false, so nothing is ever
// applied there.
//
// OTHER requires a comment (mirrors ReasonPicker.tsx's `commentRequired`):
// applying OTHER with a blank/whitespace-only comment is a no-op — nothing is
// written, so a batch action can never leave an incomplete OTHER reason behind.
// Switching a line away from OTHER drops the stale OTHER comment.

import type { BulkReason, OrderableItem, OrderLine } from "../types";
import { computeRowState } from "./compute";

export type OverruleMode = "overwrite" | "fillMissing";

/**
 * Returns a patched copy of `lines` with the bulk reason (+ comment, only kept
 * when the code is OTHER) applied to every line in `items` that requires a
 * reason (and, in "fillMissing" mode, has no `reason_code` yet).
 *
 * Returns the SAME `lines` reference when nothing changes (OTHER without a
 * comment, no matching lines, or every matching line already carries exactly
 * this reason) — lets a caller do a single `setLines(...)` unconditionally,
 * and keeps the sticky effect from looping.
 */
export function overruleAll(
  items: OrderableItem[],
  lines: Record<string, OrderLine>,
  bulk: BulkReason,
  mode: OverruleMode,
): Record<string, OrderLine> {
  const trimmedComment = bulk.comment.trim();
  if (bulk.code === "OTHER" && trimmedComment.length === 0) {
    return lines;
  }

  let next: Record<string, OrderLine> | null = null;

  for (const item of items) {
    const line = lines[item.product_id];
    if (!line) continue;
    if (mode === "fillMissing" && line.reason_code) continue; // hand-picked — keep
    if (!computeRowState(item, line).requiresReason) continue;

    const nextComment =
      bulk.code === "OTHER"
        ? trimmedComment
        : line.reason_code === "OTHER"
          ? "" // moving away from OTHER: the old OTHER comment is stale
          : line.captain_comment;
    if (line.reason_code === bulk.code && (line.captain_comment ?? "") === (nextComment ?? "")) {
      continue; // already exactly this reason
    }

    if (next === null) next = { ...lines };
    next[item.product_id] = {
      ...line,
      reason_code: bulk.code,
      captain_comment: nextComment,
    };
  }

  return next ?? lines;
}
