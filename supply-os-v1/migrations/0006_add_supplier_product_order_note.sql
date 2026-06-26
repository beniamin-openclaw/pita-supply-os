-- bucket-annotation (#7): supplier_products gains an optional short per-line
-- packaging/ordering annotation (order_note), shown on the Captain product card
-- (e.g. "1 karton = 6 szt (18 kg)"). Additive, nullable.
-- _SUPPLIER_PRODUCT_COLUMNS now references it, so reads/inserts would error
-- against a pre-0006 schema.
-- varchar(60) enforces the "few words max" cap at the DB — the field is hand-
-- edited directly in Supabase and never written via the app, so the cap lives
-- where the data is entered (the Pydantic model stays unconstrained so a valid
-- value always loads on read).
-- NOTE: keep this file free of the percent sign — the integration fixture applies
-- it via psycopg2 exec_driver_sql, where a literal percent is read as a param marker.
-- Apply live to prod Supabase BEFORE deploying the backend code; recorded here for
-- CI + fresh provisions. IF NOT EXISTS so a re-apply is idempotent.
ALTER TABLE supplier_products
    ADD COLUMN IF NOT EXISTS order_note varchar(60);
