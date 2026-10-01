-- ============================================================
-- elektrownia-westfield-rollout — prod master data (Supabase lpzhphufjwrndfogkfub)
-- Date: 2026-09-29. Sources: Marek's "min/max" tabs —
--   Norblin + Westfield: CSV exports sent by the operator 2026-09-29,
--   Elektrownia: Drive sheet "Elektrownia - Inwentaryzacja", tab "min/max" (read 2026-09-29).
-- Pattern (lessons.md "Master-data ops: diff before, audit after"):
--   STEP 0 = rollout-notes.md "Diff przed" (read-only, saved before apply)
--   STEP 1 = this DO block (one transaction; any guard failure rolls back everything)
--   STEP 2 = audit queries below
--   Rollback = rollback.sql (before-values are also embedded in each updated row's notes).
-- Rules: sheet value -> inventory unit of the product (x pack size where the sheet counts
-- packs: blocks, cartons, bidons, 10-sponge packs); target = max; Feta target = floor(max)
-- (operator 2026-09-28). Only sheet rows are written — rows not on the sheet stay as they are.
-- ============================================================

DO $$
DECLARE
  n_upsert int;
  n_loc int;
BEGIN
  -- Guards (preconditions checked on 2026-09-29)
  IF EXISTS (SELECT 1 FROM products WHERE product_id = 'P189') THEN
    RAISE EXCEPTION 'P189 already exists — re-check before re-running';
  END IF;
  IF (SELECT count(*) FROM locations
       WHERE location_id IN ('ELEKTROWNIA','WESTFIELD') AND active = false) <> 2 THEN
    RAISE EXCEPTION 'ELEKTROWNIA/WESTFIELD not in the expected inactive state';
  END IF;

  -- 1. New product: Cukier w kostkach Diament 1kg (operator decision 2026-09-28, Intermlecz)
  INSERT INTO products (product_id, gostock_id, product_name_pl, product_category,
                        inventory_unit, is_critical, active, notes)
  VALUES ('P189', NULL, 'Cukier w kostkach Diament 1kg', 'Spożywcze', 'opak', false, true,
          'operator 2026-09-28: cukier do kawy/herbaty dla pracowników, obok saszetek');
  INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id,
                                 supplier_product_name, purchase_unit, units_per_purchase_unit,
                                 rounding_rule, price_estimate_pln, active, notes)
  VALUES ('SP_INTERMLECZ_P189', 'SUP_INTERMLECZ', 'P189', 'Cukier w kostkach Diament 1 kg',
          'opak', 1, 'full_only', NULL, true, 'cena do uzupełnienia');

  -- 2. Locations: address, company, activation
  UPDATE locations SET
    location_name    = 'Pita Bros Elektrownia Powiśle',
    delivery_address = 'ul. Dobra 42',
    city             = '00-312 Warszawa',
    company_name     = 'Pita Bros Centrum Sp. z o.o.',
    company_address  = 'ul. W. Laskonogiego 9, 02-496 Warszawa',
    company_nip      = '5223314413',
    active           = true,
    notes            = 'rollout 2026-09-29 (Food Hall, poziom 0); adres: elektrowniapowisle.com + Wolt, spółka: COMPANY_ENTITIES.md'
  WHERE location_id = 'ELEKTROWNIA';
  GET DIAGNOSTICS n_loc = ROW_COUNT;
  IF n_loc <> 1 THEN RAISE EXCEPTION 'ELEKTROWNIA update touched % rows', n_loc; END IF;

  UPDATE locations SET
    location_name    = 'Pita Bros Westfield Mokotów',
    delivery_address = 'ul. Wołoska 12',
    city             = '02-675 Warszawa',
    active           = true,
    notes            = 'rollout 2026-09-29; adres: westfield.com; SPÓŁKA, NIP i e-mail lokalu DO UZUPEŁNIENIA'
  WHERE location_id = 'WESTFIELD';
  GET DIAGNOSTICS n_loc = ROW_COUNT;
  IF n_loc <> 1 THEN RAISE EXCEPTION 'WESTFIELD update touched % rows', n_loc; END IF;

  -- 3. Thresholds from the sheets (insert missing rows, update changed ones only)
  INSERT INTO location_product_settings AS s
    (setting_id, location_id, product_id, min_stock_qty_base, target_stock_qty_base,
     max_stock_qty_base, is_critical_for_location, allow_over_max_due_to_packaging, notes)
  SELECT v.location_id || '__' || v.product_id, v.location_id, v.product_id,
         v.mn, v.tg, v.mx, false, false,
         '2026-09-29 arkusz min/max (nowy wiersz)' || CASE WHEN v.conv <> '' THEN '; ' || v.conv ELSE '' END
  FROM (VALUES
  ('NORBLIN','P082',2,10,10,''),
  ('NORBLIN','P083',1,2,2,''),
  ('NORBLIN','P084',1,2,2,''),
  ('NORBLIN','P085',1,2,2,''),
  ('NORBLIN','P086',5,15,15,''),
  ('NORBLIN','P087',2,7,7,''),
  ('NORBLIN','P088',0.5,1.5,1.5,''),
  ('NORBLIN','P143',3,15,15,''),
  ('NORBLIN','P144',1,2,2,''),
  ('NORBLIN','P093',1,2,2,'arkusz ''Szt'', katalog ''box'' - 1:1'),
  ('NORBLIN','P094',1,3,3,'arkusz ''Szt'', katalog ''opak'' - 1:1'),
  ('NORBLIN','P095',2,5,5,''),
  ('NORBLIN','P096',1,3,3,''),
  ('NORBLIN','P097',1,3,3,''),
  ('NORBLIN','P100',5,20,20,''),
  ('NORBLIN','P101',7,30,30,''),
  ('NORBLIN','P102',1,2,2,''),
  ('NORBLIN','P103',0.5,1.5,1.5,'arkusz ''Box'', katalog ''opak'' - 1:1'),
  ('NORBLIN','P104',1,2,2,''),
  ('NORBLIN','P106',1,2,2,''),
  ('NORBLIN','P107',1,2,2,''),
  ('NORBLIN','P109',1,2,2,''),
  ('NORBLIN','P111',2,6,6,''),
  ('NORBLIN','P112',1,4,4,''),
  ('NORBLIN','P113',1,2,2,''),
  ('NORBLIN','P116',2,5,5,''),
  ('NORBLIN','P117',3,15,15,''),
  ('NORBLIN','P118',3,15,15,''),
  ('NORBLIN','P119',1,3,3,''),
  ('NORBLIN','P121',10,20,20,'arkusz w opak. po 10 szt -> szt (x10)'),
  ('NORBLIN','P123',5,15,15,''),
  ('NORBLIN','P125',3,8,8,'arkusz ''Opak'', katalog ''szt'' - 1:1'),
  ('NORBLIN','P006',10,48,48,''),
  ('NORBLIN','P016',5,15,15,''),
  ('NORBLIN','P004',2,4,4,''),
  ('NORBLIN','P002',0.5,1.5,1.5,''),
  ('NORBLIN','P005',0.5,2,2,''),
  ('NORBLIN','P003',0.5,2,2,''),
  ('NORBLIN','P008',7,30,30,''),
  ('NORBLIN','P007',5,20,20,''),
  ('NORBLIN','P009',0.2,1,1,''),
  ('NORBLIN','P010',0.2,0.5,0.5,''),
  ('NORBLIN','P018',0.2,1,1,''),
  ('NORBLIN','P011',6,24,24,''),
  ('NORBLIN','P012',1,2,2,''),
  ('NORBLIN','P014',0.5,1,1.5,''),
  ('NORBLIN','P064',10,24,24,''),
  ('NORBLIN','P065',10,24,24,''),
  ('NORBLIN','P066',10,48,48,''),
  ('NORBLIN','P067',10,48,48,''),
  ('NORBLIN','P068',50,120,120,'puszka 0,33 (jak istniejący wiersz lokalu)'),
  ('NORBLIN','P069',70,150,150,'puszka 0,33 (jak istniejący wiersz lokalu)'),
  ('NORBLIN','P070',30,50,50,''),
  ('NORBLIN','P071',15,24,24,''),
  ('NORBLIN','P075',10,48,48,''),
  ('NORBLIN','P076',10,48,48,''),
  ('NORBLIN','P077',10,48,48,''),
  ('NORBLIN','P001',3,9,9,''),
  ('NORBLIN','P013',1,3,3,'arkusz w opak. (bidon 2 kg) -> kg (x2)'),
  ('NORBLIN','P015',24,100,100,''),
  ('NORBLIN','P017',1.8,5.4,5.4,'arkusz w opak. -> kg (x3,6 wg katalogu)'),
  ('NORBLIN','P021',20,60,60,''),
  ('NORBLIN','P022',2,6,6,''),
  ('NORBLIN','P023',1.25,3.75,3.75,'arkusz w opak. 2,5 kg -> kg (x2,5)'),
  ('NORBLIN','P038',1,3,3,''),
  ('NORBLIN','P040',2,7,7,''),
  ('NORBLIN','P041',0.5,1.5,1.5,''),
  ('NORBLIN','P042',2,5,5,''),
  ('NORBLIN','P043',1,2,2,''),
  ('NORBLIN','P044',1,2,2,''),
  ('NORBLIN','P045',2,6,6,''),
  ('NORBLIN','P046',6,24,24,''),
  ('NORBLIN','P047',2,10,10,''),
  ('NORBLIN','P048',1,3,3,''),
  ('NORBLIN','P049',1,2,2,'arkusz ''Szt'' (sloik 1 kg), katalog ''kg'' - 1:1'),
  ('NORBLIN','P050',0.5,1.5,1.5,'arkusz ''Opak'', katalog ''kg'' - 1:1'),
  ('NORBLIN','P051',0.5,1.5,1.5,'arkusz ''Opak'', katalog ''kg'' - 1:1'),
  ('NORBLIN','P052',0.5,1.5,1.5,'arkusz ''Opak'', katalog ''kg'' - 1:1'),
  ('NORBLIN','P053',2,10,10,'arkusz ''Opak'' 1 kg, katalog ''kg'' - 1:1'),
  ('NORBLIN','P054',0.5,1.5,1.5,''),
  ('NORBLIN','P055',0.5,1.5,1.5,''),
  ('NORBLIN','P057',0.5,1.5,1.5,''),
  ('NORBLIN','P058',0.5,1.5,1.5,''),
  ('NORBLIN','P140',0.5,1.5,1.5,'arkusz ''Opak'', katalog ''szt'' - 1:1'),
  ('NORBLIN','P141',0.5,1.5,1.5,''),
  ('NORBLIN','P189',0.5,1.5,1.5,'nowy produkt (decyzja 28.09)'),
  ('NORBLIN','P020',5,20,20,''),
  ('NORBLIN','P019',0.5,1.5,1.5,''),
  ('NORBLIN','P024',0,0,0,'arkusz w blokach -> kg (x15)'),
  ('NORBLIN','P025',50,225,225,'arkusz w blokach -> kg (x25)'),
  ('NORBLIN','P145',2.1,6.3,6.3,'arkusz w kartonach -> kg (x4,2)'),
  ('NORBLIN','P026',12,84,84,'arkusz w kartonach -> opak (x12)'),
  ('NORBLIN','P027',20,75,75,'arkusz w kartonach -> kg (x5)'),
  ('NORBLIN','P028',10,25,25,'arkusz w kartonach -> kg (x5)'),
  ('NORBLIN','P089',0.5,1.5,1.5,''),
  ('NORBLIN','P090',0.5,1.5,1.5,''),
  ('NORBLIN','P091',2,8,8,''),
  ('NORBLIN','P092',3,8,8,''),
  ('NORBLIN','P098',0.5,1.5,1.5,''),
  ('NORBLIN','P131',10,50,50,'arkusz ''Szt'', katalog ''box'' (cena za sztuke) - 1:1'),
  ('NORBLIN','P132',2,4,4,''),
  ('NORBLIN','P133',2,4,4,''),
  ('NORBLIN','P127',1,3,3,''),
  ('WESTFIELD','P082',2,8,8,''),
  ('WESTFIELD','P083',1,3,3,''),
  ('WESTFIELD','P084',1,2,2,''),
  ('WESTFIELD','P085',1,2,2,''),
  ('WESTFIELD','P086',5,15,15,''),
  ('WESTFIELD','P087',2,8,8,''),
  ('WESTFIELD','P088',0.5,1.5,1.5,''),
  ('WESTFIELD','P143',5,20,20,''),
  ('WESTFIELD','P144',1,2,2,''),
  ('WESTFIELD','P093',1,3,3,'arkusz ''Szt'', katalog ''box'' - 1:1'),
  ('WESTFIELD','P094',1,5,5,'arkusz ''Szt'', katalog ''opak'' - 1:1'),
  ('WESTFIELD','P095',2,6,6,''),
  ('WESTFIELD','P096',2,4,4,''),
  ('WESTFIELD','P097',2,4,4,''),
  ('WESTFIELD','P100',5,15,15,''),
  ('WESTFIELD','P101',8,25,25,''),
  ('WESTFIELD','P102',1,2,2,''),
  ('WESTFIELD','P103',0.5,1.5,1.5,'arkusz ''Box'', katalog ''opak'' - 1:1'),
  ('WESTFIELD','P104',1,2,2,''),
  ('WESTFIELD','P106',1,2,2,''),
  ('WESTFIELD','P107',1,2,2,''),
  ('WESTFIELD','P109',1,2,2,''),
  ('WESTFIELD','P111',2,6,6,''),
  ('WESTFIELD','P112',1,4,4,''),
  ('WESTFIELD','P113',1,3,3,''),
  ('WESTFIELD','P116',2,5,5,''),
  ('WESTFIELD','P117',3,15,15,''),
  ('WESTFIELD','P118',3,15,15,''),
  ('WESTFIELD','P119',1,3,3,''),
  ('WESTFIELD','P121',10,20,20,'arkusz w opak. po 10 szt -> szt (x10)'),
  ('WESTFIELD','P123',5,15,15,''),
  ('WESTFIELD','P125',3,8,8,'arkusz ''Opak'', katalog ''szt'' - 1:1'),
  ('WESTFIELD','P006',12,48,48,''),
  ('WESTFIELD','P016',5,15,15,''),
  ('WESTFIELD','P004',2,4,4,''),
  ('WESTFIELD','P002',0.5,1.5,1.5,''),
  ('WESTFIELD','P005',0.5,2,2,''),
  ('WESTFIELD','P003',0.5,2,2,''),
  ('WESTFIELD','P008',8,25,25,''),
  ('WESTFIELD','P007',5,20,20,''),
  ('WESTFIELD','P009',0.2,0.7,0.7,''),
  ('WESTFIELD','P010',0.2,0.5,0.5,''),
  ('WESTFIELD','P018',0.2,1,1,''),
  ('WESTFIELD','P011',6,18,18,''),
  ('WESTFIELD','P012',1,2,2,''),
  ('WESTFIELD','P014',0.5,1,1.5,''),
  ('WESTFIELD','P064',10,24,24,''),
  ('WESTFIELD','P065',10,24,24,''),
  ('WESTFIELD','P066',10,24,24,''),
  ('WESTFIELD','P067',10,24,24,''),
  ('WESTFIELD','P068',50,100,100,'puszka 0,33 (jak istniejący wiersz lokalu)'),
  ('WESTFIELD','P069',70,130,130,'puszka 0,33 (jak istniejący wiersz lokalu)'),
  ('WESTFIELD','P070',30,50,50,''),
  ('WESTFIELD','P071',15,24,24,''),
  ('WESTFIELD','P075',10,60,60,''),
  ('WESTFIELD','P076',10,60,60,''),
  ('WESTFIELD','P077',10,60,60,''),
  ('WESTFIELD','P001',3,9,9,''),
  ('WESTFIELD','P013',1,3,3,'arkusz w opak. (bidon 2 kg) -> kg (x2)'),
  ('WESTFIELD','P015',24,80,80,''),
  ('WESTFIELD','P017',1.8,5.4,5.4,'arkusz w opak. -> kg (x3,6 wg katalogu)'),
  ('WESTFIELD','P021',20,48,48,''),
  ('WESTFIELD','P022',2,5,5,''),
  ('WESTFIELD','P023',1.25,3.75,3.75,'arkusz w opak. 2,5 kg -> kg (x2,5)'),
  ('WESTFIELD','P038',1,2,2,''),
  ('WESTFIELD','P040',2,7,7,''),
  ('WESTFIELD','P041',0.5,1.5,1.5,''),
  ('WESTFIELD','P042',2,4,4,''),
  ('WESTFIELD','P043',1,2,2,''),
  ('WESTFIELD','P044',1,2,2,''),
  ('WESTFIELD','P045',2,6,6,''),
  ('WESTFIELD','P046',6,18,18,''),
  ('WESTFIELD','P047',2,10,10,''),
  ('WESTFIELD','P048',1,3,3,''),
  ('WESTFIELD','P049',1,2,2,'arkusz ''Szt'' (sloik 1 kg), katalog ''kg'' - 1:1'),
  ('WESTFIELD','P050',0.5,1.5,1.5,'arkusz ''Opak'', katalog ''kg'' - 1:1'),
  ('WESTFIELD','P051',0.5,1.5,1.5,'arkusz ''Opak'', katalog ''kg'' - 1:1'),
  ('WESTFIELD','P052',0.5,1.5,1.5,'arkusz ''Opak'', katalog ''kg'' - 1:1'),
  ('WESTFIELD','P053',2,10,10,'arkusz ''Opak'' 1 kg, katalog ''kg'' - 1:1'),
  ('WESTFIELD','P054',0.5,1.5,1.5,''),
  ('WESTFIELD','P055',0.5,1.5,1.5,''),
  ('WESTFIELD','P057',0.5,1.5,1.5,''),
  ('WESTFIELD','P058',0.5,1.5,1.5,''),
  ('WESTFIELD','P140',0.5,1.5,1.5,'arkusz ''Opak'', katalog ''szt'' - 1:1'),
  ('WESTFIELD','P141',0.5,1.5,1.5,''),
  ('WESTFIELD','P189',0.5,1.5,1.5,'nowy produkt (decyzja 28.09)'),
  ('WESTFIELD','P020',5,15,15,''),
  ('WESTFIELD','P019',0.5,1.5,1.5,''),
  ('WESTFIELD','P024',30,60,60,'arkusz w blokach -> kg (x15)'),
  ('WESTFIELD','P025',75,100,100,'arkusz w blokach -> kg (x25)'),
  ('WESTFIELD','P026',12,60,60,'arkusz w kartonach -> opak (x12)'),
  ('WESTFIELD','P027',20,75,75,'arkusz w kartonach -> kg (x5)'),
  ('WESTFIELD','P028',10,25,25,'arkusz w kartonach -> kg (x5)'),
  ('WESTFIELD','P089',1,2,2,''),
  ('WESTFIELD','P090',1,2,2,''),
  ('WESTFIELD','P091',2,8,8,''),
  ('WESTFIELD','P092',3,8,8,''),
  ('WESTFIELD','P098',0.5,1.5,1.5,''),
  ('WESTFIELD','P131',10,50,50,'arkusz ''Szt'', katalog ''box'' (cena za sztuke) - 1:1'),
  ('WESTFIELD','P132',2,4,4,''),
  ('WESTFIELD','P133',2,4,4,''),
  ('WESTFIELD','P127',1,3,3,''),
  ('ELEKTROWNIA','P082',3,12,12,''),
  ('ELEKTROWNIA','P083',1,4,4,''),
  ('ELEKTROWNIA','P084',1,2,2,''),
  ('ELEKTROWNIA','P085',1,2,2,''),
  ('ELEKTROWNIA','P086',7,20,20,''),
  ('ELEKTROWNIA','P087',2,8,8,''),
  ('ELEKTROWNIA','P088',0.5,1.5,1.5,''),
  ('ELEKTROWNIA','P143',2,5,5,''),
  ('ELEKTROWNIA','P144',1,2,2,''),
  ('ELEKTROWNIA','P093',1,2,2,'arkusz ''Szt'', katalog ''box'' - 1:1'),
  ('ELEKTROWNIA','P094',1,4,4,'arkusz ''Szt'', katalog ''opak'' - 1:1'),
  ('ELEKTROWNIA','P095',2,6,6,''),
  ('ELEKTROWNIA','P096',2,4,4,''),
  ('ELEKTROWNIA','P097',2,4,4,''),
  ('ELEKTROWNIA','P100',5,25,25,''),
  ('ELEKTROWNIA','P101',8,35,35,''),
  ('ELEKTROWNIA','P102',1,2,2,''),
  ('ELEKTROWNIA','P103',0.5,1.5,1.5,'arkusz ''Box'', katalog ''opak'' - 1:1'),
  ('ELEKTROWNIA','P104',1,2,2,''),
  ('ELEKTROWNIA','P106',1,2,2,''),
  ('ELEKTROWNIA','P107',1,2,2,''),
  ('ELEKTROWNIA','P109',1,2,2,''),
  ('ELEKTROWNIA','P111',2,6,6,''),
  ('ELEKTROWNIA','P112',1,4,4,''),
  ('ELEKTROWNIA','P113',1,2,2,''),
  ('ELEKTROWNIA','P116',2,5,5,''),
  ('ELEKTROWNIA','P117',3,15,15,''),
  ('ELEKTROWNIA','P118',3,15,15,''),
  ('ELEKTROWNIA','P119',1,3,3,''),
  ('ELEKTROWNIA','P121',10,20,20,'arkusz w opak. po 10 szt -> szt (x10)'),
  ('ELEKTROWNIA','P123',5,15,15,''),
  ('ELEKTROWNIA','P125',3,8,8,'arkusz ''Opak'', katalog ''szt'' - 1:1'),
  ('ELEKTROWNIA','P006',15,60,60,''),
  ('ELEKTROWNIA','P016',5,20,20,''),
  ('ELEKTROWNIA','P004',2,5,5,''),
  ('ELEKTROWNIA','P002',0.5,2,2,''),
  ('ELEKTROWNIA','P005',0.5,2.5,2.5,''),
  ('ELEKTROWNIA','P003',0.5,2.5,2.5,''),
  ('ELEKTROWNIA','P008',10,40,40,''),
  ('ELEKTROWNIA','P007',7,30,30,''),
  ('ELEKTROWNIA','P009',0.2,1,1,''),
  ('ELEKTROWNIA','P010',0.2,1,1,''),
  ('ELEKTROWNIA','P018',0.2,1,1,''),
  ('ELEKTROWNIA','P011',6,24,24,''),
  ('ELEKTROWNIA','P012',1,3,3,''),
  ('ELEKTROWNIA','P014',0.5,1,1.5,''),
  ('ELEKTROWNIA','P064',10,24,24,''),
  ('ELEKTROWNIA','P065',10,24,24,''),
  ('ELEKTROWNIA','P066',10,48,48,''),
  ('ELEKTROWNIA','P067',10,48,48,''),
  ('ELEKTROWNIA','P068',50,120,120,'puszka 0,33 (jak istniejący wiersz lokalu)'),
  ('ELEKTROWNIA','P069',70,150,150,'puszka 0,33 (jak istniejący wiersz lokalu)'),
  ('ELEKTROWNIA','P070',30,50,50,''),
  ('ELEKTROWNIA','P071',15,24,24,''),
  ('ELEKTROWNIA','P075',10,48,48,''),
  ('ELEKTROWNIA','P076',10,48,48,''),
  ('ELEKTROWNIA','P077',10,48,48,''),
  ('ELEKTROWNIA','P001',3,12,12,''),
  ('ELEKTROWNIA','P013',1,3,3,'arkusz w opak. (bidon 2 kg) -> kg (x2)'),
  ('ELEKTROWNIA','P015',36,120,120,''),
  ('ELEKTROWNIA','P017',1.8,5.4,5.4,'arkusz w opak. -> kg (x3,6 wg katalogu)'),
  ('ELEKTROWNIA','P021',20,60,60,''),
  ('ELEKTROWNIA','P022',2,6,6,''),
  ('ELEKTROWNIA','P023',1.25,3.75,3.75,'arkusz w opak. 2,5 kg -> kg (x2,5)'),
  ('ELEKTROWNIA','P038',1,3,3,''),
  ('ELEKTROWNIA','P040',2,8,8,''),
  ('ELEKTROWNIA','P041',0.5,1.5,1.5,''),
  ('ELEKTROWNIA','P042',2,6,6,''),
  ('ELEKTROWNIA','P043',1,2,2,''),
  ('ELEKTROWNIA','P044',1,2,2,''),
  ('ELEKTROWNIA','P045',2,6,6,''),
  ('ELEKTROWNIA','P046',6,24,24,''),
  ('ELEKTROWNIA','P047',2,10,10,''),
  ('ELEKTROWNIA','P048',1,3,3,''),
  ('ELEKTROWNIA','P049',1,2,2,'arkusz ''Szt'' (sloik 1 kg), katalog ''kg'' - 1:1'),
  ('ELEKTROWNIA','P050',0.5,1.5,1.5,'arkusz ''Opak'', katalog ''kg'' - 1:1'),
  ('ELEKTROWNIA','P051',0.5,1.5,1.5,'arkusz ''Opak'', katalog ''kg'' - 1:1'),
  ('ELEKTROWNIA','P052',0.5,1.5,1.5,'arkusz ''Opak'', katalog ''kg'' - 1:1'),
  ('ELEKTROWNIA','P053',2,10,10,'arkusz ''Opak'' 1 kg, katalog ''kg'' - 1:1'),
  ('ELEKTROWNIA','P054',0.5,1.5,1.5,''),
  ('ELEKTROWNIA','P055',0.5,1.5,1.5,''),
  ('ELEKTROWNIA','P057',0.5,1.5,1.5,''),
  ('ELEKTROWNIA','P058',0.5,1.5,1.5,''),
  ('ELEKTROWNIA','P140',0.5,1.5,1.5,'arkusz ''Opak'', katalog ''szt'' - 1:1'),
  ('ELEKTROWNIA','P141',0.5,1.5,1.5,''),
  ('ELEKTROWNIA','P189',0.5,1.5,1.5,'nowy produkt (decyzja 28.09)'),
  ('ELEKTROWNIA','P020',5,20,20,''),
  ('ELEKTROWNIA','P019',0.5,1.5,1.5,''),
  ('ELEKTROWNIA','P024',0,0,0,'arkusz w blokach -> kg (x15)'),
  ('ELEKTROWNIA','P025',75,250,250,'arkusz w blokach -> kg (x25)'),
  ('ELEKTROWNIA','P026',12,84,84,'arkusz w kartonach -> opak (x12)'),
  ('ELEKTROWNIA','P027',20,75,75,'arkusz w kartonach -> kg (x5)'),
  ('ELEKTROWNIA','P028',10,25,25,'arkusz w kartonach -> kg (x5)'),
  ('ELEKTROWNIA','P089',1,2,2,''),
  ('ELEKTROWNIA','P090',1,2,2,''),
  ('ELEKTROWNIA','P091',2,8,8,''),
  ('ELEKTROWNIA','P092',3,8,8,''),
  ('ELEKTROWNIA','P098',0.5,1.5,1.5,''),
  ('ELEKTROWNIA','P131',10,50,50,'arkusz ''Szt'', katalog ''box'' (cena za sztuke) - 1:1'),
  ('ELEKTROWNIA','P132',2,4,4,''),
  ('ELEKTROWNIA','P133',2,4,4,''),
  ('ELEKTROWNIA','P127',1,3,3,'')
  ) AS v(location_id, product_id, mn, tg, mx, conv)
  ON CONFLICT (location_id, product_id) DO UPDATE SET
    min_stock_qty_base    = EXCLUDED.min_stock_qty_base,
    target_stock_qty_base = EXCLUDED.target_stock_qty_base,
    max_stock_qty_base    = EXCLUDED.max_stock_qty_base,
    notes = btrim(s.notes || ' [2026-09-29 arkusz min/max, przed '
            || s.min_stock_qty_base::float8 || '/' || s.target_stock_qty_base::float8
            || '/' || s.max_stock_qty_base::float8
            || coalesce('; ' || nullif(split_part(EXCLUDED.notes, '; ', 2), ''), '') || ']')
  WHERE (s.min_stock_qty_base, s.target_stock_qty_base, s.max_stock_qty_base)
        IS DISTINCT FROM (EXCLUDED.min_stock_qty_base, EXCLUDED.target_stock_qty_base,
                          EXCLUDED.max_stock_qty_base);
  GET DIAGNOSTICS n_upsert = ROW_COUNT;
  -- expected from the 2026-09-29 diff: ELEKTROWNIA 9+89, WESTFIELD 10+89, NORBLIN 1+59
  IF n_upsert <> 257 THEN
    RAISE EXCEPTION 'threshold upsert touched % rows, expected 257', n_upsert;
  END IF;
