# Captain small fixes (N4, N19, N13)

## Trigger

See `change.md`. Frontend only; no backend, migration, engine or e-mail change.

## Changes

- **N4** `ReceiveDeliveryPage.tsx`: the confirm button no longer depends on the name; clicking it with an empty name sets a touched flag, shows an inline `role="alert"` error under the field (`aria-invalid`, `aria-describedby`), scrolls/focuses the field and does not submit. A persistent hint above the button shows while the name is empty. The all-lines-entered gate is unchanged. Copy: `delivery.receivedByRequired` (pl/en) in `src/i18n/strings.ts`.
- **N19** new `pages/captain-mp/lib/inventoryDraft.ts`; `InventoryCountPage.tsx` uses `inventoryDraftKey(token)`. The SPA has no location id (it lives only in the per-location Captain token), so the key is `__inventory__:<djb2 fingerprint of the token>`; the raw token is never in the key. Legacy `__inventory__` draft: migrated once if it records a matching `scope`, otherwise removed (the old format records none, so in practice it is dropped).
- **N13** `lib/supplierPrompts.ts`: `SUP_COCACOLA_KAT: "crates"`. The backend has no matching list (the crates line is only a first line of the free-text `captain_note`), so nothing to sync.

## Tests

- `ReceiveDeliveryPage.test.tsx` (3): button clickable + hint, click with empty name shows alert/focus/no submit, error clears on typing.
- `lib/inventoryDraft.test.ts` (10): key differs per token, no raw token, A not loaded at B, same-location round trip, clear isolation, 5 legacy-migration cases.
- `supplierPrompts.test.ts`: `SUP_COCACOLA_KAT` assertion added.

## Progress

- [x] N4 inline message + tests
- [x] N19 per-location inventory draft key + legacy handling + tests
- [x] N13 Coca-Cola KAT crates prompt + test
- [x] Verify: backend 1110 passed, ruff clean; frontend build + lint clean; vitest 959 passed, 3 failed (stickyBulkReason x2, ProductCard "English copy": Node 25 localStorage, identical on clean origin/main)
