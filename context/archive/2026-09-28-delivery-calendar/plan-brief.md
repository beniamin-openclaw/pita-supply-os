# Delivery Calendar — Plan Brief

> Full plan: `context/changes/delivery-calendar/plan.md`
> Frame brief: `context/changes/delivery-calendar/frame.md`
> Research: `context/changes/delivery-calendar/research.md`

## What & Why

The actual problem to plan around is: give the Captain a visible, editable delivery date that
defaults to a server-computed proposal (supplier rules + location override + 17:00 Warsaw
deadline), and record both the proposal and the choice so the Manager sees deviations. Marek's
ordering rules (28.09) make the proposal possible; a Thursday "na 1 dzień / na 3 dni" reminder
covers the weekend-stock risk.

## Starting Point

The Captain never sees the date: it is computed silently at submit as "tomorrow" from the
browser clock. The order screen does not know its location, supplier calendar fields are mostly
`TBD`, and the Captain strip shows the supplier's own cutoff time.

## Desired End State

The order screen shows "Data dostawy" prefilled with the calendar proposal and the strip
"Zamów do pon. 17:00"; the Captain can pick any date. On Thursdays, Bukat and Intermlecz orders
show the coverage choice. The Manager queue and detail show a small amber marker only when the
chosen date differs from the proposal, plus the coverage choice when set.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where the proposal is computed | Backend endpoint `GET /api/captain/delivery-proposal` | Only the backend knows the Captain's location | Frame |
| Rule storage | New table `supplier_delivery_rules` (shared row or per-location rows) | `delivery_days`/`cutoff_time` cannot express lead times or per-location windows | Research |
| Rule model | order weekdays + lead days + delivery weekdays + deadline | One shape covers every rule Marek gave | Plan |
| Fallback proposals | Shown, never stored | Keeps the Manager marker free of guesses | Plan (operator) |
| Business-day suppliers | Kuchnie Świata Mon–Sat; Go Gastro, Blue Service (lead 2), Spec Food, Kamino Mon–Fri | Delivery days confirmed 28.09; Spec Food/Kamino lead 1 assumed | Peer lane (operator) |
| Coca-Cola | WESTFIELD only (Mon, Tue, Thu, Fri, 2 days); other locations TBD | Marek's call 28.09 | Peer lane (Marek) |
| Thursday scope | Flag on SUP_BUKAT and SUP_INTERMLECZ only | Marek's call 28.09 narrowed the list | Peer lane (Marek) |
| Thursday timing | Whole Warsaw calendar Thursday | Matches "w czwartki" | Plan (operator) |
| Thursday choice | Optional, never blocks | "Informational only" | Plan (operator) |
| Chosen date/coverage in draft | Session state only | A restored draft can never carry a stale date | Plan |
| Manager marker style | Amber text + `AlertTriangle` (inventory "Uwaga" flag) | The only subtle over-max marker on Manager screens | Frame |
| Migration number | 0025 | 0024 is taken by the zero-quantity lane (coordinator note) | Peer lane — confirm |
| Future hook | Pure `delivery_window(...)` → next, following delivery, deadline | A later dynamic-target lane can reuse it | Peer lane |

## Scope

**In scope:** migration 0025, rules table + supplier flag + two order columns in all backends;
pure engine + proposal endpoint; submit/queue/detail fields; Captain date field, Thursday banner,
deadline strip, confirm-dialog line; Manager marker + coverage; operator `prod-sql.sql`; docs.

**Out of scope:** e-mail builders, Transport/Pago sending, Manager `cutoff_iso`, reminders,
per-day quantity math, edit-page date editing, Coca-Cola rows for other locations.

## Architecture / Approach

`supplier_delivery_rules` → `delivery_calendar.delivery_window()` (pure, Warsaw-aware) →
`GET /api/captain/delivery-proposal` → Captain screen (date field, banner, strip) →
`POST /api/captain/submit` stores `requested_delivery_date` + `suggested_delivery_date` +
`coverage_days` → Manager queue/detail marker.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data model | Migration 0025, models, three backends, fixture, docs | Missing fixture/column-list wiring breaks integration tests |
| 2. Engine + endpoint | Proposal arithmetic, route, persisted fields | Off-by-one at 17:00, DST, Warsaw vs UTC |
| 3. Captain screen | Date field, Thursday banner, 17:00 strip | Stale proposal while the screen stays open |
| 4. Manager views | Marker + coverage in queue and detail | Visual noise |
| 5. Rollout | `prod-sql.sql`, docs, prod check | Seeding a supplier that does not exist in prod |

**Prerequisites:** operator applies migration 0025 on prod before the merge.
**Estimated effort:** ~2 sessions.

## Open Risks & Assumptions

- Spec Food and Kamino lead times (1 day) are assumptions; their delivery days are confirmed.
- SUP_MORY, SUP_FILBER and SUP_SPEC presence in prod was not verifiable here; the seed skips
  missing ones.
- Reminders (a later Telegram bot) are out of scope; the rules table is their future data source.
- PR #30 will conflict in the integration fixture; resolve at whichever merges second.
- The proposal can move at 17:00 while the screen is open; handled by a refetch at the deadline.

## Success Criteria (Summary)

- A Captain sees a sensible delivery date and the 17:00 deadline for every supplier with a rule.
- A Manager spots, at a glance, orders whose date differs from the calendar.
- Nothing in the Captain flow is blocked, and the suggestion math is unchanged.
