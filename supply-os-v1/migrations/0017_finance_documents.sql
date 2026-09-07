-- ============================================================
-- Pita Supply OS — migration 0017: finance documents (eBiuro mirror),
-- receipt reviews, learned line aliases, supplier NIP
-- (finance-invoice-reconciliation, KEN pilot)
--
-- ADDITIVE ONLY: three new tables + one nullable column. No existing row,
-- column, index or constraint is touched. Safe to apply BEFORE the code
-- merge (old code never reads these objects).
--
-- finance_documents / finance_document_lines = READ-ONLY mirror of the
-- accountant's verified purchase invoices from Symfonia eBiuro (doc ids are
-- global across eBiuro companies — verified 2026-09-07 on KEN + PB ZOO, 0
-- overlap). The app never writes back to eBiuro.
--
-- finance_receipt_reviews = Manager verdict per goods receipt. The partial
-- UNIQUE index lets one invoice be CONFIRMED against ONE receipt only (prod
-- already has two receipts for ORD-20260901-KEN-BUKA-60e316).
--
-- finance_line_aliases = learned "how supplier X names our product" so a
-- manual link ("Avocado (sztuka) Kraj poch: RPA" = Awokado) is remembered
-- per supplier NIP for every later invoice and location.
--
-- ORDER OF OPERATIONS: apply, then run prod-sql.sql (supplier NIPs + KEN
-- company_nip), then deploy code, then seed documents with
-- scripts/ebiuro_sync.py --emit-sql.
--
-- Rollback:
--   DROP INDEX IF EXISTS finance_receipt_reviews_confirmed_doc_uniq;
--   DROP TABLE IF EXISTS finance_line_aliases;
--   DROP TABLE IF EXISTS finance_receipt_reviews;
--   DROP TABLE IF EXISTS finance_document_lines;
--   DROP TABLE IF EXISTS finance_documents;
--   ALTER TABLE suppliers DROP COLUMN IF EXISTS nip;
-- ============================================================

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS nip text;

CREATE TABLE IF NOT EXISTS finance_documents (
    doc_id           bigint PRIMARY KEY,
    company_id       bigint NOT NULL,
    company_nip      text,
    contractor_nip   text,
    contractor_name  text,
    doc_type         text,
    invoice_number   text,
    ksef_number      text,
    issue_date       date,
    sell_date        date,
    payment_deadline date,
    netto            numeric(12,2),
    brutto           numeric(12,2),
    vat              numeric(12,2),
    pdf_url          text,
    state            integer,
    listing_fp       text,
    last_seen_at     timestamptz,
    synced_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS finance_documents_contractor_sell_idx
    ON finance_documents (contractor_nip, sell_date);
CREATE INDEX IF NOT EXISTS finance_documents_company_issue_idx
    ON finance_documents (company_id, issue_date);

CREATE TABLE IF NOT EXISTS finance_document_lines (
    doc_id           bigint NOT NULL REFERENCES finance_documents (doc_id) ON DELETE CASCADE,
    ordinal          integer NOT NULL,
    name             text NOT NULL DEFAULT '',
    quantity         numeric(12,3),
    unit             text,
    netto            numeric(12,2),
    brutto           numeric(12,2),
    unit_price_netto numeric(12,4),
    vat_rate         numeric(5,2),
    PRIMARY KEY (doc_id, ordinal)
);

CREATE TABLE IF NOT EXISTS finance_receipt_reviews (
    receipt_id  text PRIMARY KEY REFERENCES receipts (receipt_id),
    doc_id      bigint,
    status      text NOT NULL CHECK (status IN ('confirmed', 'mismatch')),
    note        text NOT NULL DEFAULT '',
    actor       text,
    reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS finance_receipt_reviews_confirmed_doc_uniq
    ON finance_receipt_reviews (doc_id)
    WHERE doc_id IS NOT NULL AND status = 'confirmed';

CREATE TABLE IF NOT EXISTS finance_line_aliases (
    contractor_nip    text NOT NULL,
    invoice_name_norm text NOT NULL,
    product_id        text NOT NULL REFERENCES products (product_id),
    invoice_name      text NOT NULL DEFAULT '',
    actor             text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (contractor_nip, invoice_name_norm)
);
