---
change_id: elektrownia-westfield-rollout
title: Roll out ELEKTROWNIA and WESTFIELD (activate, address, thresholds) and refresh NORBLIN thresholds from Marek's min/max sheets
status: new
created: 2026-09-29
updated: 2026-09-29
archived_at: null
---

## Notes

Ops lane (prod Supabase master data + Railway captain tokens, no product code). Operator request
2026-09-29: prepare the app for Fabryka Norblina, Elektrownia Powiśle and Westfield Mokotów from the
attached min/max lists, report gaps, provide captain access codes for 2026-09-30, and write a
reusable checklist for opening a new location (`docs/pita-supply-os-v1/NEW_LOCATION_CHECKLIST.md`).

Sources:
- Norblin and Westfield: CSV exports of Marek's "min/max" tabs (operator attachment, 2026-09-29).
- Elektrownia: the attachment was the 27.09 stock count (no min/max); thresholds were read from the
  "min/max" tab of the Drive sheet "Elektrownia - Inwentaryzacja" (1C0Pa2jaLCi_VsniVD1nCjF_leUDOASIkMQb278mYYAo).

Files: `prod-sql.sql` (one DO block + audit), `rollback.sql`, `rollout-notes.md` (diff before, apply
log, held items, operator to-do). Captain tokens are never written to the repo.

Code: none needed — backend and frontend are multi-location since `bracka-rollout`; the captain token
parser accepts any number of `LOCATION:token` pairs; delivery rules for Pago/Mory at both new
locations already exist (`supplier_delivery_rules`, 2026-09-28).
