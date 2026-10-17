# Plan — captain-backup-card-names

## Research

- Backup card before the change: `frontend/src/pages/captain-mp/components/ProductCard.tsx` — the suggestion tile showed "—" and `aria-label` `card.suggestionMissing` ("enter current stock first") on every backup card; a separate `card.suggestionAtPrimary` line and the shared `frontend/src/components/OpenOrdersElsewhere.tsx` block sat below. Row state for a backup item is neutral grey, never a reason (`frontend/src/pages/captain-mp/lib/compute.ts`, `computeRowState`, `is_backup === true` branch) — unchanged.
- Data: `OrderableItem.is_backup`, `primary_supplier_names`, `open_orders_elsewhere: OpenOrderRef[]` (`frontend/src/types.ts`; `order_date` is ISO, formatted with `lib/dates.ts formatDayMonth`).
- Suffix data: in the seed (`docs/pita-supply-os-v1/seed/products.csv`) the "/N" suffix lives in `product_name_pl` (3 rows, e.g. "AGROS ŁOWICZ MIÓD WIELOKWIATOWY 25g/30"); `supplier_product_name` is not rendered on Captain screens (only passed to `GramsHint` for matching). The helper is therefore applied to `product_name_pl`.

## Design

A. Backup card: dashed card border; tile text "u {primary names}" (aria "Sugestia u dostawcy głównego: {names}", fallback copy when there are no names); one info line "Zapasowy · główny: X · zamówione DD.MM" (date = newest `order_date` among `open_orders_elsewhere`; segment omitted when none). On backup cards the separate "Sugestia u" line and the OpenOrdersElsewhere block are not rendered. Non-backup cards unchanged. Copy in `frontend/src/i18n/strings.ts` (pl+en).

B. `frontend/src/lib/displayName.ts` `stripBulkSuffix(name)`: strips `<size>/<N>` (N integer 2..999, not followed by a digit, decimal or unit, so "400g/240g", "1/2", "2,5kg/1,5" stay) and `<size> (N)`; collapses double spaces; returns the name unchanged when unsure. Applied only on Captain screens: ProductCard title, order detail (`OrderDetailPage`), receipt (`ReceiptLineCard`), inventory count (`InventoryCountGrid`) and history (`InventoryHistoryPage`), the submit-confirm critical list (`CaptainMP`), legacy `CaptainPage`.

## Tests

`frontend/src/lib/displayName.test.ts` (strip cases, keep cases, idempotent, spaces); `ProductCard.test.tsx` (dashed frame, tile text and aria, info line with and without date, newest-date pick, no duplicate block, non-backup unchanged, title stripped).

## Progress

- [x] A. Backup card look
- [x] B. Helper + tests
- [x] B. Applied on Captain screens
- [x] Verify (build, lint, vitest, pytest, ruff)
