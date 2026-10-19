// Supplier options for the Manager queue filter (manager-queue-control, D11).
// Every active ordering supplier is listed, even one with no orders yet (Spec
// Food was missing because the list used to come from the queue alone), plus
// any supplier that has orders in the loaded lanes — an inactive supplier with
// an open order must stay filterable. Pure, so the merge is unit-tested.

import { isOrderingSupplier } from "../../../lib/orderingSuppliers";
import type { ManagerQueueItem, Supplier } from "../../../types";
import type { SupplierOption } from "../ManagerFilterBar";

/** Active ordering suppliers ∪ suppliers present in `lanes`, sorted by name.
 *  `suppliers` null (not loaded yet, or the call failed) = queue-only list. */
export function buildSupplierOptions(
  suppliers: Supplier[] | null,
  lanes: (ManagerQueueItem[] | null)[],
): SupplierOption[] {
  const byId = new Map<string, string>();
  for (const s of suppliers ?? []) {
    if (isOrderingSupplier(s)) byId.set(s.supplier_id, s.supplier_name);
  }
  for (const arr of lanes) {
    for (const q of arr ?? []) {
      if (!byId.has(q.supplier_id)) byId.set(q.supplier_id, q.supplier_name);
    }
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
