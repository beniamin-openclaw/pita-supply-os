# S-01 Captain submits a Bukat order — Implementation Plan

## Overview

Make the live Captain pilot flow (`/captain-v2` → `CaptainMP.tsx`) **default to Bukat** so a Wola captain lands on a populated Bukat order screen and can complete a stock-based submit end-to-end. Today the screen auto-selects `suppliers[0]` (= `SUP_BLUESERV`, which has 0 orderable lines at Wola), dropping the captain on an empty "Brak produktów" view. This is the single real gap for S-01 — backend, master data, and the submit path are already Bukat-ready (F-01, archived 2026-06-05). Validation is a manual sheet-mode smoke (submit-and-back-out, never a real dispatch).

## Current State Analysis

- **Live pilot route**: `/captain-v2` → `CaptainMP.tsx`; `/` redirects there (`frontend/src/App.tsx:40,50-55`). The legacy `/captain` (CaptainPage) and unlinked `/debug` pages still hardcode `SUP_PAGO` but are NOT on the pilot path.
- **The gap**: `CaptainMP.tsx:77-81` runs `setActiveSupplierId(suppliers[0].supplier_id)`. `/api/suppliers` returns an unsorted raw CSV read (`supply-os-v1/app/main.py:96-97`, `seed_loader.py`), so index 0 is `SUP_BLUESERV` — verified 0 orderable lines at Wola; Bukat (index 1) has 14.
- **Backend is supplier-agnostic**: `captain_orderable` (`main.py:132-151`) and `captain_submit` (`main.py:279-435`) key off `supplier_id`; no supplier is special-cased. Bukat validates/persists identically to Pago.
- **Data is ready (F-01)**: `SUP_BUKAT` active + email + cutoff; 14 `supplier_products`; 14/14 Wola `location_product_settings` → 14 orderable lines.
- **Persistence boundary**: `_choose_backend()` (`main.py:193-202`) returns `seed_loader` unless `DATA_BACKEND=sheet`. In **seed mode the submit is in-memory only** (warning returned) and the Manager queue returns `[]` (`main.py:528-554`). "Appears on the Manager queue" therefore requires **sheet mode**.
- **Visible math (Tier-1)**: rendered FE-side in `compute.ts:7-14` (always `Math.ceil` → full_only); the backend recomputes authoritatively per `rounding_rule` (`suggestion.py`). They agree for Bukat today (all SKUs default `full_only`).
- **Safety net is thin**: backend pytest covers the gates but every fixture uses `SUP_PAGO` (no Bukat); the frontend has **no test runner**; there is **no product CI** (local `pytest` is the only gate).

## Desired End State

A Wola captain opening `/captain-v2` sees **Bukat selected by default** with its 14 product lines and the suggestion math visible per line, can enter stock and submit, and — in sheet mode — the order lands on the Manager queue the same session. If the pilot supplier is ever absent from the fetched list (inactive/removed), the screen degrades to today's behaviour (`suppliers[0]`) without erroring.

### Key Discoveries:

- Default-selection gap: `frontend/src/pages/captain-mp/CaptainMP.tsx:77-81` (`suppliers[0]` → empty BlueServ).
- Supplier selection is dynamic and supplier-agnostic below the default: `SupplierPicker.tsx:40-84`, `api.orderable()` / `api.captainSubmit()`.
- Seed-vs-sheet boundary governs the e2e smoke: `main.py:193-202`, `:254-276`, `:528-554`.
- FE/BE suggestion divergence is latent and Bukat-safe today: `compute.ts:7-14` vs `suggestion.py:59-70` — deferred to S-09.

## What We're NOT Doing

- **Not** touching the backend, master data, or the data-layer seam — Bukat is already orderable.
- **Not** cleaning up the legacy `SUP_PAGO` hardcodes (`CaptainPage.tsx:16`, `DebugPage.tsx:22`, stale comments) — off the pilot path, out of scope.
- **Not** adding automated tests — no FE runner exists, and the backend gates are already covered generically; validation is a manual sheet-mode smoke. (No new Bukat backend test, no `conftest.py` in this slice.)
- **Not** resolving the FE/BE suggestion-rounding divergence — left as-is (Bukat-safe) with a pointer to **S-09**.
- **Not** hiding zero-product suppliers from the picker or making the default data-driven — explicitly deferred (chose the pilot-constant approach).

## Implementation Approach

Introduce a named pilot-supplier constant and use it for the **initial** selection only, with a safe fallback. This keeps the change to a single file (plus a one-line documentation comment), preserves all existing per-supplier behaviour (draft persistence, auto-advance, manual chip navigation), and is trivially retargetable when the pilot supplier changes.

## Critical Implementation Details

- **Fallback ordering is load-bearing**: select the supplier whose `supplier_id === PILOT_SUPPLIER_ID` **if present in the fetched list**, otherwise `suppliers[0]`. Never throw when the list is empty or the pilot supplier is absent — that path is the current production behaviour and must remain a safe degrade.
- **Initial-selection only**: the change applies where `CaptainMP` first sets `activeSupplierId` after the suppliers fetch. Do not alter the post-submit auto-advance or the draft-resume logic.
- **Seed vs sheet for the smoke**: the default-selection itself is verifiable in seed mode (the picker + orderable read from seed). The "order appears on the Manager queue" leg requires `SUPPLY_OS_DATA_BACKEND=sheet`; in seed mode the submit is in-memory and the queue is empty. Run the e2e leg against sheet mode and **back out** (delete the test order rows; never dispatch — no supplier email).
- **Active filter governs the fallback**: `CaptainMP.tsx:60` filters fetched suppliers to `active` ones BEFORE the default-select runs, so `find(PILOT_SUPPLIER_ID)` only matches when Bukat is `active=TRUE`. That is exactly what makes manual test 1.5 (flip `SUP_BUKAT` active=FALSE) exercise the `suppliers[0]` fallback. In normal operation Bukat is active (F-01), so the default resolves to Bukat.

