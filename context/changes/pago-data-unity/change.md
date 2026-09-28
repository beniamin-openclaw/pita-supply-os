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

2026-09-28, APPLIED: the coordinator session ran the cleanup on prod after the operator's go.
- STEP 0 matched `cleanup-diff.md` row for row and was saved as `cleanup-diff-before.md` (the rollback source).
- STEP 1 ran as the single `DO $$ … $$` statement with no error.
- STEP 2 audit: 13/13 ok. Re-checked independently from this session with a read-only query: 13/13 ok.
- The after-state is in `cleanup-diff-after.md`. BRA 14.09 `last_edited_at` = 2026-09-28 13:13:49 UTC.
- Nothing was sent. Do NOT re-run STEP 1: it would stop at A1 and roll back.

Still open (operator):
- delete the biuro@ drafts by hand;
- check the Manager screen;
- close `ORD-20260921-WOL-MORY-0cdb48` in the app once Marek answers the Tacki bez logo / Box beżowy question.
