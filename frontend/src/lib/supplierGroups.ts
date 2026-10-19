// Supplier grouping in the Manager UI (supplier-groups, Ben's D4 of 17.10).
// Pago and Magazyn Mory stay two suppliers in the data (own orders, own
// catalogues, own e-mail/PDF blocks); the Manager filters show them as ONE
// option "Pago + Magazyn Mory" that matches both. The Transport chips use the
// same pair (lib/transport.ts TRANSPORT_CHIP_SUPPLIER_IDS), so the lists
// cannot drift.

import type { StringKey } from "../i18n/strings";

/** Pago first: Pago leads a combined Transport, Mory rides as a companion. */
export const PAGO_MORY_SUPPLIER_IDS = ["SUP_PAGO", "SUP_MORY"] as const;

export interface SupplierGroup {
  id: string;
  memberIds: readonly string[];
  labelKey: StringKey;
}

export const SUPPLIER_GROUPS: readonly SupplierGroup[] = [
  { id: "GRP_PAGO_MORY", memberIds: PAGO_MORY_SUPPLIER_IDS, labelKey: "manager.filter.group.pagoMory" },
];

/** True when `supplierId` passes a filter set to `selectedId` (a supplier or a group). */
export function supplierFilterMatches(selectedId: string, supplierId: string): boolean {
  if (selectedId === supplierId) return true;
  const group = SUPPLIER_GROUPS.find((g) => g.id === selectedId);
  return group ? group.memberIds.includes(supplierId) : false;
}

/** Replace a group's members in a filter option list with one group option
 *  (only when at least one member is listed), sorted by name. */
export function groupSupplierOptions<T extends { id: string; name: string }>(
  options: T[],
  label: (key: StringKey) => string,
): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = options.filter(
    (o) => !SUPPLIER_GROUPS.some((g) => g.memberIds.includes(o.id)),
  );
  for (const group of SUPPLIER_GROUPS) {
    if (options.some((o) => group.memberIds.includes(o.id))) {
      out.push({ id: group.id, name: label(group.labelKey) });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** E-mail suppliers whose orders the Manager may also mark as ordered without
 *  sending the e-mail (D4: Filber, "like Cola"). Every other e-mail supplier
 *  keeps the e-mail-only path, so an order is never marked sent without
 *  reaching the supplier by mistake. */
export const MARK_ORDERED_EMAIL_SUPPLIER_IDS: readonly string[] = ["SUP_FILBER"];
