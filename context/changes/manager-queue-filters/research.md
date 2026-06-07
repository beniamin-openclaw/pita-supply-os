---
date: 2026-06-07T20:55:00+0200
researcher: Beniamin
git_commit: 7ddc4958ef02369ce22362fad93673f20a07f515
branch: main
repository: beniamin-openclaw/pita-supply-os
topic: "S-05 — Manager queue filters (supplier / location / status)"
tags: [research, codebase, manager-queue, filters, FR-014, frontend]
status: complete
last_updated: 2026-06-07
last_updated_by: Beniamin
---

# Research: S-05 — Manager queue filters (manager-queue-filters)

**Date**: 2026-06-07T20:55:00+0200
**Researcher**: Beniamin
**Git Commit**: 7ddc4958ef02369ce22362fad93673f20a07f515
**Branch**: main
**Repository**: beniamin-openclaw/pita-supply-os

## Research Question

For S-05 (`manager-queue-filters`, roadmap; PRD FR-014 — "Manager can filter or narrow the order queue by supplier / location / status"): map the Manager queue end-to-end (backend endpoint + frontend UI + master-data dropdowns + reusable UI patterns) and gap-hunt the filter insertion points, so `/10x-plan` can decide *server-side vs client-side filtering* and *which filters ship now*.

## Summary

**S-05 is a small, frontend-only, client-side-filtering slice — no backend change is required.** Every datum a filter needs is already in the payload: each `ManagerQueueItem` carries `supplier_id`, `supplier_name`, `location_id`, and `status`. So the Manager can filter the already-fetched lists in the browser.

The three filters split cleanly by effort and value:

- **Supplier filter — the real value now, pure client-side.** ManagerPage already holds the full `submitted`/`claimed`/`sent` arrays; derive the dropdown options from their `supplier_id`/`supplier_name` and `.filter()` before passing to `ManagerQueue`. (Week-2 adds *more suppliers* first — FR-013 — so this is the filter that earns its keep.)
- **Status filter — already exists structurally; a "selector" = show/hide groups.** The queue is rendered as 3 status groups; a status filter is just not-rendering (or collapsing) deselected groups. Pure client-side, no fetch change.
- **Location filter — defer.** It is the *only* filter that changes the fetch (replace the hardcoded `LOCATION_ID = "WOLA"`), and the pilot is **Wola-only** (PRD Non-Goal; FR-014 is "must-have by **week 2**"; the card already shows exactly one `location_id`). Build the bar so location is an easy add later — the param is already plumbed end-to-end (optional client + server) — but don't ship a one-option dropdown now.

**Reuse is strong:** `api.suppliers()`/`api.locations()` already exist (Captain MP uses them); the native-`<select>` + i18n pattern in `ReasonPicker.tsx` is the template to copy for a small new `ManagerFilterBar`. ManagerPage owns the fetch+state, so the filter bar and its state live there; `ManagerQueue` stays presentational.

**Net:** likely a single frontend phase — fetch suppliers on mount, a `ManagerFilterBar` (`<select>` for supplier + a status toggle), client-side filter of the 3 arrays, `manager.filter.*` i18n keys, verify via `build` + `lint` (no frontend test runner). The one open design call for the plan: **client-side vs a trivial server-side `supplier_id` param** (both are easy; the agents lean client-side).

## Detailed Findings

### Backend — `manager_queue` endpoint (FR-014 server-side option)

