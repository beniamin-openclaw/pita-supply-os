<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Manager Queue Filters (S-05)

- **Plan**: context/changes/manager-queue-filters/plan.md
- **Mode**: Deep
- **Date**: 2026-06-07
- **Verdict**: REVISE → SOUND (after triage)
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

4/4 paths ✓ (ManagerPage.tsx, manager/ManagerQueue.tsx, i18n/strings.ts, captain-mp/components/ReasonPicker.tsx), 3/3 symbols ✓ (`selectedCutoffIso` @ ManagerPage.tsx:269, `const groups` @ ManagerQueue.tsx:36, `ManagerQueueItem` carries supplier_id:200 / supplier_name:201 / location_id:199 / status:204 — client-side filter feasible), `docs/reference/contract-surfaces.md` absent → surface check skipped, brief↔plan ✓. Risky claims already verified by the fresh 3-agent research + this grounding grep, so the deep-mode sub-agent was skipped as redundant.

## Findings

### F1 — Progress missing a row for the 5th manual criterion

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Manual Verification vs Progress
- **Detail**: Phase 1 listed 5 Manual Verification bullets but Progress had only 4 manual rows (1.4–1.7); the 5th ("no regression to the 60s auto-refresh / unsaved-edit guards") had no Progress mirror.
- **Fix**: Add Progress row `1.8 No regression to 60s auto-refresh + unsaved-edit guards`.
- **Decision**: FIXED

### F2 — `npm run build` (1.3) fails locally on the Codex-node rollup

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — automated criterion 1.3
- **Detail**: `npm run build` (= tsc + vite/rollup) dies with ERR_DLOPEN under the default Codex-bundled node (S-01/S-02 gotcha); only Homebrew node or Vercel builds it. As written the implementer hits a confusing failure.
- **Fix**: Pin 1.3 to Homebrew node (`PATH="/opt/homebrew/opt/node/bin:$PATH" npm run build`); note Vercel verifies the bundle.
- **Decision**: FIXED

### F3 — Selected supplier can fall out of the derived options

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — ManagerPage change #4
- **Detail**: Supplier options derive from the union of the 3 fetched arrays; after a 60s refresh that removed the filtered supplier's last order, `filterSupplierId` points at an absent option → `<select value=x>` renders unset + empty queue.
- **Fix**: When `filterSupplierId` isn't among the current `supplierOptions`, reset it to `null` (show all). Added to the ManagerPage change contract.
- **Decision**: FIXED

## Triage Summary

- Fixed: F1, F2, F3 (3)
- Verdict after fixes: **SOUND** — plan conforms to the progress-format contract, the local-build gotcha is pinned to Homebrew node, and the supplier-options edge is guarded. Substance (client-side filter approach, supplier+status scope, keep-detail, ephemeral) was already sound and grounded against the live code.
