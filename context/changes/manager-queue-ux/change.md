---
change_id: manager-queue-ux
title: Fix three Manager/Captain queue UX bugs (error copy, claim strikethrough, queue ordering)
status: impl_reviewed
created: 2026-06-16
updated: 2026-06-16
archived_at: null
---

## Notes

fix three Manager/Captain UX bugs grounded 2026-06-16: (1) "[object Object]" error messages from FastAPI 422 array detail in apiClient.ts, (2) freshly-claimed Manager order lines render struck-through + "Anulowane przez managera" because manager_final_qty=0 is treated as cancelled in OrderLineTable, (3) new orders not at top of Manager queue (backend sorts by cutoff_iso then 60s FE refresh). See manager-ux-feedback-backlog memory.
