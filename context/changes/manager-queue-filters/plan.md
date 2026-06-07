# Manager Queue Filters (S-05) Implementation Plan

## Overview

Add a **client-side filter bar** to the Manager queue so the operator can narrow it by **supplier** and by **status** (which status-groups to show), keeping the queue usable as order volume grows beyond the single Wola×Bukat stream (PRD FR-014). No backend change: every datum a filter needs (`supplier_id`, `supplier_name`, `status`) is already in the `ManagerQueueItem` payload. Location filtering is deferred (pilot is Wola-only); the param is already plumbed end-to-end for a later add.

## Current State Analysis

- **`ManagerPage.tsx` owns the fetch + state.** `loadQueue` fires 3 parallel `api.managerQueue(LOCATION_ID, status)` calls (`captain_submitted` / `manager_claimed` / `manager_sent`), `LOCATION_ID = "WOLA"` hardcoded (ManagerPage.tsx:34), 60s auto-refresh, three state arrays `submitted`/`claimed`/`sent` (`null` = loading, `[]` = empty). Selection (`selectedId`/`detail`) is independent state that survives refresh.
- **`ManagerQueue.tsx` is presentational** — props `{submitted, claimed, sent, selectedId, onSelect}`; builds a `groups` array (ManagerQueue.tsx:36-40) → 3 collapsible `QueueGroupSection`s (per-group `open` useState already exists). No filter state.
- **`ManagerQueueItem` (types.ts:197-213)** carries `supplier_id`, `supplier_name`, `location_id`, `status` → client-side filtering is feasible with zero backend change.
- **Reusable pattern:** native `<select>` + i18n in `ReasonPicker.tsx:44-62`. `api.suppliers()` exists but is **not needed** — supplier options derive from the queue itself (only suppliers that have orders → no dead options, no extra fetch).
- **i18n:** `manager.*` block in `strings.ts:254-431`; flat dotted keys, PL/EN; existing `manager.tab.submitted/claimed/sent` labels reusable for the status control. No hardcoded strings (frontend/AGENTS.md). **No frontend test runner** → verify via `tsc --noEmit` + `lint`.

### Key Discoveries:

- Client-side, frontend-only: the payload is already filter-complete (`types.ts:197-213`).
- ManagerPage is the natural filter-state owner; ManagerQueue stays presentational (fed pre-filtered arrays + which statuses to show).
- The `selectedCutoffIso` lookup (ManagerPage.tsx:269-273) flat-maps over the 3 arrays — it must keep reading the **full** (unfiltered) arrays so a filtered-out-but-selected order's cutoff still resolves (the "keep detail" decision).

## Desired End State

The Manager `/manager` screen shows a filter bar above the queue: a **supplier `<select>`** ("Wszyscy dostawcy" + each supplier present in the queue) and a **status toggle** (3 chips for submitted/claimed/sent, all on by default). Picking a supplier narrows all groups to that supplier; toggling a status hides/shows that group. Filters are **ephemeral** (reset on reload). Selecting an order then filtering it out **keeps the detail pane** showing it. Claim/save/send-back/dispatch keep working on a filtered queue. `tsc` + `lint` clean; the build deploys on Vercel.

## What We're NOT Doing

- **No location filter** (pilot Wola-only; one option). The `location_id` param stays plumbed for a later add.
- **No backend / endpoint change** — `manager_queue` is untouched; filtering is client-side.
- **No filter persistence** (no localStorage) — ephemeral per the decision.
- **No change to the 3-call fetch** — status filtering hides already-fetched groups; it does NOT make the calls conditional.
- **No auto-deselect** when the selected order is filtered out — the detail pane keeps showing it.
- **No frontend test runner** added (out of scope; verification is tsc + lint + manual).

## Implementation Approach

