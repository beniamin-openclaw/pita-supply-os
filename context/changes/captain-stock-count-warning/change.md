---
change_id: captain-stock-count-warning
title: Non-blocking stock-count warning before a Captain submits an order (D6, WP12)
status: implemented
created: 2026-10-17
updated: 2026-10-17
archived_at: null
---

## Notes

Owner decision D6 (Ben, 2026-10-17; `context/changes/porzadek-2026-10/plan.md`, row D6 under
"Decyzje Bena (17.10)", and `contracts.md` "Fala B"): stock counts are mandatory for every
location except NORBLIN and ELEKTROWNIA, until revoked. Mandatory means a warning, never a block:
the Captain can always send.

Background from the chat archive (`porzadek-2026-10/inputs/connecteam-chat.md`): on 02.10 Marek
allowed orders without stocks (B47, "mam mniejszą kontrolę"); on 15.10 a Captain reported that
every stock showed as 0 (B59, "same zera"). W60 (12.10) was the original trial rule
("mandatory stock entry, not Norblin/Elektrownia").

### What the Captain sees

When the location's flag is ON, the pre-submit dialog ("Czy na pewno chcesz wysłać?") shows one
more amber block when either holds for the supplier's cards on screen:

- `missing`: no stock ("Obecny stan") was entered on any card;
- `allZero`: at least one stock was entered and every entered stock is 0.

The send button then reads "Wyślij mimo to", the same as for the sent-today (WP6) and
critical-products warnings; the stock block sits below those two. Nothing else changes: the
order is sent exactly as before.

### Decisions

1. **Column, default and backfill.** `locations.require_stock_count boolean NOT NULL DEFAULT true`
   (migration 0030). `ADD COLUMN ... DEFAULT true` gives every existing row `true`, so the
   implicit backfill is "ON everywhere"; the two exceptions are a separate data step in
   `prod-sql.sql`. Why default ON:
   - the owner's rule is "every location except two", so ON is the norm and OFF is the
     exception that has to be named;
   - a location added later (rollouts are frequent: Westfield, Kraków, Katowice, Gdańsk)
     starts with the rule, which is what "until revoked" means;
   - the code default is the same: a missing column (seed, Sheets, or Postgres before 0030)
     reads as ON through the `Location` model default, so DB and code never disagree;
   - the migration stays schema-only and re-runnable, like 0022 (whose Pago switch also lived
     in a prod-sql data step). The integration fixture has no NORBLIN row to update.
2. **Where the flag reaches the Captain.** Each item of `GET /api/captain/orderable` carries
   `require_stock_count`, the token location's flag. This follows the precedent of
   `suggestion_alerts_enabled`, a supplier flag that rides on every item of the same response.
   Why this endpoint:
   - it already derives the location from the token;
   - it delivers the cards the warning evaluates in the same response, so the flag and the
     cards cannot get out of step on a supplier switch, and no second request or loading state
     is needed;
   - the response is a bare JSON list with no Pydantic model, so a top-level field is
     impossible without breaking the shape; a new key on each item is additive.
   An unknown location reads as ON. The Manager twin (`/api/manager/orderable`) shares the
   builder and returns the key too; Manager screens ignore it.
3. **Which lines count.** All cards shown for the active supplier, except backup cards
   (`is_backup`). Not only lines with an order quantity > 0. Why:
   - in the Captain's flow the count comes first and covers every card: the suggestion tile
     can only fill "Zamawiasz" after a stock is typed (`ProductCard.tsx:375,386`), and the
     inventory prefill fills stocks on every card (`CaptainMP.tsx:608-628`);
   - the B59 complaint ("all mentioned as 0") describes the whole screen;
   - scoping to ordered lines would warn "all zero" whenever the Captain orders only products
     that ran out, which is a normal, correct order. A warning that fires on correct orders
     trains people to ignore it;
   - backup cards carry no suggestion; their stock is counted on the primary supplier's tab.
   Accepted trade-off: a Captain who counts only products they do not order, and orders
   uncounted products, gets no warning. The rule targets the two patterns the owner named.
