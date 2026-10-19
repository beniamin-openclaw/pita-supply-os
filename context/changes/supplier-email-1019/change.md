---
change_id: supplier-email-1019
title: Supplier e-mail — per-location delivery hours, staff/signature line, Intermlecz without pack suffix
status: implemented
created: 2026-10-19
updated: 2026-10-19
archived_at: null
---

## Notes

Owner decisions at the 19.10 meeting (Ben, Marek, Sławek, Kamesh), recorded in
`porzadek-2026-10/marek-answers-2026-10-19.md` (rows A1, A5, G1) and `marek-list-2026-10-19.md`
(B4). Three changes to the supplier order e-mail. Both builders change together: the client one
the Manager sends from (`frontend/src/pages/manager/lib/emailBody.ts`) and its backend twin
(`supply-os-v1/app/gmail_url.py`, the session re-open link). The shared golden fixtures in
`supply-os-v1/tests/fixtures/order_email/` pin them byte for byte.

### 1. Delivery hours per location (WP2)

- `locations.delivery_window_from` / `delivery_window_to`, nullable text "H:MM" with a format
  CHECK (migration 0031). Printed as stored.
- The "Dostawa:" line:
  - both set: `Dostawa: środa 21.10.2026, w godzinach 9:00–10:00`
  - only from: `…, od godziny 10:00`
  - only to: `…, do godziny 10:00`
  - neither: `…, od godziny 11:00` (unchanged from today)
- Data: only WESTFIELD 9:00–10:00 (Kamesh, 19.10). Gdańsk (SLONY) "od 10:00" is not confirmed
  and the other locations are still being collected by Marek, so they stay on 11:00.
  `prod-sql.sql` has a commented one-row template for adding them later.
- Text, not `time`: printed exactly as the operator wrote it ("9:00", not "09:00:00"), the same
  in the seed CSV, Sheets and Postgres, with no parsing on either side.

### 2. Fixed staff / signature / no-keys line

Every supplier e-mail, right after the address and phone lines (inside the delivery block,
before the company data and the sign-off):

> WAŻNE: dostawa tylko przy naszym pracowniku. Każdą dostawę sprawdzamy i podpisujemy. Bez
> pracownika prosimy nie zostawiać towaru i nie brać od nikogo kluczy do lokalu.

A literal in both builders (`DELIVERY_RULES_LINE`), like the rest of the supplier copy, which is
always Polish. It is not UI copy, so it does not go through `src/i18n/`. The Transport drafts
(Pago/Mory, our own pickup) are a different builder and are not touched.

### 3. Intermlecz without the pack suffix (A5)

- `suppliers.email_strip_pack_suffix boolean NOT NULL DEFAULT false` (migration 0031). ON only
  for SUP_INTERMLECZ (data step in `prod-sql.sql`), so the scope is data, not a hardcoded id.
- The rule is the Captain-view rule of PR #65 (`frontend/src/lib/displayName.ts`
  `stripBulkSuffix`): the client builder calls it directly; the backend has a Python twin
  `gmail_url.strip_bulk_suffix`. Both suites read the shared cases in
  `supply-os-v1/tests/fixtures/strip_bulk_suffix.json`. Examples: `MIÓD 25g/30` -> `MIÓD 25g`,
  `HERBATA 100szt./12 koperta` -> `HERBATA 100szt. koperta`, `OLEJ 5L (4)` -> `OLEJ 5L`.
  Ratios (`400g/240g`), `/1`, and names without a size stay as they are.
- Only catalogue product names change. Off-catalogue items stay exactly as the Captain typed
  them. Quantities and units are unchanged.
- PDF: no order PDF is built from this builder. The only PDFs are the Transport driver/Pago
  documents (`transportPdf.ts`), which do not cover Intermlecz. Nothing to change there.

### Deploy order (operator-gated; nothing here has run on prod)

1. Operator runs `prod-sql.sql`: A (save output), B (migration 0031), C (guarded: WESTFIELD
   9:00–10:00, SUP_INTERMLECZ switch ON), D (audit). An older backend ignores the columns
   (reads are `SELECT *`).
2. Merge the PR. Railway and Vercel deploy from `main`.
3. Confirm live: Railway `/health`, the new Vercel bundle for the merge commit.
4. Live check (below).

If the code goes live before step 1: reads are fine (no window, switch off), but a location or
supplier INSERT from the app fails because the insert column lists name the new columns. So B
must run first.

### Live check for Ben (prod, after deploy; creates Gmail drafts only — do not send)

1. Open any Westfield order in the Manager panel → "Dostawa: …, w godzinach 9:00–10:00".
2. Open an order from another location (e.g. Wola) → "Dostawa: …, od godziny 11:00".
3. In both, the line "WAŻNE: dostawa tylko przy naszym pracowniku…" sits under the address/phone.
4. Open an Intermlecz order with a product like "MIÓD … 25g/30" → the name reads "… 25g", the
   quantity and unit are unchanged.
5. Open a Bukat (or any non-Intermlecz) order → product names unchanged.
6. Optional: create the Gmail draft for one of them and check the draft body matches the
   preview; then delete the draft.

### Coordination

- Migration number: 0031. Lane D (PR #67) keeps `draft-0030-supplier-products-unique.sql`
  outside `migrations/`; when it moves in it should become 0032.
- The integration fixture (`tests/test_supabase_integration.py`) applies 0031.
- Pre-existing on `main` (not from this change): 3 Vitest failures in
  `captain-mp/stickyBulkReason.test.tsx` (2) and `captain-mp/components/ProductCard.test.tsx`
  (1, "English copy"); they fail the same on a clean `origin/main` checkout (57749c1).