END $$;

-- ============================================================
-- STEP 2 — audit (read-only). Every query must return the stated result.
-- ============================================================

-- a) rows written by this rollout per location  -> ELEKTROWNIA 98, NORBLIN 60, WESTFIELD 99
SELECT location_id, count(*) FROM location_product_settings
 WHERE notes LIKE '%2026-09-29 arkusz min/max%' GROUP BY 1 ORDER BY 1;

-- b) inconsistent thresholds at the three locations -> 0 rows
SELECT location_id, product_id, min_stock_qty_base, target_stock_qty_base, max_stock_qty_base
  FROM location_product_settings
 WHERE location_id IN ('NORBLIN','ELEKTROWNIA','WESTFIELD')
   AND (min_stock_qty_base > max_stock_qty_base
        OR target_stock_qty_base > max_stock_qty_base
        OR (max_stock_qty_base > 0 AND target_stock_qty_base < min_stock_qty_base));

-- c) settings on inactive products / products without an active supplier row -> 0 rows
SELECT s.location_id, s.product_id FROM location_product_settings s
  JOIN products p USING (product_id)
 WHERE s.notes LIKE '%2026-09-29 arkusz min/max%'
   AND (NOT p.active OR NOT EXISTS (SELECT 1 FROM supplier_products sp
                                     WHERE sp.product_id = p.product_id AND sp.active));

-- d) locations -> both active, address + city filled; ELEKTROWNIA with company
SELECT location_id, location_name, delivery_address, city, active, company_name, company_nip, email
  FROM locations WHERE location_id IN ('NORBLIN','ELEKTROWNIA','WESTFIELD') ORDER BY 1;
