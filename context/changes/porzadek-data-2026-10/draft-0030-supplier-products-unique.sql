-- DRAFT — not yet a migration. Move to supply-os-v1/migrations/0030_supplier_products_unique.sql
-- only after prod-sql-0-audits.sql A1 returns 0 rows on prod and A4 shows Postgres >= 15
-- (D10, porzadek-data-2026-10, 2026-10-17). Kept outside migrations/ on purpose: the integration
-- CI job applies every file in migrations/, and this PR is docs/SQL only.
--
-- Why: supplier_products has no uniqueness beyond the PK. Two ACTIVE rows of the same supplier +
-- product in one scope give two cards in one order tab; the card state is keyed by product_id
-- (prod-sql-B-suppliers-catalog.sql:415-422, app/main.py:335-385 does not dedupe). Today this is
-- only guarded by audits in each prod-sql file.
--
-- Shape: partial (WHERE active), so retired rows (active = false) may keep their history twins and
-- re-adding a product means deactivate-then-insert or reactivate, never a second active row.
-- NULLS NOT DISTINCT so two SHARED rows (location_id NULL) of one supplier + product collide too.
-- A scoped row next to a shared row of the same supplier + product is NOT blocked here (different
-- location_id); that pattern is legal for own_catalog locations and is covered by audit A3.
--
-- Code impact: none. The app never writes supplier_products (supabase_backend.py only has
-- load_supplier_products; grep of app/ for an INSERT into supplier_products is empty, 2026-10-17).
-- Manager add-any-product (R-35) keeps its override on the order line. Only operator prod-sql
-- scripts insert catalog rows; with the index a twin fails loudly (23505) instead of silently.
--
-- Apply order (operator): run A1 -> 0 rows, then this file in the SQL editor, then merge the code
-- that adds it to migrations/ (lessons.md: migration before the code that needs it).
--
-- Rollback:
--   DROP INDEX IF EXISTS supplier_products_active_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS supplier_products_active_unique_idx
    ON supplier_products (supplier_id, product_id, location_id) NULLS NOT DISTINCT
    WHERE active;
