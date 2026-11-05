<!-- IMPL-REVIEW-REPORT -->
# Phase 1 backend implementation review

- Date: 2026-11-05
- Reviewer scope: independent read-only review, Phase 1 only
- Candidate: `769a2f7`, compared with `ae643989`
- Plan: `context/changes/waste-reporter-products/plan.md`, read in full
- Verdict: **APPROVED for Phase 1**
- Actionable findings: **none (0 P1, 0 P2)**

## Reviewed behavior

Read the complete committed backend delta, connected waste detail/by-batch/list/void/CSV paths, migration0032 and 0033, the new unit/integration tests, existing concurrent retry/RLS/rollback/pagination tests, and the integration fixture. Also read the private backend implementation record. The frontend remains an independently implemented later phase and is outside this verdict.

- `supply-os-v1/app/models.py:14-60,79-101`: source identity excludes curated identity and free description; source quantities retain their exact base unit and three-decimal bound. Curated whole grams, kg conversion, Other restrictions and reasons retain their prior rules. Attribution trims before its 120-character bound and stays nullable solely for legacy parsing/read compatibility.
- `supply-os-v1/app/supabase_backend.py:109-142`: compatibility hashing removes only the two newly introduced null fields and retains legacy nullable fields and established quantity normalization. Exact stored batch resolution happens before the missing-name gate and live master validation. A new unnamed batch executes no INSERT. The original unique location/batch fence remains: a concurrent loser waits for the winner, then compares the stored digest and returns the stored snapshot or conflicts.
- `supply-os-v1/app/supabase_backend.py:143-174`: only the winning new report resolves authoritative master names/units, in the same transaction as header and lines. An unknown source or mismatched unit raises the shared rejection and rolls back earlier header/line inserts. Master `g` bypasses curated grams conversion. Server snapshots remain independent of later master changes or deletion; no source foreign key erases historical identity.
- `supply-os-v1/app/supabase_backend.py:98-106,177-231`: existing scoped reads round-trip attribution and source fields. Totals group separately by location, curated ID, source ID, manual description and unit; same-name master IDs are not merged. Void behavior and exclusion from totals remain intact.
- `supply-os-v1/app/main.py:7202-7214,7371-7395`: domain validation becomes 422/rejected, while storage failure remains unknown. CSV appends the two new fields after existing columns and applies the existing formula escaping to both. Both role exports reuse this path and Captain scope still comes from authentication. Persistence stays behind the existing backend seam.
- `supply-os-v1/migrations/0033_waste_reporter_products.sql:1-43`: additive nullable columns and six explicitly named broadened checks are transactional. Source-mode shape, exact submitted/canonical unit and quantity remain enforced; non-source checks retain their previous meaning. Curated whitelist/unit, decimal bounds, reasons, void completeness, keys/FKs and RLS are not removed. Existing rows and old-shaped inserts remain valid.

## Evidence assessment

The added integration tests meaningfully exercise the contracts: a manually built pre-change hash including its original null fields; SQL capture proving zero INSERTs on missing-name rejection; all five source units including fractional master `g`; rename/unit-change/deletion followed by exact replay; reporter/source changes conflicting; mixed-mode atomic rejection; equal-name/different-ID totals; role-scoped history/CSV and formula escaping. The migration regression constructs canonical0032 in an isolated schema, inserts legacy data, applies0033 and compares old field values and all untouched constraint definitions. Existing concurrency and RLS denial tests remain connected.

I ran `git diff ae643989..769a2f7 --check`: clean. I did **not** independently rerun pytest, Ruff, PostgreSQL or browser tests in this review. The parent reports an independent clean rerun of 1265 unit and 54 disposable-Postgres integration tests; those counts are parent evidence, not this reviewer's execution.

## Remaining boundaries

- This approves the backend phase, not the unfinished full application or production promotion. Frontend frozen-body matching, restored drafts, chooser behavior and both-role browser E2E still require their planned review/verification.
- Migration0033 must precede the dependent application after explicit release approval. Once opak/box or other widened-unit rows exist, reverting to ae643989's narrow waste readers is unsafe. The accepted plan retains a widened reader or disables the feature with the documented pre-waste fallback while preserving data; the final release package must name the concrete artifact.
- The parent records that the old browser fixture was normalized only in a synthetic local clone to canonical0032 before0033. This review neither queried production nor independently attests its schema fingerprint. The canonical migration/test comparison supports the code-level prerequisite, not a production-state claim.

Exact next step: finish frontend integration, run the planned authenticated real-Postgres E2E and final frozen-delta review, then prepare the concrete migration/application/rollback release proposal. No source edits, shared documentation edits, commits, production queries or runtime changes were made by this reviewer.
