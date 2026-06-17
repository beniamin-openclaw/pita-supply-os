-- ============================================================
-- Pita Supply OS — RLS deny-all (S-10, migration 0002)
--
-- Supabase auto-exposes every public-schema table through the anon PostgREST
-- API. Enabling RLS with NO policies = deny-all for the anon / authenticated
-- roles, which locks that public API (supplier + price data would otherwise be
-- readable via a guessable REST endpoint). The FastAPI backend connects with a
-- privileged Postgres role (table owner), which BYPASSES RLS — so the app keeps
-- full access while the public REST surface is closed. This also clears the
-- Supabase security advisor's "RLS disabled on public table" lints.
--
-- No row policies are added (Supabase Auth is a v0 non-goal; the app's two-token
-- model is unchanged). A future CRUD UI using the anon key would add policies then.
-- ============================================================

ALTER TABLE products                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_product_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines                ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_counts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_count_lines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_lines              ENABLE ROW LEVEL SECURITY;
ALTER TABLE _meta                      ENABLE ROW LEVEL SECURITY;
