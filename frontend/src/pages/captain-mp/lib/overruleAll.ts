// "Overrule all" (bulk reason) — apply one deviation reason to every order line
// that currently requires a reason, in a single batched update.
//
// Two modes (feedback-1001 D10):
//   - "overwrite"   — the Captain's explicit Apply: the reason REPLACES whatever
//                     reason the line already carried.
//   - "fillMissing" — the automatic, sticky pass run whenever lines change while
//                     a bulk reason is active: fills only lines that have no
//                     reason yet, so a reason the Captain hand-picked on a line
//                     afterwards is never touched. Lines in `handEdited` (the
//                     Captain changed or CLEARED the reason by hand since the
//                     last Apply) are skipped too, so clearing a reason sticks.
//
// "Requires a reason" is `computeRowState(item, line).requiresReason` — reused
// as-is so this never re-derives (and risks drifting from) the deviation /
// critical-under / over-MAX gate logic that already lives in compute.ts. For a
// supplier with suggestion alerts off that is always false, so nothing is ever
// applied there.
//
// Every reason this fills is marked `reason_auto`. `clearStaleAutoReasons`
// (also run at the start of every "fillMissing" pass) removes such a reason
// once its line no longer requires one — the Captain typing "1" then "12"
// passes through a deviating "1", and without this the reason filled there
// would stay hidden on a green line and be submitted (impl-review F1). A
// reason picked by hand carries no flag and is kept.
//
// OTHER requires a comment (mirrors ReasonPicker.tsx's `commentRequired`):
// applying OTHER with a blank/whitespace-only comment is a no-op — nothing is
// written, so a batch action can never leave an incomplete OTHER reason behind.
// Switching a line away from OTHER drops the stale OTHER comment.

import type { BulkReason, OrderableItem, OrderLine } from "../types";
import { computeRowState } from "./compute";

export type OverruleMode = "overwrite" | "fillMissing";

/**
 * Returns a copy of `lines` without the reasons that were filled automatically
 * (`reason_auto`) on lines that no longer require a reason — an auto OTHER
 * also loses its comment. The SAME reference when nothing changes, so an
 * effect can call it on every change without looping.
 */
export function clearStaleAutoReasons(
  items: OrderableItem[],
  lines: Record<string, OrderLine>,
): Record<string, OrderLine> {
  let next: Record<string, OrderLine> | null = null;
  for (const item of items) {
    const line = lines[item.product_id];
    if (!line || !line.reason_auto) continue;
    if (computeRowState(item, line).requiresReason) continue;
    if (next === null) next = { ...lines };
    next[item.product_id] = {
      ...line,
      reason_code: "",
      captain_comment: line.reason_code === "OTHER" ? "" : line.captain_comment,
      reason_auto: false,
    };
  }
  return next ?? lines;
}

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
  handEdited?: ReadonlySet<string>,
): Record<string, OrderLine> {
  const trimmedComment = bulk.comment.trim();
  if (bulk.code === "OTHER" && trimmedComment.length === 0) {
    return lines;
  }

  // The sticky pass first drops auto reasons that are no longer needed.
  const base = mode === "fillMissing" ? clearStaleAutoReasons(items, lines) : lines;
  let next: Record<string, OrderLine> | null = null;

  for (const item of items) {
    const line = base[item.product_id];
    if (!line) continue;
    if (mode === "fillMissing" && line.reason_code) continue; // hand-picked — keep
    if (mode === "fillMissing" && handEdited?.has(item.product_id)) continue; // hand-cleared
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

    if (next === null) next = { ...base };
    next[item.product_id] = {
      ...line,
      reason_code: bulk.code,
      captain_comment: nextComment,
      reason_auto: true,
    };
  }

  return next ?? base;
}
