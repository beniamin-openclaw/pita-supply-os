# Inventory-Count Follow-ups (FR-020…024) — Plan Brief

> Full plan: `context/changes/inventory-count-followups/plan.md`
> Research: `context/changes/inventory-count-followups/research.md`

## What & Why

Six improvements to the Captain inventory-count flow, surfaced by the 2026-06-08 Wola×Bukat demo: an editable count date, a required "counted by", a "last count: who/when" banner, an always-available pre-fill control with two fill modes, a snapshot picker, and a permanent top-tab nav. The demo proved real users hit these first — they're daily-use blockers, not polish. Parallel inventory track; does not touch the Bukat pilot.

## Starting Point

The inventory submit endpoint hardcodes `count_date = today` and `count_user = location_id`; the request carries neither. Both are already live columns on the `inventory_counts` sheet (S-06), so no migration is needed. Pre-fill works today as a one-shot dismissable banner using only the *latest* snapshot; inventory is reachable only via the hamburger menu, two levels deep.

## Desired End State

A Captain opens inventory from a permanent top-tab; sets the count date (future blocked); must enter who counted; sees who/when the last count was; on the order screen picks any of the last 10 snapshots and pulls stock via "fill empties" or a confirm-gated "overwrite all"; the order banner names the counter; and the "blank = not counted / 0 = real zero" rule is finally explained inline.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Migration vs reuse | Reuse live columns | `count_date`/`count_user` already exist on the sheet + model | Research |
| Count-date validation | Reject future only | Covers "entered a day late"; one rule, one message | Plan |
| "Counted by" requirement | Required to submit | Operator wants strong attribution ("imię, nazwisko, data") | Plan |
| "Counted by" input | Typed each count | Avoids wrong name on a shared tablet | Plan |
| "Who/when" banner | Inventory screen + order pre-fill | count_user is nearly free once added to the response | Plan |
| Pre-fill re-press | Two actions: fill-empties + overwrite-all | Operator wants both; overwrite is confirm-gated to keep the safeguard | Plan |
| Picker sort / size | By count date, last 10, shows both dates + who | Operator-intuitive ordering; both timestamps shown to defuse back-dating | Plan |
| Pre-fill control placement | Dedicated row above lines | Visible, next to the stock fields it fills (sibling of the supplier context strip) | Plan |
| Inventory discoverability | Permanent top-tab strip | Not just hamburger — always-visible menu (demo feedback) | Plan |
| Blank-vs-0 gap (C7-2) | Add one-line hint now | Pre-fill becomes more prominent; timely to explain | Plan |
| Live-sheet header | Operator confirms before coding | De-risks the one migration-free assumption | Plan |

## Scope

**In scope:** FR-020 editable date · FR-021 required free-text "counted by" · FR-022 who/when banner (inventory + order) · FR-023 always-on pre-fill with two modes · FR-024 snapshot picker (last 10) · permanent top-tab nav · blank-vs-0 hint.

**Out of scope:** per-user auth/identity · editing/deleting saved counts · worksheet migration · concurrency locking · supplier KPI / receiving (epic) · master-data fixes · FE test runner.

## Architecture / Approach

Two backend→frontend vertical slices (count-metadata, then snapshot-picker) plus a nav phase. Backend lands first in each vertical so it's curl-verifiable before the UI consumes it. All reads/writes go through `_choose_backend()`; the two new FR-024 routes reuse the already-existing `load_inventory_counts` / `get_inventory_count` and degrade to `[]`/`null` in dev. Deploy once, after all phases — so the required-`count_user` contract change never breaks the live frontend mid-change.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend metadata | Editable date + required counter; count_user in latest | Required count_user tightens the request contract (intra-change only) |
| 2. FE inventory screen | Date picker, counted-by, who/when banner, blank-vs-0 hint | Submit-gating UX must be clear, not annoying |
| 3. Backend list + detail | `/inventory/counts` + `/inventory/count/{id}` | Seed-mode + no-tab must degrade, not 500 |
| 4. FE pre-fill + picker | Picker, two fill modes, order banner names counter | Overwrite-all must be confirm-gated (safeguard) |
| 5. FE top-tab nav | Permanent Zamówienia/Remanent tabs | Mobile vertical space (~40px) |

**Prerequisites:** S-06 + S-07 shipped (done); operator confirms the live `inventory_counts` header before Phase 1 code.
**Estimated effort:** ~1–1.5 sessions across 5 phases (3 of 6 items are plumbing existing fields).

## Open Risks & Assumptions

- The live `inventory_counts` header carries `count_user` + `count_date` (verified at S-06; re-confirmed in the Phase 1 pre-flight).
- "Counted by" stays free-text/unverified — does not drift into auth (would break the v0 Non-Goal).
- Required-`count_user` + typed-each-time adds friction; accepted as the operator's explicit choice.

## Success Criteria (Summary)

- A Captain can set a past count date, must name who counted, and sees the last count's author/time.
- On the order screen, any of the last 10 snapshots can pre-fill stock via fill-empties or confirm-gated overwrite; the banner names the counter.
- Inventory is reachable from a permanent tab on phone + laptop without the hamburger.
