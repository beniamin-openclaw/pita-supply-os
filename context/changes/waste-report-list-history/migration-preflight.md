# Read-only production schema preflight

Date: 2026-11-04. Existing authenticated Railway CLI access identified the `pita-supply-os` production service. The configured backend is Supabase. Credentials were retained in process memory, never printed or written to artifacts. A database transaction explicitly set READ ONLY returned:

| Schema object | Present |
| --- | --- |
| public.locations | yes |
| public.waste_reports | no |
| public.waste_report_lines | no |

No schema/data/runtime/config mutation occurred. This is actual schema evidence; remote main still points to `02a0930e09e09648a0e75dfb22f1cb1d96006144` at this preflight. Production application behavior and schema drift since this read remain unverified.

Required before production promotion: the parent's reviewed additive `supply-os-v1/migrations/0032_waste_reports.sql`, SHA-256 `cbdb193e040ca37d031afe6cd74b3c0da1bd9e72859b7ab8cf5450fdd58a9f67`. It adds the two separate waste tables, keys/checks/index and deny-all public RLS, with no orders/inventory modification or historical import. Apply in one transaction with stop-on-error only after Ben's specific production approval, then read back the actual constraints and RLS. Failure rolls back the transaction; do not promote application code until schema verification passes. Preserve tables/data on application rollback.

An asynchronous approval question for migration0032 only (no merge/deploy) is pending. A selected default or elapsed time is not approval. Unless Ben authorizes that action, deliver the reviewed PR with this explicit prerequisite and do not call the production release merge-only ready. Local application work and E2E continue independently.


## Authorized execution and verified outcome

Ben explicitly approved only migration0032. It was applied in one transaction after a fresh absent-table preflight; commit confirmed. Actual readback:2tables, enabled RLS onboth,0publicpolicies,21constraints,5indexes,0rows ineachtable. No existing table/data mutation, syntheticproductionentry, applicationmerge/deploy, restart orconfigchange. A full backup was not created/verified for this additive transaction; retain existing tables/data on rollback. The pending-question paragraph above is historical, superseded by this explicit approval and outcome.

Private before/after constraint/index evidence: `test-runtime/production-migration-0032.json` under the task's private evidence directory. Shared WORKLOG and REMOTE_RUNTIME_STATE append-only entries record this production mutation. The schema prerequisite is now satisfied at this readback; final application/CI readiness remains to be verified before presenting the PR for Ben's merge decision.
