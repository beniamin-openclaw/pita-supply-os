<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Pago + Magazyn Mory on one Transport run

- **Plan**: context/changes/transport-pago-mory-combined/plan.md
- **Mode**: Deep (two passes: a standard plan review and an adversarial review)
- **Date**: 2026-09-29
- **Verdict**: REVISE → SOUND after the fixes below were applied to plan.md
- **Findings**: 1 critical, 7 warnings, 8 observations (two passes, merged)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING (A3, F1) |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL before fixes (A1), PASS after |
| Plan Completeness | WARNING (F2, F6) |

## Grounding

All cited `main.py`, `models.py`, `transport.ts`, `gmailDraft.ts`, `transportPdf.ts` and `TransportPage.tsx` lines verified against 3915bab. The four SUP_BUKAT tests exist at `test_transport.py:446/583/728/958`.

## Findings — adversarial pass (A)

### A1 — A stale frontend against the new backend leaks Mory lines into the Pago e-mail

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM
- **Dimension**: Blind Spots
- **Location**: Phase 1 §4, §7; Notes (deploy window)
- **Detail**: Once the backend is live, an open tab with the old bundle calls `eligible?supplier_id=SUP_PAGO`, gets Mory orders with no label, combines them, and the old `buildTransportEmailBody` / Pago draft then list Mory lines to Pago.
- **Fix**: explicit client opt-in. `include_companions=true` on eligible and `allow_companions=true` on create, both default false (today's behaviour). Test: create without the flag still skips SUP_MORY as "different supplier".
- **Decision**: FIXED (plan Phase 1 §4, §7, §9; Critical Implementation Details)

### A2 — Remove-order and cancel release a prefilled Mory skeleton as a phantom order

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: `manager_transport_remove_order`, `manager_transport_cancel`
- **Detail**: Both cancel only a skeleton with NO lines. A prefilled skeleton (all lines 0) is released to `captain_submitted`; Mory is `manual`, so it can then be marked ordered with all zeros.
- **Fix**: manager-created-empty = `captain_user == "manager-default"` and no line with a positive effective qty (the finalize rule). Applies to every supplier. Tests for remove and cancel of a prefilled skeleton.
- **Decision**: FIXED (plan Phase 1 §9a)

### A3 — Finalize's empty guard is batch-wide

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: End-State Alignment
- **Location**: `manager_transport_finalize`
- **Detail**: All Pago columns 0 plus one positive Mory column finalizes a "Pago run" whose Pago documents are empty.
- **Fix**: 400 "nothing to send for {lead}" when no member of the lead supplier has a positive total. Test both mixes.
- **Decision**: FIXED (plan Phase 1 §9b)

### A4 — Pago-facing label and subject carry Mory-only locations

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: `transportAutoLabel` (`transport.ts:552-560`), Pago draft subject, Pago PDF number
- **Fix**: the Pago documents compute the label from `leadSupplierView(detail)` (lead orders' locations).
- **Decision**: FIXED (plan Phase 2 §2)

### A5 — A Mory member of a sent batch stays dispatchable / releasable from the queue

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Blind Spots
- **Location**: `_reject_if_locked_in_draft_transport`, `manager_release`, `manager_cancel`, `manager_dispatch`
- **Detail**: A member skipped at finalize ("send conflict") keeps `manager_claimed` and the marker. Mory is `manual`, so the queue can mark it ordered; release returns it to the Captain with a stale `TRN-` marker.
- **Fix**: dispatch 409s for any `TRN-`-marked order (release it first); release and cancel clear the marker when they pass the draft guard. Rejecting release too would strand the order, since remove-order needs a draft batch. Tests with a Mory member of a sent header.
- **Decision**: FIXED via the "clear marker on release/cancel, 409 on dispatch" variant (plan Phase 1 §9c)

### A6 — Row key collisions

- **Severity**: OBSERVATION
- **Fix**: add the invariant test "same product_id under two suppliers → two driver-doc rows in two sections"; sent-view keys become `${supplier}:${product_id}` (already in plan).
- **Decision**: FIXED (plan Phase 2 §5)

### A7 — Test fixture gaps

- **Severity**: OBSERVATION
- **Fix**: `_supplier()` gains `ordering_method` / `active`; add tests for remove and cancel of a Mory member, finalize mixes, the batch list under SUP_MORY with a Mory-only batch, and add-location on a Mory-lead batch.
- **Decision**: FIXED (plan Phase 1 §9)

### A8 — Page assumptions

- **Severity**: OBSERVATION
- **Fix**: `locationsNotInBatch` and `handleAddProductAll` per supplier (already in plan Phase 3 §1; kept).
- **Decision**: DISMISSED (already covered)

## Findings — standard pass (F)

### F1 — End-state line contradicts the draft design

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Fix**: a sent Pago batch and any non-Pago batch look as today; a Pago draft additionally shows the (possibly empty) Mory section.
- **Decision**: FIXED

### F2 — Driver text and driver PDF disagree on the empty-lead rule

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Fix**: one rule for both (the PDF rule), stated once in Critical Implementation Details.
- **Decision**: FIXED

### F3 — `supplier_id: ""` vs the frontend "missing" fallback

- **Severity**: OBSERVATION
- **Fix**: falsy fallback `line.supplier_id || detail.supplier_id`; test the `""` case.
- **Decision**: FIXED

### F4 — Backend-first deploy window not analysed

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM
- **Fix**: closed by A1 (opt-in flags); Notes updated; the Phase 5 live check starts with a hard refresh.
- **Decision**: FIXED

### F5 — A Mory-only Transport batch is a trap

- **Severity**: OBSERVATION
- **Fix**: hide companion suppliers (SUP_MORY) from the Transport supplier dropdown via a frontend mirror of the constant; recorded in "What We're NOT Doing".
- **Decision**: FIXED

### F6 — Missing exit tests for Mory members

- **Severity**: OBSERVATION
- **Fix**: cancel with a Mory member → released; remove-order on a Mory member; create with `append_to` + a Mory order → combined.
- **Decision**: FIXED (merged with A7)

### F7 — `suppliers` active filter vs membership

- **Severity**: OBSERVATION
- **Fix**: docstring: the `active` filter governs only the empty-section offer, not membership.
- **Decision**: FIXED

### F8 — `order_combined` event does not name a companion's supplier

- **Severity**: OBSERVATION
- **Fix**: append ` ({order.supplier_id})` when it differs from `req.supplier_id`; assert in the create test.
- **Decision**: FIXED
