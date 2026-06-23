<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Decimal-comma inputs + receipt-edit save loss (P0 demo blockers)

- **Plan**: context/changes/demo-blocker-decimals-save/plan.md
- **Mode**: Deep
- **Date**: 2026-06-23
- **Verdict**: REVISE (all findings applied → SOUND)
- **Findings**: 1 critical · 2 warnings · 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

7/7 existing paths ✓, 2/2 new-paths-absent ✓, contract-surfaces.md absent (surface check skipped), brief↔plan ✓, blast radius contained (buildPayloadLines→CaptainMP/OrderEditPage; ReceiptLineCard→ReceiveDeliveryPage only; compute→Captain only). Manager blast-radius sweep surfaced OrderLineTable.tsx:198-214 (F2).

## Findings

### F1 — Phase-body Success Criteria use [ ] checkboxes (double state source)

- **Severity**: ❌ CRITICAL (mechanical contract)
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 & 2 — "#### Automated/Manual Verification:" blocks
- **Detail**: Phase bodies listed criteria as `- [ ]` AND repeated them in `## Progress`. The format contract (and the repo's archived plans, e.g. context/archive/2026-06-17-order-cancel-with-trace/plan.md) keep checkboxes ONLY in `## Progress`; phase blocks use plain `- ` bullets. Two checkbox sources can desync SHA write-back / completion counting in /10x-implement.
- **Fix**: Convert phase-body Success Criteria `- [ ]` → plain `- ` bullets; Progress stays the single checkbox source.
- **Decision**: FIXED (plain bullets in both phases)

### F2 — Manager qty input has the identical comma bug, scoped out

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: "What We're NOT Doing" vs OrderLineTable.tsx:198-214
- **Detail**: The Manager's editable qty input is `type="number"` + `Number(e.target.value)` (OrderLineTable.tsx:199,211) — same bug. A manager typing "0,6" → `NaN` → `Number.isFinite(raw)&&raw>0 ? raw : 0` → silently 0. The owner acts as manager in the live demo. DecimalInput is reusable → one extra swap.
- **Fix A ⭐ Recommended**: Add OrderLineTable to the Phase 1 DecimalInput swap (5th site).
  - Strength: Closes the same bug class in one cheap edit; component already built.
  - Tradeoff: Widens P0 scope by one file + one manual check.
  - Confidence: HIGH — grounded at :199/:211.
  - Blind spot: managerQty clamp logic — verify decimals flow.
- **Fix B**: Keep manager out, log it as a known live-demo gap.
- **Decision**: FIXED (Fix A — OrderLineTable added as 5th swap; Overview/Current State/Discoveries/End State/Phase 1 #3/criteria/Progress/References + brief updated)

### F3 — Suggestion/variance still render "1.4" (dot), not "1,4"

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Desired End State ("suggestion 1,4 … renders") vs ProductCard render
- **Detail**: Plan fixes decimal INPUT but displayed numbers still stringify with a dot — the owner's "powinno się pojawić 1,4" gets "1.4". Functionally unblocked, but a Polish-locale UI showing "1.4" may draw another feedback round.
- **Fix A ⭐ Recommended**: Scope display-formatting OUT explicitly + note as fast follow-up.
  - Strength: Keeps P0 tight on the ordering blocker; input fix is what unbreaks it.
  - Tradeoff: "1.4" vs "1,4" stays until a follow-up.
  - Confidence: HIGH.
  - Blind spot: Owner's tolerance for dot-display unknown.
- **Fix B**: Add a small formatNumber(comma) to the 2-3 display sites now.
- **Decision**: FIXED (Fix A — added to What We're NOT Doing + End State note + brief out-of-scope)

### F4 — parseDecimal example wrong; Number-vs-parseFloat + step-on-text unspecified

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 #1 (parseDecimal contract) + #3 (step)
- **Detail**: `parseDecimal("0,")` → "0." → `Number("0.")===0` (finite), so it returns 0 (the wanted mid-type behavior), not null as the plan stated. Contract didn't pin Number() vs parseFloat() (differ on "1.5abc"/"1 234"), and noted preserving `step` — a no-op on `type="text"`.
- **Fix**: Correct the example to "0,"→0, specify strict Number(), drop the step-preservation note (keep inputMode only).
- **Decision**: FIXED (parseDecimal contract + ProductCard step note corrected)

## Triage Summary

- **Fixed**: F1, F2 (Fix A), F3 (Fix A), F4 — all four applied to plan.md + plan-brief.md.
- **Verdict after fixes**: REVISE → **SOUND**.
