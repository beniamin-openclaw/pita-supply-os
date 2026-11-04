# Waste report — concrete production release proposal

Status: prepared; awaiting Ben's production approval. No push, migration, main merge or deployment has been performed.

## Reviewed artifacts

- Repository: `beniamin-openclaw/pita-supply-os`; isolated branch `codex/supply-v2-waste-report`.
- Exact application candidate: `3cddf37` (includes backend `320abfb`, source/catalog commits `b448d00` and `4b5cb35`). Base main: `02a0930e09e09648a0e75dfb22f1cb1d96006144`, confirmed against the remote during this task.
- Additive migration: `supply-os-v1/migrations/0032_waste_reports.sql`, SHA-256 `cbdb193e040ca37d031afe6cd74b3c0da1bd9e72859b7ab8cf5450fdd58a9f67`.
- Frontend route `/captain-v2/waste-report`; Manager route `/manager/waste`. Backend uses the existing configured Supabase persistence seam. No new secret or environment variable is required.
- Verification and independent review: `verification.md` and `reviews/impl-review.md`. Later documentation-only commits on this lane do not change the application candidate.

Business effect: Captains enter individual losses or several rows in one save, add later without replacing previous entries, and correct through a visible void audit. Managers read period/location totals and export original rows. Existing supplier ordering and inventory contracts stay intact.

## Approved execution sequence

1. Recheck remote main and the exact candidate. If main has advanced, integrate current main on the isolated lane, resolve conflicts, rerun affected checks and refresh this proposal before promotion. Do not overwrite or force-push another lane. Verify Railway/Vercel project linkage and the live backend's configured data backend without printing credentials. Use the operator's existing authorized Supabase access; production access has not been tested in this task.
2. Before changing the schema, confirm migrations through 0031 are present, required `locations` exists, and neither waste table is present. If a table exists already, inspect its actual schema/data and migration history; do not blindly reapply or drop it. Confirm the current managed backup/recovery point. Apply the fingerprinted 0032 file in a single transaction, stopping on any error. With an existing securely configured connection this is `psql --set ON_ERROR_STOP=1 --single-transaction --file supply-os-v1/migrations/0032_waste_reports.sql`; supply the connection through the established operator mechanism, never the command log. Read back columns, foreign keys, constraints, unique key, indexes, and enabled RLS/no public policies on both tables. Keep the current application running until this passes.
3. Promote the exact reviewed application candidate `3cddf37` to main using a normal fast-forward (or the repository's existing integration flow). Do not force-push. Main auto-deploys the backend on Railway and frontend on Vercel; migration must precede that promotion. Task documentation may be integrated separately, with no application-tree changes. No dependency upgrade or configuration change is part of this release.
4. Verify Railway reports the deployed candidate and a healthy `/health`; verify the backend actually selects Supabase and serves the 17-item authenticated catalog. Verify Vercel's production deployment source commit/bundle and existing `/api/*` rewrite to Railway. Confirm the fourth menu item and both routes in the deployed bundle. A successful main push or a local green build is insufficient evidence.
5. Using authorized existing roles, perform read-only production checks: missing token is rejected; Captain history is location-scoped; Manager history and CSV load with only a Manager token. Do not create synthetic production waste entries or place a supplier order. Capture deployed version identifiers and query evidence without tokens.
6. Offer the live pilot only after both builds and schema are verified. On a real loss, confirm amount/unit/reason, persisted readback, a later addition, period totals and CSV. If correction is needed, preserve the original through void and add the actual corrected observation. Compare against the original source for that period; absence of a report is not zero. Ask operators whether entry is usable and reduces transcription, especially for the six provisional products. This acceptance closes human criteria, not local testing alone.
7. Record every production mutation, deployed artifact, verification result, rollback point and exact next step in the JARVIS operational state documents including `REMOTE_RUNTIME_STATE.md`. Archive the 10x change only after accepted completion; reconcile roadmap/AGENTS at archive as required by lessons.

## Rollback

Before any new application release, the additive tables alone do not alter existing ordering. On migration failure the single transaction rolls back; do not promote code that requires it. On application regression, restore both Railway and Vercel to their verified pre-release builds from main `02a0930` (or the preflight's newly verified base) and verify health plus the existing ordering flow through read-only checks. Prefer a normal revert of the feature application's commits if rolling back through main; preserve unrelated subsequent commits. Keep the waste tables and every recorded row/audit for recovery. Do not drop tables, delete reports or reverse the schema as an automatic rollback. The preceding application does not use the additive tables.

Remaining risk: local tests do not prove production connectivity or real-period usability. Tile evidence is selected, not a complete/random archive; six products are provisional and three-decimal piece precision cannot exactly represent one third. No GoStock import, box catalog, monetary valuation or historical report import is included.

Exact next step: Ben approves migration 0032 plus backend/frontend application candidate `3cddf37`; then execute the sequence above and verify the running artifacts before a live pilot.
