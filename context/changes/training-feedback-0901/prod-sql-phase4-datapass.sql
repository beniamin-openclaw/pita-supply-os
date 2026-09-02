-- ============================================================
-- training-feedback-0901 — Phase 4 DATA PASS: warehouse_pickup
--
-- STATUS: APPLIED TO PROD 2026-09-02. This file records what is actually in
-- production, not a proposal.
--
-- CORRECTION HISTORY — read this before trusting any earlier copy of this file.
-- The first version of this data pass flagged TEN rows, derived from
-- product_category (everything Pago sold in Chłodnia + Mrożonki). That was my
-- inference and it was WRONG. The operator supplied the authoritative Pago
-- catalogue on 2026-09-02 and it has eight positions, of which four of my ten
-- do not appear at all: Feta blok, Przyprawa do souvlakow, Tirokafteri and
-- Tzatzyki. Those are bought through Pago but are NOT collected on the
-- warehouse run. Prod was corrected the same day; this file was rewritten to
-- match. If you find a version claiming "expect 10", it is stale.
--
-- WHY THIS EXISTS
-- SUP_PAGO is a purchasing CHANNEL, not a warehouse. One real batch mixed
-- frozen meat with till rolls, napkins and trays. "Zlecenie odbioru własnego"
-- is the run to the cold-storage warehouse, so it lists only what is collected
-- there. Only the pickup DOCUMENT filters on this column — the Pago order email
-- and the order PDF still cover the whole purchase.
--
-- ORDER OF OPERATIONS: migration 0015 → this file → deploy the filtering code.
-- The column defaults false on every row, so shipping the code first renders an
-- empty pickup document.
-- ============================================================


-- ------------------------------------------------------------
-- (1) BEFORE — the pre-change state was uniform: migration 0015 set every row
--     to false. The rollback is therefore a single statement, at the bottom.
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- (2) APPLIED — the operator's Pago catalogue, with their own SKU codes.
--
--     PAGO-001  Gyros 15 KG                 -> P024
--     PAGO-002  Gyros 25 KG                 -> P025
--     PAGO-003  Souvlaki Kurczak            -> P027
--     PAGO-004  Souvlaki Wieprz             -> P028
--     PAGO-005  Pita                        -> P026 (Pita (opakowania) szt 10)
--     PAGO-006  Bifteki Black Pork          -> P145 (catalogued as "Bifteki
--                                             burgers"; rename pending operator
--                                             confirmation)
--     PAGO-007  CIASTO FILLO KANAKI 20X450G -> DOES NOT EXIST as a product yet
--     PAGO-008  ARMENONVILLE                -> DOES NOT EXIST as a product yet
--
--     PAGO-007 and PAGO-008 still need products + supplier_products + per-
--     location thresholds before they can be flagged. Until then the pickup
--     document is short by those two lines.
-- ------------------------------------------------------------

BEGIN;

-- Reset first, so re-running this file is idempotent and cannot leave a
-- previously-flagged row (e.g. from the superseded ten-row version) behind.
UPDATE supplier_products SET warehouse_pickup = false WHERE supplier_id = 'SUP_PAGO';

UPDATE supplier_products SET warehouse_pickup = true, supplier_sku = v.sku
  FROM (VALUES
    ('SP_PAGO_P024','PAGO-001'),
    ('SP_PAGO_P025','PAGO-002'),
    ('SP_PAGO_P027','PAGO-003'),
    ('SP_PAGO_P028','PAGO-004'),
    ('SP_PAGO_P026','PAGO-005'),
    ('SP_PAGO_P145','PAGO-006')
  ) AS v(spid, sku)
 WHERE supplier_products.supplier_product_id = v.spid;

COMMIT;


-- ------------------------------------------------------------
-- (3) AUDIT — verified on prod 2026-09-02.
-- ------------------------------------------------------------
-- Must return 6 (rises to 8 once PAGO-007 and PAGO-008 exist):
--   select count(*) from supplier_products
--    where supplier_id = 'SUP_PAGO' and warehouse_pickup;
--
-- Must return 0 — nothing outside Pago is ever a warehouse-pickup item:
--   select count(*) from supplier_products
--    where warehouse_pickup and supplier_id <> 'SUP_PAGO';
--
-- Must return 0 — every flagged row carries its Pago catalogue code:
--   select count(*) from supplier_products
--    where supplier_id = 'SUP_PAGO' and warehouse_pickup
--      and (supplier_sku is null or supplier_sku = '');
--
-- Eyeball:
--   select sp.supplier_sku, p.product_name_pl, sp.warehouse_pickup
--     from supplier_products sp join products p on p.product_id = sp.product_id
--    where sp.supplier_id = 'SUP_PAGO'
--    order by sp.warehouse_pickup desc, sp.supplier_sku nulls last;


-- ------------------------------------------------------------
-- ROLLBACK
-- ------------------------------------------------------------
-- UPDATE supplier_products SET warehouse_pickup = false WHERE supplier_id = 'SUP_PAGO';
-- (supplier_sku is additive identification and is deliberately NOT cleared.)
