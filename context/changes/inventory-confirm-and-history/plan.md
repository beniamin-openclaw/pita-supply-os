# Plan — inventory-confirm-and-history

Status: DRAFT, awaiting operator acceptance (2026-09-06).

Three independent tracks in one change. A and B are frontend-only (no backend, no migration).
C is prod master data only (SQL, no code) — it is the unrun half of
`training-feedback-0901/prod-sql-phase3.sql`, re-verified against prod today.

## Grounding (verified, not assumed)

**Why the confirmation is invisible.** `InventoryCountPage.tsx:334-372` — after a successful
submit the page shows a 5 s toast pinned at `fixed top-20` (`components/Toast.tsx:19-34`) and
immediately resets every line to blank. The Captain is at the bottom of a long list, next to the
sticky "Wyślij" bar; the toast is off-screen and the only thing in view is an emptied form.

**Why history is invisible.** `/captain-v2/inventory-history` (`App.tsx:71-78`) is reachable only
through a text link under the count-page title (`InventoryCountPage.tsx:395-401`). The "Historia"
tab (`CaptainTabs.tsx:12`, `/captain-v2/orders`) has no path to it. `OrdersListPage.tsx:36-53` and
`InventoryHistoryPage.tsx:266-288` are two unrelated pages with different headers.

**Prod master data (Supabase, 2026-09-06).**
- Gyros: only `P037 "Gyros (ścięty + nieścięty)"` (SUP_INTERNAL, active). No P176–P179, no
  chicken gyros anywhere; the only chicken SKU is `P027 Souvlaki Kurczak` (Pago). P037 has 0
  order lines in 60 d but 11 inventory-count lines at BRACKA/BROWARY/KEN/WOLA — it is counted,
  never ordered (production item).
- Corfu Pilsner: `P157` exists but `SP_FILBER_P157` is **`active=false`**, `szt` × 1 (every other
  Corfu is `zgrzewka` × 6), thresholds only at STARY_BROWAR (0/0/0). Zero order lines ever.
  Since 2026-09-03 `_build_orderable_items` honours `sp.active`, so even adding thresholds would
  not surface it — the row must be re-activated (phase-3 SQL missed this).
- Free ids: P176–P182 (rolki change deliberately jumped to P183/P184). Max = P184.

## Track A — confirmation card after inventory submit

`pages/captain-mp/InventoryCountPage.tsx` + one new component.

1. New state `submitted: { countId, countDate, who, lineCount } | null`.
2. On success: keep `clearDraft`, `addNameSuggestion`, `inventoryLatest()` refresh; set
   `submitted`; do **not** reset lines / countedBy / countDate yet; no success toast.
   Error path and the seed-mode "not persisted" warning keep the existing toast.
3. When `submitted` is set, `<main>` renders `InventorySubmittedCard` instead of the grid and the
   sticky footer is hidden. Header + `CaptainTabs` stay.
4. `InventorySubmittedCard` (`pages/captain-mp/components/InventorySubmittedCard.tsx`): centred
   card, `CheckCircle2` (green-600), title `inventory.submitted.title`, one meta line
   `{date} · {who} · {tPlural lineCount}` (reuse `inventory.history.lineCount`), two buttons:
   primary `inventory.submitted.viewHistory` → `navigate("/captain-v2/inventory-history")`,
   secondary `inventory.submitted.newCount` → runs the existing reset (lines → blank,
   countedBy → "", countDate → today) and clears `submitted`. Styling: white card, `rounded-xl
   border border-gray-200`, same palette as the blue "last count" banner; no new colours.
5. i18n (`i18n/strings.ts`): `inventory.submitted.title` (pl "Remanent zapisany" / en
   "Inventory saved"), `.viewHistory` ("Zobacz w historii" / "View in history"), `.newCount`
   ("Nowy remanent" / "New count"). `inventory.successToast` stays for the not-persisted branch
   only if still referenced; otherwise remove (pluralKeys test guards key composition).
6. Test: `InventorySubmittedCard.test.tsx` (render + both callbacks). No page-level harness
   exists; page behaviour verified by hand on prod after deploy.

## Track B — Zamówienia / Remanenty segment on the Historia tab

1. New `pages/captain-mp/components/HistorySegment.tsx`: two `Link`s styled as the Manager
   filter pills (`ManagerFilterBar.tsx:115-134` — `rounded-full border px-2.5 py-1 text-xs`),
   `aria-current="page"` on the active one, derived from `useLocation`. Left "Zamówienia" →
   `/captain-v2/orders`; right "Remanenty" → `/captain-v2/inventory-history`. Routes unchanged,
   so the confirmation card's deep link lands on the right segment.
2. `OrdersListPage.tsx`: render `<HistorySegment />` at the top of `<main>`. Keep its header.
3. `InventoryHistoryPage.tsx` list mode (`:266-288`): replace the ChevronLeft + "Historia
   remanentów" h2 with `<HistorySegment />`; the page already renders `Header` + `CaptainTabs`.
   Detail mode untouched (own header + back).
4. `CaptainTabs.tsx:23-25`: `historyActive` now also matches `/captain-v2/inventory-history`;
   `inventoryActive` narrows to `/captain-v2/inventory-count`. Update the "whole inventory
   subtree" test in `CaptainTabs.test.tsx:34-39` to the new contract (history sub-page → Historia
   tab) and add the count-page case.
