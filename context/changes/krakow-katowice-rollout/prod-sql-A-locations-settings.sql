-- ============================================================
-- krakow-katowice-rollout — STEP A: locations + thresholds (Supabase lpzhphufjwrndfogkfub)
-- Date: 2026-10-08. Run order: migration 0029 -> A (this file) -> C (DELETE, operator at the
-- screen) -> code deploy (check /health + new bundle) -> B (city suppliers + scoped catalog).
-- Sources: Marek's sheet "Miasta poza Warszawą" (Drive 1i-sXUd5zQUyA4YASKkb9SBl61r3sV5M5fazagnsJnpg,
--   tabs Katowice A1:D149, Kraków A1:D151), FORUM August thresholds (prod, read 2026-10-08),
--   operator data 2026-10-08 (addresses, companies, NIP, phones). Decision table: rollout-notes.md.
-- Pattern (lessons.md "Master-data ops: diff before, audit after"):
--   STEP 0 = diff below (read-only; save the output into rollout-notes.md "Diff przed")
--   STEP 1 = one DO block (one transaction; any guard failure rolls back everything)
--   STEP 2 = audit queries at the end
--   Rollback = rollback.sql section R-A (before-values embedded in each updated row's notes).
-- Rules: sheet value -> inventory unit (x pack where the sheet counts packs); target = max;
--   no sheet value -> keep an existing non-zero FORUM value, else 0/0/0; count-only products
--   (Pago, Mory, drinks, own production, Katowice tzatziki/tirokafteri) = 0/0/0.
--   Only rows of the final set are written; template leftovers go in STEP C.
-- Before (prod, 2026-10-08): FORUM 114 settings rows, SUPERSAM 116; both locations
--   active=false; 0 orders and 0 inventory counts at either location.
-- Expected: upsert touches 101 rows = FORUM 35 UPDATE + 4 INSERT,
--   SUPERSAM 59 UPDATE + 3 INSERT; unchanged rows of the final set
--   (65 FORUM, 45 SUPERSAM) are not touched.
--   After A: FORUM 118 rows, SUPERSAM 119 rows (C then removes 14 + 12).
-- NOTE: do not hand out FORUM/SUPERSAM captain tokens before step B is live — the old backend
--   ignores own_catalog and would show the Warsaw catalog to these locations.
-- ============================================================

-- ============================================================
-- STEP 0 — diff before (read-only)
-- ============================================================

-- 0a) locations now -> FORUM / SUPERSAM, active false, no address/company/phone
SELECT location_id, location_name, delivery_address, city, active, company_name, company_nip,
       phone, email, sender_email, notes
  FROM locations WHERE location_id IN ('FORUM','SUPERSAM') ORDER BY 1;

