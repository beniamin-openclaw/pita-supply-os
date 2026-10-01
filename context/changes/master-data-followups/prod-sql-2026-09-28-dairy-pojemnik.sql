-- master-data-followups · Batch 1 · 2026-09-28 · DRAFT, NOT APPLIED
-- Tzatzyki (P011), Hot Feta / Tirokafteri (P012) and Feta blok (P014) move from kg to `pojemnik`
-- (1 pojemnik = 3 kg / 2 kg / 2 kg). Operator decisions: change.md "Operator decisions 2026-09-28".
-- Run after 17:00 (orders for the next day already submitted), in this order:
--   Step 0 diff (save the output: it is the rollback) -> Step 1 apply (one transaction) -> Step 2 audit.
-- Purchase-unit quantities in order_lines / receipt_lines keep their meaning (1 pojemnik = 1 wiadro
-- = 1 blok = one ordered unit), so history is not rewritten; only base (kg) fields of OPEN orders,
-- inventory counts and thresholds are converted.

-- ---------- Thresholds (explicit rows win; every other location is converted generically) ----------
-- Sources: NORBLIN / ELEKTROWNIA / WESTFIELD "minmax" tabs (already in pojemnik); BRACKA "Bracka Min Max"
-- (kg, divided); WOLA / KEN / BROWARY approved in chat (max = values from Q3; min converted from kg).
-- KEN and BROWARY rows: re-check against the new sheets (1PlApVFkF..., 1nubILkSTN...) before running.
-- Fractional max on a full_only product: target = floor(max) (Feta 0.5 / 1 / 1.5 — "usually order 1,
-- reorder at 0.5").

-- ---------- Step 0: diff ----------
WITH factor(product_id, kg_per_unit) AS (
  VALUES ('P011', 3.0), ('P012', 2.0), ('P014', 2.0)
),
explicit(location_id, product_id, min_q, target_q, max_q) AS (
  VALUES
  ('BRACKA',      'P011', 3.0, 12.0, 12.0), ('BRACKA',      'P012', 1.0, 3.0, 3.0), ('BRACKA',      'P014', 0.5, 1.0, 1.0),
  ('NORBLIN',     'P011', 6.0, 24.0, 24.0), ('NORBLIN',     'P012', 1.0, 2.0, 2.0), ('NORBLIN',     'P014', 0.5, 1.0, 1.5),
  ('ELEKTROWNIA', 'P011', 6.0, 24.0, 24.0), ('ELEKTROWNIA', 'P012', 1.0, 3.0, 3.0), ('ELEKTROWNIA', 'P014', 0.5, 1.0, 1.5),
  ('WESTFIELD',   'P011', 6.0, 18.0, 18.0), ('WESTFIELD',   'P012', 1.0, 2.0, 2.0), ('WESTFIELD',   'P014', 0.5, 1.0, 1.5),
  ('WOLA',        'P011', 2.0, 12.0, 12.0), ('WOLA',        'P012', 1.5, 3.0, 3.0), ('WOLA',        'P014', 0.5, 2.0, 2.0),
  ('KEN',         'P011', 2.0,  6.0,  6.0), ('KEN',         'P012', 0.5, 2.0, 2.0), ('KEN',         'P014', 0.5, 1.0, 1.0),
  ('BROWARY',     'P011', 3.0, 12.0, 12.0), ('BROWARY',     'P012', 1.0, 2.0, 2.0), ('BROWARY',     'P014', 0.5, 1.0, 1.0)
),
generic AS (
  SELECT s.setting_id,
         round(s.min_stock_qty_base / f.kg_per_unit * 2) / 2      AS g_min,
         ceil(s.max_stock_qty_base / f.kg_per_unit * 2) / 2       AS g_max
  FROM location_product_settings s JOIN factor f USING (product_id)
)
SELECT s.setting_id, s.location_id, s.product_id,
       s.min_stock_qty_base AS old_min, s.target_stock_qty_base AS old_target, s.max_stock_qty_base AS old_max,
       COALESCE(e.min_q, g.g_min) AS new_min,
       COALESCE(e.target_q, CASE WHEN g.g_max >= 1 THEN floor(g.g_max) ELSE g.g_max END) AS new_target,
       COALESCE(e.max_q, g.g_max) AS new_max,
       (e.location_id IS NOT NULL) AS explicit_row
FROM location_product_settings s
JOIN generic g USING (setting_id)
LEFT JOIN explicit e ON e.location_id = s.location_id AND e.product_id = s.product_id
ORDER BY s.product_id, s.location_id;

SELECT product_id, product_name_pl, inventory_unit FROM products WHERE product_id IN ('P011','P012','P014');
SELECT supplier_product_id, supplier_product_name, purchase_unit, units_per_purchase_unit, order_note
FROM supplier_products WHERE supplier_product_id IN ('SP_BUKAT_P011','SP_BUKAT_P012','SP_BUKAT_P014','SP_BUKAT_P007');
SELECT l.count_line_id, l.product_id, l.current_stock_qty_base FROM inventory_count_lines l
WHERE l.product_id IN ('P011','P012','P014') ORDER BY l.count_line_id;
SELECT l.order_line_id, o.status, l.product_id, l.current_stock_qty_base, l.target_stock_qty_base,
       l.suggested_qty_base, l.captain_final_qty_purchase, l.captain_final_qty_base,
       l.manager_final_qty_purchase, l.manager_final_qty_base
FROM order_lines l JOIN orders o USING (order_id)
WHERE l.product_id IN ('P011','P012','P014') AND o.status IN ('draft','captain_submitted','manager_claimed');

-- ---------- Step 1: apply ----------
BEGIN;

UPDATE products SET product_name_pl = 'Tzatzyki 3kg',  inventory_unit = 'pojemnik' WHERE product_id = 'P011';
UPDATE products SET product_name_pl = 'Hot Feta 2kg',  inventory_unit = 'pojemnik' WHERE product_id = 'P012';
UPDATE products SET product_name_pl = 'Feta blok 2kg', inventory_unit = 'pojemnik' WHERE product_id = 'P014';
UPDATE products SET product_name_pl = 'Rucola 100 gr' WHERE product_id = 'P007';

UPDATE supplier_products SET supplier_product_name = 'Tzatzyki 3kg', purchase_unit = 'pojemnik',
       units_per_purchase_unit = 1, order_note = '1 pojemnik = 3 kg (karton 6)'
WHERE supplier_product_id = 'SP_BUKAT_P011';
UPDATE supplier_products SET supplier_product_name = 'Hot Feta (Tirokafteri) 2kg', purchase_unit = 'pojemnik',
       units_per_purchase_unit = 1, order_note = '1 pojemnik = 2 kg'
WHERE supplier_product_id = 'SP_BUKAT_P012';
UPDATE supplier_products SET supplier_product_name = 'Feta blok 2kg', purchase_unit = 'pojemnik',
       units_per_purchase_unit = 1, order_note = '1 pojemnik = blok 2 kg'
WHERE supplier_product_id = 'SP_BUKAT_P014';
UPDATE supplier_products SET supplier_product_name = 'Rucola 100 gr' WHERE supplier_product_id = 'SP_BUKAT_P007';

WITH factor(product_id, kg_per_unit) AS (
  VALUES ('P011', 3.0), ('P012', 2.0), ('P014', 2.0)
),
explicit(location_id, product_id, min_q, target_q, max_q) AS (
  VALUES
  ('BRACKA',      'P011', 3.0, 12.0, 12.0), ('BRACKA',      'P012', 1.0, 3.0, 3.0), ('BRACKA',      'P014', 0.5, 1.0, 1.0),
  ('NORBLIN',     'P011', 6.0, 24.0, 24.0), ('NORBLIN',     'P012', 1.0, 2.0, 2.0), ('NORBLIN',     'P014', 0.5, 1.0, 1.5),
  ('ELEKTROWNIA', 'P011', 6.0, 24.0, 24.0), ('ELEKTROWNIA', 'P012', 1.0, 3.0, 3.0), ('ELEKTROWNIA', 'P014', 0.5, 1.0, 1.5),
  ('WESTFIELD',   'P011', 6.0, 18.0, 18.0), ('WESTFIELD',   'P012', 1.0, 2.0, 2.0), ('WESTFIELD',   'P014', 0.5, 1.0, 1.5),
  ('WOLA',        'P011', 2.0, 12.0, 12.0), ('WOLA',        'P012', 1.5, 3.0, 3.0), ('WOLA',        'P014', 0.5, 2.0, 2.0),
  ('KEN',         'P011', 2.0,  6.0,  6.0), ('KEN',         'P012', 0.5, 2.0, 2.0), ('KEN',         'P014', 0.5, 1.0, 1.0),
  ('BROWARY',     'P011', 3.0, 12.0, 12.0), ('BROWARY',     'P012', 1.0, 2.0, 2.0), ('BROWARY',     'P014', 0.5, 1.0, 1.0)
),
newvals AS (
  SELECT s.setting_id,
         COALESCE(e.min_q, round(s.min_stock_qty_base / f.kg_per_unit * 2) / 2) AS n_min,
         COALESCE(e.max_q, ceil(s.max_stock_qty_base / f.kg_per_unit * 2) / 2) AS n_max,
         e.target_q
  FROM location_product_settings s
  JOIN factor f USING (product_id)
  LEFT JOIN explicit e ON e.location_id = s.location_id AND e.product_id = s.product_id
)
UPDATE location_product_settings s
SET min_stock_qty_base    = n.n_min,
    max_stock_qty_base    = n.n_max,
    target_stock_qty_base = COALESCE(n.target_q, CASE WHEN n.n_max >= 1 THEN floor(n.n_max) ELSE n.n_max END),
    notes = trim(both ' ' FROM coalesce(s.notes, '') || ' [2026-09-28 kg->pojemnik]')
FROM newvals n
WHERE s.setting_id = n.setting_id;

WITH factor(product_id, kg_per_unit) AS (VALUES ('P011', 3.0), ('P012', 2.0), ('P014', 2.0))
UPDATE inventory_count_lines l
SET current_stock_qty_base = round(l.current_stock_qty_base / f.kg_per_unit, 3)
FROM factor f WHERE l.product_id = f.product_id;

WITH factor(product_id, kg_per_unit) AS (VALUES ('P011', 3.0), ('P012', 2.0), ('P014', 2.0))
UPDATE order_lines l
SET current_stock_qty_base = round(l.current_stock_qty_base / f.kg_per_unit, 3),
    target_stock_qty_base  = round(l.target_stock_qty_base  / f.kg_per_unit, 3),
    suggested_qty_base     = round(l.suggested_qty_base     / f.kg_per_unit, 3),
    captain_final_qty_base = l.captain_final_qty_purchase,
    manager_final_qty_base = l.manager_final_qty_purchase
FROM factor f, orders o
WHERE l.product_id = f.product_id AND o.order_id = l.order_id
  AND o.status IN ('draft', 'captain_submitted', 'manager_claimed');

COMMIT;

-- ---------- Step 2: audit ----------
SELECT location_id, product_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base
FROM location_product_settings
WHERE product_id IN ('P011','P012','P014')
  AND NOT (min_stock_qty_base <= target_stock_qty_base AND target_stock_qty_base <= max_stock_qty_base);
-- expect 0 rows
SELECT product_id, product_name_pl, inventory_unit FROM products WHERE product_id IN ('P007','P011','P012','P014');
SELECT supplier_product_id, supplier_product_name, purchase_unit, units_per_purchase_unit
FROM supplier_products WHERE supplier_product_id IN ('SP_BUKAT_P007','SP_BUKAT_P011','SP_BUKAT_P012','SP_BUKAT_P014');
SELECT product_id, max(current_stock_qty_base) AS max_count FROM inventory_count_lines
WHERE product_id IN ('P011','P012','P014') GROUP BY product_id;
-- expect roughly: P011 <= 13, P012 <= 4, P014 <= 2
