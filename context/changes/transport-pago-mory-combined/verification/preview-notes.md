# Preview notes — transport-pago-mory-combined

- **Date**: 2026-09-29
- **Build**: branch `claude/transport-pago-mory-combined` at 07746f7 (Phases 1–3)
- **Stack**: local only. Backend `supabase` mode on a local Postgres copy `supply_os_trn_pm` (cloned from `supply_os_prodsql_0027`, prod master data, no orders), frontend Vite dev server. Auth ON: a local Manager token and four local Captain tokens (WOLA, BRACKA, KEN, NORBLIN), generated for this session, kept in the session scratchpad, not in the repo. Never prod; no e-mail, no Gmail (Google client id empty).
- **Local data prep (copy only)**: SUP_PAGO renamed "Pago", `ordering_method = transport`; SUP_MORY renamed "Magazyn własny Mory", `ordering_method = manual`, no e-mail; the 6 active SP_PAGO rows `warehouse_pickup = true` (mirrors prod). Mory `display_order` is unset in the copy, so the Mory block falls back to `supplier_product_id` order, as it will on prod until `prod-sql-pago-mory.sql` (PR #44) runs.

## Steps and results

1. Five orders submitted through the local Captain API: Pago at WOLA, BRACKA, KEN; Mory at WOLA, NORBLIN (3 lines each, plus a test extra item each).
2. Transport → supplier dropdown: "Magazyn własny Mory" is not offered (companion hidden). Supplier Pago: "Do połączenia" lists KEN, BRACKA, WOLA (Pago), then NORBLIN, WOLA with a "Magazyn własny Mory" label.
3. Selected all five → "Utwórz transport": draft `TRN-20260929-PAGO-f6ea75` with 5 orders.
4. Draft view: two sections, "Produkty × lokalizacje — Pago" (BRACKA, KEN, WOLA) and "Produkty × lokalizacje — Magazyn własny Mory" (NORBLIN, WOLA), each with its own "+ Dodaj produkt" and "Dodaj lokalizację".
5. Mory section → "Dodaj lokalizację" → KEN: a KEN Mory column appeared, prefilled with the 15 Mory products orderable at KEN; KEN's Pago column stayed. The batch now holds 6 orders.
6. Typed 5 into "Serwetki PB — KEN" (Mory) and saved: "Zapisano zmiany w 1 zamówieniach."
7. Documents, built in the page from the live batch detail (no file downloaded):
   - Pago print doc products: the three Pago lines only; excluded list empty.
   - Order e-mail body and Pago Gmail draft body: Pago lines and the three Pago extra items only; no Mory line, no Mory extra item.
   - Driver print doc: columns BRACKA, KEN, NORBLIN, WOLA; section 1 "Pago / LINEAGE" (3 products), section 2 "Magazyn własny Mory" (4 products incl. Serwetki PB 0/5/0/0).
   - Driver Gmail draft body: all five extra items.
   - `leadSupplierView(detail).location_ids` = BRACKA, KEN, WOLA (the Pago label omits NORBLIN).
8. "Zatwierdź transport": sent view shows "Sumy produktów" and "Rozbicie na lokalizacje" grouped under a "Pago" header row, then a "Magazyn własny Mory" header row.
9. Local DB after finalize: all 6 orders (3 SUP_PAGO, 3 SUP_MORY) `manager_sent`, `sent_method = transport`, marker `TRN-20260929-PAGO-f6ea75`; header `SUP_PAGO`, `sent`.
10. The "Otwórz email" button stays disabled locally (Pago e-mail in the copy is a placeholder); `buildTransportGmailUrl` with a dummy address produces a body with Pago lines only. Nothing was sent anywhere.
