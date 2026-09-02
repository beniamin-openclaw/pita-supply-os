// Shared in-memory line shape for the inventory count grid — used by both
// InventoryCountPage (new count) and InventoryCountEditPage (correct a
// count, training-feedback-0901 Phase 2). Stock stays "" until the user
// types a number, so "not counted" (blank) is distinguishable from a real
// counted 0 (blank-vs-zero, FR-020) all the way up to submit/edit.

export interface InventoryLineInput {
  current_stock_qty_base: number | "";
  count_comment: string;
}

export function blankInventoryLine(): InventoryLineInput {
  return { current_stock_qty_base: "", count_comment: "" };
}
