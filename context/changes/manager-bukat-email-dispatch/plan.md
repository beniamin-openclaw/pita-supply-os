# Manager Bukat Email Dispatch (S-02) Implementation Plan

## Overview

Prove the Manager half of the Wola×Bukat round-trip end-to-end — queue → claim → edit/save → send-back → **email dispatch producing a ready-to-send Gmail draft in purchase units**, with per-line history recorded (PRD US-01, FR-006…FR-011). This is the roadmap **north star** (the terminal proof of the governing rule: one path from cooler to supplier).

Research (`research.md`) established that **the whole flow is already built and channel-aware, with no Bukat hardcodes** — so, like S-01, this is a *validation* slice, not a feature build. The work is: (1) one focused regression test closing the highest-value north-star gap (per-line history must survive dispatch), (2) a session-scoped `conftest.py` that makes the suite order-independent *and* unconditionally safe against the live sheet, (3) NOTE comments documenting the two parallel email-body builders, and (4) a manual sheet-mode smoke through the full chain that **backs out without sending — never a real Bukat order**.

## Current State Analysis

- **Backend dispatch is complete.** `POST /api/manager/dispatch` (`supply-os-v1/app/main.py:1157-1300`) branches on `supplier.ordering_method == EMAIL`, writes only `manager_final_*` + `manager_comment` back to `order_lines` (suggested/captain/reason columns are never in the `line_updates` dict → structurally preserved), gates `manager_claimed → manager_sent`, and is guarded by `OrderAlreadyDispatchedError` (`sheets.py:498-551`).
- **The Gmail draft renders purchase units.** `app/gmail_url.py:31-35` (`_effective_qty` = manager-final-else-captain, purchase units) + `:49-169` (Polish body, `supplier.email` recipient, 8000-char guard).
- **The frontend Manager flow is fully wired** (`frontend/src/pages/ManagerPage.tsx` + `pages/manager/*`): queue (3 status groups), claim, edit/save (read-modify-write contract honored), send-back, and dispatch via a client-built `<a href>` Gmail compose URL that opens the draft and persists `manager_sent` in one click. Channel-branched.
- **Two parallel email builders.** The operator's actual draft is built **client-side** by `frontend/src/pages/manager/lib/emailBody.ts:32-112`; the backend `gmail_url.py` URL is returned in the response but used only for a session-only "re-open" link. Undocumented divergence — same shape as S-09's `compute.ts`↔`suggestion.py`.
- **Tests: 217 pass on `main`, all Pago.** No Bukat fixture; no e2e `submit→claim→dispatch` chain; **per-line-history preservation on dispatch is untested** (`test_manager_dispatch.py:343` asserts only the manager fields written, not that captain/suggested survive). `tests/conftest.py` is **absent** — every file sets identical tokens via per-file `os.environ.setdefault` (the fragile order-dependent pattern `lessons.md:40-44` warns against). Confirmed: all 8 files use `WOLA:test_wola_token,KEN:test_ken_token` + `test_manager_token`; none set `SUPPLY_OS_DATA_BACKEND`.
- **Dispatch is sheet-mode only** — every manager write 503s in seed mode (`main.py` manager endpoints). The smoke needs the live-sheet `.env` (present locally from F-01/S-01). A sheet-mode `.env` left in place during pytest would make settings load `data_backend=sheet` against live creds — the reason F-01/S-01 needed a manual `mv .env .env.bak`.
- **F-01 set the master data this depends on:** `SUP_BUKAT` email `biuro@bukat.com`, `ordering_method=email`, `cutoff_time 16:00`.

## Desired End State

1. A regression test in `test_manager_dispatch.py` proves dispatch never overwrites the captain/suggested/reason history columns (FR-011 guardrail), and a manager-untouched line is left entirely alone.
2. `tests/conftest.py` sets auth tokens + a safe `seed` backend session-wide before any app import; the full suite (218) passes **regardless of file order or subset**, and passes **even with the sheet-mode `.env` present** (no live-sheet writes).
3. `gmail_url.py` and `emailBody.ts` each carry a short NOTE cross-referencing the other as a parallel email-body implementation that must be changed together.
4. A manual Wola×Bukat sheet-mode smoke has been run through the full chain (claim → edit/save → send-back → dispatch → verify the **frontend** Gmail draft) and **backed out cleanly** — draft closed unsent, test `orders`/`order_lines` rows deleted from the live sheet. No real Bukat order placed.
5. Roadmap S-02 ready to close via `/10x-archive`.

