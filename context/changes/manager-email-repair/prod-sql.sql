-- Prepared 2026-11-06; NOT applied. Requires Ben's production approval.
-- Source: Marek's 2026-10-15 reply, Gmail thread 1a135645196a2f71.
-- Contacts were loaded, but the four suppliers remained manual pending terms.
-- Minima/cutoffs are now present. Change only these four channels; never send.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';

DO $$
DECLARE
    changed integer;
BEGIN
    PERFORM 1 FROM suppliers
    WHERE supplier_id IN ('SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT',
                          'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT')
    FOR UPDATE;

    IF (SELECT count(*) FROM suppliers s
        JOIN (VALUES
            ('SUP_KUCHNIE_KRK', 'krakow@kuchnieswiata.com.pl', 600),
            ('SUP_KUCHNIE_KAT', 'krakow@kuchnieswiata.com.pl', 600),
            ('SUP_SELGROS_KRK', 'HoReCa.Krakow@selgros.pl', 750),
            ('SUP_SELGROS_KAT', 'horeca.bytom@selgros.pl', 750)
        ) AS expected(id, email, minimum) ON s.supplier_id = expected.id
        WHERE s.active AND s.ordering_method = 'manual'
          AND s.email = expected.email
          AND s.minimum_order_value_pln = expected.minimum
          AND s.cutoff_time = '17:00') <> 4 THEN
        RAISE EXCEPTION 'Supplier configuration changed; re-audit before applying';
    END IF;

    UPDATE suppliers
    SET ordering_method = 'email',
        notes = coalesce(notes, '') ||
            '; 2026-11-06: manager-email-repair — email enabled using Marek 15.10 contacts; existing minima/cutoffs retained'
    WHERE supplier_id IN ('SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT',
                          'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT');
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 4 THEN
        RAISE EXCEPTION 'Expected 4 updates, got %', changed;
    END IF;
END $$;
COMMIT;

SELECT supplier_id, ordering_method, email, minimum_order_value_pln, cutoff_time
FROM suppliers
WHERE supplier_id IN ('SUP_KUCHNIE_KRK', 'SUP_KUCHNIE_KAT',
                      'SUP_SELGROS_KRK', 'SUP_SELGROS_KAT')
ORDER BY supplier_id;
