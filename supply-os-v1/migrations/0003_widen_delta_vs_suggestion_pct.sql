-- S-10 cutover fix: delta_vs_suggestion_pct is a deviation RATIO that can exceed
-- 100 (e.g. 61.0 = 6100%). The original NUMERIC(8,6) capped it at <100 and
-- overflowed on backfill of real order_lines. Widen to NUMERIC(12,6).
-- Applied live via Supabase migration `widen_delta_vs_suggestion_pct`; this
-- records the same change in repo migrations for CI + fresh provisions.
ALTER TABLE order_lines ALTER COLUMN delta_vs_suggestion_pct TYPE numeric(12,6);
