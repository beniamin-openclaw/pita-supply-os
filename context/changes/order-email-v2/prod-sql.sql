-- ============================================================
-- order-email-v2 — prod master data (PREPARED, NOT APPLIED)
--
-- Applied by the OPERATOR, in order, AFTER migration 0026 and BEFORE the merge:
--   A. diff-before snapshot (save the output — it IS the rollback)
--   B. sender aliases + phones on locations
--   C. signer list in _meta.order_email_signers
--   D. audit-after (every query must return the expected result)
--
-- Lessons "Master-data ops: diff before, audit after". The agent never runs
-- B or C against prod.
--
-- Confirmed by the operator 2026-09-28:
--   * WOLA sends from biuro@ itself -> sender_email NULL
--   * kulinarna@ goes to KULINARNA (the "Kulinarna Kamienica" location);
--     the separate inactive KAMIENICA row gets no alias
--   * Marek's signature e-mail: marek@pitabros.pl
--   * Marek and Sławek can both sign in as biuro@ in their Chrome
-- Still open (non-blocking):
--   * BROWARY / WESTFIELD phone: unknown -> left NULL (no phone line)
--
-- Rollback:
--   restore sender_email/phone from the A snapshot (UPDATE per row), and
--   DELETE FROM _meta WHERE key = 'order_email_signers';
-- ============================================================


-- ---------- A. diff-before ----------
SELECT location_id, location_name, active, sender_email, phone, email
FROM locations
ORDER BY location_id;

SELECT key, value FROM _meta WHERE key = 'order_email_signers';


-- ---------- B. aliases + phones ----------
BEGIN;

-- Active locations (brief rule 1 + rule 5).
UPDATE locations SET sender_email = 'bracka@pitabros.pl',      phone = '600 722 252' WHERE location_id = 'BRACKA';
UPDATE locations SET sender_email = 'browary@pitabros.pl',     phone = NULL          WHERE location_id = 'BROWARY';
UPDATE locations SET sender_email = 'ken@pitabros.pl',         phone = '530 699 266' WHERE location_id = 'KEN';
UPDATE locations SET sender_email = 'norblin@pitabros.pl',     phone = '535 300 514' WHERE location_id = 'NORBLIN';
-- WOLA sends from the order mailbox itself (brief) -> sender_email NULL.
UPDATE locations SET sender_email = NULL,                      phone = '662 015 470' WHERE location_id = 'WOLA';

-- Inactive / later locations (harmless until they go live).
UPDATE locations SET sender_email = 'elektrownia@pitabros.pl', phone = '608 037 499' WHERE location_id = 'ELEKTROWNIA';
UPDATE locations SET sender_email = 'mokotow@pitabros.pl',     phone = NULL          WHERE location_id = 'WESTFIELD';
UPDATE locations SET sender_email = 'forum@pitabros.pl'                              WHERE location_id = 'FORUM';
UPDATE locations SET sender_email = 'poznan@pitabros.pl'                             WHERE location_id = 'STARY_BROWAR';
UPDATE locations SET sender_email = 'slony@pitabros.pl'                              WHERE location_id = 'SLONY';
UPDATE locations SET sender_email = 'supersam@pitabros.pl'                           WHERE location_id = 'SUPERSAM';
-- "Kulinarna Kamienica" is KULINARNA (operator 2026-09-28).
UPDATE locations SET sender_email = 'kulinarna@pitabros.pl'                          WHERE location_id = 'KULINARNA';

COMMIT;


-- ---------- C. signers ----------
-- First entry = default signer (Marek, marek@ confirmed 2026-09-28).
INSERT INTO _meta (key, value) VALUES (
  'order_email_signers',
  '[{"name": "Marek Złotopolski", "phone": "+48 662 184 258", "email": "marek@pitabros.pl"},
    {"name": "Sławomir Glanowski", "phone": "+48 692 840 194", "email": "slawek@pitabros.pl"}]'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- ---------- D. audit-after ----------
-- D1. Every active location: alias with "@" or NULL (NULL = order mailbox). Expect 0 rows.
SELECT location_id, sender_email FROM locations
WHERE active AND sender_email IS NOT NULL AND position('@' IN sender_email) = 0;

-- D2. Aliases live in the pitabros.pl domain (they must be send-as of biuro@). Expect 0 rows.
SELECT location_id, sender_email FROM locations
WHERE sender_email IS NOT NULL AND sender_email NOT LIKE '_%@pitabros.pl';

-- D3. No alias used twice. Expect 0 rows.
SELECT sender_email, count(*) FROM locations
WHERE sender_email IS NOT NULL GROUP BY sender_email HAVING count(*) > 1;

-- D4. Phones per brief (compare with docs/pita-supply-os-v1/COMPANY_ENTITIES.md).
SELECT location_id, active, sender_email, phone FROM locations ORDER BY location_id;

-- D5. Signer JSON parses and has 2 entries with a name. Expect 2.
SELECT jsonb_array_length(value::jsonb) FROM _meta WHERE key = 'order_email_signers';
SELECT e->>'name', e->>'phone', e->>'email'
FROM _meta, jsonb_array_elements(value::jsonb) AS e
WHERE key = 'order_email_signers';
