# Digital waste report — Plan brief

> Full plan: `context/changes/waste-report/plan.md`
> Research: `context/changes/waste-report/research.md`
> Source calibration: `context/changes/waste-report/report-sample-analysis.md`
> Reviewed contract: `context/changes/waste-report/api-contract.md`; review: `reviews/plan-review.md`

## What and why

Replace photographed paper waste sheets with structured loss entries in Supply OS. Start with the existing paper's 17 products and one additional Captain menu destination. Support both entry during the shift and a batch at the end of a day with one form.

## Starting point

The original paper form and codebase were checked. No waste module exists. Current order/inventory data and menu/API/auth components provide reusable patterns, but losses must remain separate from stock counts. Box reporting is deferred by Ben.

## Desired end state

A Captain can enter quantity and reason, save, and easily append further entries. The saved records can be read by location/date and exported by a Manager. Corrections retain original quantities through a void-and-add flow rather than silent overwrite.

## Selected quantity control

| Choice | Interaction | Main tradeoff |
| --- | --- | --- |
| B — field and additive quick amounts | Editable amount plus up to three labelled additions. Every tap adds, including repeated taps; different tiles can be combined. E.g. `+100 g` twice gives `200 g`, then `+50 g` gives `250 g`. | Few taps for common quantities; one extra row of controls. |

Ben selected B with additive tiles on 2026-11-04. The amounts above are illustrative; final display units/additions require the 30 actual reports requested. Manual entry is always available; invalid nonblank input disables additions until corrected. Blank starts at zero, and taps only edit the draft. No permanent mode/settings selector.

## Key decisions and provenance

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Initial catalog | 17 paper products; boxes later | Preserve the agreed first scope | Ben |
| Timing | One form, appendable saves | Works for individual incidents and end-of-day entry | Ben |
| Quantity UI | B: manual input and additive tiles on every tap | Ben selected the second preview and specified repeated addition | Ben |
| Calibration source | Existing Telegram archive/API in JARVIS-CODEX; Terra 6.1 medium | Use real report images and existing access | Ben |
| Storage | Separate Supabase tables through the existing seam | Loss is not stock-on-hand | Research / Plan |
| Save safety | Atomic batch + idempotency UUID; distinct rejected/uncertain outcomes | Retrying must not double a recorded loss; rejected forms stay correctable | Reviewed plan |
| Draft location | Pin scope and check before sending; abort if token changes | Old drafts must never be sent under a new location token | Review F1 |
| Numeric safety | Shared exact per-line bound, decimal strings and safe scaled additions | Avoid precision loss without rounding observations | Review F4 |
| Correction | Void with reason, then add correct entry | Preserve the original observation and audit trail | Plan default |
| Unsupported backend | Explicit 503 on seed/Sheets | Avoid false durable-write success | Research / Plan |
| GoStock | Preserve source identity/unit; no automatic mapping | Accepted product conversions are missing | Research |

## Scope

In scope: fourth menu button, selected quantity control, reasons/Other, durable appendable records, scoped history, Manager period/location view and generic CSV, focused tests and release proposal.

Out of scope: boxes, prices, pack conversions, GoStock import, Telegram runtime changes, reminders, individual staff authentication or a new dashboard.

## Architecture and approach

React form → typed role-aware `apiClient` → FastAPI/Pydantic → selected backend → transactional Supabase header/lines. The backend owns catalog units; frontend receives them. Source images remain private and separate from operational records. No dependency is added.

## Phases at a glance

| Phase | Deliverable | Main risk |
| --- | --- | --- |
| 1 | 30-report calibration of the selected additive tiles | Unreadable/duplicate photos and sparse product coverage |
| 2 | Typed catalog/contracts and atomic storage | Partial writes or unit drift |
| 3 | Role-scoped APIs and complete period readback/export | Location leakage or truncated totals |
| 4 | Minimal Captain form and Manager view | Invalid visible input or mobile crowding |
| 5 | Review, product checks and concrete release proposal | Treating local tests or a merge as production proof |

The supplied 30-report package has been reconciled; disposable Postgres and auth-enabled browser checks passed. The selected control is implemented and independently reviewed. The four targeted review findings are fixed in the plan (SOUND). Ben authorized autonomous implementation and E2E; production remains separately gated.

## Open risks and assumptions

- Source count: 30 unique records/images, 527 eligible daily cells and six provisionally calibrated products; see the analysis for exclusions and coverage limits.
- Signed-in Telegram app/browser downloads are prohibited by Ben. This client's Office login fails with `invalid_client_metadata`; use a working existing API session and hand back the private result path.
- Reasons, fractional-piece behavior and correction are explicit proposed defaults, not an already accepted company procedure.
- Quick amounts do not replace weighing. A missing day is not zero loss.
- Production migration, merge/deploy and real-period acceptance remain separate from planning and local checks.

## Success criteria

- Individual and batch entry both work with clear units and manual override.
- Append/retry/correction preserve correct quantities, provenance and role boundaries.
- Complete selected-period readback works, and a real pilot proves usability before archival.

## Delivery handoff

Backend `320abfb` and frontend `3cddf37` are locally verified. Full evidence is in `verification.md`, final review in `reviews/impl-review.md` and the concrete production action in `release-proposal.md`. No production release or real-period operator acceptance is claimed. Next: obtain separate approval for the migration + backend + frontend release, execute and verify the running artifacts before requesting a live pilot.
