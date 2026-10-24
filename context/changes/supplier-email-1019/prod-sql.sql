-- ============================================================
-- supplier-email-1019 — prod steps for the operator (Supabase SQL editor)
-- Date: 2026-10-19. Owner decisions of the 19.10 meeting (porzadek-2026-10,
-- marek-answers-2026-10-19.md rows A1, A5, G1):
--   - per-location delivery hours in the supplier e-mail; WESTFIELD 9:00–10:00;
--   - Intermlecz e-mails without the "/12" pack suffix in product names.
-- (The fixed staff/signature/no-keys line is code only — no data.)
--
-- Order (lessons.md: migration before the code that needs it; diff before, audit after):
--   A  read-only BEFORE — save the output
--   B  migration 0031 (additive: 2 nullable text columns + 1 boolean default false)
--   C  ONE guarded DO block: WESTFIELD window 9:00–10:00 + Intermlecz switch ON
--   D  read-only AUDIT
--   then merge the PR (Railway + Vercel deploy from main)
--   E  rollback (commented out)
--
-- NOT set here on purpose: Gdańsk (SLONY) "od 10:00" is not confirmed, and the other
-- locations' hours are still being collected by Marek. Without a window a location keeps
-- today's "od godziny 11:00". Add each one later with a one-row guarded UPDATE like C1.
--
-- Nothing in this file was run on prod by the agent. Dry run: local Postgres 16 with the
-- integration schema (0001..0031) plus WESTFIELD and SUP_INTERMLECZ rows (2026-10-19):
-- A..D gave the expected rows, and a second run of C stopped on its guard.
--
-- Ids: WESTFIELD as in the delivery-calendar and rolki-minima prod SQL
-- (context/archive/2026-09-28-delivery-calendar/prod-sql.sql, DR-*-WESTFIELD rows);
-- SUP_INTERMLECZ as in the r4/r7 prod SQL (context/archive/2026-07-25-feedback-r7-tushar).
-- A2 and A3 re-check both on prod before anything changes.
-- ============================================================


-- ---------- A. BEFORE (read-only) — save the output ----------

-- A1. Are the columns there yet? Expected: 0 rows (3 rows after B).
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'locations' AND column_name IN ('delivery_window_from', 'delivery_window_to'))
    OR (table_name = 'suppliers' AND column_name = 'email_strip_pack_suffix'))
ORDER BY table_name, column_name;

-- A2. Westfield. Expected: 1 row, location_id = WESTFIELD.
SELECT location_id, location_name, active
FROM locations
WHERE location_id = 'WESTFIELD';

-- A3. Every Intermlecz supplier row. Expected: 1 row, SUP_INTERMLECZ.
-- If a second Intermlecz row shows up (e.g. a city-scoped one), STOP and ask Ben
-- whether it gets the switch too: C only touches SUP_INTERMLECZ.
SELECT supplier_id, supplier_name, email, ordering_method, active
FROM suppliers
WHERE supplier_name ILIKE 'intermlecz%' OR supplier_id ILIKE '%intermlecz%'
ORDER BY supplier_id;

-- A4. Intermlecz product names that WILL change in the e-mail (the /N or (N) suffix).
-- Read-only preview; the exact rule is gmail_url.strip_bulk_suffix (this regex is close,
-- not identical). Expected: a list like "... 25g/30", "... 100szt./12 koperta".
SELECT supplier_product_id, supplier_product_name
FROM supplier_products
WHERE supplier_id = 'SUP_INTERMLECZ'
  AND active
  AND supplier_product_name ~* '[0-9](kg|dag|mg|ml|cl|cm|mm|szt\.?|g|l|m)\s*(/[0-9]{1,3}\M|\([0-9]{1,3}\))'
ORDER BY supplier_product_name;


-- ---------- B. MIGRATION 0031 ----------
-- Same statements as supply-os-v1/migrations/0031_delivery_window_and_pack_suffix.sql.
-- Additive and re-runnable. Every location starts with no window (NULL) and every
-- supplier with the switch OFF, so no e-mail changes until C.

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS delivery_window_from text,
    ADD COLUMN IF NOT EXISTS delivery_window_to text;

ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_delivery_window_from_format;
ALTER TABLE locations
    ADD CONSTRAINT locations_delivery_window_from_format
    CHECK (delivery_window_from IS NULL
           OR delivery_window_from ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_delivery_window_to_format;
ALTER TABLE locations
    ADD CONSTRAINT locations_delivery_window_to_format
    CHECK (delivery_window_to IS NULL
           OR delivery_window_to ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS email_strip_pack_suffix boolean NOT NULL DEFAULT false;

-- B1. Expected: 3 rows (A1 again).
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'locations' AND column_name IN ('delivery_window_from', 'delivery_window_to'))
    OR (table_name = 'suppliers' AND column_name = 'email_strip_pack_suffix'))
ORDER BY table_name, column_name;


-- ---------- C. DATA STEP — one transaction; any guard failure rolls back everything ----------

DO $$
DECLARE
  n_rows int;