## Phase 1: Default the Captain pilot to Bukat

### Overview

Change the initial supplier selection in the live captain flow to the pilot supplier (Bukat) with a safe fallback, and document the FE/BE suggestion-rounding divergence for S-09.

### Changes Required:

#### 1. Pilot-default supplier selection

**File**: `frontend/src/pages/captain-mp/CaptainMP.tsx`

**Intent**: Replace the `suppliers[0]` initial auto-select with the pilot supplier (Bukat) so the captain lands on a populated screen, falling back to `suppliers[0]` when the pilot supplier isn't in the fetched list.

**Contract**: Add a named module-level constant `const PILOT_SUPPLIER_ID = "SUP_BUKAT"` in `CaptainMP.tsx` (no env var — the frontend has no config module and the value is identical in dev and prod; retargeting the pilot later is a one-line edit). At the existing initial-selection site (`CaptainMP.tsx:77-81`), pick `suppliers.find(s => s.supplier_id === PILOT_SUPPLIER_ID) ?? suppliers[0]` and pass its `supplier_id` to `setActiveSupplierId`. Keep the whole expression inside the existing `suppliers.length > 0` guard (`CaptainMP.tsx:78`) so `suppliers[0]` is always defined. No other state flow changes.

#### 2. S-09 divergence note

**File**: `frontend/src/pages/captain-mp/lib/compute.ts`

**Intent**: Leave a durable pointer where a future implementer will look, noting that the FE preview always ceils (full_only) while the backend honors per-SKU `rounding_rule`; they agree for Bukat today but will diverge once S-09 adds sub-unit (0.1 kg) rounding.

**Contract**: A short comment at the suggestion computation (`compute.ts:7-14`). No behaviour change.

### Success Criteria:

#### Automated Verification:

- Frontend builds: `cd frontend && npm run build`
- Frontend lints: `cd frontend && npm run lint`
- Backend regression green (no backend change, run for safety): `cd supply-os-v1 && python -m pytest`

#### Manual Verification:

- On `/captain-v2`, **Bukat is the default-selected supplier** on first load, showing its 14 Wola product lines (no empty "Brak produktów"), with the visible suggestion math (Tier-1) rendering per line, unchanged.
- **Fallback**: with the pilot supplier temporarily absent/inactive (e.g. flip `SUP_BUKAT` active=FALSE in a local seed copy), the screen still loads `suppliers[0]` with no error; restore afterwards.
- **End-to-end (sheet mode)**: enter stock, submit a Bukat order, confirm it appears on the Manager queue the same session, then **back it out** (delete the test order rows from the sheet; do NOT dispatch — no supplier email is sent). Never place a real Bukat order.

**Implementation Note**: After automated verification passes, pause for manual confirmation (especially the sheet-mode submit-and-back-out) before considering the slice done. Phase blocks use plain bullets; the `## Progress` section owns the checkboxes.

---

## Testing Strategy

### Unit Tests:

- None added (no FE test runner; backend gates already covered generically). Backend suite is run unchanged as a regression guard.

### Manual Testing Steps:

1. Start backend in **seed mode** + frontend dev; open `/captain-v2` → confirm Bukat is selected by default with 14 lines and visible math.
2. Temporarily mark `SUP_BUKAT` inactive in a local seed copy → reload → confirm graceful fallback to `suppliers[0]` (no crash); restore.
3. Start backend in **sheet mode** (`SUPPLY_OS_DATA_BACKEND=sheet`, editor SA) → submit a Bukat order → open the Manager view → confirm it is in the queue → delete the test order rows from the sheet (back-out). Do not dispatch.

## Performance Considerations

None. The change is an in-memory array lookup at initial render; no new network calls (the pilot-constant approach was chosen specifically to avoid per-supplier orderable fetches).

## Migration Notes

None. No schema, data, or API change. The pilot supplier is a plain frontend constant (`PILOT_SUPPLIER_ID` in `CaptainMP.tsx`); retargeting the pilot later is a one-line edit.

## References

- Research: `context/changes/captain-bukat-submit/research.md`
- Prerequisite (done): `context/archive/2026-06-05-bukat-master-data-ready/audit.md` (F-01 Bukat data baseline)
- Default-selection site: `frontend/src/pages/captain-mp/CaptainMP.tsx:77-81`
- Suggestion divergence: `frontend/src/pages/captain-mp/lib/compute.ts:7-14` vs `supply-os-v1/app/suggestion.py:59-70`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Default the Captain pilot to Bukat

#### Automated

- [x] 1.1 Frontend builds: `cd frontend && npm run build` — 5df6ec3
- [x] 1.2 Frontend lints: `cd frontend && npm run lint` — 5df6ec3
- [x] 1.3 Backend regression green: `cd supply-os-v1 && python -m pytest` — 5df6ec3

#### Manual

- [x] 1.4 `/captain-v2` defaults to Bukat with 14 lines + visible math on first load — 5df6ec3
- [x] 1.5 Graceful fallback to `suppliers[0]` when the pilot supplier is absent/inactive — 5df6ec3
- [x] 1.6 Sheet-mode e2e: Bukat submit appears on the Manager queue, then backed out (no dispatch) — 5df6ec3
