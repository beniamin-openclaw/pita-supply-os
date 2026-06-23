# Decimal-comma inputs + receipt-edit save loss — Plan Brief

> Full plan: `context/changes/demo-blocker-decimals-save/plan.md`

## What & Why

Two P0 bugs from the live M-01 in-store demo, frontend-only. (1) Polish-locale phones type decimals with a comma (`0,6`); the Captain's `<input type="number">` fields don't deliver a comma to JS, so weight-goods lines blank out ("zamawiasz bez stanu"), show no suggestion, and get silently dropped from the submit payload — the order never reaches the Manager. (2) Goods-receipts are append-only + persist-first; after the first save the quantity fields stay editable but have no save path, so quantities re-typed during a photo retry are silently lost (photos upload fine). Both make the live pilot unusable for real ordering.

## Starting Point

Four Captain decimal inputs (`ProductCard` current+final, `InventoryCountPage` stock, `ReceiptLineCard` delivered) are `type="number"` parsed with bare `Number()`, storing `number | ""`. `ProductCard` + `buildPayloadLines` are shared by the new-order and edit screens. Vitest is wired with existing `compute`/`buildPayloadLines` tests. `ReceiveDeliveryPage.handleSubmit` guards receipt creation behind `if (!receiptId)`, skipping the line block on retry.

## Desired End State

A Captain on a Polish phone types `0,6` and sees the suggestion + submits a decimal order that reaches the Manager queue; commas work on the inventory and receipt screens too. After a receipt is saved, the quantity fields are read-only with a clear "saved — photos only" note, so no edit is ever lost. `npm run test|build|lint` all green.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Decimal input representation | New `DecimalInput` component + `parseDecimal` helper | Local raw-string buffer fixes the mid-type reset and keeps `compute`/`payload`/types on `number \| ""` — minimal logic churn, fully testable. | Plan |
| Input element type | `type="text" inputMode="decimal"` | `type="number"` won't hand a comma to JS in a `pl-PL` locale; text + decimal keyboard does. | Plan |
| Receipt edit-after-save | Lock quantities read-only once saved | Honors append-only + persist-first and removes the silent loss, vs an atomic rewrite (loses persist-first) or a mutate endpoint (breaks append-only). | Plan |
| Fix scope | All 5 decimal inputs (4 Captain + Manager edit-qty) | Same bug class everywhere; the owner hits the Manager `OrderLineTable` input in the demo too (plan-review F2). | Plan |
| Verification | Vitest + build/lint + manual preview | Automated catches the logic; manual catches real input/keyboard behavior before a prod push during a live demo. | Plan |

## Scope

**In scope:** `parseDecimal` helper + tests; `DecimalInput` component; swap into the 5 inputs (4 Captain + Manager `OrderLineTable`); update compute/payload tests; receipt read-only-after-save + a saved-note string (PL/EN).

**Out of scope:** any backend/API/schema change; **display-side number formatting** (showing `1,4` not `1.4` — fast follow-up, plan-review F3); the other demo-feedback items (deviation 25%, email total/address, ∞ copy, name field, add-product, day-of-week targets, history nav); a receipt mutate endpoint; reverting persist-first; a locale number-format library.

## Architecture / Approach

One reusable `DecimalInput` (text input + local raw-string buffer, comma→dot, emits `number | ""`) replaces the five `type="number"` fields (4 Captain + Manager `OrderLineTable`). Because it emits the same `number | ""` the code already uses, `compute.ts`, `buildPayloadLines.ts`, and the in-memory state types are untouched. Phase 2 threads a `readOnly` flag from `ReceiveDeliveryPage` (`createdReceiptId !== null`) into `ReceiptLineCard`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Decimal-comma input | Commas work across all 5 inputs (Captain + Manager); suggestion + submit fixed | `DecimalInput` buffer-vs-prop sync (autofill suggestion / draft restore) |
| 2. Receipt edit-save lock | Quantities read-only after save; no silent loss | Getting the saved-state affordance clear without blocking photo retry |

**Prerequisites:** Homebrew node on PATH for vite/vitest (`/opt/homebrew/bin`); captain token for manual check.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Assumes the live-demo "edits don't save" report is the retry-guard path (grounded in code); the read-only-after-save fix also covers the general append-only confusion.
- `DecimalInput` external-value sync must not clobber a mid-typed buffer — the one fiddly bit; covered by the tap-to-autofill manual check.
- Real-device keyboard behavior (iOS/Android `pl-PL`) verified via narrow-viewport preview, not a physical phone in CI.

## Success Criteria (Summary)

- `0,6` entered on a phone yields a suggestion and a submittable decimal order that reaches the Manager.
- Inventory + receipt decimal inputs accept commas.
- A saved receipt's quantities are read-only; photo retry never loses a re-edit.