### Key Discoveries:

- Dispatch preserves history *structurally* (keys absent from `line_updates`), so the regression test asserts **key-absence** in the `update_order_lines` payload — robust regardless of fixture field values. (`main.py:1224-1244`)
- All test files share identical token strings and none set the backend → a session `conftest.py` is a no-op behavior change for the 217 existing tests, pure safety/robustness gain. (verified via grep)
- Pydantic settings precedence: env var > `.env` file. `conftest.py` setting `os.environ` before import overrides a sheet-mode `.env` → the suite becomes unconditionally live-sheet-safe. (`config.py`, summary gotcha)
- The smoke must verify the **frontend** `emailBody.ts` draft (what reaches Bukat), not the backend `gmail_url.py` URL. (`research.md` Open Question 2)

## What We're NOT Doing

- **Not unifying the two email builders** — decision: leave + NOTE only (avoids a real UI change / regression risk on the north star; tracked as future work).
- **Not adding a Bukat fixture, an e2e submit→claim→dispatch test, or units-edge-case tests** — only the single per-line-history regression test was chosen. (The other two gaps stay noted in research.)
- **Not removing the per-file `os.environ.setdefault` preambles** — `conftest.py` makes them redundant no-ops; deleting them is optional future cleanup, out of scope (keeps the diff minimal and the 217 tests untouched).
- **Not changing any dispatch/queue/claim/release/save endpoint, model, or the Gmail-URL logic** — the flow works; this slice validates it.
- **Not dispatching a real Bukat order** — the smoke stops at the un-sent Gmail draft and backs out (hard rule).
- **Not closing the roadmap item here** — `/10x-archive` owns that.

## Implementation Approach

Two phases. **Phase 1** is all code/tests, fully automated-verifiable (pytest + ruff + frontend type-check). **Phase 2** is the manual sheet-mode smoke (no diff). This mirrors the 10x pattern and keeps the safety-critical live-sheet exercise isolated behind a green automated gate.

## Critical Implementation Details