4. **Copy.** Polish first, short and plain, in `src/i18n/strings.ts` (pl + en):
   "Nie wpisano stanów" / "Wszystkie wpisane stany to 0", each followed by
   "Wróć i policz albo wyślij mimo to." / "Sprawdź je. Wróć i popraw albo wyślij mimo to."
5. **Scope limits.** Only the new-order submit (`CaptainMP`). The edit screen
   (`OrderEditPage`) and the backend submit are unchanged; nothing is blocked server-side.
6. **Every supplier tab, Pago included.** The flag is per location, so the warning applies on
   every supplier tab. It does not follow `suppliers.suggestion_alerts_enabled` (Pago = false):
   that flag switched off the deviation and reason gates because Pago is ordered for a week
   against one-day targets (`context/archive/2026-09-27-pago-suggestion-no-alerts/change.md`),
   not stock counting. The critical-products warning does skip Pago
   (`CaptainMP.tsx:824-836`). Open for Ben: if Pago should be exempt too, it is a one-line
   filter in `lib/stockCountWarning.ts`.

### Deploy order (operator-gated; nothing here has run on prod)

1. Operator runs `prod-sql.sql`: A (save output), B (migration 0030), C (guarded UPDATE of
   NORBLIN and ELEKTROWNIA), D (audit). Nothing breaks if the backend is older: it reads
   `SELECT *` and ignores the column.
2. Merge WP6 (#69) first, then this PR (stacked on it; see Coordination). Railway and Vercel
   deploy from `main`.
3. Confirm live: Railway `/health`, the new Vercel bundle for the merge commit.
4. Live check (PR body checklist).

If the backend went live before step 1, nothing breaks either: the column is absent, every
location reads as ON, and Norblin and Elektrownia see the warning until C runs.

### Location ids (how they were verified)

`NORBLIN` and `ELEKTROWNIA` are the exact `location_id` values:
- seed `docs/pita-supply-os-v1/seed/locations.csv` (NORBLIN row);
- `context/archive/2026-09-29-elektrownia-westfield-rollout/prod-sql.sql`
  (`UPDATE locations ... WHERE location_id = 'ELEKTROWNIA'`, guarded to 1 row);
- `context/changes/order-email-v2/prod-sql-applied.md` (audit table of prod on 2026-10-01 lists
  NORBLIN and ELEKTROWNIA);
- `docs/pita-supply-os-v1/COMPANY_ENTITIES.md` (rows NORBLIN, ELEKTROWNIA).
The guard in `prod-sql.sql` C re-checks on prod that both ids exist before it writes.

### Coordination

- **Stacked on WP6.** `claude/captain-sent-today` (PR #69, d990bb5) adds a "sent today" warning
  to the same confirm dialog. This branch is based on it, and its PR targets it; once #69 is
  merged the PR retargets to `main`. The one conflict (`ConfirmSubmitDialog.tsx`) is resolved
  here: props `sentToday` and `stockWarning` side by side, blocks in the order sent-today →
  critical → stock, all three in `aria-describedby`, and "Wyślij mimo to" when any shows.
  WP6's behaviour is unchanged.
- **One WP6 test fixture changed.** `captainSentToday.test.tsx` `fillOrder` typed stock 0 on the
  only card, which with D6 ON is exactly the all-zero case, so its "plain confirm" assertion
  failed. It now types a real count (stock 10, order 40, still green); the test still proves
  the plain confirm when no order went out today.
- **D6 dialog tests** are appended to WP6's `ConfirmSubmitDialog.test.tsx` in their own
  `describe` with their own render helper.
- **Migration number.** Lane D (PR #67) keeps `draft-0030-supplier-products-unique.sql` outside
  `migrations/`. This change takes 0030 in `migrations/`; when Lane D's draft moves in, it
  should become 0031.
