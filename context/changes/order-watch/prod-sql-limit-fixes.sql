-- order-watch / ZALEGŁE LIMITY (>3 tyg. w kolejce) — decyzja operatora, jeden apply.
-- Źródła: connecteam B-sweep + master-data-followups (C-3, A′) + maile 26/30.10.
-- Konwencja: BEFORE → UPDATE z komentarzem-źródłem → AUDIT → rollback.
--
-- Schemat zweryfikowany z migracjami 0001/0029:
--   products.product_name_pl          — nazwa produktu
--   location_product_settings         — progi PER LOKAL:
--     (location_id, product_id, min/max/target_stock_qty_base, UNIQUE(location_id,product_id))
--   supplier_products                 — katalog dostawcy:
--     (supplier_id, product_id, purchase_unit, units_per_purchase_unit, location_id NULL — 0029)
--   ŻADNA z tych tabel nie ma updated_at — AUDIT filtruje po product_id/location_id.
-- Wartości ZWERYFIKOWAĆ na prod przed apply (część mogła wejść po 30.10).

-- BEFORE per pozycja (odczyt) — progi per lokal:
SELECT lps.location_id, p.product_id, p.product_name_pl,
       lps.min_stock_qty_base AS min, lps.target_stock_qty_base AS target,
       lps.max_stock_qty_base AS max
FROM location_product_settings lps
JOIN products p ON p.product_id = lps.product_id
WHERE p.product_name_pl ILIKE ANY
      (ARRAY['%souvlaki%','%gyros%','%coca%','%cola%','%kamino%','%gąbk%','%gabk%'])
ORDER BY lps.location_id, p.product_name_pl;

-- BEFORE — jednostki pakowania w katalogu dostawców (w tym wiersze per-lokal z 0029):
SELECT sp.supplier_product_id, sp.supplier_id, sp.location_id, p.product_name_pl,
       sp.purchase_unit, sp.units_per_purchase_unit
FROM supplier_products sp
JOIN products p ON p.product_id = sp.product_id
WHERE p.product_name_pl ILIKE ANY
      (ARRAY['%souvlaki%','%gyros%','%coca%','%cola%','%kamino%','%gąbk%','%gabk%'])
ORDER BY sp.location_id NULLS LAST, p.product_name_pl;

-- GUARD: zmapuj product_id / supplier_product_id z BEFORE zanim odkomentujesz.

-- BEGIN;
-- 1) KEN souvlaki: karton 6 kg (prod ma 5 kg) [B35, captain 25.09; potwierdzić 6 kg/box]
--    — jednostka pakowania = supplier_products, wiersz KEN (location_id z 0029):
-- UPDATE supplier_products SET units_per_purchase_unit = 6
--  WHERE supplier_product_id = '<SP_SOUVLAKI_KEN>' AND location_id = 'KEN';
--
-- 2) KEN gyros: próg „3 szt do następnej dostawy" → min 0 / target 3 / max 6 [B53, 08.10]
-- UPDATE location_product_settings
--    SET min_stock_qty_base = 0, target_stock_qty_base = 3, max_stock_qty_base = 6
--  WHERE location_id = 'KEN' AND product_id = '<P_GYROS>';
--
-- 3) KEN Coca-Cola: 72/96 → 48/72 (min. zamówienia 500) [master-data-followups C-3]
-- UPDATE location_product_settings
--    SET target_stock_qty_base = 48, max_stock_qty_base = 72
--  WHERE location_id = 'KEN' AND product_id = '<P_COLA_KEN>';
--
-- 4) Wola Kamino butle: max 9 [B20]
-- UPDATE location_product_settings SET max_stock_qty_base = 9
--  WHERE location_id = 'WOLA' AND product_id = '<P_KAMINO>';
--
-- 5) Gąbki: jednostka „paczka 10 szt" [B16/B58 — Marek potwierdził]
-- UPDATE supplier_products SET purchase_unit = 'paczka', units_per_purchase_unit = 10
--  WHERE supplier_product_id = '<SP_GABKI>';
--
-- AUDIT (w transakcji — porównaj z BEFORE, ten sam zbiór filtrów):
-- SELECT lps.location_id, p.product_name_pl,
--        lps.min_stock_qty_base, lps.target_stock_qty_base, lps.max_stock_qty_base
-- FROM location_product_settings lps JOIN products p ON p.product_id = lps.product_id
-- WHERE p.product_id IN ('<P_GYROS>','<P_COLA_KEN>','<P_KAMINO>');
-- SELECT sp.location_id, p.product_name_pl, sp.purchase_unit, sp.units_per_purchase_unit
-- FROM supplier_products sp JOIN products p ON p.product_id = sp.product_id
-- WHERE sp.supplier_product_id IN ('<SP_SOUVLAKI_KEN>','<SP_GABKI>');
-- COMMIT;   -- albo ROLLBACK; jeśli AUDIT ≠ oczekiwania.

-- ROLLBACK: przywróć wartości z BEFORE dump (UPDATE per klucz główny).
