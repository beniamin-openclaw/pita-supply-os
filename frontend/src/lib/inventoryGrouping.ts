// Groups product rows by their raw `product_category` (first-seen order) for
// the collapsible category sections of the Captain inventory grid AND the
// Manager inventory detail (week2-feedback-quantities Phase 4 generalised it
// over any `{ product_category }` row and moved it here from
// pages/captain-mp/lib/inventoryGrouping.ts, which stays as a re-export shim).
//
// Grouping keys stay the RAW backend category value (possibly "" when a
// product has none) — display translation happens at render time via
// categoryLabel() (i18n/categoryLabels.ts), so grouping itself never depends
// on the active language and is stable across a language toggle.

export interface CategorizedRow {
  product_category: string;
}

export interface ProductCategoryGroup<T extends CategorizedRow> {
  category: string;
  items: T[];
}

export function groupProductsByCategory<T extends CategorizedRow>(
  products: T[],
): ProductCategoryGroup<T>[] {
  const order: string[] = [];
  const byCategory = new Map<string, T[]>();
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
