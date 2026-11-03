-- order-watch / ZALEGŁE LIMITY (>3 tyg. w kolejce) — decyzja operatora, jeden apply.
-- Źródła: connecteam B-sweep + master-data-followups (C-3, A′) + maile 26/30.10.
-- Konwencja: BEFORE → UPDATE z komentarzem-źródłem → AUDIT → rollback.
-- Uwaga: wartości ZWERYFIKOWAĆ z prod przed apply (możliwe że część już wgrana po 30.10).

-- BEFORE per pozycja (odczyt)
SELECT sp.location_id, p.name, sp.min_stock_qty_base AS min, sp.target_stock_qty_base AS target,
       sp.max_stock_qty_base AS max, sp.package_qty, sp.unit_label
FROM supplier_products sp JOIN products p ON p.product_id = sp.product_id
WHERE p.name ILIKE ANY (ARRAY['%souvlaki%','%gyros%','%coca%','%cola%','%kamino%','%gąbk%','%gabk%'])
ORDER BY sp.location_id NULLS LAST, p.name;

BEGIN;
-- 1) KEN souvlaki kurczak/wieprz: 6 box = 36 kg → karton 6 kg (prod ma 5 kg) [B35, captain 25.09]
--    UPDATE supplier_products SET package_qty = 6 WHERE product_id = '<SOUVLAKI_KEN>' AND location_id = 'KEN';
--    (potwierdzić z Khushi, czy 6 kg/box — chat mówi 6 box=36 kg)
-- 2) KEN gyros: próg „3 szt do następnej dostawy" → min 0 / target 3 / max ~6 [B53, 08.10]
-- 3) KEN Coca-Cola: min/target 72/96 → 48/72 (min zamówienia 500) [master-data-followups C-3]
-- 4) Wola Kamino butle gazowe: max 9 (razem 11) [B20]
-- 5) Gąbki: jednostka „paczka 10 szt" zamiast szt. [B16/B58, Marek potwierdził „10szt opak."]
-- AUDIT
SELECT sp.location_id, p.name, sp.min_stock_qty_base, sp.target_stock_qty_base, sp.max_stock_qty_base
FROM supplier_products sp JOIN products p ON p.product_id = sp.product_id
WHERE sp.updated_at > now() - interval '10 minutes';
COMMIT;

-- ROLLBACK: przywróć wartości z BEFORE dump.
