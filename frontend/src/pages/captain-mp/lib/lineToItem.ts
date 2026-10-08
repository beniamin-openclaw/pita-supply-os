import type { ManagerOrderLineDetail, OrderableItem } from "../../../types";

/** Translate an enriched detail line into the shape ProductCard expects. */
export function lineToItem(
  line: ManagerOrderLineDetail,
  suggestionAlertsEnabled: boolean,
): OrderableItem {
  return {
    product_id: line.product_id,
    product_name_pl: line.product_name_pl,
    inventory_unit: line.inventory_unit,
    is_critical: line.is_critical,
    purchase_unit: line.purchase_unit,
    units_per_purchase_unit: line.units_per_purchase_unit,
    rounding_rule: line.rounding_rule ?? "full_only", // detail line carries it (S-09); fall back to full_only
    min_stock_qty_base: 0,
    // Real ceiling from the detail join (impl-review F1) so computeRowState's uncounted over-MAX
    // gate mirrors the backend; was hardcoded 0/true, which made the over-MAX
    // pill unreachable on edit (a cleared stock + over-MAX order then 400'd at
    // the backend with no on-screen warning).
    max_stock_qty_base: line.max_stock_qty_base,
    target_stock_qty_base: line.target_stock_qty_base,
    allow_over_max_due_to_packaging: line.allow_over_max_due_to_packaging,
    supplier_product_id: line.supplier_product_id,
    supplier_product_name: line.supplier_product_name,
    // Server gate mirror: supplier alerts AND NOT a backup line.
    suggestion_alerts_enabled: suggestionAlertsEnabled && line.is_backup !== true,
    is_backup: line.is_backup === true,
    open_orders_elsewhere: line.open_orders_elsewhere ?? [],
    display_order: line.display_order ?? null,
    // Bulk pack (migration 0028) so a card rebuilt from the order line keeps
    // the two-field input and the case-aware suggestion.
    case_unit: line.case_unit ?? null,
    units_per_case: line.units_per_case ?? null,
  };
}
