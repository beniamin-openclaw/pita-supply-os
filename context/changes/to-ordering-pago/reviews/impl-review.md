<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Manager Transport (Pago)

- **Plan**: context/changes/to-ordering-pago/plan.md
- **Scope**: Full plan (Phases 1–3)
- **Date**: 2026-08-22
- **Verdict**: APPROVED (after fixes — every finding fixed or documented in this session)
- **Findings**: 1 critical, 2 warnings, 3 observations — all resolved

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS (drift agent: 19/19 MATCH, zero DRIFT/MISSING/EXTRA) |
| Scope Discipline | PASS (touches exactly the planned files; stray empty `prod-sql/` dir removed) |
| Safety & Quality | PASS after fixes (F1, F2 fixed; F5 documented-accepted) |
| Architecture | PASS (marker design implemented as planned; no seam violations) |
| Pattern Consistency | PASS after fixes (F3, F4 fixed; F6 documented-deliberate) |
| Success Criteria | PASS (backend ruff clean + 567 passed; FE 101 tests + build + lint green) |

## Review process

Two parallel Opus subagents (plan-drift; safety/quality/patterns) over the transport-only working-tree diff, plus fresh success-criteria runs by the orchestrator. The unrelated `multi-location-master-data` working-tree changes were explicitly excluded.

## Findings

### F1 — Supplier picker never reloads eligible/batches on change

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (FE state bug)
- **Location**: frontend/src/pages/manager/TransportPage.tsx:253
- **Detail**: `<select>` called `setSupplierId` only, never `selectSupplier` — after switching supplier the lists silently kept the previous supplier's data while create posted against the new supplier.
- **Fix**: `onChange` now calls `selectSupplier(e.target.value)` (which also clears the selection via `loadEligible`).
- **Decision**: FIXED

### F2 — Unexpected exception mid-create-loop aborts after partial writes

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (reliability)
- **Location**: supply-os-v1/app/main.py (manager_transport_create loop)
- **Detail**: Only the two guard exceptions were caught; any other backend error (APIError, OrderNotFoundError, ConfigDriftError) 500'd the request after earlier orders were already durably combined, hiding both the partial result and the transport_id.
- **Fix**: Broad `except Exception` per write → `log.exception` + `skipped[]` reason "backend error"; release-back extracted to `_release_claim_best_effort` (never raises). Regression test added: `test_create_unexpected_error_degrades_to_skipped_backend_error` (asserts ORD-OK combined, ORD-BOOM skipped + released, exact call sequence).
- **Decision**: FIXED (backend suite now 567)

### F3 — New TS optional fields dropped `| null`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/types.ts (Transport* + supplier_order_reference)
- **Detail**: FastAPI serializes Optional as JSON `null` (key always present); repo convention is `field?: T | null`. New fields used bare `?: T`.
- **Fix**: `| null` added to every new optional field; two pre-existing `total_value_estimate_pln?: number` / one `captain_submitted_at?: string` on the captain list/detail interfaces were aligned to the same convention in passing (same finding class, backend is Optional there too; widening is type-safe and build stays green).
- **Decision**: FIXED

### F4 — Driver-matrix sums skipped `roundQty`

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/manager/TransportPage.tsx (matrix useMemo)
- **Detail**: Client-side float sum displayed raw — could show `2.1000000000000005` in the copy-accurate driver matrix; every sibling sum routes through `roundQty`.
- **Fix**: Sum wrapped in `roundQty(...)`; import added.
- **Decision**: FIXED

### F5 — No backend record of whether the Transport email was actually sent

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🔎 MEDIUM
- **Dimension**: Safety & Quality
- **Location**: transport.ts / manager_transport_create
- **Detail**: `sent_method="transport"` is stamped at combine time regardless of the email button; the Gmail draft is client-only.
- **Decision**: ACCEPTED (documented) — intentional scope: a Transport batch is a pickup run, not an email-channel dispatch; this mirrors the existing FE-owned Gmail URL model, and the plan's email is an output artifact, not the state transition. Revisit if the operator wants a "sent to supplier" audit stamp (would be a small `update_order` follow-up).

### F6 — `eligible` endpoint uncapped, unlike sibling routes

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: supply-os-v1/app/main.py (manager_transport_eligible)
- **Detail**: `manager_queue`/`batches` clamp with `limit`; eligible returns everything.
- **Decision**: DOCUMENTED-DELIBERATE — the eligible set is self-draining AND must be complete for combine correctness (a hidden order would be silently left out of a batch); rationale added to the route docstring.

## Post-fix verification (round 2)

- Backend: `ruff check .` clean; `python3 -m pytest` → **567 passed**, 16 deselected (integration).
- Frontend: `npm run test` → **101 passed** (11 files); `npm run build` green (TS strict); `npm run lint` clean.
- Convergence per 10x-autonomous-workflow Phase 5: no CRITICAL or WARNING outstanding; every OBSERVATION fixed or documented above. Residual notes from the drift agent (empty `prod-sql/` dir — removed; inert optional `cc` param on `buildTransportGmailUrl` — harmless, kept for the existing global-CC follow-up) are recorded here as addressed.

---

# v2 review round (2026-08-22) — draft workstation extension

Two Opus subagents (drift + safety) over the v2 working-tree diff, plus an orchestrator-found gap.

## Verdict: APPROVED after fixes

- **Drift**: MATCH on all 8 ADDENDUM v2 design decisions and Phase 4/5 items; only notes were 4 dead i18n keys (removed) and stale checklist ticks (fixed).
- **G1 (orchestrator-found, functional gap)**: create required ≥1 order — with zero Pago orders on prod the manager could never start. FIXED: empty-draft contract (order_ids may be [], header always written for a new batch, header-only batches now listed and served in detail; FE "Utwórz pusty transport" button). Tests: empty-create, header-only list/detail.
- **F1 CRITICAL (safety)**: draft members (manager_claimed) were dispatchable/releasable/cancellable from the ordinary queue, bypassing the batch lifecycle and stranding markers. FIXED: `_reject_if_locked_in_draft_transport` gate (409) in manager_dispatch/release/cancel — draft members exit only via finalize/remove-order; legacy marker-without-header unaffected. Tests: 3 lock tests + 1 legacy-pass test.
- **F2 WARNING**: batch status gates read a TTL-cached header (Sheets) without invalidation. FIXED: `invalidate_cache("transport_batches")` before every status-gated header read (finalize/add-location/remove-order/patch/append_to + the lock gate).
- **F3 WARNING**: unsaved matrix edits silently discarded on batch/supplier switch; a doc comment falsely claimed a navigate-away guard. FIXED: window.confirm guard on both switches; comment corrected. (Browser tab close still loses edits — accepted, matches the rest of the app.)
- **F4 OBSERVATION**: manager-created skeleton orders appear in that location's Captain list. ACCEPTED — transparency is desirable (the captain sees a manager order exists for their location); recorded here.
- **F5 OBSERVATION**: LogisticsPanel local state could desync if the backend ever normalized fields asymmetrically. ACCEPTED — current save path trims symmetrically; noted.

## Post-fix verification

Backend: ruff clean; pytest **525 passed** (85 transport tests). Frontend: **116 passed**, build (TS strict) green, lint clean.
