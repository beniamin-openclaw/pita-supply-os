# Manager/Captain Queue UX Fixes — Plan Brief

> Full plan: `context/changes/manager-queue-ux/plan.md`
> Backlog: memory `manager-ux-feedback-backlog` (grounded 2026-06-16)

## What & Why

Fix three owner-reported UX bugs on the Manager/Captain screens that make daily
ordering confusing: cryptic "[object Object]" error toasts, a freshly-opened order
that looks entirely "cancelled" (struck-through), and new orders landing at the
bottom of the Manager queue instead of the top.

## Starting Point

The Manager/Captain SPA (React/Vite) talks to the FastAPI backend (Google Sheets
datastore, now on Railway). All three bugs are grounded to specific lines: a naive
`String(detail)` on FastAPI 422 arrays, a status-blind "manager_final = 0 means
cancelled" rule, and a queue sorted by delivery cutoff (so cutoff-less orders sink).

## Desired End State

Errors render readable field messages; an unclaimed/claimed order shows untouched
lines as neutral (Manager zamawia = captain's qty) with the "cancelled" strike
reserved for genuinely-dropped lines on dispatched orders; and a new order appears
at the top of the queue within ~20 s.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Error format | Readable join of 422 field messages, central in `apiClient` | One choke-point fix covers every call site; field context beats a generic message | Plan |
| "Cancelled" scope | Strike only when dispatched (`manager_sent`/`closed`) | Pre-dispatch `0` means "not set yet", not "dropped" | Plan |
| Queue sort | Newest-submitted first (recency) | Matches the literal ask; intuitive "inbox" at pilot scale | Plan |
| Freshness | orders/order_lines TTL 20 s + 20 s poll (master data stays 60 s) | Surfaces new orders fast; ~3 reads/min is safe on Sheets now, trivial on Supabase | Plan |

## Scope

**In scope:** central API-error formatting; status-aware line visual (table +
summary); newest-first queue sort; faster orders/order_lines cache + poll.

**Out of scope:** localizing FastAPI validation text; any cancel/delete capability
(separate `order-cancel-with-trace` change); master-data cache changes; a backend
force-refresh endpoint; the editable-mode live-0 visual (already correct).

## Architecture / Approach

Three self-contained phases. Phase 1 & 2 are frontend-only (apiClient; managerLine
+ OrderLineTable + OrderDetailPane). Phase 3 spans backend (`main.py` sort,
`sheets.py` per-call TTL) and frontend (`ManagerPage` poll interval). No schema or
API-contract change; each phase reverts on its own.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. API errors | Readable messages instead of "[object Object]" | A non-validation `detail` shape must still fall back cleanly |
| 2. Cancelled visual | No false "Anulowane" on undispatched orders | Must keep the genuine post-dispatch cancelled signal |
| 3. Queue order + freshness | New orders at top, ~20 s refresh | Don't lose cutoff badge; don't over-read Sheets |

**Prerequisites:** none — backend is live on Railway; frontend builds with Homebrew node.
**Estimated effort:** ~1 session across 3 small phases.

## Open Risks & Assumptions

- Assumes no other caller of `lineVisualState`/`managerSummary` exists
  (grep-confirmed) — Phase 2 signature change is safe.
- Assumes pilot scale (1 manager); 20 s poll is safe under the Sheets read quota
  at that scale.
- Frontend has no test runner for these components — verification is build/lint +
  manual preview.

## Success Criteria (Summary)

- No "[object Object]" anywhere; 422s show readable field messages.
- An unclaimed order shows neutral lines (captain qty), no false strike.
- A newly submitted order appears at the top of the queue within ~20 s.