One frontend phase. ManagerPage gains ephemeral filter state (`filterSupplierId: string | null`, `visibleStatuses`), derives supplier options from the union of the 3 fetched arrays, supplier-filters the arrays, and passes them plus `visibleStatuses` to ManagerQueue. A small new presentational `ManagerFilterBar` renders the supplier `<select>` (copying the ReasonPicker pattern) + the status chips + a "clear filters" affordance. ManagerQueue gains one optional `visibleStatuses` prop and skips hidden groups. New `manager.filter.*` i18n keys.

## Critical Implementation Details

- **Keep `selectedCutoffIso` over the FULL arrays.** Filter only the *display* copies passed to ManagerQueue; the cutoff lookup (ManagerPage.tsx:269-273) and any selection-related lookups must read the original unfiltered `submitted`/`claimed`/`sent` so a filtered-out selected order still resolves (keep-detail decision).
- **Don't overload `null`.** `null` already means "group still loading" in ManagerQueue. The status filter must use an explicit `visibleStatuses` signal (not `null`) to hide a group; an empty visible group renders the existing `manager.queueEmptyGroup` copy.
- **Selection survives filtering.** Do not reset `selectedId` on a filter change; a filter change doesn't navigate, so the `confirmDiscardIfDirty`/`beforeunload` guards are not involved.

## Phase 1: Client-side filter bar (supplier + status)

### Overview

All frontend: i18n keys, a new `ManagerFilterBar`, a `visibleStatuses` prop on `ManagerQueue`, and ManagerPage filter state + wiring.

### Changes Required:

#### 1. i18n filter copy

**File**: `frontend/src/i18n/strings.ts`

**Intent**: Add the filter-bar labels/options so no strings are hardcoded.

**Contract**: New `manager.filter.*` keys (PL/EN) under the `manager.*` block — e.g. `supplierLabel` ("Dostawca"/"Supplier"), `allSuppliers` ("Wszyscy dostawcy"/"All suppliers"), `statusLabel` ("Status"/"Status"), `clear` ("Wyczyść filtry"/"Clear filters"). Reuse the existing `manager.tab.submitted/claimed/sent` for the status-chip labels.

#### 2. ManagerFilterBar component

**File**: `frontend/src/pages/manager/ManagerFilterBar.tsx` (new)

**Intent**: Presentational filter controls — a supplier `<select>` + a 3-chip status toggle + a clear affordance — driven entirely by props (no fetching, no app state).

**Contract**: Props: `supplierOptions: {id: string; name: string}[]`, `selectedSupplierId: string | null`, `onSupplierChange(id|null)`, `visibleStatuses: Set<OrderStatus>` (or 3 booleans), `onToggleStatus(status)`, `onClear()`, `anyActive: boolean`. Copy the native-`<select>` + `useT()` pattern from `ReasonPicker.tsx:44-62`; clear button shown only when `anyActive`.

#### 3. ManagerQueue — hide non-visible status groups

**File**: `frontend/src/pages/manager/ManagerQueue.tsx`

**Intent**: Let the queue render only the status groups the filter says are visible, without otherwise changing its presentational shape.

**Contract**: Add optional prop `visibleStatuses?: Set<OrderStatus>` (default = all visible → backward compatible). In the `groups` builder (ManagerQueue.tsx:36-40), skip groups whose status is not visible. No change to card rendering or the per-group collapse.

#### 4. ManagerPage — filter state + wiring

**File**: `frontend/src/pages/ManagerPage.tsx`

**Intent**: Own the ephemeral filter state, derive supplier options from the fetched queue, apply the supplier filter to the display arrays, and render the filter bar above `ManagerQueue` — preserving selection and the cutoff lookup over full arrays.

