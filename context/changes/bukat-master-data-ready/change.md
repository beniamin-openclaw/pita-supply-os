---
change_id: bukat-master-data-ready
title: Verify & correct Bukat master data + ops fields so suggestions are pilot-ready
status: implemented
created: 2026-06-05
updated: 2026-06-05
archived_at: null
---

## Notes

Verify and correct Bukat master data (supplier_products units/prices + Wola min/max/target) and Bukat ops fields (email, cutoff_time) so the suggestion engine is trustworthy for the pilot — foundation F-01, PRD FR-012 / US-01. Data-readiness pass (audit → verify-with-owner → correct live sheet + mirror to seed → validate suggestions), not a code change; skip plan/implement.

Outcome: 8-cell diff applied to both seed CSV and the live Google Sheet, read-back verified, suggestions re-validated. See `audit.md` → "Execution log (2026-06-05)". Spun out S-09 (engine 0.1-kg rounding for weight SKUs) — parked for a separate session.
