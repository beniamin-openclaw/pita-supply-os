-- threshold-audit.sql — READ-ONLY (pago-stock-packs-plus-kg merge gate)
--
-- Lists pack-based thresholds at active locations that still look like PACK
-- COUNTS stored in base units (kg / opak / szt). The new two-field stock input
-- stores base units, so such a row makes "1 blok + 5 kg = 20 kg" read above
-- target and drops the suggestion to 0. Merge only once this returns no rows
-- the operator considers wrong (data session converts them).
--
-- Heuristic: target < 2 packs, or max < 1 pack (both > 0). A genuine small
-- target (e.g. 1 block of a slow product) will also show up — judge per row.
-- No writes.

SELECT
  l.location_id,
  p.product_id,
  p.product_name_pl,
  sp.supplier_id,
  sp.purchase_unit                       AS pack_unit,
  sp.units_per_purchase_unit             AS upp,
  p.inventory_unit                       AS base_unit,
  lps.min_stock_qty_base,
  lps.target_stock_qty_base,
  lps.max_stock_qty_base,
  round((lps.target_stock_qty_base * sp.units_per_purchase_unit)::numeric, 3)
                                         AS target_if_it_was_packs
FROM location_product_settings lps
JOIN locations l          ON l.location_id = lps.location_id AND l.active
JOIN products p           ON p.product_id = lps.product_id AND p.active
JOIN supplier_products sp ON sp.product_id = lps.product_id
                         AND sp.active
                         AND sp.units_per_purchase_unit > 1
WHERE (lps.target_stock_qty_base > 0
       AND lps.target_stock_qty_base < 2 * sp.units_per_purchase_unit)
   OR (lps.max_stock_qty_base > 0
       AND lps.max_stock_qty_base < sp.units_per_purchase_unit)
ORDER BY p.product_name_pl, l.location_id, sp.supplier_id;
