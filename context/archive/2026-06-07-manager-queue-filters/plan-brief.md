# Manager Queue Filters (S-05) — Plan Brief

> Full plan: `context/changes/manager-queue-filters/plan.md`
> Research: `context/changes/manager-queue-filters/research.md`

## What & Why

Add a filter bar to the Manager queue (`/manager`) so the operator can narrow it by **supplier** and **status**, keeping it usable as order volume grows past the single Wola×Bukat stream (PRD FR-014). Filtering is **client-side** — the queue payload already carries everything a filter needs.

## Starting Point

`ManagerPage.tsx` fetches the queue as 3 parallel calls (one per status: submitted/claimed/sent) with a hardcoded `LOCATION_ID = "WOLA"`, and `ManagerQueue.tsx` renders them as 3 collapsible groups. Each `ManagerQueueItem` already carries `supplier_id`, `supplier_name`, `location_id`, `status`. No filter UI exists yet.

## Desired End State

A filter bar above the queue: a supplier `<select>` ("Wszyscy dostawcy" + each supplier present) and a 3-chip status toggle (all on by default) + "clear filters". Picking a supplier narrows all groups; toggling a status hides/shows its group. Filters reset on reload; a selected order stays visible in the detail pane even when filtered out of the list. Claim/save/send-back/dispatch keep working.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Filter approach | Client-side | The payload already carries supplier_id/location_id — zero backend change, snappy. | Research → Plan |
| Which filters | Supplier + status (defer location) | Supplier is the real value (week-2 = more suppliers); status is cheap show/hide; location is one option in a Wola-only pilot. | Research → Plan |
| Selected order filtered out | Keep showing detail | Don't lose context or risk the dirty-edit guard; simplest. | Plan |
| Filter persistence | Ephemeral | Simple; the queue auto-refreshes every 60s anyway. | Plan |
| Supplier options source | Derive from the queue | Only suppliers with orders → no dead options, no extra `api.suppliers()` fetch. | Plan |

## Scope

**In scope:** `manager.filter.*` i18n keys; a new presentational `ManagerFilterBar` (supplier `<select>` + status chips + clear); a `visibleStatuses` prop on `ManagerQueue`; ManagerPage ephemeral filter state + client-side supplier filter + wiring.

**Out of scope:** location filter; any backend/endpoint change; filter persistence; conditional fetching; auto-deselect; a frontend test runner.

## Architecture / Approach

ManagerPage stays the state/fetch owner: it derives supplier options from the union of the 3 fetched arrays, applies the supplier filter to display copies, and passes those + `visibleStatuses` down. ManagerQueue stays presentational (renders only visible groups). The `selectedCutoffIso` lookup keeps reading the **full** unfiltered arrays so a filtered-out selection still resolves.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Client-side filter bar | i18n + ManagerFilterBar + ManagerQueue `visibleStatuses` + ManagerPage wiring | Overloading `null` (loading vs hidden); disturbing selection/cutoff lookup — both called out in Critical Details |

**Prerequisites:** none (extends the present queue). Manual verification needs a queue with ≥2 suppliers' orders.
**Estimated effort:** ~1 session, single frontend phase.

## Open Risks & Assumptions

- No frontend test runner → correctness rests on `tsc` + `lint` + manual; logic is intentionally small.
- Manual smoke needs the Manager screen against real orders (local sheet mode, or the deployed frontend once the backend has orders from ≥2 suppliers).

## Success Criteria (Summary)

- Supplier select + status chips narrow the queue client-side; "Wszyscy"/clear restores.
- A selected, then-filtered-out order stays in the detail pane; dispatch flow unaffected.
- `tsc` + `lint` clean (no new findings vs the 13-problem baseline); build deploys on Vercel.
