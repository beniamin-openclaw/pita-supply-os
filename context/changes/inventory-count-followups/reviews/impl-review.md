<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Inventory-Count Follow-ups (FR-020…024)

- **Plan**: context/changes/inventory-count-followups/plan.md
- **Scope**: Full plan (Phases 1–5)
- **Date**: 2026-06-09
- **Verdict**: APPROVED (after F2 fix)
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS (after F2 fix) |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Automated (re-run at review): backend `pytest` 256 passed · `ruff` clean · frontend `npm run build` green · `npm run lint` clean.
Drift: negligible — all 5 phases implemented as planned; the two approved adaptations (always-available control supersedes the dismissable banner per FR-023; added Clear action) are correctly handled. Manual gates 1.4/1.5, 2.5/2.7, 3.3/3.4, 4.3/4.4/4.5 remain deploy-gated by design (sheet-mode/curl); 5.3/5.4 e2e-verified.

## Findings

### F2 — List route lacks WorksheetNotFound catch → raw 500

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality / Reliability
- **Location**: supply-os-v1/app/main.py — captain_inventory_counts
- **Detail**: The Phase 3 list route called `backend.load_inventory_counts()` with no `WorksheetNotFound` catch; a missing `inventory_counts` tab in sheet mode would raise a raw 500, while the sibling detail/submit routes degrade gracefully.
- **Fix**: Wrapped the load in `try/except sheets.WorksheetNotFound: return []` (empty picker = same degraded state as seed mode) + regression test `test_counts_worksheet_not_found_empty`.
- **Decision**: FIXED (this review)

### F1 — captain_inventory_products bypasses _choose_backend()

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture / Hard Rule
- **Location**: supply-os-v1/app/main.py — captain_inventory_products (and siblings captain_orderable, /api/products|suppliers|locations)
- **Detail**: Reads master data via `seed_loader.load_*` directly, bypassing `_choose_backend()`. PRE-EXISTING (added in S-06, not this change's diff) and shared by several read routes, while the submit path reads master data via the chosen backend — a latent inconsistency: in sheet mode the orderable/inventory-products VIEWS would show seed CSV master data, not the sheet.
- **Fix**: Out of scope for this change (not in the diff; broad blast radius; intended behavior needs owner confirmation — master data may be deliberately seed-sourced). Flagged as a background follow-up task.
- **Decision**: SKIPPED (out of scope) → spawned follow-up

### F3 — ConfirmPrefillDialog missing focus-trap / scroll-lock

- **Severity**: 🟢 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/captain-mp/components/ConfirmPrefillDialog.tsx
- **Detail**: Lacks focus-trap, focus-restore on close, and body-scroll lock that ConfirmSubmitDialog has. It DOES mirror its stated target (InventoryCountPage's ConfirmApproveDialog), which also lacks these — so it is consistent with the F4-mandated pattern. Not a blocker for the mobile pilot.
- **Fix**: Defer — desktop a11y hardening across both dialogs, post-pilot.
- **Decision**: SKIPPED (consistent with mirror; mobile pilot)

### F4 — Error-fallback sentinel count_date: ""

- **Severity**: 🟢 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Reliability
- **Location**: frontend/src/pages/captain-mp/CaptainMP.tsx — lazy-detail effect error path
- **Detail**: The cached error sentinel sets `count_date: ""` (not a valid ISO date). Harmless in practice: the snapshot DETAIL is consumed only for `.lines`; date/who for the banner + confirm come from the summary, so the sentinel's `count_date` is never rendered or passed to `formatDateTime`.
- **Fix**: None — accepted; documented here so a future reader who starts rendering `detail.count_date` knows to revisit.
- **Decision**: ACCEPTED (harmless)

## Dead copy (cleanup observation, not a finding)
- `captain.prefillBannerTitle` / `prefillBannerAccept` / `prefillBannerSkip` in strings.ts are orphaned S-07 keys (the Phase 4 refactor replaced that banner). No references remain; safe to delete in a future cleanup.
