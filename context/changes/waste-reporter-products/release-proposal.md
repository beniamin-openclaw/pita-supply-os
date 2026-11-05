# Release proposal: mandatory waste reporter and master products

Status: REVIEWED LOCAL CANDIDATE; NOT DEPLOYED. Production promotion needs Ben's explicit approval for migration0033 and the reviewed application.

## Business behavior

New waste reports require the reporting person's first name, following the existing free-text/datalist convention. Histories and CSV retain that attribution. Existing reports show that no name was recorded; no person is invented or backfilled. The original17cards and manual Other remain. + Product searches the complete authenticated master list, including inactive products. Added rows keep the actual inventory unit, support repeated +1 and manual amounts, and can be removed before save. Products with a missing master unit remain visible but cannot be selected; do not guess a conversion.

## Candidate and prerequisites

- Baseline: production/main ae643989ad2d012d52278dbb0a28284c86de1181, merged PR84.
- Lane: codex/waste-reporter-products; backend phase769a2f7. Final application source:85f6e49. The following release commit adds verification/review documentation only.
- Apply only `supply-os-v1/migrations/0033_waste_reporter_products.sql` before dependent code. SHA256: `ff52ac1291c162005c65bc1c48f0f2ea4b1c53f9c5a5150716ca859327081bad`.
- Migration adds nullable reported_by/source_product_id and replaces exactly six named0032checks to admit independent master identities and their units. Preserve all old rows, quantity/reason/void/curated checks, keys and RLS. No order/inventory/master-data change, backfill, data deletion, environment or credential change.
- Existing0032SHA256 remains cbdb193e040ca37d031afe6cd74b3c0da1bd9e72859b7ab8cf5450fdd58a9f67; never reapply it.
- Read-only production preflight2026-11-05: canonical0032check names present,0033notapplied, RLSonboth tables,1realreport/5lines,196masterproducts. Counts may change; repeat immediately before migration. Do not treat the old pre-release zero counts as current.

## Ordered release

1. Confirm final reviewed PR head, green product CI and unchanged main. Confirm explicit approval covers this migration and application merge/deploy. Recheck current Railway/Vercel artifacts and record immediate rollback choices.
2. Read-only schema preflight compares all six old constraint definitions and verifies new columns absent. Record existing report/line counts, RLS/policies and old-row fingerprints privately; do not log credentials or personal report contents.
3. Apply exact0033in one transaction with lock timeout5s and statement timeout30s. On contention/failure roll back and investigate; never retry an uncertain commit without readback. Verify two new columns, all required constraints/RLS and unchanged old-row fingerprints. Keep every new observation.
4. Merge only the reviewed head using expected-head protection. Main auto-deploys the backend to Railway and frontend to Vercel. Keep the brief staggered rollout explicit: a stale frontend can receive a definitive422until refreshed; unsaved drafts must remain intact.
5. Wait for successful Railway AND Vercel production artifacts for the actual merge SHA, plus product CI. Verify real backend health/data backend and authenticated public API/schema, catalog17, full products and both role-scoped histories/CSV. Check missing-auth/wrong-role denial and public UI reporter/chooser/history on mobile/desktop. Use GET/read-only checks; never create fake production waste or supplier orders.
6. Only after that hand Ben the live screen for a real named report with an extra master product, history and CSV. Record his acceptance separately; do not archive before acceptance. The Office email/group copy remains unchanged and unsent.

## Rollback and limits

Preserve additive columns, tables, old and new reports and audit. Never DROP, DELETE, rewrite observations or backfill people as rollback. A failed migration transaction changes nothing; a committed migration can remain safely in place with the old application until master-unit data appears.

After any master g/opak/box/pojemnik or other widened-unit row has been written, ae643989's kg/szt-only waste response models are NOT a safe application rollback. Prefer a forward patch or retain the widened reader. If immediate feature withdrawal is required, the concrete known compatible fallback is pre-waste source `02a0930e09e09648a0e75dfb22f1cb1d96006144`, which disables waste while preserving tables/data. Recorded artifacts: Railway deployment `5c51c288-e002-4b0a-8ad6-b87fe3746c8f`; Vercel GitHub Production deployment `7491246259`. Recheck artifact availability/current parallel main changes before using them, and verify both hosting surfaces after rollback. Never silently revert unrelated later work.

No full production database backup is created or asserted by this additive release. Transactional DDL and row/schema fingerprints protect the scoped migration, not unrelated database failures. Blank master units need a separately authorized master-data correction; this release exposes them honestly.

## Verification and exact next step

Backend: Ruff clean,1265unit tests and54disposable-Postgres integration tests passed on769a2f7; independent Phase1review approved without P1/P2findings. Local canonical0032→0033preservation regression passes. The synthetic browser clone's old draft schema was normalized to canonical0032before0033; production was queried read-only and already has canonical checks.

Frontend build/lint and1343tests/90files passed on final application85f6e49. Root independently reran all gates. Authenticated real-Postgres browser E2E passed: required-name focus/noPOST, full master chooser/missing-unit explanation, mixed units including literal0.5g, scoped draft reload, lost200readback without duplicate, by-batch404locked + identical retry, unchanged legacy replay, both histories, actual CSV and separate same-name source totals. Independent final plan and safety reviews APPROVED with0P1/P2; each independently ran39focused frontend tests. See verification.md and reviews/. Draft PR: https://github.com/beniamin-openclaw/pita-supply-os/pull/85. Backend/frontend application source remains85f6e49; later commits contain verification/review/release documentation only. Hosted product CI runs on the final PR head; confirm all three product jobs before promotion. Do not merge before explicit approval. Private evidence directory: `/Users/ben/Documents/Codex/2026-11-05/supply-v2-waste-report/reporter-products/`.