- **`conftest.py` must set env at module top, before any `app` import.** pytest imports `conftest.py` before collecting test modules, so settings load with auth + seed backend in place — this is the whole point (closes the `lessons.md:40-44` order-dependence). Use `os.environ.setdefault` so a developer who deliberately exports real env (e.g. to run against the sheet) is still respected.
- **Live-sheet safety via conftest.** Setting `SUPPLY_OS_DATA_BACKEND=seed` (via `setdefault`) neutralizes a sheet-mode `.env`. Verify by running the suite **without** moving `.env` aside and confirming green + zero live calls (the mocker-based dispatch tests patch `sheets.settings.data_backend` directly, so they're unaffected).
- **History-preservation assertion = key-absence.** Capture `update_order_lines.call_args`; assert each written line's payload dict contains exactly `{manager_final_qty_purchase, manager_final_qty_base, manager_comment}` and that a manager-untouched line does not appear in the payload at all.

## Phase 1: Test + safety hardening

### Overview

Add the per-line-history regression test, the session-scoped `conftest.py`, and the NOTE comments — everything verifiable by `pytest` + `ruff` + the frontend type-check.

### Changes Required:

#### 1. Session-scoped test settings

**File**: `supply-os-v1/tests/conftest.py` (new)

**Intent**: Set auth tokens + a safe `seed` data backend once, before any `app`/`config` import, so the suite is order-independent (closes `lessons.md:40-44`) and never touches the live sheet even with a sheet-mode `.env` present.

**Contract**: New `conftest.py` at the tests root. Sets, via `os.environ.setdefault` at module top: `SUPPLY_OS_CAPTAIN_TOKENS="WOLA:test_wola_token,KEN:test_ken_token"`, `SUPPLY_OS_MANAGER_TOKEN="test_manager_token"` (must match every existing file's values — verified identical), and `SUPPLY_OS_DATA_BACKEND="seed"`. No fixtures required. Existing per-file preambles stay (redundant no-ops).

#### 2. Per-line history-preservation regression test

**File**: `supply-os-v1/tests/test_manager_dispatch.py`

**Intent**: Prove dispatch records `manager_final_*` without ever overwriting the captain/suggested/reason history columns (FR-011: "every dispatched line stays inspectable"), and that a manager-untouched line is left entirely alone.

**Contract**: New test `test_dispatch_preserves_captain_and_suggested_history(mocker)` reusing `_activate_sheet_backend` + a `captain_submitted` order whose lines carry non-zero `suggested_qty_purchase`, `captain_final_qty_purchase`, `reason_code`, `captain_comment`. Dispatch overriding only line 1's `manager_final_qty_purchase`. Capture `mocks["update_order_lines"].call_args`; assert line 1's payload keys == `{manager_final_qty_purchase, manager_final_qty_base, manager_comment}` (no `suggested_*`/`captain_*`/`reason_code`/`delta_*`), and line 2 (no manager final sent) is absent from the payload.

#### 3. NOTE: two parallel email-body builders

**File**: `supply-os-v1/app/gmail_url.py` and `frontend/src/pages/manager/lib/emailBody.ts`

**Intent**: Document that the dispatch email body is built in two places that must be changed together — the frontend one is what the operator actually sends; the backend one populates the response `gmail_compose_url` (session-only re-open link). Prevents a future edit to one builder silently diverging from the other.

**Contract**: A short comment block at the top of each builder (above `build_draft_url` in `gmail_url.py`; above the subject/body builders in `emailBody.ts`) cross-referencing the other file by path, mirroring the S-09 NOTE style already in `frontend/src/pages/captain-mp/lib/compute.ts:7-11`. Comment-only; no behavior change.

### Success Criteria:

#### Automated Verification:

- Full backend suite passes (218 expected): `cd supply-os-v1 && python -m pytest`
- New test passes in isolation: `cd supply-os-v1 && python -m pytest tests/test_manager_dispatch.py::test_dispatch_preserves_captain_and_suggested_history`
- Order-independence proven: a 2-file subset that imports `app.config` via `app.sheets` first still passes, e.g. `cd supply-os-v1 && python -m pytest tests/test_sheets_read.py tests/test_manager_dispatch.py`
- Live-sheet safety: `cd supply-os-v1 && python -m pytest` passes **with `.env` present** (not moved aside) — conftest forces seed; no live calls
- Backend lint clean: `cd supply-os-v1 && ruff check .`
- Frontend type-check clean (NOTE compiles): `cd frontend && npx tsc -p tsconfig.app.json --noEmit`
- Frontend lint adds no NEW findings vs the S-01 baseline of 13 problems (8 errors, 5 warnings — react-hooks/set-state-in-effect, pre-existing): `cd frontend && npm run lint`

#### Manual Verification:

- Diff reviewed: NOTE comments are accurate and cross-reference the correct file paths

**Implementation Note**: After automated checks pass, pause for human confirmation of the diff review before Phase 2.

---

## Phase 2: Manual Wola×Bukat sheet-mode smoke

### Overview

Run the full Manager chain against the live sheet with Bukat, verify the operator's Gmail draft, and back out without sending. No code diff (manual-only phase).

### Changes Required:

_None — this phase is manual verification only. Prerequisite: `supply-os-v1/.env` in sheet mode (`SUPPLY_OS_DATA_BACKEND=sheet`, `sa.json`, live sheet id) + both tokens set; backend on `uvicorn`; frontend on Homebrew node (`PATH="/opt/homebrew/opt/node/bin:$PATH" npm run dev`) per the S-01 rollup gotcha._

### Success Criteria:

#### Manual Verification:

- Captain (`/captain-v2`, Bukat default) submits a Bukat order; it appears on the Manager queue (`/manager`)
- Manager claims it ("Przejmij") → status `manager_claimed`; edits one line qty/comment and saves (stays `manager_claimed`)
- Send-back ("Odrzuć do poprawy") with a reason returns it to the captain, who resubmits (full-chain leg)
- Dispatch opens the **frontend** Gmail draft; verified: recipient = `biuro@bukat.com`, each line shows the correct **purchase-unit** quantity + Polish unit label, total in Polish comma (`XXX,XX zl`), delivery date or `do potwierdzenia`, Wola delivery address
- Backed out cleanly: Gmail draft closed **unsent**; the test `orders` row (`ORD-…-BUKA-…`) and its `order_lines` rows deleted from the live sheet — **no real Bukat order placed**

**Implementation Note**: This phase produces no commit (manual-only). Its Progress rows stay SHA-less; `/10x-archive` surfaces that as an informational warning, which is expected.

---

## Testing Strategy

### Unit Tests:

- Per-line history preservation on dispatch (the new test) — key-absence in the `update_order_lines` payload + untouched-line absence.
- Existing 217 tests must remain green and become order-independent (conftest).

### Integration Tests:

- None added in code. The end-to-end submit→claim→dispatch path is exercised by the manual smoke (Phase 2), not an automated e2e test (explicitly out of scope per the chosen scope).

### Manual Testing Steps:

1. Start backend (sheet mode) + frontend (Homebrew node). Confirm `/captain-v2` defaults to Bukat.
2. Submit a Bukat order as Captain; confirm it lands on `/manager`.
3. Claim → edit a line + save → send-back with reason → captain resubmits.
4. Claim again → dispatch → inspect the opened Gmail draft against the FR-010 content checklist above. **Do not click Send.**
5. Back out: close the draft; delete the `orders` + `order_lines` rows for the test order from the live sheet.

## Migration Notes

No data-model or schema change. No migration. `conftest.py` is additive; existing per-file env preambles remain as harmless no-ops.

## References

- Related research: `context/changes/manager-bukat-email-dispatch/research.md`
- Roadmap S-02: `context/foundation/roadmap.md:94-104`
- Prior slice (smoke + back-out pattern): `context/archive/2026-06-05-captain-bukat-submit/plan.md`
- NOTE-comment precedent (S-09 divergence): `frontend/src/pages/captain-mp/lib/compute.ts:7-11`
- Order-independence rule: `context/foundation/lessons.md:40-45`
- Dispatch endpoint: `supply-os-v1/app/main.py:1157-1300`; Gmail builder: `supply-os-v1/app/gmail_url.py`; frontend builder: `frontend/src/pages/manager/lib/emailBody.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Test + safety hardening

#### Automated

- [x] 1.1 Full backend suite passes (218 expected): `python -m pytest` — c7ab1d4
- [x] 1.2 New history-preservation test passes in isolation — c7ab1d4
- [x] 1.3 Order-independence proven via a 2-file subset run — c7ab1d4
- [x] 1.4 Live-sheet safety: suite passes with sheet-mode `.env` present — c7ab1d4
- [x] 1.5 Backend lint clean: `ruff check .` — c7ab1d4
- [x] 1.6 Frontend type-check clean: `npx tsc -p tsconfig.app.json --noEmit` — c7ab1d4
- [x] 1.7 Frontend lint adds no new findings vs S-01 baseline: `npm run lint` — c7ab1d4

#### Manual

- [x] 1.8 Diff reviewed: NOTE comments accurate and cross-referenced — c7ab1d4

### Phase 2: Manual Wola×Bukat sheet-mode smoke

#### Manual

- [x] 2.1 Captain submits a Bukat order; it appears on the Manager queue
- [x] 2.2 Manager claims; edits a line + saves (stays manager_claimed)
- [x] 2.3 Send-back with reason → captain resubmits
- [x] 2.4 Dispatch opens the frontend Gmail draft; content verified (recipient/purchase-units/PL total/address/date)
- [x] 2.5 Backed out cleanly: draft closed unsent + order/order_lines rows deleted; no real Bukat order placed
