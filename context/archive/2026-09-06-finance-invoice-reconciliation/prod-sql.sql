-- finance-invoice-reconciliation — prod master data (run AFTER migration 0017).
-- Supplier NIPs as they appear on eBiuro purchase documents (contractor.nip),
-- digits only. Source: KEN eBiuro listing 2026-09-07.
UPDATE suppliers SET nip = '1182242889' WHERE supplier_id = 'SUP_BUKAT';
UPDATE suppliers SET nip = '5242106963' WHERE supplier_id = 'SUP_COCACOLA';
UPDATE suppliers SET nip = '5240005293' WHERE supplier_id = 'SUP_INTERMLECZ';
UPDATE suppliers SET nip = '1251685763' WHERE supplier_id = 'SUP_BLUESERV';
UPDATE suppliers SET nip = '1182124486' WHERE supplier_id = 'SUP_EUROFOOD';
UPDATE suppliers SET nip = '8151799755' WHERE supplier_id = 'SUP_SPEC';
UPDATE suppliers SET nip = '1180039859' WHERE supplier_id = 'SUP_KUCHNIE';
UPDATE suppliers SET nip = '5252855471' WHERE supplier_id = 'SUP_FILBER';
-- KEN orders under Pita Bros KEN sp. z o.o. (eBiuro company 7189181).
UPDATE locations SET company_nip = '5223241275'
 WHERE location_id = 'KEN' AND (company_nip IS NULL OR company_nip = '');
-- Assert:
-- SELECT supplier_id, nip FROM suppliers WHERE nip IS NOT NULL ORDER BY 1;
-- SELECT location_id, company_nip FROM locations WHERE location_id = 'KEN';
