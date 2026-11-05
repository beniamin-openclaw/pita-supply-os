# Release proposal: mandatory waste reporter and master products

Status: APPROVED AND DEPLOYED. Ben explicitly approved migration 0033 and PR [85](https://github.com/beniamin-openclaw/pita-supply-os/pull/85). Actual production merge: `e4d4c5490d726fce10c38719c6e0fa2ebdee0ef2`; see release-verification.md. The ordered steps below retain the reviewed procedure.

## Behavior

Every new waste report requires the reporter's first name, following the existing name/datalist convention. Both histories and CSV retain it. Historical reports remain unnamed; no person is invented or backfilled.

The original 17 cards and manual Other remain. + Product searches the entire authenticated master list, including inactive products. Added rows keep their actual inventory unit, accept repeated +1 and manual quantities, and can be removed before saving. Products without a master unit remain visible but disabled with an explanation. No package or unit conversion is guessed.

## Exact candidate

- Baseline: production/main `ae643989ad2d012d52278dbb0a28284c86de1181` (PR 84).
- Application source: `85f6e49`; later commits contain verification/release documentation only. The PR's final head and its hosted CI must be confirmed immediately before promotion.
- Migration: `supply-os-v1/migrations/0033_waste_reporter_products.sql`.
- Migration SHA256: `ff52ac1291c162005c65bc1c48f0f2ea4b1c53f9c5a5150716ca859327081bad`.
- Existing 0032 SHA256: `cbdb193e040ca37d031afe6cd74b3c0da1bd9e72859b7ab8cf5450fdd58a9f67`. Do not reapply it.

Migration 0033 adds nullable reporter/source columns and replaces six explicitly named checks to admit master identities and their units. It preserves existing observations, quantity/reason/void/curated checks, keys and RLS. No order, inventory, master-data, credential or environment change is included.

Read-only production preflight on 2026-11-05 confirmed canonical 0032 checks, no 0033 columns, RLS on both tables, one real report/five lines and 196 master products. Repeat this preflight: counts may change as people use the application.

## Ordered release

1. Obtain Ben's explicit approval for this migration plus PR 85. Confirm the reviewed PR head, all three product CI jobs, unchanged main and current Railway/Vercel rollback artifacts.
2. Recheck the six old constraint definitions and absence of the two new columns. Privately record existing-row fingerprints, counts, constraints and RLS/policies. Do not save credentials or personal report contents.
3. Apply exact 0033 in one transaction, with a 5-second lock timeout and 30-second statement timeout. On failure, roll back and investigate. After an uncertain result, read the state before retrying. Verify new columns/checks, retained RLS and unchanged old-row fingerprints.
4. Merge only the reviewed head with expected-head protection. Main auto-deploys Railway and Vercel. During the brief staggered rollout an old frontend may receive a definitive 422 until refreshed; drafts must remain intact.
5. Wait for successful production artifacts on BOTH hosts for the actual merge SHA and green product CI. Verify backend health/data source, authenticated catalog and full products, both scoped histories/CSV, no-auth/wrong-role denial and mobile/desktop UI. Use read-only production checks; do not invent production waste or supplier orders.
6. Only then ask Ben to test a real named report with an extra product, history and CSV. Record his acceptance separately; do not archive before acceptance. Office email/group drafts remain unchanged and unsent.

## Rollback and accepted limits

Preserve all tables, additive columns, reports and audit. Never DROP, DELETE, rewrite observations or backfill names as rollback. Failed transactional DDL changes nothing. A committed migration may remain with the old application until widened-unit observations exist.

Once master g, opak, box, pojemnik or other widened units are stored, the old `ae643989` waste readers are unsafe: they accept only kg/szt. Prefer a forward patch or retain widened readers. For emergency withdrawal, the concrete known compatible fallback is pre-waste source `02a0930e09e09648a0e75dfb22f1cb1d96006144`, temporarily disabling waste while retaining its data. Historical artifact references (availability checked at release):

- Railway: `5c51c288-e002-4b0a-8ad6-b87fe3746c8f` is now REMOVED. Do not assume one-click restoration; redeploy the known pre-waste source through a reviewed corrective release if feature withdrawal is needed.
- Vercel GitHub Production deployment: `7491246259`.

Recheck artifact availability and parallel main changes before rollback; verify both hosting surfaces afterwards. Do not revert unrelated work.

No full production database backup is created or claimed by this additive release. Approval covers that stated limit and the data-preserving forward-patch/feature-withdrawal recovery path. Transactional DDL and row/schema fingerprints protect the scoped migration, not unrelated database failures. Missing master units require a separate master-data correction.

## Verification and next step

Ruff, 1265 backend tests, 54 real-Postgres integration tests, frontend build/lint and 1343 frontend tests across 90 files passed. Root independently reran the complete gates. Authenticated real-Postgres browser E2E passed: required name, full chooser, exact mixed units including 0.5 g, reload retention, lost-response recovery without duplication, locked 404 and identical retry, unchanged legacy replay, both histories, real CSV download and separate same-name source totals. Seven legacy reports retained their original data. Two final reviews approved the application without actionable P1/P2 findings; see `verification.md` and `reviews/`.

Local evidence: `/Users/ben/Documents/Codex/2026-11-05/supply-v2-waste-report/reporter-products/`. These private machine-local artifacts provide provenance and are not team-shared evidence or production proof. Hosted CI and the exact release head are confirmed in the operator handoff. The migration and actual Railway/Vercel deployment are now verified. Next: Ben tests a real named report with an extra product and confirms acceptance before archive. No synthetic production reports were created.
