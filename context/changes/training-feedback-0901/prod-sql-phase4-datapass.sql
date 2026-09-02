-- ============================================================
-- training-feedback-0901 — Phase 4 DATA PASS: warehouse_pickup
--
-- ORDER OF OPERATIONS MATTERS (hardening finding B4):
--   1. apply migration 0015          (adds the column, DEFAULT false everywhere)
--   2. run THIS FILE                 (flags the goods actually collected)
--   3. THEN deploy the frontend      (which filters the pickup document)
--
-- Running the code before this data pass renders an EMPTY pickup document,
-- because the column defaults to false on every existing row.
--
-- WHY THIS EXISTS
-- SUP_PAGO is a purchasing CHANNEL, not a warehouse. The Pago batch verified on
-- prod (TRN-20260901-PAGO-1fc493) held 14 products spanning frozen meat, chilled
-- dips, till rolls, napkins, trays and paper. "Zlecenie odbioru własnego" is the
-- run to the cold-storage warehouse, so it must list only what is collected
-- there — that is the operator's "Pago daje wszystkie produkty, a nie tylko Pago".
--
-- The order email and the order PDF are deliberately NOT filtered: the warehouse
-- run is a subset of the purchase, not the whole of it.
-- ============================================================


-- ------------------------------------------------------------
-- (1) BEFORE — save this output; it is the rollback.
-- ------------------------------------------------------------
-- select sp.supplier_product_id, p.product_name_pl, p.product_category, sp.warehouse_pickup
--   from supplier_products sp join products p on p.product_id = sp.product_id
--  where sp.supplier_id = 'SUP_PAGO'
--  order by p.product_category, p.product_name_pl;


-- ------------------------------------------------------------
-- (2) APPLY — the full Pago catalogue, split explicitly.
--
-- Enumerated by supplier_product_id rather than derived from product_category,
-- so the decision is reviewable line by line and a future re-categorisation
-- cannot silently move a product between the two documents.
--
-- REVIEW THIS LIST BEFORE RUNNING. The split below is the researched default:
-- Chłodnia + Mrożonki are collected from the cold store; Biurowe + Opakowania
-- are delivered/purchased. Move any line that is actually handled the other way.
-- ------------------------------------------------------------

BEGIN;

-- Collected on the warehouse run (frozen + chilled).
UPDATE supplier_products SET warehouse_pickup = true
 WHERE supplier_product_id IN (
    'SP_PAGO_P014',   -- Feta blok                     (Chłodnia)
    'SP_PAGO_P019',   -- Przyprawa do souvlakow        (Chłodnia)
    'SP_PAGO_P012',   -- Tirokafteri                   (Chłodnia)
    'SP_PAGO_P011',   -- Tzatzyki                      (Chłodnia)
    'SP_PAGO_P145',   -- Bifteki burgers               (Mrożonki)
    'SP_PAGO_P024',   -- Gyros 15 KG                   (Mrożonki)
    'SP_PAGO_P025',   -- Gyros 25 KG                   (Mrożonki)
    'SP_PAGO_P026',   -- Pita (opakowania) szt 10      (Mrożonki)
    'SP_PAGO_P027',   -- Souvlaki Kurczak              (Mrożonki)
    'SP_PAGO_P028'    -- Souvlaki Wieprz               (Mrożonki)
 );

-- Purchased through Pago but NOT collected on the warehouse run.
-- Explicit for the audit trail; the column already defaults to false.
UPDATE supplier_products SET warehouse_pickup = false
 WHERE supplier_product_id IN (
    'SP_PAGO_P133',   -- Długopisy                     (Biurowe)
    'SP_PAGO_P131',   -- Koperty                       (Biurowe)
    'SP_PAGO_P132',   -- Markery                       (Biurowe)
    'SP_PAGO_P128',   -- Rolki do kasy 57 na 20        (Biurowe)
    'SP_PAGO_P130',   -- Rolki do kasy 57 na 30        (Biurowe)
    'SP_PAGO_P142',   -- Rolki do kasy 57 na 50        (Biurowe)
    'SP_PAGO_P129',   -- Rolki do kasy 80 na 80        (Biurowe)
    'SP_PAGO_P127',   -- Zszywki do zszywacza          (Biurowe)
    'SP_PAGO_P089',   -- Boxy PB                       (Opakowania)
    'SP_PAGO_P090',   -- Papier do Pita (PB)           (Opakowania)
    'SP_PAGO_P098',   -- Papier termiczny - aluminiowy (Opakowania)
    'SP_PAGO_P091',   -- Serwetki PB                   (Opakowania)
    'SP_PAGO_P173',   -- Skepasti box PB               (Opakowania)
    'SP_PAGO_P092'    -- Tacki bez logo                (Opakowania)
 );

COMMIT;


-- ------------------------------------------------------------
-- (3) AUDIT
-- ------------------------------------------------------------
-- MUST be non-zero — a zero here means the pickup document will render empty:
-- select count(*) from supplier_products
--  where supplier_id = 'SUP_PAGO' and warehouse_pickup;      -- expect 10

-- No Pago product left unclassified by this file:
-- select sp.supplier_product_id, p.product_name_pl from supplier_products sp
--   join products p on p.product_id = sp.product_id
--  where sp.supplier_id = 'SUP_PAGO'
--    and sp.supplier_product_id not in ( /* both lists above */ );

-- Nothing outside Pago was touched:
-- select count(*) from supplier_products
--  where warehouse_pickup and supplier_id <> 'SUP_PAGO';     -- expect 0

-- Eyeball the result:
-- select p.product_category, p.product_name_pl, sp.warehouse_pickup
--   from supplier_products sp join products p on p.product_id = sp.product_id
--  where sp.supplier_id='SUP_PAGO' order by sp.warehouse_pickup desc, 1, 2;


-- ------------------------------------------------------------
-- ROLLBACK
-- ------------------------------------------------------------
-- UPDATE supplier_products SET warehouse_pickup = false WHERE supplier_id = 'SUP_PAGO';