5. The text link on the count page (`InventoryCountPage.tsx:395-401`) stays.
6. i18n: `history.segment.orders` ("Zamówienia" / "Orders"), `history.segment.inventory`
   ("Remanenty" / "Inventory counts"), `history.segment.ariaLabel`.
7. Tests: `HistorySegment.test.tsx` (active state per route) + updated `CaptainTabs.test.tsx`.

## Track C — prod master data (SQL only)

File: `context/changes/inventory-confirm-and-history/prod-sql.sql`, same BEFORE / APPLY / AUDIT
/ ROLLBACK shape as the archived phase-3 file. Sections carried over: **2.3 Corfu + 2.5 gyros
only**. Bombilla, Tirokafteri, Allegro/Selgros, cooked chickpeas and the gas-cylinder split stay
parked (not asked for; listed as an option below).

C1 Corfu Pilsner (P157):
- `supplier_products SP_FILBER_P157`: `active = true`, `purchase_unit = 'zgrzewka'`,
  `units_per_purchase_unit = 6` (the phase-3 file changed unit but not `active` — that alone
  would have kept it hidden).
- `location_product_settings` for WOLA / BRACKA / KEN mirroring each location's **own** Corfu
  Lager row, not the invented 6/24/24: WOLA 6/6/6, KEN 6/6/6, BRACKA 5/12/12 (min/max/target,
  read from prod today). `ON CONFLICT DO NOTHING`.
- Product name stays "Corfu Pilsner" (siblings carry no "500ml" either).

C2 Gyros split (P176–P179, SUP_INTERNAL, category Produkcja, kg):
- P176 Gyros wieprzowy ścięty, P177 Gyros wieprzowy nieścięty — thresholds copied from each
  location's P037 row onto both (WOLA/BRACKA/KEN 1/3/3, NORBLIN 1.3/3.8/3.8, BROWARY 15/25/25).
  Placeholder: one number now covers two SKUs — flagged for rebalancing, not guessed.
- P178 Gyros kurczak ścięty, P179 Gyros kurczak nieścięty — KEN only, 1/3/3 placeholder.
- `P037 active = false` (never deleted; 11 count lines + history reference it). It disappears
  from the count list and order screens; history rows still resolve the name.
- Audit: chicken exists only at KEN; every new product has an SP row; min ≤ max; target = max.

C3 Execution: BEFORE snapshot saved into the change folder → APPLY via Supabase MCP
(`execute_sql`, one transaction) → AUDIT → live check with a KEN captain token that the four
gyros rows and Corfu Pilsner appear on `/api/captain/orderable` (SUP_INTERNAL / SUP_FILBER)
and on `/api/captain/inventory/products`.

## Open questions — RESOLVED 2026-09-06 (operator)

1. Chicken = purchased 15 kg block from **Spec Food** (`SUP_SPEC`, l.raczkowski@specfood.pl, found in the Nov-2025 registration + order mails) + a CUT production item only; no uncut chicken SKU.
2. Gyros thresholds: leave the copied placeholder.
3. Whole phase 3 in one go — EXCEPT Allegro/Selgros (no active catalogue rows → would only add an empty supplier tab at every location; see prod-sql.sql header).

## Open questions (original)

1. **Chicken gyros supply.** Prod has no chicken-gyros block under Pago (only Souvlaki
   Kurczak). Phase 3 parked "a chicken-gyros BLOCK SKU under SUP_PAGO" pending your
   confirmation. Do KEN buy a chicken block from Pago (then: new purchased product + SP_PAGO
   row + KEN threshold), or is chicken gyros only a production item counted on the shelf?
2. **Gyros thresholds.** Copying P037's number onto both cut/uncut overstates the total. Accept
   the placeholder now and rebalance later, or give the split now?
3. **Rest of phase 3** (Bombilla off, Tirokafteri 2 kg tubs, Allegro/Selgros on, chickpeas,
   gas cylinders) — include in the same SQL, or keep parked?

## Verification before commit

Backend untouched → no pytest change expected, still run `python3 -m pytest` + `ruff check .`.
Frontend: `npm run test`, `npm run build`, `npm run lint` (Homebrew node). Then deploy, confirm
new bundle hash on prod, then hand over the live checklist (verify-after-deploy rule).

## Progress

- [x] Track A — confirmation card (Sonnet impl, R1 fix by reviewer)
- [x] Track B — history segment + CaptainTabs contract
- [x] Track C — prod SQL written (`prod-sql.sql`), BEFORE snapshot saved (`before-snapshot-2026-09-06.md`)
- [x] Track C — applied on prod 2026-09-06 (one transaction via Supabase MCP); 7 audit rules = 0 rows; orderable predicate re-run in SQL: KEN×INTERNAL = 3 gyros, KEN×SPEC = chicken block, Corfu Pilsner at WOLA/BRACKA/KEN. No prod captain token available locally, so the API itself was not called — the SQL mirrors `_build_orderable_items` exactly; master-data TTL is 60 s.
- [x] Impl review — see change.md (R1 fixed, R2–R7 noted)
