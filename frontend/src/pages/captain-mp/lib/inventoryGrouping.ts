// Groups inventory products by their raw `product_category` (first-seen
// order) for the collapsible category sections shared by InventoryCountPage
// (new count) and InventoryCountEditPage (correct a count, training-
// feedback-0901 Phase 2).
//
// Grouping keys stay the RAW backend category value (possibly "" when a
// product has none) — display translation happens at render time via
// categoryLabel() (i18n/categoryLabels.ts), so grouping itself never depends
// on the active language and is stable across a language toggle.

import type { InventoryProduct } from "../../../types";

export interface InventoryProductGroup {
  category: string;
  items: InventoryProduct[];
}

export function groupProductsByCategory(
  products: InventoryProduct[],
): InventoryProductGroup[] {
  const order: string[] = [];
  const byCategory = new Map<string, InventoryProduct[]>();
  products.forEach((p) => {
    const cat = p.product_category;
    let bucket = byCategory.get(cat);
    if (!bucket) {
      bucket = [];
      byCategory.set(cat, bucket);
      order.push(cat);
    }
    bucket.push(p);
  });
  return order.map((cat) => ({ category: cat, items: byCategory.get(cat)! }));
}
