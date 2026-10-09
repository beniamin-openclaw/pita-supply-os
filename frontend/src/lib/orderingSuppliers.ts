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

/** Default captain tab: the pilot supplier when present, else the first tab. */
export function pickDefaultSupplier<T extends Pick<Supplier, "supplier_id">>(
  suppliers: T[],
  pilotId: string,
): T | null {
  return suppliers.find((s) => s.supplier_id === pilotId) ?? suppliers[0] ?? null;
}

/**
 * Captain tabs from the location-scoped list, falling back to the global list
 * when the scoped call fails (e.g. 404 from an older backend during the deploy
 * window) so the screen never breaks. The client-side ordering filter stays on
 * top of both. A 401 is NOT retried — the global call needs the same token.
 */
export async function loadCaptainSuppliers(
  scoped: () => Promise<Supplier[]>,
  global: () => Promise<Supplier[]>,
): Promise<Supplier[]> {
  try {
    return (await scoped()).filter(isOrderingSupplier);
  } catch (err) {
    if ((err as { status?: number })?.status === 401) throw err;
    return (await global()).filter(isOrderingSupplier);
  }
}