**Contract**: Add `useState` `filterSupplierId: string | null = null` and `visibleStatuses` (default all 3). Derive `supplierOptions` from the de-duped union of `submitted`/`claimed`/`sent` (`{supplier_id, supplier_name}`, sorted by name). Compute display arrays = each array filtered by `filterSupplierId` (no-op when null). Render `<ManagerFilterBar>` above `<ManagerQueue>` (ManagerPage.tsx:330-339); pass display arrays + `visibleStatuses` to `ManagerQueue`. **Leave the `selectedCutoffIso` lookup (269-273) reading the original unfiltered arrays.** Do not touch `selectedId` on filter change. When `filterSupplierId` is no longer among the current `supplierOptions` (e.g. a 60s refresh removed that supplier's last order), reset it to `null` (show all) so the `<select>` never holds an option-less value.

### Success Criteria:

#### Automated Verification:

- Frontend type-check clean: `cd frontend && npx tsc -p tsconfig.app.json --noEmit`
- Frontend lint adds no NEW findings vs the S-01 baseline of 13 problems (8 errors, 5 warnings — react-hooks/set-state-in-effect, pre-existing): `cd frontend && npm run lint`
- Production build succeeds (Vercel verifies the bundle; locally use Homebrew node — the default Codex node fails rollup with ERR_DLOPEN): `cd frontend && PATH="/opt/homebrew/opt/node/bin:$PATH" npm run build`

#### Manual Verification:

- Supplier `<select>` lists only suppliers present in the queue; picking one narrows all groups to that supplier; "Wszyscy dostawcy" restores the full queue.
- Status chips hide/show the matching group(s); default all shown; an emptied visible group shows the existing empty-group copy.
- Select an order, then filter it out (by supplier or status) → the detail pane keeps showing it; no console error; claim/save/send-back/dispatch still work.
- "Clear filters" resets supplier=all + all statuses visible; reloading the page resets filters (ephemeral).
- No regression to the 60s auto-refresh or the unsaved-edit guards.

**Implementation Note**: After automated checks pass, pause for human manual verification (needs a queue with ≥2 suppliers' orders — run the Manager screen locally in sheet mode, or on the deployed frontend once the backend has orders) before the phase-end commit.

---

## Testing Strategy

### Unit Tests:

None (no frontend test runner — frontend/AGENTS.md tripwire). Logic is small and verified by type-check + manual.

### Manual Testing Steps:

1. Open `/manager` against a queue holding orders from ≥2 suppliers.
2. Pick a supplier → confirm all visible groups narrow to it; switch back to "Wszyscy".
3. Toggle off a status chip → its group disappears; toggle on → returns.
4. Select an order, then filter it out → detail pane still shows it; run a claim/save to confirm no regression.
5. Clear filters; reload → filters are reset.

## Performance Considerations

Negligible — filtering a handful of in-memory arrays on render. No new network calls (supplier options derive from the already-fetched queue).

## Migration Notes

None — additive frontend change, no data or API change.

## References

- Related research: `context/changes/manager-queue-filters/research.md`
- Reuse pattern: `frontend/src/pages/captain-mp/components/ReasonPicker.tsx:44-62` (native `<select>` + i18n)
- Queue UI: `frontend/src/pages/ManagerPage.tsx` (state/fetch owner), `frontend/src/pages/manager/ManagerQueue.tsx` (presentational groups)
- Types: `frontend/src/types.ts:197-213` (`ManagerQueueItem` carries supplier_id/location_id)
- PRD FR-014; roadmap S-05.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Client-side filter bar (supplier + status)

#### Automated

- [x] 1.1 Frontend type-check clean: `npx tsc -p tsconfig.app.json --noEmit`
- [x] 1.2 Frontend lint adds no new findings vs the S-01 baseline (13 problems): `npm run lint`
- [x] 1.3 Production build succeeds (Homebrew node): `PATH="/opt/homebrew/opt/node/bin:$PATH" npm run build`

#### Manual

- [x] 1.4 Supplier select filters all groups; "Wszyscy" restores
- [x] 1.5 Status chips hide/show groups; default all shown
- [x] 1.6 Selected order filtered out → detail pane persists; claim/save/dispatch unaffected
- [x] 1.7 Clear filters resets; reload resets (ephemeral)
- [x] 1.8 No regression to 60s auto-refresh + unsaved-edit guards
