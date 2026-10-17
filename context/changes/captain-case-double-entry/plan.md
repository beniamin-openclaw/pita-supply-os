# Plan — captain-case-double-entry (N1)

## Research

- Inputs: `frontend/src/pages/captain-mp/components/PackStockInput.tsx` (two fields, emits `combinePackStock`), used by `ProductCard.tsx:312` (stock, pack = units_per_case × upp), `ProductCard.tsx:535` (order, `copy="order"`, pack = units_per_case) and `InventoryCountGrid.tsx:235`.
- Math: `frontend/src/lib/packStock.ts` `combinePackStock` / `splitPackStock`; backend `gmail_url._format_case_qty`; `order_qty.py` / `orderQty.ts` (effective qty only).
- Prod evidence: see `change.md` Diagnosis.

## Design

Detect the duplicate signature on the client, where the pair exists; offer a one-tap fix; never block. Stock counts are gated by references (impl-review: real counts often have loose ≥ one small pack). Shown while typing (not only on blur) because the Captain can go straight to "Wyślij".

## Progress

- [x] Repro test (Vitest) on the Browary/Intermlecz halloumi case
- [x] `detectDoubleEntry` + prompt in `PackStockInput`
- [x] i18n pl/en
- [x] Backend regression (stored once, e-mail wording)
- [x] Impl-review (Opus) findings applied: stock gating, agreement-free copy, order loose-over-pack fix, tile-path test, focus/aria, docs
- [x] Verify: backend 1113 passed + ruff; frontend build + lint; vitest 963 passed, 3 failures pre-existing on clean main (local localStorage)
