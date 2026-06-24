<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: UX Quick-Wins Round 1

- **Plan**: context/changes/ux-quick-wins-r1/plan.md
- **Scope**: Full plan (Phases 1–5)
- **Date**: 2026-06-24
- **Verdict**: NEEDS ATTENTION (no CRITICAL; 1 WARNING + 5 OBSERVATIONS) → all fixed → APPROVED
- **Findings**: 0 critical, 1 warning, 5 observations

## Verdicts (pre-fix)

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING (1 benign DRIFT) |
| Scope Discipline | PASS |
| Safety & Quality | WARNING (1 defense-in-depth data-safety) |
| Architecture | PASS |
| Pattern Consistency | PASS (i18n compliance confirmed; Tailwind JIT-safe) |
| Success Criteria | PASS (BE ruff+pytest 392; FE build+lint+test 77) |

Confirmed-correct (no action): isSubmitting sequencing (early-return precedes
`setIsSubmitting(true)`), `handleSubmit` useCallback deps complete, photo-retry path
correctly bypasses the recount gate, no-baseline routing edge cases (final=0 → green),
`deviationPct: null` has no downstream consumer, 25% gate/badge asymmetry intentional &
tested, backend change is threshold-only (seam/auth/order_lines/suggestion math untouched).

## Findings

### F1 — Silent `? 0` fallback on a "guaranteed non-blank" receipt line

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx (payload build)
- **Detail**: The recount gate guarantees no blank line reaches the payload, but the map
  still has `v === "" || v === undefined ? 0 : Number(v)`. If a future edit removed the
  gate, a blank would silently submit `received_qty_purchase: 0` — recording a false
  full short-delivery. The "guaranteed non-blank" comment is aspirational, not enforced.
- **Fix**: Replace the `0` fallback with a loud throw (caught by the existing try/catch →
  error toast) so the invariant is enforced rather than silently mis-recorded.
- **Decision**: FIXED.

### F2 — Phase 2 shared `formatDeviationPct` helper not created (inline guards used)

- **Severity**: 🟦 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Detail**: Plan Phase 2 change #1 specified a reusable `formatDeviationPct(delta,
  suggested)` helper; the implementation inlines a `suggested_qty_purchase === 0` guard at
  each of the three sites. Functionally equivalent and the plan-review already concluded
  inline guards are simpler/lower-risk (plan-review F1). Extracting a helper for a `=== 0`
  check would be over-abstraction.
- **Fix**: Align the plan text (source of truth) to the inline-guard approach; no code
  change. (Resolves the drift by making plan and code agree, per the plan-review verdict.)
- **Decision**: FIXED (plan aligned).

### F3 — Stale `>= 0.20` comment on `ManagerQueueItem.deviation_count`

- **Severity**: 🟦 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency (docs)
- **Location**: supply-os-v1/app/models.py:241
- **Detail**: Comment still reads `>= 0.20`; the badge threshold is now 0.25. Phase 1's
  "update the >20% wording in docstrings/comments" intent missed this file.
- **Fix**: `>= 0.20` → `>= 0.25`.
- **Decision**: FIXED.

### F4 — Stale `>20% gate` docstring in `rounding_step`

- **Severity**: 🟦 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency (docs)
- **Location**: supply-os-v1/app/suggestion.py:82
- **Detail**: `rounding_step` docstring references the old `>20% gate`. Same missed
  Phase-1 wording sweep.
- **Fix**: `>20% gate` → `>25% gate`.
- **Decision**: FIXED.

### F5 — Stale `>20%` comments in `compute.test.ts`

- **Severity**: 🟦 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency (docs)
- **Location**: frontend/src/pages/captain-mp/lib/compute.test.ts:81, :148
- **Detail**: Two descriptive comments still say `>20%`; the assertions exercise 90%/100%
  deviations so they pass, but the prose is stale.
- **Fix**: Update both comment strings to `>25%`.
- **Decision**: FIXED.

### F6 — "= zamówione" shortcut button lacks a per-product aria-label

- **Severity**: 🟦 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency (a11y)
- **Location**: frontend/src/pages/captain-mp/components/ReceiptLineCard.tsx
- **Detail**: In a list of identical "= zamówione" buttons, a screen reader can't tell
  which product each targets (the delivered input already has a per-product aria-label).
- **Fix**: Add `aria-label={`${t("delivery.useOrderedQty")} — ${line.product_name_pl}`}`.
- **Decision**: FIXED.
