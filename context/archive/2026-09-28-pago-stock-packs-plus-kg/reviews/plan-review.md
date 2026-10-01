<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Stock input as packs + loose base units

- **Plan**: context/changes/pago-stock-packs-plus-kg/plan.md
- **Mode**: Deep
- **Date**: 2026-09-28
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 1 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL (fixed) |

## Grounding
8/8 paths ✓, 5/5 symbols ✓ (only the callers the plan names), brief↔plan ✓. Nested DecimalInput re-seed verified for type-with-echo, one-tap fix and external re-seed (review agent, `DecimalInput.tsx:57-65`).

## Findings

### F1 — Phase 1 cleanup breaks the build

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §3
- **Detail**: Phase 1 removed `packUnitLocative` and the `loc` forms while `ProductCard.tsx:22,418` still imports/calls it and `lib/packUnits.test.ts:140` asserts `loc`; Phase 1's own criterion is `npm run build` (tsc -b) passing.
- **Fix**: Move the cleanup into Phase 2 after the ProductCard rewrite.
- **Decision**: FIXED

### F2 — Prompt flashes while typing

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 §1 (PackStockInput prompt)
- **Detail**: The rule is evaluated live; typing "60" kg passes through "6", so the amber block appears then disappears (layout shift on a phone). Nothing in the plan or DecimalInput (no onBlur prop) prevents it.
- **Fix**: Track focus with onFocus/onBlur on the wrapper (events bubble) and show the prompt only when focus is outside the component; tests use fireEvent.blur.
- **Decision**: FIXED

### F3 — False positives on piece products

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 §1 (`suggestPackCount`)
- **Detail**: For Coca-Cola (szt, zgrzewka 24, target ≥ 48) any loose count of 1–23 cans passes the rule, so a normal "5 puszek" asks "Czy chodziło o 5 zgrzewek?" on every count. The observed mistake is on kg/opak products.
- **Fix**: Exclude base unit "szt" from the prompt (input and reading stay generic). Confirm with the operator at the plan STOP.
- **Decision**: DISMISSED by operator at STOP (ask everywhere, szt included)

### F4 — Below-min pack wording never shows on Pago

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: End-State Alignment
- **Location**: Phase 2 §2
- **Detail**: `belowMin` is hidden when `suggestion_alerts_enabled === false` (`ProductCard.tsx:92-96`), which is Pago's setting.
- **Fix**: Keep the key for other pack-based suppliers; noted in the plan.
- **Decision**: FIXED (note)

### F5 — Newest snapshot may never load

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 2 §3
- **Detail**: If the Captain switches the snapshot picker before the newest detail resolves, the `cancelled` flag drops it (`CaptainMP.tsx:189-190`) and it is not re-fetched.
- **Fix**: Accept; cards fall back to the target reference. Noted in the plan.
- **Decision**: ACCEPTED

### F6 — All three ×24 ProductCard tests need rewriting

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §4
- **Detail**: `ProductCard.test.tsx:73-103` assert `current-unit-P1`, `getByLabelText("Obecny stan")` and the toggle; new ids/labels make them obsolete.
- **Fix**: State explicitly in the plan.
- **Decision**: FIXED
