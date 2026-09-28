// Which suppliers can be ORDERED from (supplier-product-order-minimum, operator
// decision 2026-09-28). On-site production — "Pita Bros (internal production)",
// SUP_INTERNAL — is counted in inventory but never ordered, so it must not
// appear in any ordering picker. The supplier row stays in master data (the
// inventory grid and its "Produkcja" grouping still need it); only the
// ordering screens filter it out, and the backend refuses a submit for it.
//
// Mirrors `_INTERNAL_SUPPLIER_ID` in supply-os-v1/app/main.py — keep in sync.

import type { Supplier } from "../types";

export const INTERNAL_SUPPLIER_ID = "SUP_INTERNAL";

/** True for an active supplier that is not on-site production. */
export function isOrderingSupplier(s: Pick<Supplier, "supplier_id" | "active">): boolean {
  return s.active && s.supplier_id !== INTERNAL_SUPPLIER_ID;
}
