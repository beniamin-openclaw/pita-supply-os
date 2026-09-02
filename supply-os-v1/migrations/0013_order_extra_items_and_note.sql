-- ============================================================
-- Pita Supply OS — migration 0013: Captain ad-hoc items + order comment
-- (training-feedback-0901, Phase 1b)
--
-- ADDITIVE ONLY.
--
-- Two independent free-text fields the Captain fills at submit:
--
--   extra_items  — products the Captain needs that are NOT in master data
--                  ("+ dodaj produkt": name / qty / unit, one per line). They
--                  are deliberately NOT order_lines rows: that table is a
--                  production contract whose product_id / supplier_product_id
--                  are FK-resolved against master data, and an ad-hoc item has
--                  neither. Rendered on the Manager detail and appended to the
--                  supplier email by BOTH builders (frontend emailBody.ts is
--                  the authoritative one; app/gmail_url.py is its twin).
--
--   captain_note — an order-level comment. It gets its OWN column rather than
--                  reusing orders.notes, because notes is overwritten by
--                  manager_release (the send-back reason) and blanked by
--                  captain_order_edit — reusing it would silently destroy the
--                  Captain's text.
--
-- Both are NOT NULL DEFAULT '' and are modelled in Pydantic as `str = ""`,
-- NOT Optional[str] = None: supabase_backend._insert binds every column in
-- _ORDER_COLUMNS, so a None against a NOT NULL column raises IntegrityError on
-- every captain submit. Mirrors 0004's cancel_reason.
--
-- Apply to PROD Supabase BEFORE deploying the backend that references these
-- columns. Wire into tests/test_supabase_integration.py::_schema.
--
-- Rollback:
--   ALTER TABLE orders DROP COLUMN IF EXISTS extra_items;
--   ALTER TABLE orders DROP COLUMN IF EXISTS captain_note;
-- ============================================================

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS extra_items  text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS captain_note text NOT NULL DEFAULT '';
