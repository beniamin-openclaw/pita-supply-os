---
change_id: inventory-count-followups
title: Inventory-count follow-ups: editable date, attribution, snapshot pre-fill picker
status: impl_reviewed
created: 2026-06-08
updated: 2026-06-09
archived_at: null
---

## Notes

Inventory-count quality follow-ups surfaced by the 2026-06-08 Wola×Bukat demo feedback. Parallel track — does NOT touch the Bukat pilot. Scope (decisions locked with the operator): FR-020 editable count date (date-picker, default today, reject future) — count_date column already exists, endpoint currently hardcodes today. FR-021 lightweight "counted by" free-text attribution → lands in the existing count_user field (NOT per-user auth; the v0 Non-Goal holds). FR-022 "last count: who/when" reassurance banner on the inventory screen (add count_user to InventoryLatestResponse) — addresses the two-people-counting concurrency worry. FR-023 promote the inventory pre-fill (FR-017, already working as a conditional dismissable banner) to an always-available "fill from inventory" button. FR-024 NEW: let the Captain choose WHICH inventory snapshot to pre-fill from (not only the latest) — needs a list endpoint + get-by-count_id route + picker UI. Follow-up: improve discoverability of the inventory entry point (navigation). Out of scope: supplier KPI / error tracking (belongs to the order-lifecycle epic / receiving module); master-data gaps (PRD Open Question #2, owner fixes the sheet).
