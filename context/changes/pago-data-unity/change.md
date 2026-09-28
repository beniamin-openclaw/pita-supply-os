---
change_id: pago-data-unity
title: Read-only reconciliation of Pago orders between the app, the ordering sheet and sent mail
status: new
created: 2026-09-28
updated: 2026-09-28
archived_at: null
---

## Notes

READ-ONLY reconciliation of Pago (and Mory/Magazyn) orders between the app (Supabase) and the "Ordering PB v5 prod" sheet + biuro@ Sent mail, from 2026-08-20; outputs reconciliation.md + proposal.md (one-time cleanup, weekly process, optional ORDER_INPUT export idea). No writes to DB, sheet or mailbox.

2026-09-28: the operator approved the cleanup direction (via the coordinator session): prepare it, do not run it. The one-time prod cleanup (groups A/B/C) is prepared in `prod-sql.sql`: step 0 diff, step 1 one guarded transaction, step 2 audit, step R rollback. The exact diff for the operator is in `cleanup-diff.md`. It was tested on a throwaway local Postgres copy only. **Not run on prod.** `ORD-20260921-WOL-MORY-0cdb48` stays out of the script until Marek answers the Tacki bez logo / Box beżowy question.
