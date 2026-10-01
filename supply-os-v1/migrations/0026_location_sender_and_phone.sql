-- ============================================================
-- Pita Supply OS — migration 0026: locations.sender_email + locations.phone
-- (order-email-v2)
--
-- ADDITIVE ONLY. The per-order supplier e-mail is created as a Gmail draft in
-- the biuro@ mailbox with From = the location's send-as alias
-- (sender_email, e.g. bracka@pitabros.pl), and carries the location's phone
-- ("Telefon lokalu: 600 722 252"). Both nullable: a location without an alias
-- sends from settings.order_mailbox, one without a phone gets no phone line.
-- phone stores the display form (digits grouped with spaces).
--
-- Numbered 0026 (0023 display order, 0024 zero-qty, 0025 delivery-calendar).
-- Keep this file free of the percent sign (integration fixture applies it via
-- psycopg2 exec_driver_sql). Applied on prod by the operator BEFORE the
-- backend that lists the columns in _LOCATION_COLUMNS.
--
-- Rollback:
--   ALTER TABLE locations DROP COLUMN IF EXISTS sender_email,
--                         DROP COLUMN IF EXISTS phone;
-- ============================================================

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS sender_email varchar(120);

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS phone varchar(40);
