# Move estimated total out of the email — Plan Brief

> Full plan: `context/changes/email-total-to-manager-panel/plan.md`
> Research: `context/changes/email-total-to-manager-panel/research.md`

## What & Why

The supplier dispatch email leaks our internal estimated value ("Łączna wartość szacunkowa"). The
owner wants the supplier to never see it — move it from the email into the Manager order-detail panel
(above the action buttons). Backlog item #7 from the demo feedback.

## Starting Point

The total is appended to the email body by two parallel builders — `emailBody.ts` (what the Manager
actually sends) and `gmail_url.py` (backend) — and a backend test asserts it's present. The Manager
UI shows no absolute total today (only a change-vs-captain delta).

## Desired End State

The email body (sent + backend-built) has no estimated-total line; the Manager panel shows "Wartość
szacunkowa: X PLN" between the summary and the action buttons; a backend test now guards that the
total stays OUT of the email.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Remove from where | Both builders (`emailBody.ts` + `gmail_url.py`) | They must stay in sync or the email drifts | Research |
| Test handling | Invert to an absence guard (not delete) | Keeps a regression guard against the value returning | Plan |
| Panel placement | Under summary, above action buttons (`OrderDetailPane.tsx`) | Owner's stated location; `total_value_estimate_pln` already in scope | Owner/Research |

## Scope

**In scope:** delete the total line from both email builders; invert the pinning test; add a
read-only value line + i18n key in the Manager panel.

**Out of scope:** data model, total computation, Captain views, email subject/product lines, the
receiving-display change (separate).

## Architecture / Approach

Two-builder duplication is a known seam — edit both in lockstep. Backend verified by pytest, frontend
by build/lint/test. One phase.

## Phases at a Glance

| Phase | Delivers | Key risk |
| --- | --- | --- |
| 1. Total out of email → into panel | Email clean; value shown to Manager only | Missing the second builder (drift) — both are named in the plan |

**Prerequisites:** none.
**Estimated effort:** ~1 short session, 1 phase.

## Open Risks & Assumptions

- Assumes `total_value_estimate_pln` can be `null` → the panel line is conditional.
- Manual email check must NOT send a real supplier order — inspect the Gmail draft only.

## Success Criteria (Summary)

- Dispatch email body has no estimated total; Manager panel shows it above the buttons.
- Backend pytest (inverted guard) + frontend build/lint/test green.
