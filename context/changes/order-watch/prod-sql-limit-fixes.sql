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

-- BEFORE per pozycja (odczyt) — progi per lokal. Kamino to „Butla gazowa 10L
-- zamknięta" — filtr obejmuje %butla%/%gazowa%, mapowanie potwierdź po product_id.
SELECT lps.location_id, p.product_id, p.product_name_pl,
       lps.min_stock_qty_base AS min, lps.target_stock_qty_base AS target,
       lps.max_stock_qty_base AS max
FROM location_product_settings lps
JOIN products p ON p.product_id = lps.product_id
WHERE p.product_name_pl ILIKE ANY
      (ARRAY['%souvlaki%','%gyros%','%coca%','%cola%','%butla%','%gazowa%',
             '%kamino%','%gąbk%','%gabk%'])
ORDER BY lps.location_id, p.product_name_pl;

-- BEFORE — jednostki pakowania w katalogu dostawców (w tym wiersze per-lokal z 0029).
-- ZWRÓĆ UWAGĘ na case_unit/units_per_case (0028): jeśli produkt ma już
-- units_per_case=10, NIE ustawiaj dodatkowo units_per_purchase_unit=10 —
-- dwa przeliczniki = opakowanie 100 szt i sugestia 0 (review sol #4).
SELECT sp.supplier_product_id, sp.supplier_id, sp.location_id, p.product_name_pl,
       sp.purchase_unit, sp.units_per_purchase_unit, sp.case_unit, sp.units_per_case
FROM supplier_products sp
JOIN products p ON p.product_id = sp.product_id
WHERE p.product_name_pl ILIKE ANY
      (ARRAY['%souvlaki%','%gyros%','%coca%','%cola%','%butla%','%gazowa%',
             '%kamino%','%gąbk%','%gabk%'])
ORDER BY sp.location_id NULLS LAST, p.product_name_pl;

-- GUARD: zmapuj product_id / supplier_product_id z BEFORE zanim odkomentujesz.

-- BEGIN;
-- 1) KEN souvlaki: karton 6 kg (prod ma 5 kg) [B35, captain 25.09; potwierdzić 6 kg/box]
--    ⚠ NAJPIERW ustal, który wiersz catalog jest EFEKTYWNY dla KEN: jeśli KEN
--    korzysta ze wspólnego katalogu (wiersz location_id IS NULL — 0029), to
--    UPDATE na wierszu 'KEN' nic nie zmieni albo wiersza nie ma. Sprawdź BEFORE:
--    wiersz KEN istnieje? → update jego; nie ma → decyzja: update wspólny wiersz
--    ALBO utwórz KEN-scoped (wzór z 0029), nie zgaduj.
-- UPDATE supplier_products SET units_per_purchase_unit = 6
--  WHERE supplier_product_id = '<SP_SOUVLAKI_EFEKTYWNY>';
--
-- 2) KEN gyros: „3 szt do następnej dostawy" [B53, 08.10]
--    ⚠ JEDNOSTKA: progi są w JEDNOSTCE BAZOWEJ produktu (products.inventory_unit
--    = kg dla gyrosa ~15 kg/szt). Wartości w sztukach ZEPSUJĄ sugestię
--    (symulacja: target=3 → silnik proponuje 1 szt zamiast 3). Z BEFORE odczytaj
--    inventory_unit + units_per_purchase_unit i przelicz:
--    np. szt=15 kg → target=45, max=90 (kg). Wartości poniżej = PRZYKŁAD, nie gotowiec.
-- UPDATE location_product_settings
--    SET min_stock_qty_base = 0,
--        target_stock_qty_base = 3 * <KG_NA_SZT>,   -- np. 45
--        max_stock_qty_base   = 6 * <KG_NA_SZT>    -- np. 90
--  WHERE location_id = 'KEN' AND product_id = '<P_GYROS>';
--
-- 3) KEN Coca-Cola: 72/96 → 48/72 (min. zamówienia 500) [master-data-followups C-3]
-- UPDATE location_product_settings
--    SET target_stock_qty_base = 48, max_stock_qty_base = 72
--  WHERE location_id = 'KEN' AND product_id = '<P_COLA_KEN>';
--
-- 4) Wola Kamino (butla gazowa): max 9 [B20] — product_id z BEFORE (nazwa bez „kamino")
-- UPDATE location_product_settings SET max_stock_qty_base = 9
--  WHERE location_id = 'WOLA' AND product_id = '<P_BUTLA_GAZOWA>';
--
-- 5) Gąbki: jednostka „paczka 10 szt" [B16/B58 — Marek potwierdził]
--    ⚠ JEDEN przelicznik: jeśli units_per_case już =10 (BEFORE pkt 2), pomiń ten UPDATE.
--    Wpp. preferuj units_per_case (purchase zostaje 'szt') zamiast zmiany purchase_unit:
-- UPDATE supplier_products SET case_unit = 'paczka', units_per_case = 10
--  WHERE supplier_product_id = '<SP_GABKI>';
--
-- AUDIT (w transakcji — porównaj z BEFORE, ten sam zbiór filtrów):
-- SELECT lps.location_id, p.product_name_pl,
--        lps.min_stock_qty_base, lps.target_stock_qty_base, lps.max_stock_qty_base
-- FROM location_product_settings lps JOIN products p ON p.product_id = lps.product_id
-- WHERE p.product_id IN ('<P_GYROS>','<P_COLA_KEN>','<P_BUTLA_GAZOWA>');
-- SELECT sp.location_id, p.product_name_pl, sp.purchase_unit,
--        sp.units_per_purchase_unit, sp.case_unit, sp.units_per_case
-- FROM supplier_products sp JOIN products p ON p.product_id = sp.product_id
-- WHERE sp.supplier_product_id IN ('<SP_SOUVLAKI_EFEKTYWNY>','<SP_GABKI>');
-- COMMIT;   -- albo ROLLBACK; jeśli AUDIT ≠ oczekiwania.

-- ROLLBACK: przywróć wartości z BEFORE dump (UPDATE per klucz główny).
