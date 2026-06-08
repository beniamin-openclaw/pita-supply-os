---
change_id: bukat-suggestion-learning-loop
title: Suggestion learning-loop review aggregate (roadmap S-03, FR-012)
status: impl_reviewed
created: 2026-06-09
updated: 2026-06-09
archived_at: null
---

## Notes

Roadmap **S-03** (must-have learning loop). Operationalizes FR-012 "Owner verifies suggestion outcomes" — a read-only aggregate over the per-line order history (`order_lines`) so the owner can see, per product, where the engine's suggestion was overridden (captain/manager deltas + reason codes) and decide where to correct master data. The roadmap frames S-03 as a thin build that "reads the present per-line history"; this is exactly that — one aggregate read endpoint + an owner/manager review view. No new write path; master-data correction stays an out-of-band sheet edit (Non-Goal: no auto-correction).

Constraints: sheet-only (order_lines persist only in sheet mode; seed → []), all reads through `_choose_backend()`, every endpoint returns a Pydantic model, API via `apiClient.ts`, copy via `i18n/`. Sheet-mode positive paths deferred to the deploy gate (no real pilot data / Google creds locally; logic covered by synthetic tests). Autonomous build.
