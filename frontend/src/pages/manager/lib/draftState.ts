// Per-line manager edit draft state (Phase G2). Keyed by order_line_id.
// A line's draft is seeded from the loaded detail (qty = manager_final if > 0
// else captain_final; comment = manager_comment) and is "dirty" once qty or
// comment differs from that loaded baseline. The PATCH save + dispatch payloads
// are both built from the draft so the table, email, and save never disagree.

import type { ManagerOrderDetail, ManagerOrderLineDetail, OrderLineManagerFinal } from "../../../types";
import { effectiveManagerQtyPurchase } from "./managerLine";

export interface LineDraft {
  /** Effective purchase qty the manager will order (>= 0). */
  qty: number;
  /** Manager comment (free text, soft-capped by the input). */
  comment: string;
}

export type DraftMap = Record<string, LineDraft>;

/** Soft cap for manager comments (spec §4: ~200 chars). */
export const MANAGER_COMMENT_MAX = 200;

/** Seed a draft map from a freshly-loaded detail. */
export function seedDrafts(detail: ManagerOrderDetail): DraftMap {
  const map: DraftMap = {};
  for (const line of detail.lines) {
    map[line.order_line_id] = {
      qty: effectiveManagerQtyPurchase(line),
      comment: line.manager_comment ?? "",
    };
  }
  return map;
}

/** The baseline a draft is compared against (same rule as seedDrafts). */
export function baselineFor(line: ManagerOrderLineDetail): LineDraft {
  return {
    qty: effectiveManagerQtyPurchase(line),
    comment: line.manager_comment ?? "",
  };
}

/** Draft effective qty for a line, falling back to the seeded baseline. */
export function draftQty(drafts: DraftMap, line: ManagerOrderLineDetail): number {
  const d = drafts[line.order_line_id];
  return d ? d.qty : effectiveManagerQtyPurchase(line);
}

/** Draft comment for a line, falling back to the persisted comment. */
export function draftComment(drafts: DraftMap, line: ManagerOrderLineDetail): string {
  const d = drafts[line.order_line_id];
  return d ? d.comment : line.manager_comment ?? "";
}

/** A line is dirty when its draft qty or comment differs from the baseline. */
export function isLineDirty(drafts: DraftMap, line: ManagerOrderLineDetail): boolean {
  const d = drafts[line.order_line_id];
  if (!d) return false;
  const base = baselineFor(line);
  return d.qty !== base.qty || d.comment !== base.comment;
}

/** Any dirty line across the order. */
export function hasDirtyDrafts(drafts: DraftMap, lines: ManagerOrderLineDetail[]): boolean {
  return lines.some((line) => isLineDirty(drafts, line));
}

/**
 * Full read-modify-write payload for the PATCH save: one entry per DIRTY line,
 * carrying BOTH the current qty AND comment (spec §4 — a qty-only payload would
 * wipe a saved comment). Empty array = no-op (allowed by the PATCH contract).
 */
export function dirtySavePayload(
  drafts: DraftMap,
  lines: ManagerOrderLineDetail[],
): OrderLineManagerFinal[] {
  return lines
    .filter((line) => isLineDirty(drafts, line))
    .map((line) => ({
      order_line_id: line.order_line_id,
      manager_final_qty_purchase: draftQty(drafts, line),
      manager_comment: draftComment(drafts, line),
    }));
}

/**
 * Full effective line set for DISPATCH (qty + comment for EVERY line, dirty or
 * not). dispatch requires a non-empty array and persists the full state; sending
 * every line keeps portal/phone "mark ordered" above min_length and never wipes
 * comments. Build the email from the same draft values.
 */
export function dispatchPayload(
  drafts: DraftMap,
  lines: ManagerOrderLineDetail[],
): OrderLineManagerFinal[] {
  return lines.map((line) => ({
    order_line_id: line.order_line_id,
    manager_final_qty_purchase: draftQty(drafts, line),
    manager_comment: draftComment(drafts, line),
  }));
}

/** True when no line has an effective qty > 0 (dispatch must be blocked). */
export function isOrderEmpty(drafts: DraftMap, lines: ManagerOrderLineDetail[]): boolean {
  return !lines.some((line) => draftQty(drafts, line) > 0);
}
