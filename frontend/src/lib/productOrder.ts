// Canonical order of a supplier's products (supplier-product-order-minimum).
// TS twin of supply-os-v1/app/product_order.py — change both together.
//
// One rule for every per-supplier list and document: rows with a
// `display_order` first (ascending), then rows without one, and every tie, by
// `supplier_product_id`. The id is compared by code point (`<` / `>`), NOT
// `localeCompare`: ICU collation orders "_" and digits differently from
// Python, and the two dispatch e-mail builders must number lines identically.

export interface ProductOrderKey {
  display_order?: number | null;
  supplier_product_id?: string | null;
}

export function compareProductOrder(a: ProductOrderKey, b: ProductOrderKey): number {
  const pa = a.display_order ?? null;
  const pb = b.display_order ?? null;
  if (pa !== null && pb === null) return -1;
  if (pa === null && pb !== null) return 1;
  if (pa !== null && pb !== null && pa !== pb) return pa - pb;
  const ia = a.supplier_product_id ?? "";
  const ib = b.supplier_product_id ?? "";
  if (ia < ib) return -1;
  if (ia > ib) return 1;
  return 0;
}
