---
change_id: api-error-localization-pl
title: Localize FastAPI 422 validation errors to Polish in the UI
status: implementing
created: 2026-06-17
updated: 2026-06-17
archived_at: null
---

## Notes

localize FastAPI 422 validation error messages to Polish in the UI — map the Pydantic error `type` (missing / too_short / greater_than_equal / etc.) to PL i18n templates instead of surfacing raw English Pydantic text under the PL "Błąd wysyłania:" prefix; cover the common form validations first (Tier 1 from roadmap Parked); business-rule 400s stay English (Tier 2, needs backend error codes).

From roadmap `## Parked` and the `manager-ux-feedback-backlog` memory. Owner hit this during the 2026-06-17 smoke-check (e.g. "Błąd wysyłania: lines: List should have at least 1 item after validation, not 0"). `manager-queue-ux` already fixed the `[object Object]` rendering; this closes the remaining raw-English-detail gap. Sibling: [[order-screen-ux-fixes]] (Bug B removed the most common trigger of the empty-lines 422).
