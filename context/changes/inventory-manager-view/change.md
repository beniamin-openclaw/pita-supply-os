---
change_id: inventory-manager-view
title: Manager inventory view + Captain inventory history (roadmap S-08, FR-018/FR-019)
status: plan_reviewed
created: 2026-06-09
updated: 2026-06-09
archived_at: null
---

## Notes

Roadmap **S-08** (Phase 2, should-have). Manager views submitted inventory counts across locations (FR-018); Captain/Owner browse inventory history over time (FR-019). Prerequisite S-06 (done) — snapshots persist via `inventory_counts` / `inventory_count_lines` behind `_choose_backend()`.

Backend Captain list/detail endpoints already exist (`GET /api/captain/inventory/counts` + `/count/{id}`, built in `inventory-count-followups` Phase 3, archived 2026-06-08). This slice adds the **Manager-side** read endpoints (manager auth, cross-location) + the **frontend consumption surfaces**: a Manager inventory list/detail view (FR-018) and a Captain history list/detail view reachable from the Remanent area (FR-019).

Constraints: sheet-only reads (seed degrades to `[]`/503, never 500), all persistence/reads through `_choose_backend()`, every endpoint takes/returns Pydantic models, API only via `apiClient.ts`, copy only via `i18n/`. **Defer** heavy per-product trend charts (the chronological snapshot list + detail IS the history browse; trends are a stretch past should-have). Autonomous build — no real Google creds locally; sheet-mode manual checks deferred to deploy gate.
