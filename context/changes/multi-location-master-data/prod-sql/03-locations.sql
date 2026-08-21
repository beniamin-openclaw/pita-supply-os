-- Batch: 03-locations.sql
-- Purpose: Onboard the 6 brand-new locations (inactive), rename the KAMIENICA stub to match the real sheet, and leave BROWARY's already-correct stub untouched.
-- Preconditions:
--   none — new rows are inactive; the rename only touches location_name
-- Diff-before (run first, record the result):
--   SELECT location_id, location_name, active FROM locations WHERE location_id IN ('ELEKTROWNIA', 'FORUM', 'KAMIENICA', 'SLONY', 'STARY_BROWAR', 'SUPERSAM', 'WESTFIELD');

INSERT INTO locations (location_id, location_name, delivery_address, city, active, notes, company_name, company_address, company_nip)
VALUES ('ELEKTROWNIA', 'Pita Bros Elektrownia', NULL, NULL, FALSE, 'added 2026-08-22 (multi-location-master-data); address/city/company gap for the operator', NULL, NULL, NULL)
ON CONFLICT (location_id) DO NOTHING;
INSERT INTO locations (location_id, location_name, delivery_address, city, active, notes, company_name, company_address, company_nip)
VALUES ('FORUM', 'Pita Bros Forum', NULL, NULL, FALSE, 'added 2026-08-22 (multi-location-master-data); address/city/company gap for the operator', NULL, NULL, NULL)
ON CONFLICT (location_id) DO NOTHING;
UPDATE locations SET location_name = 'Pita Bros Kulinarna Kamienica' WHERE location_id = 'KAMIENICA';
-- NOTE: the separate 'KULINARNA' stub is a probable duplicate of this location (research §3.6) and is NOT touched here — operator confirms or deletes it.
INSERT INTO locations (location_id, location_name, delivery_address, city, active, notes, company_name, company_address, company_nip)
VALUES ('SLONY', 'Pita Bros Słony Spichlerz', NULL, NULL, FALSE, 'added 2026-08-22 (multi-location-master-data); address/city/company gap for the operator', NULL, NULL, NULL)
ON CONFLICT (location_id) DO NOTHING;
INSERT INTO locations (location_id, location_name, delivery_address, city, active, notes, company_name, company_address, company_nip)
VALUES ('STARY_BROWAR', 'Pita Bros Stary Browar', NULL, NULL, FALSE, 'added 2026-08-22 (multi-location-master-data); address/city/company gap for the operator', NULL, NULL, NULL)
ON CONFLICT (location_id) DO NOTHING;
INSERT INTO locations (location_id, location_name, delivery_address, city, active, notes, company_name, company_address, company_nip)
VALUES ('SUPERSAM', 'Pita Bros Supersam', NULL, NULL, FALSE, 'added 2026-08-22 (multi-location-master-data); address/city/company gap for the operator', NULL, NULL, NULL)
ON CONFLICT (location_id) DO NOTHING;
INSERT INTO locations (location_id, location_name, delivery_address, city, active, notes, company_name, company_address, company_nip)
VALUES ('WESTFIELD', 'Pita Bros Westfield', NULL, NULL, FALSE, 'added 2026-08-22 (multi-location-master-data); address/city/company gap for the operator', NULL, NULL, NULL)
ON CONFLICT (location_id) DO NOTHING;

-- Audit-after (run after applying, compare to diff-before):
--   SELECT location_id, location_name, active, city FROM locations WHERE location_id IN ('ELEKTROWNIA', 'FORUM', 'KAMIENICA', 'SLONY', 'STARY_BROWAR', 'SUPERSAM', 'WESTFIELD');
-- Rollback:
--   UPDATE locations SET location_name = 'Pita Bros Kamienica' WHERE location_id = 'KAMIENICA'; DELETE FROM locations WHERE location_id IN ('ELEKTROWNIA', 'FORUM', 'KAMIENICA', 'SLONY', 'STARY_BROWAR', 'SUPERSAM', 'WESTFIELD') AND location_id <> 'KAMIENICA';
