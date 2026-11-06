-- Proposed rollback of prod-sql.sql only. Not applied; requires a fresh
-- configuration check and production approval. Preserve orders and drafts.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
DO $$
BEGIN
    PERFORM 1 FROM suppliers
    WHERE supplier_id IN ('SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT',
                          'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT') FOR UPDATE;
    IF (SELECT count(*) FROM suppliers s
        JOIN (VALUES
            ('SUP_KUCHNIE_KRK', 'krakow@kuchnieswiata.com.pl'),
            ('SUP_KUCHNIE_KAT', 'krakow@kuchnieswiata.com.pl'),
            ('SUP_SELGROS_KRK', 'HoReCa.Krakow@selgros.pl'),
            ('SUP_SELGROS_KAT', 'horeca.bytom@selgros.pl')
        ) AS expected(id, email) ON s.supplier_id = expected.id
        WHERE s.active AND s.ordering_method = 'email' AND s.email = expected.email
          AND s.notes LIKE '%2026-11-06: manager-email-repair — email enabled%') <> 4 THEN
        RAISE EXCEPTION 'Supplier configuration changed; re-audit before rollback';
    END IF;
    UPDATE suppliers
    SET ordering_method = 'manual',
        notes = notes || '; manager-email-repair: email channel rolled back to manual'
    WHERE supplier_id IN ('SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT',
                          'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT');
END $$;
COMMIT;
