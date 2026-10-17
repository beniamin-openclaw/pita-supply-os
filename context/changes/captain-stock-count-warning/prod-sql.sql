-- ============================================================
-- captain-stock-count-warning (D6) — prod steps for the operator (Supabase SQL editor)
-- Date: 2026-10-17. Owner decision D6 (Ben, 2026-10-17): before a Captain sends a
-- supplier order, warn (never block) when no stock was counted or every count is 0.
-- ON at every location except NORBLIN and ELEKTROWNIA, until revoked.
--
-- Order (lessons.md: migration before the code that needs it; diff before, audit after):
--   A  read-only BEFORE — save the output
--   B  migration 0030 (additive column, default true)
--   C  ONE guarded DO block: NORBLIN + ELEKTROWNIA -> false (one transaction)
--   D  read-only AUDIT
--   then merge the PR (Railway + Vercel deploy from main)
--   E  rollback / kill switch (commented out)
--
-- Nothing in this file was run on prod by the agent. Dry run: local Postgres 16, every
-- migration 0001..0030 applied, the 13 prod location ids inserted (2026-10-17): A..D
-- gave the expected rows, and a second run of C stopped on its guard.
--
-- Location ids: NORBLIN and ELEKTROWNIA as listed by the prod audit of 2026-10-01
-- (context/changes/order-email-v2/prod-sql-applied.md) and by the ELEKTROWNIA rollout
-- UPDATE guarded to exactly 1 row (context/archive/2026-09-29-elektrownia-westfield-
-- rollout/prod-sql.sql, "WHERE location_id = 'ELEKTROWNIA'"). A3 re-checks them on prod
-- before anything changes, and C refuses to run unless both exist.
-- ============================================================


-- ---------- A. BEFORE (read-only) — save the output ----------

-- A1. Is the column there yet? Expected: 0 rows (1 row after B).
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'locations'
  AND column_name = 'require_stock_count';

-- A2. Every location. Expected as of the 2026-10-01 audit: 13 rows — BRACKA, BROWARY,
-- ELEKTROWNIA, FORUM, KAMIENICA, KEN, KULINARNA, NORBLIN, SLONY, STARY_BROWAR,
-- SUPERSAM, WESTFIELD, WOLA. A location added since is fine: it starts ON.
SELECT location_id, location_name, active
FROM locations
ORDER BY location_id;

-- A3. The two exceptions under these exact ids. Expected: 2 rows, ELEKTROWNIA and NORBLIN.
SELECT location_id, location_name, active
FROM locations
WHERE location_id IN ('NORBLIN', 'ELEKTROWNIA')
ORDER BY location_id;


-- ---------- B. MIGRATION 0030 ----------
-- Same statement as supply-os-v1/migrations/0030_location_require_stock_count.sql.
-- Additive and re-runnable. Every existing row gets true.

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS require_stock_count boolean NOT NULL DEFAULT true;

-- B1. Expected: one row, require_stock_count = true, count = the A2 row count.
SELECT require_stock_count, count(*) AS locations
FROM locations
GROUP BY require_stock_count;


-- ---------- C. DATA STEP — one transaction; any guard failure rolls back everything ----------

DO $$
DECLARE
  n_total int;
  n_rows  int;
BEGIN
  -- Guards: the before-state this step was written for.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'locations'
      AND column_name = 'require_stock_count'
  ) THEN
    RAISE EXCEPTION 'locations.require_stock_count is missing: run B (migration 0030) first';
  END IF;
  IF (SELECT count(*) FROM locations
      WHERE location_id IN ('NORBLIN', 'ELEKTROWNIA')) <> 2 THEN
    RAISE EXCEPTION 'expected 2 rows for NORBLIN/ELEKTROWNIA: re-check the ids (A3)';
  END IF;
  IF EXISTS (SELECT 1 FROM locations WHERE require_stock_count = false) THEN
    RAISE EXCEPTION 'a location is already OFF: not the expected before-state (already applied? see D)';
  END IF;
  SELECT count(*) INTO n_total FROM locations;

  -- The change.
  UPDATE locations
  SET require_stock_count = false
  WHERE location_id IN ('NORBLIN', 'ELEKTROWNIA')
    AND require_stock_count = true;
  GET DIAGNOSTICS n_rows = ROW_COUNT;
  IF n_rows <> 2 THEN
    RAISE EXCEPTION 'update touched % rows, expected 2', n_rows;
  END IF;

  -- Post-checks.
  IF (SELECT count(*) FROM locations WHERE require_stock_count = false) <> 2 THEN
    RAISE EXCEPTION 'after the update: expected exactly 2 locations OFF';
  END IF;
  IF (SELECT count(*) FROM locations WHERE require_stock_count = true) <> n_total - 2 THEN
    RAISE EXCEPTION 'after the update: expected % locations ON', n_total - 2;
  END IF;

  RAISE NOTICE 'D6: stock-count warning OFF at NORBLIN, ELEKTROWNIA; ON at % other locations',
    n_total - 2;
END $$;


-- ---------- D. AUDIT (read-only) ----------

-- D1. Expected: exactly 2 rows — ELEKTROWNIA false, NORBLIN false.
SELECT location_id, require_stock_count
FROM locations
WHERE require_stock_count = false
ORDER BY location_id;

-- D2. Expected: false = 2, true = (A2 row count - 2), i.e. 2 and 11 with the 13 rows of A2.
SELECT require_stock_count, count(*) AS locations
FROM locations
GROUP BY require_stock_count
ORDER BY require_stock_count;

-- D3. Full list for the record (save with A2).
SELECT location_id, active, require_stock_count
FROM locations
ORDER BY location_id;


-- ---------- E. ROLLBACK / KILL SWITCH (commented out; run only on the owner's call) ----------

-- E1. Undo C (the warning comes back ON at the two locations):
-- UPDATE locations SET require_stock_count = true WHERE location_id IN ('NORBLIN', 'ELEKTROWNIA');

-- E2. Revoke D6 everywhere without a deploy (the warning disappears at every location):
-- UPDATE locations SET require_stock_count = false;

-- E3. Undo B (schema). Safe for the running code: reads are SELECT * and a missing column
-- reads as ON (models.Location default), so this turns the warning ON EVERYWHERE,
-- including NORBLIN and ELEKTROWNIA. Revert the code first if the feature should go.
-- ALTER TABLE locations DROP COLUMN IF EXISTS require_stock_count;