BEGIN
  -- Guards: the before-state this step was written for.
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public'
        AND ((table_name = 'locations'
              AND column_name IN ('delivery_window_from', 'delivery_window_to'))
          OR (table_name = 'suppliers' AND column_name = 'email_strip_pack_suffix'))) <> 3 THEN
    RAISE EXCEPTION 'migration 0031 columns missing: run B first';
  END IF;
  IF (SELECT count(*) FROM locations WHERE location_id = 'WESTFIELD') <> 1 THEN
    RAISE EXCEPTION 'expected 1 row for WESTFIELD: re-check the id (A2)';
  END IF;
  IF (SELECT count(*) FROM suppliers WHERE supplier_id = 'SUP_INTERMLECZ') <> 1 THEN
    RAISE EXCEPTION 'expected 1 row for SUP_INTERMLECZ: re-check the id (A3)';
  END IF;
  IF EXISTS (SELECT 1 FROM locations
             WHERE delivery_window_from IS NOT NULL OR delivery_window_to IS NOT NULL) THEN
    RAISE EXCEPTION 'a location already has a delivery window: not the expected before-state (already applied? see D)';
  END IF;
  IF EXISTS (SELECT 1 FROM suppliers WHERE email_strip_pack_suffix) THEN
    RAISE EXCEPTION 'a supplier already has the pack-suffix switch ON: not the expected before-state (already applied? see D)';
  END IF;

  -- C1. Westfield accepts deliveries 9:00–10:00 (Kamesh, meeting 19.10).
  UPDATE locations
  SET delivery_window_from = '9:00', delivery_window_to = '10:00'
  WHERE location_id = 'WESTFIELD'
    AND delivery_window_from IS NULL
    AND delivery_window_to IS NULL;
  GET DIAGNOSTICS n_rows = ROW_COUNT;
  IF n_rows <> 1 THEN
    RAISE EXCEPTION 'WESTFIELD update touched % rows, expected 1', n_rows;
  END IF;

  -- C2. Intermlecz e-mails without the pack suffix (Ben, 19.10, A5).
  UPDATE suppliers
  SET email_strip_pack_suffix = true
  WHERE supplier_id = 'SUP_INTERMLECZ'
    AND email_strip_pack_suffix = false;
  GET DIAGNOSTICS n_rows = ROW_COUNT;
  IF n_rows <> 1 THEN
    RAISE EXCEPTION 'SUP_INTERMLECZ update touched % rows, expected 1', n_rows;
  END IF;

  -- Post-checks.
  IF (SELECT count(*) FROM locations
      WHERE delivery_window_from IS NOT NULL OR delivery_window_to IS NOT NULL) <> 1 THEN
    RAISE EXCEPTION 'after the update: expected exactly 1 location with a window';
  END IF;
  IF (SELECT count(*) FROM suppliers WHERE email_strip_pack_suffix) <> 1 THEN
    RAISE EXCEPTION 'after the update: expected exactly 1 supplier with the switch ON';
  END IF;

  RAISE NOTICE 'supplier-email-1019: WESTFIELD 9:00-10:00; SUP_INTERMLECZ pack suffix stripped';
END $$;


-- ---------- D. AUDIT (read-only) ----------

-- D1. Expected: exactly 1 row — WESTFIELD, 9:00, 10:00.
SELECT location_id, delivery_window_from, delivery_window_to
FROM locations
WHERE delivery_window_from IS NOT NULL OR delivery_window_to IS NOT NULL
ORDER BY location_id;

-- D2. Expected: exactly 1 row — SUP_INTERMLECZ, true.
SELECT supplier_id, supplier_name, email_strip_pack_suffix
FROM suppliers
WHERE email_strip_pack_suffix
ORDER BY supplier_id;

-- D3. Full lists for the record (save with A).
SELECT location_id, active, delivery_window_from, delivery_window_to
FROM locations
ORDER BY location_id;
SELECT supplier_id, active, email_strip_pack_suffix
FROM suppliers
ORDER BY supplier_id;


-- ---------- Later: one more location's hours (template, commented out) ----------
-- Run only once Marek has confirmed the hours. One row, guarded; "H:MM" format.
-- Example for Gdańsk if "od 10:00" is confirmed (only a start hour):
-- UPDATE locations SET delivery_window_from = '10:00', delivery_window_to = NULL
-- WHERE location_id = 'SLONY' AND delivery_window_from IS NULL AND delivery_window_to IS NULL;
-- -- Expected: UPDATE 1


-- ---------- E. ROLLBACK (commented out; run only on the owner's call) ----------

-- E1. Undo C (e-mails go back to "od godziny 11:00" and full Intermlecz names):
-- UPDATE locations SET delivery_window_from = NULL, delivery_window_to = NULL
--   WHERE location_id = 'WESTFIELD';
-- UPDATE suppliers SET email_strip_pack_suffix = false WHERE supplier_id = 'SUP_INTERMLECZ';

-- E2. Undo B (schema). Safe for the running code: reads are SELECT * and the missing
-- columns read as "no window" / "switch off" (models defaults). But the backend's insert
-- column lists name them, so a location or supplier INSERT fails until the code is
-- reverted too. Revert the code first.
-- ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_delivery_window_from_format;
-- ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_delivery_window_to_format;
-- ALTER TABLE locations DROP COLUMN IF EXISTS delivery_window_from;
-- ALTER TABLE locations DROP COLUMN IF EXISTS delivery_window_to;
-- ALTER TABLE suppliers DROP COLUMN IF EXISTS email_strip_pack_suffix;
