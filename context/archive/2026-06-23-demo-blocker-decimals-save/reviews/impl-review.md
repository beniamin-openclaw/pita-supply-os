<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Decimal-comma inputs + receipt-edit save loss (P0 demo blockers)

- **Plan**: context/changes/demo-blocker-decimals-save/plan.md
- **Scope**: Phases 1–2 of 2 (full plan)
- **Date**: 2026-06-23
- **Verdict**: APPROVED (all findings fixed during triage)
- **Findings**: 0 critical · 1 warning · 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | WARNING → resolved (F1 fixed) |
| Pattern Consistency | PASS |
| Success Criteria | PASS (automated 66 tests / build / lint green; manual = owner-on-deploy) |

## Evidence

Two parallel sub-agents (plan-drift + safety/quality/pattern) reviewed all 10 changed files.
Plan-drift: all files MATCH — no drift, no missing items, no scope creep; the DecimalInput
"adjust-state-during-render" external-sync guard independently confirmed correct (mid-type "0,"
survives the value echo; genuine autofill reseeds). Safety: receipt readOnly lock correctly
prevents the silent-loss without blocking photo-retry or first submit; i18n key well-formed;
no hardcoded strings; `{...rest}` spreads all props to the DOM.

## Findings

### F1 — DecimalInput + number.ts shared with Manager but housed under captain-mp/

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: OrderLineTable.tsx:28 (cross-feature import of ../captain-mp/components/DecimalInput)
- **Detail**: DecimalInput became feature-agnostic (Captain + Manager) but lived under captain-mp/;
  the Manager table imported across features. A shared `src/components/ui/` dir already exists.
- **Fix**: Move DecimalInput.tsx + number.ts (+ number.test.ts) to `src/components/ui/`; update the
  4 consumer imports.
- **Decision**: FIXED — `git mv` to `frontend/src/components/ui/` (history preserved); imports
  updated in ProductCard, ReceiptLineCard, InventoryCountPage, OrderLineTable; DecimalInput now
  imports `./number`. Build/lint/test green.

### F2 — parseDecimal accepted scientific notation ("1e5" → 100000)

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: number.ts:25-26
- **Detail**: Strict `Number()` still accepts "1e5"; a quantity field shouldn't silently submit 100k.
  Near-zero risk on the mobile decimal keyboard (no `e` key), but possible on desktop/paste.
- **Fix**: Reject `/[eE]/` before `Number()`.
- **Decision**: FIXED — guard added in parseDecimal; tests cover "1e5"/"2E3" → null.

### F3 — Invalid mid-type ("abc") kept last good value with no visual cue

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: DecimalInput.tsx:67-69
- **Detail**: Documented behavior (keep raw, don't emit), but the field could show unparseable text
  while the parent held a number, with no error cue.
- **Fix**: Red ring when raw is non-blank and unparseable.
- **Decision**: FIXED — DecimalInput composes a `ring-2 ring-red-400` on invalid raw (uses `ring`,
  not border-color, so it never fights the parent's border classes; aria-invalid stays the parent's).

## Triage Summary

- **Fixed**: F1 (move to src/components/ui/), F2 (sci-notation guard), F3 (invalid-input ring).
- **Verdict after fixes**: APPROVED — ready to deploy.