-- 0b) every row of the final set: now vs new, action (INSERT / UPDATE / bez zmian)
WITH v(location_id, product_id, mn, tg, mx, conv) AS (VALUES
  ('FORUM','P001',3,9,9,'Selgros KRK, progi lokalu z sierpnia'),
  ('FORUM','P002',0.5,2,2,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P003',1,2.5,2.5,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P004',2,6,6,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P005',1,2.5,2.5,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P006',12,54,54,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P007',10,35,35,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P008',8,25,25,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P009',0.3,1,1,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P010',0.2,1,1,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P011',5,14,14,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P012',1.5,4,4.5,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P013',1,3,3,'Kuchnie Świata KRK 0,5/1,5, arkusz bidon 2 kg -> kg (x2)'),
  ('FORUM','P014',0.5,2,2,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P015',24,72,72,'Kuchnie Świata KRK 24/72'),
  ('FORUM','P016',5,20,20,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P018',0.5,2,2,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P019',0,0,0,'tylko liczenie (Mory)'),
  ('FORUM','P020',2.5,7.5,7.5,'Kuchnie Świata KRK 0,5/1,5, arkusz karton 5 kg -> kg (x5)'),
  ('FORUM','P021',10,44,44,'Kuchnie Świata KRK 10/44'),
  ('FORUM','P022',2,5,5,'Kuchnie Świata KRK 2/5'),
  ('FORUM','P023',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P024',0,0,0,'tylko liczenie (Pago)'),
  ('FORUM','P026',0,0,0,'tylko liczenie (Pago)'),
  ('FORUM','P027',0,0,0,'tylko liczenie (Pago)'),
  ('FORUM','P028',0,0,0,'tylko liczenie (Pago)'),
  ('FORUM','P029',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P030',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P031',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P032',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P033',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P034',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P035',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P036',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P038',1,3,3,'Kuchnie Świata KRK 1/3'),
  ('FORUM','P040',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P041',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P042',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P043',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P044',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P045',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P046',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P047',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P048',2,4,4,'Kuchnie Świata KRK 2/4'),
  ('FORUM','P049',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P050',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P051',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P052',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P053',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P054',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P055',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P057',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P058',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P075',0,0,0,'tylko liczenie (napoje Filber)'),
  ('FORUM','P076',0,0,0,'tylko liczenie (napoje Filber)'),
  ('FORUM','P077',0,0,0,'tylko liczenie (napoje Filber)'),
  ('FORUM','P082',2,6,6,'Dis-Pack KRK 2/6'),
  ('FORUM','P083',1,4,4,'Dis-Pack KRK 1/4'),
  ('FORUM','P084',1,2,2,'Dis-Pack KRK 1/2'),
  ('FORUM','P085',1,2,2,'Dis-Pack KRK 1/2'),
  ('FORUM','P086',5,20,20,'Dis-Pack KRK 5/20'),
  ('FORUM','P087',3,8,8,'Dis-Pack KRK 3/8'),
  ('FORUM','P088',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P089',0,0,0,'tylko liczenie (Mory)'),
  ('FORUM','P090',0,0,0,'tylko liczenie (Mory)'),
  ('FORUM','P091',0,0,0,'tylko liczenie (Mory)'),
  ('FORUM','P092',0,0,0,'tylko liczenie (Mory)'),
  ('FORUM','P093',1,3,3,'Dis-Pack KRK 1/3, arkusz ''Karton'', katalog ''box'' - 1:1'),
  ('FORUM','P094',2,5,5,'Dis-Pack KRK 2/5'),
  ('FORUM','P095',1,5,5,'Dis-Pack KRK 1/5, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('FORUM','P096',1,4,4,'Dis-Pack KRK 1/4, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('FORUM','P097',1,3,3,'Dis-Pack KRK 1/3, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('FORUM','P098',0,0,0,'tylko liczenie (Mory)'),
  ('FORUM','P100',3,10,10,'Dis-Pack KRK 3/10'),
  ('FORUM','P101',5,20,20,'Dis-Pack KRK 5/20'),
  ('FORUM','P102',0.5,1.5,1.5,'Dis-Pack KRK 0,5/1,5, arkusz opak. 100 szt, katalog 250 szt - 1:1, do potw.'),
  ('FORUM','P104',1,2,2,'Dis-Pack KRK 1/2, arkusz ''Karton'', katalog ''opak'' - 1:1, do potw.'),
  ('FORUM','P106',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P107',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P116',2,7,7,'Dis-Pack KRK 2/7'),
  ('FORUM','P117',4,15,15,'Dis-Pack KRK 4/15'),
  ('FORUM','P118',4,15,15,'Dis-Pack KRK 4/15'),
  ('FORUM','P119',1,3,3,'Dis-Pack KRK 1/3'),
  ('FORUM','P121',10,25,25,'Dis-Pack KRK 2/5, arkusz opak. 5 szt -> szt (x5)'),
  ('FORUM','P122',3,10,10,'Dis-Pack KRK 3/10'),
  ('FORUM','P123',3,10,10,'Dis-Pack KRK 3/10'),
  ('FORUM','P126',3,7,7,'Dis-Pack KRK 3/7, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('FORUM','P127',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P129',0,0,0,'tylko liczenie (Mory, rolki)'),
  ('FORUM','P130',0,0,0,'tylko liczenie (Mory, rolki)'),
  ('FORUM','P131',1,2,2,'Dis-Pack KRK 1/2, arkusz opak. 50 szt, katalog ''box'' - 1:1'),
  ('FORUM','P132',0,0,0,'tylko liczenie (Mory)'),
  ('FORUM','P133',0,0,0,'tylko liczenie (Mory)'),
  ('FORUM','P143',2,8,8,'Dis-Pack KRK 2/8'),
  ('FORUM','P144',1,2,2,'Dis-Pack KRK 1/2'),
  ('FORUM','P155',0,0,0,'tylko liczenie (napoje Pepsi)'),
  ('FORUM','P163',0,0,0,'tylko liczenie (napoje Pepsi)'),
  ('FORUM','P164',0,0,0,'tylko liczenie (napoje Pepsi)'),
  ('FORUM','P165',0,0,0,'tylko liczenie (napoje Pepsi)'),
  ('FORUM','P166',0,0,0,'tylko liczenie (napoje Pepsi)'),
  ('FORUM','P167',0,0,0,'tylko liczenie (napoje Pepsi)'),
  ('FORUM','P172',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P176',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P177',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P001',3,8,8,'Selgros KAT 3/8'),
  ('SUPERSAM','P002',0.5,2,2,'Selgros KAT 0,5/2'),
  ('SUPERSAM','P003',0.5,2,2,'Selgros KAT 0,5/2'),
  ('SUPERSAM','P004',2,5,5,'Selgros KAT 2/5'),
  ('SUPERSAM','P005',0.5,2,2,'Selgros KAT 0,5/2'),
  ('SUPERSAM','P006',12,48,48,'Selgros KAT 12/48'),
  ('SUPERSAM','P007',3,20,20,'Selgros KAT 3/20'),
  ('SUPERSAM','P008',5,25,25,'Selgros KAT 5/25'),
  ('SUPERSAM','P009',0.2,1,1,'Selgros KAT 0,2/1'),
  ('SUPERSAM','P010',0.2,0.5,0.5,'Selgros KAT 0,2/0,5'),
  ('SUPERSAM','P011',0,0,0,'tylko liczenie (nabiał Katowice)'),
  ('SUPERSAM','P012',0,0,0,'tylko liczenie (nabiał Katowice)'),
  ('SUPERSAM','P013',1,3,3,'Kuchnie Świata KAT 0,5/1,5, arkusz bidon 2 kg -> kg (x2)'),
  ('SUPERSAM','P014',0,0,0,'Kuchnie Świata KAT, brak progu w arkuszu'),
  ('SUPERSAM','P015',24,72,72,'Kuchnie Świata KAT 24/72'),
  ('SUPERSAM','P016',5,20,20,'Selgros KAT 5/20'),
  ('SUPERSAM','P018',0.2,1,1,'Selgros KAT 0,2/1'),
  ('SUPERSAM','P019',0,0,0,'tylko liczenie (Mory)'),
  ('SUPERSAM','P020',2.5,7.5,7.5,'Kuchnie Świata KAT 0,5/1,5, arkusz karton 5 kg -> kg (x5)'),
  ('SUPERSAM','P021',10,36,36,'Kuchnie Świata KAT 10/36'),
  ('SUPERSAM','P022',2,4,4,'Kuchnie Świata KAT 2/4'),
  ('SUPERSAM','P023',1.25,3.75,3.75,'Selgros KAT 0,5/1,5, arkusz szt 2,5 kg -> kg (x2,5)'),
  ('SUPERSAM','P024',0,0,0,'tylko liczenie (Pago)'),
  ('SUPERSAM','P026',0,0,0,'tylko liczenie (Pago)'),
  ('SUPERSAM','P027',0,0,0,'tylko liczenie (Pago)'),
  ('SUPERSAM','P028',0,0,0,'tylko liczenie (Pago)'),
  ('SUPERSAM','P029',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P030',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P031',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P032',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P033',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P034',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P035',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P036',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P038',1,2,2,'Kuchnie Świata KAT 1/2'),
  ('SUPERSAM','P040',3,8,8,'Selgros KAT 3/8'),
  ('SUPERSAM','P041',0.5,1.5,1.5,'Selgros KAT 0,5/1,5'),
  ('SUPERSAM','P042',2,5,5,'Selgros KAT 2/5'),
  ('SUPERSAM','P043',1,2,2,'Selgros KAT 1/2'),
  ('SUPERSAM','P044',1,2,2,'Selgros KAT 1/2'),
  ('SUPERSAM','P045',2,7,7,'Selgros KAT 2/7'),
  ('SUPERSAM','P046',6,16,16,'Selgros KAT 6/16'),
  ('SUPERSAM','P047',2,6,6,'Selgros KAT 2/6'),
  ('SUPERSAM','P048',2,4,4,'Kuchnie Świata KAT 2/4'),
  ('SUPERSAM','P049',1,2,2,'Selgros KAT 1/2, arkusz ''szt'' (słoik 1 kg), katalog ''kg'' - 1:1'),
  ('SUPERSAM','P050',0,0,0,'Selgros KAT, brak progu w arkuszu'),
  ('SUPERSAM','P051',1,2,2,'Selgros KAT 1/2, arkusz ''szt'' (duże), katalog ''kg'' - 1:1, waga do potw.'),
  ('SUPERSAM','P052',1,2,2,'Selgros KAT 1/2, arkusz ''szt'' (duża), katalog ''kg'' - 1:1, waga do potw.'),
  ('SUPERSAM','P053',1,3,3,'Selgros KAT 1/3, arkusz ''szt'' 1 kg, katalog ''kg'' - 1:1'),
  ('SUPERSAM','P054',0,0,0,'Selgros KAT, brak progu w arkuszu'),
  ('SUPERSAM','P055',0,0,0,'Selgros KAT, brak progu w arkuszu'),
  ('SUPERSAM','P057',0,0,0,'Selgros KAT, brak progu w arkuszu'),
  ('SUPERSAM','P058',0,0,0,'Selgros KAT, brak progu w arkuszu'),
  ('SUPERSAM','P064',0,0,0,'tylko liczenie (Coca-Cola)'),
  ('SUPERSAM','P065',0,0,0,'tylko liczenie (Coca-Cola)'),
  ('SUPERSAM','P066',0,0,0,'tylko liczenie (Coca-Cola)'),
  ('SUPERSAM','P067',0,0,0,'tylko liczenie (Coca-Cola)'),
  ('SUPERSAM','P068',0,0,0,'tylko liczenie (Coca-Cola)'),
  ('SUPERSAM','P069',0,0,0,'tylko liczenie (Coca-Cola)'),
  ('SUPERSAM','P070',0,0,0,'tylko liczenie (Coca-Cola)'),
  ('SUPERSAM','P071',0,0,0,'tylko liczenie (Coca-Cola)'),
  ('SUPERSAM','P075',0,0,0,'tylko liczenie (napoje Filber)'),
  ('SUPERSAM','P076',0,0,0,'tylko liczenie (napoje Filber)'),
  ('SUPERSAM','P077',0,0,0,'tylko liczenie (napoje Filber)'),
  ('SUPERSAM','P082',1,4,4,'Dis-Pack KAT 1/4'),
  ('SUPERSAM','P083',1,3,3,'Dis-Pack KAT 1/3'),
  ('SUPERSAM','P084',1,2,2,'Dis-Pack KAT 1/2'),
  ('SUPERSAM','P085',1,2,2,'Dis-Pack KAT 1/2'),
  ('SUPERSAM','P086',5,15,15,'Dis-Pack KAT 5/15'),
  ('SUPERSAM','P087',3,7,7,'Dis-Pack KAT 3/7'),
  ('SUPERSAM','P088',0,0,0,'Selgros KAT, brak progu w arkuszu'),
  ('SUPERSAM','P089',0,0,0,'tylko liczenie (Mory)'),
  ('SUPERSAM','P090',0,0,0,'tylko liczenie (Mory)'),
  ('SUPERSAM','P091',0,0,0,'tylko liczenie (Mory)'),
  ('SUPERSAM','P092',0,0,0,'tylko liczenie (Mory)'),
  ('SUPERSAM','P093',1,3,3,'Dis-Pack KAT 1/3, arkusz ''Karton'', katalog ''box'' - 1:1'),
  ('SUPERSAM','P094',2,5,5,'Dis-Pack KAT 2/5'),
  ('SUPERSAM','P095',1,5,5,'Dis-Pack KAT 1/5, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('SUPERSAM','P096',1,4,4,'Dis-Pack KAT 1/4, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('SUPERSAM','P097',1,3,3,'Dis-Pack KAT 1/3, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('SUPERSAM','P098',0,0,0,'tylko liczenie (Mory)'),
  ('SUPERSAM','P100',3,10,10,'Dis-Pack KAT 3/10'),
  ('SUPERSAM','P101',5,20,20,'Dis-Pack KAT 5/20'),
  ('SUPERSAM','P102',0.5,1.5,1.5,'Dis-Pack KAT 0,5/1,5, arkusz opak. 100 szt, katalog 250 szt - 1:1, do potw.'),
  ('SUPERSAM','P104',1,2,2,'Dis-Pack KAT 1/2, arkusz ''Karton'', katalog ''opak'' - 1:1, do potw.'),
  ('SUPERSAM','P106',1,2,2,'Selgros KAT 1/2'),
  ('SUPERSAM','P107',1,2,2,'Selgros KAT 1/2'),
  ('SUPERSAM','P116',2,5,5,'Dis-Pack KAT 2/5'),
  ('SUPERSAM','P117',4,15,15,'Dis-Pack KAT 4/15'),
  ('SUPERSAM','P118',4,15,15,'Dis-Pack KAT 4/15'),
  ('SUPERSAM','P119',1,3,3,'Dis-Pack KAT 1/3'),
  ('SUPERSAM','P121',10,25,25,'Dis-Pack KAT 2/5, arkusz opak. 5 szt -> szt (x5)'),
  ('SUPERSAM','P122',3,10,10,'Dis-Pack KAT 3/10'),
  ('SUPERSAM','P123',3,10,10,'Dis-Pack KAT 3/10'),
  ('SUPERSAM','P124',2,5,5,'Dis-Pack KAT 2/5, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('SUPERSAM','P125',3,7,7,'Dis-Pack KAT 3/7, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('SUPERSAM','P126',2,5,5,'Dis-Pack KAT 2/5, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('SUPERSAM','P127',0,0,0,'Selgros KAT, brak progu w arkuszu'),
  ('SUPERSAM','P129',0,0,0,'tylko liczenie (Mory, rolki)'),
  ('SUPERSAM','P131',1,2,2,'Dis-Pack KAT 1/2, arkusz opak. 50 szt, katalog ''box'' - 1:1'),
  ('SUPERSAM','P132',0,0,0,'Selgros KAT, brak progu w arkuszu'),
  ('SUPERSAM','P133',0,0,0,'tylko liczenie (Mory)'),
  ('SUPERSAM','P143',2,8,8,'Dis-Pack KAT 2/8'),
  ('SUPERSAM','P144',1,2,2,'Dis-Pack KAT 1/2'),
  ('SUPERSAM','P176',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P177',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P183',0,0,0,'tylko liczenie (Mory, rolki)')
)
SELECT v.location_id, v.product_id, p.product_name_pl, p.inventory_unit,
       s.min_stock_qty_base::float8 AS min_now, s.target_stock_qty_base::float8 AS target_now,
       s.max_stock_qty_base::float8 AS max_now,
       v.mn::float8 AS min_new, v.tg::float8 AS target_new, v.mx::float8 AS max_new,
       CASE WHEN s.setting_id IS NULL THEN 'INSERT'
            WHEN (s.min_stock_qty_base, s.target_stock_qty_base, s.max_stock_qty_base)
                 IS DISTINCT FROM (v.mn, v.tg, v.mx) THEN 'UPDATE'
            ELSE 'bez zmian' END AS action,
       v.conv
  FROM v
  LEFT JOIN location_product_settings s
         ON s.location_id = v.location_id AND s.product_id = v.product_id
  LEFT JOIN products p ON p.product_id = v.product_id
 ORDER BY action, v.location_id, v.product_id;
-- expected action counts: FORUM UPDATE 35 / INSERT 4 / bez zmian 65;
--                         SUPERSAM UPDATE 59 / INSERT 3 / bez zmian 45

-- ============================================================
-- STEP 1 — apply (one DO block = one transaction)
-- ============================================================
DO $$
DECLARE
  n_upsert int;
  n_loc int;
BEGIN
  -- Guards (preconditions read on 2026-10-08)
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public'
         AND ((table_name = 'locations' AND column_name = 'own_catalog')
           OR (table_name = 'supplier_products' AND column_name IN ('location_id','is_backup')))) <> 3 THEN
    RAISE EXCEPTION 'migration 0029 not applied (own_catalog / location_id / is_backup missing) — apply it first';
  END IF;
  IF (SELECT count(*) FROM locations
       WHERE location_id IN ('FORUM','SUPERSAM') AND active = false AND own_catalog = false
         AND delivery_address IS NULL AND company_nip IS NULL) <> 2 THEN
    RAISE EXCEPTION 'FORUM/SUPERSAM missing or not in the expected pre-rollout state';
  END IF;
  IF EXISTS (SELECT 1 FROM orders WHERE location_id IN ('FORUM','SUPERSAM')) THEN
    RAISE EXCEPTION 'orders already exist at FORUM/SUPERSAM — stop and re-diff';
  END IF;
  IF EXISTS (SELECT 1 FROM inventory_counts WHERE location_id IN ('FORUM','SUPERSAM')) THEN
    RAISE EXCEPTION 'inventory counts already exist at FORUM/SUPERSAM — stop and re-diff';
  END IF;
  IF (SELECT count(*) FROM location_product_settings WHERE location_id = 'FORUM') <> 114
     OR (SELECT count(*) FROM location_product_settings WHERE location_id = 'SUPERSAM') <> 116 THEN
    RAISE EXCEPTION 'FORUM/SUPERSAM settings row count differs from the 2026-10-08 diff (114/116)';
  END IF;

  -- Location FORUM (operator data 2026-10-08; location_name, email, sender_email unchanged)
  UPDATE locations SET
    delivery_address = 'Forum Food & Fun, ul. Marii Konopnickiej 28',
    city             = '30-307 Kraków',
    company_name     = 'Pita Bros Mokotów sp. z o.o.',
    company_address  = 'ul. Władysława Laskonogiego 9, 02-496 Warszawa',
    company_nip      = '5223356334',
    phone            = '604 615 776',
    own_catalog      = true,
    active           = true,
    notes            = 'rollout 2026-10-08 (krakow-katowice-rollout): adres, spółka, NIP i telefon od operatora 2026-10-08 (spółka: COMPANY_ENTITIES.md); katalog własny Kraków (own_catalog) - dostawcy miejscy'
  WHERE location_id = 'FORUM';
  GET DIAGNOSTICS n_loc = ROW_COUNT;
  IF n_loc <> 1 THEN RAISE EXCEPTION 'FORUM update touched % rows', n_loc; END IF;

  -- Location SUPERSAM (operator data 2026-10-08; location_name, email, sender_email unchanged)
  UPDATE locations SET
    delivery_address = 'DH Supersam, Bajsownia, ul. ks. Piotra Skargi 6A',
    city             = '40-091 Katowice',
    company_name     = 'Pita Bros sp. z o.o.',
    company_address  = 'ul. W. Laskonogiego 9, 02-496 Warszawa',
    company_nip      = '9522100633',
    phone            = '696 404 198',
    own_catalog      = true,
    active           = true,
    notes            = 'rollout 2026-10-08 (krakow-katowice-rollout): adres, spółka, NIP i telefon od operatora 2026-10-08 (spółka: COMPANY_ENTITIES.md); katalog własny Katowice (own_catalog); E-MAIL LOKALU DO UZUPEŁNIENIA'
  WHERE location_id = 'SUPERSAM';
  GET DIAGNOSTICS n_loc = ROW_COUNT;
  IF n_loc <> 1 THEN RAISE EXCEPTION 'SUPERSAM update touched % rows', n_loc; END IF;

  -- Thresholds: the full final set; inserts missing rows, updates changed ones only
  INSERT INTO location_product_settings AS s
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  SELECT v.location_id || '__' || v.product_id, v.location_id, v.product_id,
         v.mn, v.tg, v.mx, false, false,
         '2026-10-08 arkusz KRK/KAT (nowy wiersz)' || CASE WHEN v.conv <> '' THEN '; ' || v.conv ELSE '' END
  FROM (VALUES
  ('FORUM','P001',3,9,9,'Selgros KRK, progi lokalu z sierpnia'),
  ('FORUM','P002',0.5,2,2,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P003',1,2.5,2.5,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P004',2,6,6,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P005',1,2.5,2.5,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P006',12,54,54,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P007',10,35,35,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P008',8,25,25,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P009',0.3,1,1,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P010',0.2,1,1,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P011',5,14,14,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P012',1.5,4,4.5,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P013',1,3,3,'Kuchnie Świata KRK 0,5/1,5, arkusz bidon 2 kg -> kg (x2)'),
  ('FORUM','P014',0.5,2,2,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P015',24,72,72,'Kuchnie Świata KRK 24/72'),
  ('FORUM','P016',5,20,20,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P018',0.5,2,2,'Bukat KRK, progi lokalu z sierpnia'),
  ('FORUM','P019',0,0,0,'tylko liczenie (Mory)'),
  ('FORUM','P020',2.5,7.5,7.5,'Kuchnie Świata KRK 0,5/1,5, arkusz karton 5 kg -> kg (x5)'),
  ('FORUM','P021',10,44,44,'Kuchnie Świata KRK 10/44'),
  ('FORUM','P022',2,5,5,'Kuchnie Świata KRK 2/5'),
  ('FORUM','P023',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P024',0,0,0,'tylko liczenie (Pago)'),
  ('FORUM','P026',0,0,0,'tylko liczenie (Pago)'),
  ('FORUM','P027',0,0,0,'tylko liczenie (Pago)'),
  ('FORUM','P028',0,0,0,'tylko liczenie (Pago)'),
  ('FORUM','P029',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P030',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P031',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P032',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P033',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P034',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P035',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P036',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P038',1,3,3,'Kuchnie Świata KRK 1/3'),
  ('FORUM','P040',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P041',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P042',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P043',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P044',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P045',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P046',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P047',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P048',2,4,4,'Kuchnie Świata KRK 2/4'),
  ('FORUM','P049',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P050',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P051',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P052',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P053',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P054',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P055',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P057',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P058',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P075',0,0,0,'tylko liczenie (napoje Filber)'),
  ('FORUM','P076',0,0,0,'tylko liczenie (napoje Filber)'),
  ('FORUM','P077',0,0,0,'tylko liczenie (napoje Filber)'),
  ('FORUM','P082',2,6,6,'Dis-Pack KRK 2/6'),
  ('FORUM','P083',1,4,4,'Dis-Pack KRK 1/4'),
  ('FORUM','P084',1,2,2,'Dis-Pack KRK 1/2'),
  ('FORUM','P085',1,2,2,'Dis-Pack KRK 1/2'),
  ('FORUM','P086',5,20,20,'Dis-Pack KRK 5/20'),
  ('FORUM','P087',3,8,8,'Dis-Pack KRK 3/8'),
  ('FORUM','P088',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P089',0,0,0,'tylko liczenie (Mory)'),
  ('FORUM','P090',0,0,0,'tylko liczenie (Mory)'),
  ('FORUM','P091',0,0,0,'tylko liczenie (Mory)'),
  ('FORUM','P092',0,0,0,'tylko liczenie (Mory)'),
  ('FORUM','P093',1,3,3,'Dis-Pack KRK 1/3, arkusz ''Karton'', katalog ''box'' - 1:1'),
  ('FORUM','P094',2,5,5,'Dis-Pack KRK 2/5'),
  ('FORUM','P095',1,5,5,'Dis-Pack KRK 1/5, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('FORUM','P096',1,4,4,'Dis-Pack KRK 1/4, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('FORUM','P097',1,3,3,'Dis-Pack KRK 1/3, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('FORUM','P098',0,0,0,'tylko liczenie (Mory)'),
  ('FORUM','P100',3,10,10,'Dis-Pack KRK 3/10'),
  ('FORUM','P101',5,20,20,'Dis-Pack KRK 5/20'),
  ('FORUM','P102',0.5,1.5,1.5,'Dis-Pack KRK 0,5/1,5, arkusz opak. 100 szt, katalog 250 szt - 1:1, do potw.'),
  ('FORUM','P104',1,2,2,'Dis-Pack KRK 1/2, arkusz ''Karton'', katalog ''opak'' - 1:1, do potw.'),
  ('FORUM','P106',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P107',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P116',2,7,7,'Dis-Pack KRK 2/7'),
  ('FORUM','P117',4,15,15,'Dis-Pack KRK 4/15'),
  ('FORUM','P118',4,15,15,'Dis-Pack KRK 4/15'),
  ('FORUM','P119',1,3,3,'Dis-Pack KRK 1/3'),
  ('FORUM','P121',10,25,25,'Dis-Pack KRK 2/5, arkusz opak. 5 szt -> szt (x5)'),
  ('FORUM','P122',3,10,10,'Dis-Pack KRK 3/10'),
  ('FORUM','P123',3,10,10,'Dis-Pack KRK 3/10'),
  ('FORUM','P126',3,7,7,'Dis-Pack KRK 3/7, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('FORUM','P127',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P129',0,0,0,'tylko liczenie (Mory, rolki)'),
  ('FORUM','P130',0,0,0,'tylko liczenie (Mory, rolki)'),
  ('FORUM','P131',1,2,2,'Dis-Pack KRK 1/2, arkusz opak. 50 szt, katalog ''box'' - 1:1'),
  ('FORUM','P132',0,0,0,'tylko liczenie (Mory)'),
  ('FORUM','P133',0,0,0,'tylko liczenie (Mory)'),
  ('FORUM','P143',2,8,8,'Dis-Pack KRK 2/8'),
  ('FORUM','P144',1,2,2,'Dis-Pack KRK 1/2'),
  ('FORUM','P155',0,0,0,'tylko liczenie (napoje Pepsi)'),
  ('FORUM','P163',0,0,0,'tylko liczenie (napoje Pepsi)'),
  ('FORUM','P164',0,0,0,'tylko liczenie (napoje Pepsi)'),
  ('FORUM','P165',0,0,0,'tylko liczenie (napoje Pepsi)'),
  ('FORUM','P166',0,0,0,'tylko liczenie (napoje Pepsi)'),
  ('FORUM','P167',0,0,0,'tylko liczenie (napoje Pepsi)'),
  ('FORUM','P172',0,0,0,'Selgros KRK, brak progu w arkuszu'),
  ('FORUM','P176',0,0,0,'tylko liczenie (produkcja własna)'),
  ('FORUM','P177',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P001',3,8,8,'Selgros KAT 3/8'),
  ('SUPERSAM','P002',0.5,2,2,'Selgros KAT 0,5/2'),
  ('SUPERSAM','P003',0.5,2,2,'Selgros KAT 0,5/2'),
  ('SUPERSAM','P004',2,5,5,'Selgros KAT 2/5'),
  ('SUPERSAM','P005',0.5,2,2,'Selgros KAT 0,5/2'),
  ('SUPERSAM','P006',12,48,48,'Selgros KAT 12/48'),
  ('SUPERSAM','P007',3,20,20,'Selgros KAT 3/20'),
  ('SUPERSAM','P008',5,25,25,'Selgros KAT 5/25'),
  ('SUPERSAM','P009',0.2,1,1,'Selgros KAT 0,2/1'),
  ('SUPERSAM','P010',0.2,0.5,0.5,'Selgros KAT 0,2/0,5'),
  ('SUPERSAM','P011',0,0,0,'tylko liczenie (nabiał Katowice)'),
  ('SUPERSAM','P012',0,0,0,'tylko liczenie (nabiał Katowice)'),
  ('SUPERSAM','P013',1,3,3,'Kuchnie Świata KAT 0,5/1,5, arkusz bidon 2 kg -> kg (x2)'),
  ('SUPERSAM','P014',0,0,0,'Kuchnie Świata KAT, brak progu w arkuszu'),
  ('SUPERSAM','P015',24,72,72,'Kuchnie Świata KAT 24/72'),
  ('SUPERSAM','P016',5,20,20,'Selgros KAT 5/20'),
  ('SUPERSAM','P018',0.2,1,1,'Selgros KAT 0,2/1'),
  ('SUPERSAM','P019',0,0,0,'tylko liczenie (Mory)'),
  ('SUPERSAM','P020',2.5,7.5,7.5,'Kuchnie Świata KAT 0,5/1,5, arkusz karton 5 kg -> kg (x5)'),
  ('SUPERSAM','P021',10,36,36,'Kuchnie Świata KAT 10/36'),
  ('SUPERSAM','P022',2,4,4,'Kuchnie Świata KAT 2/4'),
  ('SUPERSAM','P023',1.25,3.75,3.75,'Selgros KAT 0,5/1,5, arkusz szt 2,5 kg -> kg (x2,5)'),
  ('SUPERSAM','P024',0,0,0,'tylko liczenie (Pago)'),
  ('SUPERSAM','P026',0,0,0,'tylko liczenie (Pago)'),
  ('SUPERSAM','P027',0,0,0,'tylko liczenie (Pago)'),
  ('SUPERSAM','P028',0,0,0,'tylko liczenie (Pago)'),
  ('SUPERSAM','P029',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P030',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P031',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P032',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P033',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P034',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P035',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P036',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P038',1,2,2,'Kuchnie Świata KAT 1/2'),
  ('SUPERSAM','P040',3,8,8,'Selgros KAT 3/8'),
  ('SUPERSAM','P041',0.5,1.5,1.5,'Selgros KAT 0,5/1,5'),
  ('SUPERSAM','P042',2,5,5,'Selgros KAT 2/5'),
  ('SUPERSAM','P043',1,2,2,'Selgros KAT 1/2'),
  ('SUPERSAM','P044',1,2,2,'Selgros KAT 1/2'),
  ('SUPERSAM','P045',2,7,7,'Selgros KAT 2/7'),
  ('SUPERSAM','P046',6,16,16,'Selgros KAT 6/16'),
  ('SUPERSAM','P047',2,6,6,'Selgros KAT 2/6'),
  ('SUPERSAM','P048',2,4,4,'Kuchnie Świata KAT 2/4'),
  ('SUPERSAM','P049',1,2,2,'Selgros KAT 1/2, arkusz ''szt'' (słoik 1 kg), katalog ''kg'' - 1:1'),
  ('SUPERSAM','P050',0,0,0,'Selgros KAT, brak progu w arkuszu'),
  ('SUPERSAM','P051',1,2,2,'Selgros KAT 1/2, arkusz ''szt'' (duże), katalog ''kg'' - 1:1, waga do potw.'),
  ('SUPERSAM','P052',1,2,2,'Selgros KAT 1/2, arkusz ''szt'' (duża), katalog ''kg'' - 1:1, waga do potw.'),
  ('SUPERSAM','P053',1,3,3,'Selgros KAT 1/3, arkusz ''szt'' 1 kg, katalog ''kg'' - 1:1'),
  ('SUPERSAM','P054',0,0,0,'Selgros KAT, brak progu w arkuszu'),
  ('SUPERSAM','P055',0,0,0,'Selgros KAT, brak progu w arkuszu'),
  ('SUPERSAM','P057',0,0,0,'Selgros KAT, brak progu w arkuszu'),
  ('SUPERSAM','P058',0,0,0,'Selgros KAT, brak progu w arkuszu'),
  ('SUPERSAM','P064',0,0,0,'tylko liczenie (Coca-Cola)'),
  ('SUPERSAM','P065',0,0,0,'tylko liczenie (Coca-Cola)'),
  ('SUPERSAM','P066',0,0,0,'tylko liczenie (Coca-Cola)'),
  ('SUPERSAM','P067',0,0,0,'tylko liczenie (Coca-Cola)'),
  ('SUPERSAM','P068',0,0,0,'tylko liczenie (Coca-Cola)'),
  ('SUPERSAM','P069',0,0,0,'tylko liczenie (Coca-Cola)'),
  ('SUPERSAM','P070',0,0,0,'tylko liczenie (Coca-Cola)'),
  ('SUPERSAM','P071',0,0,0,'tylko liczenie (Coca-Cola)'),
  ('SUPERSAM','P075',0,0,0,'tylko liczenie (napoje Filber)'),
  ('SUPERSAM','P076',0,0,0,'tylko liczenie (napoje Filber)'),
  ('SUPERSAM','P077',0,0,0,'tylko liczenie (napoje Filber)'),
  ('SUPERSAM','P082',1,4,4,'Dis-Pack KAT 1/4'),
  ('SUPERSAM','P083',1,3,3,'Dis-Pack KAT 1/3'),
  ('SUPERSAM','P084',1,2,2,'Dis-Pack KAT 1/2'),
  ('SUPERSAM','P085',1,2,2,'Dis-Pack KAT 1/2'),
  ('SUPERSAM','P086',5,15,15,'Dis-Pack KAT 5/15'),
  ('SUPERSAM','P087',3,7,7,'Dis-Pack KAT 3/7'),
  ('SUPERSAM','P088',0,0,0,'Selgros KAT, brak progu w arkuszu'),
  ('SUPERSAM','P089',0,0,0,'tylko liczenie (Mory)'),
  ('SUPERSAM','P090',0,0,0,'tylko liczenie (Mory)'),
  ('SUPERSAM','P091',0,0,0,'tylko liczenie (Mory)'),
  ('SUPERSAM','P092',0,0,0,'tylko liczenie (Mory)'),
  ('SUPERSAM','P093',1,3,3,'Dis-Pack KAT 1/3, arkusz ''Karton'', katalog ''box'' - 1:1'),
  ('SUPERSAM','P094',2,5,5,'Dis-Pack KAT 2/5'),
  ('SUPERSAM','P095',1,5,5,'Dis-Pack KAT 1/5, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('SUPERSAM','P096',1,4,4,'Dis-Pack KAT 1/4, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('SUPERSAM','P097',1,3,3,'Dis-Pack KAT 1/3, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('SUPERSAM','P098',0,0,0,'tylko liczenie (Mory)'),
  ('SUPERSAM','P100',3,10,10,'Dis-Pack KAT 3/10'),
  ('SUPERSAM','P101',5,20,20,'Dis-Pack KAT 5/20'),
  ('SUPERSAM','P102',0.5,1.5,1.5,'Dis-Pack KAT 0,5/1,5, arkusz opak. 100 szt, katalog 250 szt - 1:1, do potw.'),
  ('SUPERSAM','P104',1,2,2,'Dis-Pack KAT 1/2, arkusz ''Karton'', katalog ''opak'' - 1:1, do potw.'),
  ('SUPERSAM','P106',1,2,2,'Selgros KAT 1/2'),
  ('SUPERSAM','P107',1,2,2,'Selgros KAT 1/2'),
  ('SUPERSAM','P116',2,5,5,'Dis-Pack KAT 2/5'),
  ('SUPERSAM','P117',4,15,15,'Dis-Pack KAT 4/15'),
  ('SUPERSAM','P118',4,15,15,'Dis-Pack KAT 4/15'),
  ('SUPERSAM','P119',1,3,3,'Dis-Pack KAT 1/3'),
  ('SUPERSAM','P121',10,25,25,'Dis-Pack KAT 2/5, arkusz opak. 5 szt -> szt (x5)'),
  ('SUPERSAM','P122',3,10,10,'Dis-Pack KAT 3/10'),
  ('SUPERSAM','P123',3,10,10,'Dis-Pack KAT 3/10'),
  ('SUPERSAM','P124',2,5,5,'Dis-Pack KAT 2/5, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('SUPERSAM','P125',3,7,7,'Dis-Pack KAT 3/7, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('SUPERSAM','P126',2,5,5,'Dis-Pack KAT 2/5, arkusz ''Rolka'', katalog ''szt'' - 1:1'),
  ('SUPERSAM','P127',0,0,0,'Selgros KAT, brak progu w arkuszu'),
  ('SUPERSAM','P129',0,0,0,'tylko liczenie (Mory, rolki)'),
  ('SUPERSAM','P131',1,2,2,'Dis-Pack KAT 1/2, arkusz opak. 50 szt, katalog ''box'' - 1:1'),
  ('SUPERSAM','P132',0,0,0,'Selgros KAT, brak progu w arkuszu'),
  ('SUPERSAM','P133',0,0,0,'tylko liczenie (Mory)'),
  ('SUPERSAM','P143',2,8,8,'Dis-Pack KAT 2/8'),
  ('SUPERSAM','P144',1,2,2,'Dis-Pack KAT 1/2'),
  ('SUPERSAM','P176',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P177',0,0,0,'tylko liczenie (produkcja własna)'),
  ('SUPERSAM','P183',0,0,0,'tylko liczenie (Mory, rolki)')
  ) AS v(location_id, product_id, mn, tg, mx, conv)
  ON CONFLICT (location_id, product_id) DO UPDATE SET
    min_stock_qty_base    = EXCLUDED.min_stock_qty_base,
    target_stock_qty_base = EXCLUDED.target_stock_qty_base,
    max_stock_qty_base    = EXCLUDED.max_stock_qty_base,
    notes = btrim(s.notes || ' [2026-10-08 arkusz KRK/KAT, przed '
            || s.min_stock_qty_base::float8 || '/' || s.target_stock_qty_base::float8
            || '/' || s.max_stock_qty_base::float8
            || coalesce('; ' || nullif(split_part(EXCLUDED.notes, '; ', 2), ''), '') || ']')
  WHERE (s.min_stock_qty_base, s.target_stock_qty_base, s.max_stock_qty_base)
        IS DISTINCT FROM (EXCLUDED.min_stock_qty_base, EXCLUDED.target_stock_qty_base,
                          EXCLUDED.max_stock_qty_base);
  GET DIAGNOSTICS n_upsert = ROW_COUNT;
  -- expected from the 2026-10-08 diff: FORUM 35+4, SUPERSAM 59+3
  IF n_upsert <> 101 THEN
    RAISE EXCEPTION 'threshold upsert touched % rows, expected 101', n_upsert;
  END IF;

  -- Post-conditions inside the transaction
  IF (SELECT count(*) FROM location_product_settings WHERE location_id = 'FORUM') <> 118
     OR (SELECT count(*) FROM location_product_settings WHERE location_id = 'SUPERSAM') <> 119 THEN
    RAISE EXCEPTION 'after upsert FORUM/SUPERSAM should have 118/119 rows';
  END IF;
  IF EXISTS (SELECT 1 FROM location_product_settings
              WHERE location_id IN ('FORUM','SUPERSAM')
                AND (min_stock_qty_base > target_stock_qty_base
                     OR target_stock_qty_base > max_stock_qty_base)) THEN
    RAISE EXCEPTION 'min <= target <= max violated at FORUM/SUPERSAM';
  END IF;
  IF EXISTS (SELECT 1 FROM location_product_settings s JOIN products p USING (product_id)
              WHERE s.location_id IN ('FORUM','SUPERSAM') AND NOT p.active
                AND s.notes LIKE '%2026-10-08 arkusz KRK/KAT%') THEN
    RAISE EXCEPTION 'a row written by this rollout points at an inactive product';
  END IF;
END $$;

-- ============================================================
-- STEP 2 — audit (read-only). Every query must return the stated result.
-- ============================================================

-- a) rows written by this rollout -> FORUM 35 stamped + 4 new; SUPERSAM 59 stamped + 3 new
SELECT location_id,
       count(*) FILTER (WHERE notes LIKE '%[2026-10-08 arkusz KRK/KAT, przed %') AS stamped,
       count(*) FILTER (WHERE notes LIKE '2026-10-08 arkusz KRK/KAT (nowy wiersz)%') AS new_rows,
       count(*) AS all_rows
  FROM location_product_settings WHERE location_id IN ('FORUM','SUPERSAM') GROUP BY 1 ORDER BY 1;
-- all_rows -> FORUM 118, SUPERSAM 119 (before C)

-- b) min <= target <= max at both locations -> 0 rows
SELECT location_id, product_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base
  FROM location_product_settings
 WHERE location_id IN ('FORUM','SUPERSAM')
   AND (min_stock_qty_base > target_stock_qty_base OR target_stock_qty_base > max_stock_qty_base);

-- c) stamped / new rows on an inactive product -> 0 rows
SELECT s.location_id, s.product_id FROM location_product_settings s JOIN products p USING (product_id)
 WHERE s.location_id IN ('FORUM','SUPERSAM') AND s.notes LIKE '%2026-10-08 arkusz KRK/KAT%' AND NOT p.active;

-- d) locations -> both active, own_catalog true, address + postcode city + company + NIP + phone
SELECT location_id, location_name, delivery_address, city, company_name, company_address,
       company_nip, phone, email, sender_email, own_catalog, active
  FROM locations WHERE location_id IN ('FORUM','SUPERSAM') ORDER BY 1;

-- e) no other location touched -> 0 rows
SELECT location_id, count(*) FROM location_product_settings
 WHERE location_id NOT IN ('FORUM','SUPERSAM') AND notes LIKE '%2026-10-08 arkusz KRK/KAT%' GROUP BY 1;