`GET /api/manager/queue` ([main.py:538-564](https://github.com/beniamin-openclaw/pita-supply-os/blob/7ddc4958ef02369ce22362fad93673f20a07f515/supply-os-v1/app/main.py#L538)):

- **Params today:** `location_id: Optional[str] = None`, `status: OrderStatus = CAPTAIN_SUBMITTED`. Filter is a short-circuit comprehension: `o.status == status and (location_id is None or o.location_id == location_id)`.
- **`ManagerQueueItem`** ([models.py:219-236](https://github.com/beniamin-openclaw/pita-supply-os/blob/7ddc4958ef02369ce22362fad93673f20a07f515/supply-os-v1/app/models.py#L219)) already carries `supplier_id`, `supplier_name` (joined via `suppliers_by_id`), `location_id`, `status`.
- **Adding a server-side `supplier_id` filter is trivial** — one param + one comprehension line mirroring `location_id` (`and (supplier_id is None or o.supplier_id == supplier_id)`); no new loads, no sort change. Sorting is status-aware and happens *after* filtering (cutoff_iso then captain_submitted_at), so it's preserved.
- **Seed mode returns `[]`** (sheet-mode-only at runtime) — same constraint as the rest of the Manager surface.

### Frontend — Manager queue UI (where filters go)

- **`ManagerPage.tsx` is the fetch + state owner.** `loadQueue` fires **3 parallel `api.managerQueue(LOCATION_ID, status)` calls** (`captain_submitted`/`manager_claimed`/`manager_sent`) ([ManagerPage.tsx:63-78](https://github.com/beniamin-openclaw/pita-supply-os/blob/7ddc4958ef02369ce22362fad93673f20a07f515/frontend/src/pages/ManagerPage.tsx#L63)); hardcoded `LOCATION_ID = "WOLA"` (line 34); 60s auto-refresh (lines 82-86); three separate state arrays `submitted`/`claimed`/`sent` (`null` = loading, `[]` = empty).
- **`ManagerQueue.tsx` is presentational** — props `{ submitted, claimed, sent, selectedId, onSelect }`, renders 3 collapsible groups (per-group `open` useState already exists), cards titled `{location_id} → {supplier_name}` with badges. **No filter state anywhere.**
- **Filter bar belongs in ManagerPage** (owns arrays + fetch), above `ManagerQueue`; keep `ManagerQueue` a pure component fed pre-filtered arrays. **Supplier + status filters = client-side over the 3 arrays; no fetch change.** Location filter would replace the hardcoded WOLA and pass a chosen `location_id` (the only fetch-changing filter).
- **Guards a filter must respect:** don't reset `selectedId` on filter (selection survives the 60s refresh by design); the `selectedCutoffIso` lookup flat-maps over the 3 arrays (keep that lookup over the *full* arrays, filter only the display copy); unsaved-edit guards `confirmDiscardIfDirty` (ManagerPage.tsx:122-127) + `beforeunload` (142-151) aren't tripped by a filter change unless the filter auto-clears a dirty selection — if it does, route through `confirmDiscardIfDirty`.

### Master data, reusable patterns, i18n

- **`api.suppliers()` / `api.locations()`** return `Supplier[]` / `Location[]` ([apiClient.ts:171-172](https://github.com/beniamin-openclaw/pita-supply-os/blob/7ddc4958ef02369ce22362fad93673f20a07f515/frontend/src/apiClient.ts#L171)), `"captain"` auth (Manager has a token → works). **Captain MP already fetches suppliers on mount** (CaptainMP.tsx:61-80) — mirror that pattern.
- **Reusable control:** copy the native `<select>` + i18n pattern from `ReasonPicker.tsx:44-62` for the supplier/status dropdowns. `SupplierPicker.tsx` (chip row) is Captain-specific UI but its id-select state pattern is reusable. No ready-made filter bar exists → small new `ManagerFilterBar` (~80 LOC).
- **`ManagerQueueItem` (types.ts:197-213)** carries `supplier_id` (200) + `location_id` (199) + `supplier_name` (201) → client-side filter is feasible with zero backend change.
- **i18n:** the `manager.*` block lives in `strings.ts:254-431`; flat dotted keys, `{curly}` interpolation, PL/EN; add net-new `manager.filter.*` keys (e.g. `supplierLabel`, `allSuppliers`, `statusLabel`). **No hardcoded strings** (frontend/AGENTS.md). **No frontend test runner** → verify via `npm run build` (tsc) + `npm run lint` only.

## Code References

- `supply-os-v1/app/main.py:538-564` — `manager_queue` params + filter comprehension (server-side `supplier_id` would slot here)
- `supply-os-v1/app/main.py:611-631` — status-aware sort (after filtering; preserved by any filter)
- `supply-os-v1/app/models.py:219-236` — `ManagerQueueItem` already carries supplier_id / supplier_name / location_id / status
- `frontend/src/pages/ManagerPage.tsx:34,63-86` — hardcoded WOLA, 3-call fetch, 60s refresh, state arrays (filter-state owner)
- `frontend/src/pages/manager/ManagerQueue.tsx:21-40,66` — presentational 3-group render + per-group collapse
- `frontend/src/apiClient.ts:171-172` — `api.suppliers()` / `api.locations()`
- `frontend/src/pages/captain-mp/components/ReasonPicker.tsx:44-62` — native `<select>` + i18n pattern to copy
- `frontend/src/pages/captain-mp/CaptainMP.tsx:61-80` — fetch-suppliers-on-mount pattern to mirror
- `frontend/src/types.ts:197-213` — `ManagerQueueItem` fields for client-side filtering
- `frontend/src/i18n/strings.ts:254-431` — `manager.*` copy block (add `manager.filter.*`)

## Architecture Insights

- **The payload is already filter-complete.** `ManagerQueueItem` carrying `supplier_id` + `location_id` is the load-bearing fact: it makes the whole slice frontend-only. Server-side filtering is a *nicety* (smaller payload, consistency with `location_id`), not a necessity.
- **Status is encoded as *which call*, not a param.** The 3-call fan-out means a "status filter" isn't a query param — it's show/hide of the 3 already-fetched groups. Keep all 3 calls; hide client-side (simplest) rather than making calls conditional (which complicates the `Promise.all` null-state logic).
- **Clean component split to preserve:** ManagerPage = state/fetch/filter owner; ManagerQueue = pure presentational. The filter bar + filter state go in ManagerPage; ManagerQueue keeps receiving (now pre-filtered) arrays.
- **Location is plumbed but premature.** The `location_id` param is optional client→server already; the only blocker to a location filter is that the pilot has one location. Design the bar to drop a location `<select>` in later without refactor.

## Historical Context (from prior changes)

- `context/foundation/prd.md` — **FR-006 resolution explicitly gates FR-014**: "queue without filters unusable at scale; keep week 1, add FR-014 before multi-supplier/location." FR-014 priority = "must-have by **week 2**". PRD Non-Goals: "Multi-location / company-wide scale hardening — week 1 is Wola-only" → supports deferring the location filter.
- `context/archive/2026-06-06-manager-bukat-email-dispatch/research.md` — S-02 mapped the same Manager queue (3-status groups, hardcoded WOLA, ManagerPage/ManagerQueue split); this research extends it to the filter insertion points.
- `context/foundation/roadmap.md` — S-05 `ready`, Prerequisites `—` (extends the present queue), Parallel-with S-04; "smallest independent slice."

## Related Research

- `context/archive/2026-06-06-manager-bukat-email-dispatch/research.md` — Manager-dispatch flow (queue/claim/dispatch) that this queue UI feeds into.

## Open Questions (for /10x-plan to decide)

1. **Client-side vs server-side supplier filter.** Both are easy; agents lean **client-side** (data already present, snappier, zero backend). Server-side adds a trivial `supplier_id` param + consistency with `location_id` but a second round-trip on filter change. Plan decides.
2. **Ship location filter now or defer?** Recommendation: **defer** (Wola-only pilot; one option) but plumb the bar for an easy later add. Confirm.
3. **Status filter UX:** a multi-select / segmented toggle that show/hides the 3 existing groups (vs. the groups themselves already being the split). Decide whether a status control adds value beyond the existing collapsible groups, or if supplier-only is enough for the first cut.
