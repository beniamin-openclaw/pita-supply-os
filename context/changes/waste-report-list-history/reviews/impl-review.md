<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: catalog list and integrated histories

- **Plan**: `context/changes/waste-report-list-history/plan.md`
- **Scope**: all3phases, local application plus approved schema prerequisite; no application release
- **Date**:2026-11-04
- **Verdict**: APPROVED
- **Findings**:0unresolved critical,0unresolved warnings,0unresolved observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS automated; human acceptance pending |

## Independent review

Two separate final reviewers inspected the delta from `d05a3f3` and relevant whole-branch contracts. Plan reviewer independently ran35tests/5files; safety reviewer20tests/3files. Both returned APPROVED after fixes; root ran the complete product suites and authenticated real-Postgres browser flows in `../verification.md`. No reviewer substituted code inspection for deployed-artifact evidence.

## Findings and decisions

### F1 — First input lost keyboard focus

- **Severity**: WARNING
- **Impact**: LOW — narrow render identity correction
- **Dimension**: Safety & Quality
- **Location**: `WasteReportPage.tsx` catalog card keys
- **Detail**: selecting a sparse placeholder changed its React key to a row index; real keyboard150 became1 and focus moved toBODY.
- **Fix**: stable product/occurrence keys before/after entry and when another product changes row indices.
- **Decision**: FIXED in `d955721`; regression red→green and actual keyboard150/INPUT verified.

### F2 — Selecting the current period erased the history

- **Severity**: WARNING
- **Impact**: LOW — narrowly force same-range reload
- **Dimension**: Safety & Quality
- **Location**: `WasteHistory.tsx` preset handler
- **Detail**: clearing results and setting unchanged dates did not retrigger the effect.
- **Fix**: explicitly reload when the chosen preset is already selected, retaining ordinary filter generation behavior.
- **Decision**: FIXED in `d955721`; red→green regression, independent check and repeatedToday browser check pass.

### F3 — Catalog failure displayed a restored standard row as Other with the wrong unit

- **Severity**: WARNING
- **Impact**: LOW — preserve unavailable metadata boundary
- **Dimension**: Safety & Quality
- **Location**: `WasteReportPage.tsx` fallback rendering
- **Detail**: before catalog metadata was available, a restored standard product could appear asOther/szt.
- **Fix**: keep the original draft untouched and do not render unavailable standard metadata as an invented Other conversion; save stays unavailable until catalog resolves.
- **Decision**: FIXED in `d955721`; focused catalog-failure regression passes.

## Contract and scope audit

All17visible catalog items, exact additive/manual input, fresh today/retained explicit dates, sparse selection and old duplicate/frozen drafts match intent. Existing timeout/idempotency/token/storage ownership guards are retained. Captain History owns waste history; Manager has an Inventory/Waste reports sibling segment. Presets/manual dates, scoped complete SQL totals/CSV, filter-generation checks, correction audit and download deadline are implemented. Optional AbortSignal preserves existing blob callers. Captain CSV reuses the bounded generator and forces token location; no new schema is introduced by the follow-up. No dependency, purchasing/inventory mutation, hidden per-tap server writes or signed-in Telegram access.

Ben separately approved the already planned migration0032. Actual schema readback resolves the merge prerequisite. No application merge/deploy/restart is inferred from that approval. Manual Progress rows remain unchecked; real operator/pilot acceptance is beyond preparation. Current source, commands/counts, screenshots and production boundaries are in the verification/merge handoff.
