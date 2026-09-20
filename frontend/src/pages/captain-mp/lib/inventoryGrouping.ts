// Re-export shim (week2-feedback-quantities Phase 4): the grouping helper was
// generalised and moved to src/lib/inventoryGrouping.ts so the Manager
// inventory detail can share it. The three captain importers
// (InventoryCountGrid, InventoryCountPage, InventoryCountEditPage) keep this
// path and the InventoryProduct-specialised group type unchanged.

import type { InventoryProduct } from "../../../types";
import type { ProductCategoryGroup } from "../../../lib/inventoryGrouping";

export { groupProductsByCategory } from "../../../lib/inventoryGrouping";

export type InventoryProductGroup = ProductCategoryGroup<InventoryProduct>;
