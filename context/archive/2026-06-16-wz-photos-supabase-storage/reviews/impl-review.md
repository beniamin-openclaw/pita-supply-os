<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: WZ Photo Upload via Supabase Storage

- **Plan**: context/changes/wz-photos-supabase-storage/plan.md
- **Scope**: Code phases 1–4 (commits eb01efd, 758f191, ab74b35). Phases 0 & 5 are manual/operational and out of code scope.
- **Date**: 2026-06-16
- **Verdict**: APPROVED
- **Findings**: 0 critical · 2 warnings (both resolved/deferred) · 5 observations
- **Triage**: autonomous (per user directive to deliberate via subagents and pick the best recommendation)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS — all 38 planned changes verified MATCH; no drift/missing/extra |
| Scope Discipline | PASS — no scope creep; review remediations confined to staleness this change introduced |
| Safety & Quality | PASS — F1 fixed; key invariants confirmed clean (no service_role key in SPA, no persisted signed URL) |
| Architecture | PASS — side-service pattern + `_choose_backend()` seam respected |
| Pattern Consistency | PASS — endpoint degrade pattern, apiClient, TS↔Pydantic optionality all conform |
| Success Criteria | PASS (automated) — pytest 346, ruff, npm build, npm lint all green; manual UI checks pending (need live Supabase) |

## Findings

### F1 — Non-idempotent upload breaks the retry-photos path

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (reliability)
- **Location**: supply-os-v1/app/supabase_storage.py (`upload_photo`)
- **Detail**: With `upsert:"false"`, a transient failure mid-batch orphaned an object, and the frontend retry-photos path (re-sends the same batch) then hit a 409 on the already-uploaded file → 500, leaving the Captain stuck. Drive allowed re-upload; `upsert:"false"` regressed it. Object keys are receipt-scoped (`wz/<order_id>/<receipt_id>-NN`) and receipts are append-only, so the only file an overwrite can hit is the same one on a same-batch retry — exactly the case we want idempotent. On a partial-then-retry, `update_receipt` was never reached on the failed attempt (count stayed 0), so the retry's count is correct.
- **Fix**: Set `upsert:"true"` so retries overwrite idempotently; update the module doc + unit-test assertion.
  - Strength: Restores the retryable contract the frontend already implements; no cross-receipt collision risk (receipt-scoped keys).
  - Tradeoff: Minor — weakens "never overwrite" to "never overwrite *across receipts*", which is the actual invariant that matters.
  - Confidence: HIGH — verified the retry flow re-sends the same batch and that count stays correct.
  - Blind spot: A non-UI multi-batch *additive* upload to one receipt would still mis-count; not a real frontend flow at pilot scale.
- **Decision**: FIXED (upsert→"true", test + docs updated)

### F2 — Excess `drive.file` OAuth scope lingers in sheets.py

- **Severity**: ⚠️ WARNING (downgraded to OBSERVATION in triage — see Detail)
- **Impact**: 🔎 MEDIUM — removal carries prod-breakage risk; not a one-liner
- **Dimension**: Safety & Quality (least-privilege)
- **Location**: supply-os-v1/app/sheets.py:52 (`SCOPES`)
- **Detail**: After Drive removal, the gspread `SCOPES` still requests `…/auth/drive.file`. It is now arguably excess for Sheets-only use. But `drive.file` is a *narrow* scope (only files the app created/opened, not the SA's wider Drive), so exposure is low; and removing it risks breaking `open_by_key` Sheet access depending on gspread version — which needs testing against the live Sheet. Out of scope for this WZ-photos change (sheets.py functional code was untouched).
- **Fix**: Trim `SCOPES` to spreadsheets-only after verifying live Sheet read/append/update still works.
- **Decision**: DEFERRED → spawned a tracked follow-up task ("Drop excess drive.file OAuth scope from sheets.py").

### F3 — Stale "Drive" references in sheets.py doc-strings

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency (docs)
- **Location**: supply-os-v1/app/sheets.py:105 (`_client` docstring), :790 (`update_receipt` docstring)
- **Detail**: Drive removal left two doc-strings referencing "(Sheets + Drive)" and "WZ Drive folder reference + photo count" — misleading now that only Sheets consumes the resolver and the receipt stores a Supabase path prefix.
- **Fix**: Update both doc-strings to Sheets-only / Supabase Storage path prefix.
- **Decision**: FIXED

### F4 — Per-photo signing + 100-object list cap on the viewing endpoint

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality (performance/reliability)
- **Location**: supply-os-v1/app/main.py (`captain_receipt_photo_urls`)
- **Detail**: The GET endpoint signs N URLs per request and `supabase_storage.list_photos` returns ≤100 objects (Supabase default page size, no explicit pagination). Trivial at pilot scale (a few photos/receipt). A storage error there surfaces as a raw 500, but the frontend degrades cleanly (`setPhotoError`).
- **Decision**: ACCEPTED (pilot-acceptable; revisit if photos-per-receipt grows)

### F5 — Sheet column-rename is operationally optional (no bug)

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Data Safety
- **Location**: supply-os-v1/app/sheets.py (`update_receipt`) + main.py viewing endpoint
- **Detail**: `update_receipt` silently skips columns not in the header, so a not-yet-renamed Sheet just stores no prefix; the viewing endpoint then reconstructs `wz/<order_id>` from the stable `order_id`. The system works correctly before the operator renames the column — the rename only makes the stored prefix explicit.
- **Decision**: ACCEPTED (intentional graceful fallback; rename remains the documented Phase 5 step)

### F6 — Confirmed-clean invariants

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality (security)
- **Detail**: (a) `service_role` key is a `SecretStr` consumed only by `supabase_storage`; no `VITE_SUPABASE_*` exists, SPA only calls `/api/*` and receives pre-signed URLs. (b) Signed URLs appear only in response bodies, never passed to `update_receipt` — only the path prefix is persisted. (c) GET viewing endpoint is Captain-auth + location-scoped (404 on foreign). (d) content-type set explicitly on upload.
- **Decision**: ACCEPTED (no action — these are the load-bearing security properties, all hold)

### F7 — Pre-existing items in touched files (not introduced here)

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/captain-mp/OrderDetailPage.tsx:184-185, :47
- **Detail**: Two hardcoded Polish strings ("stan: "/"sugestia: ") bypass i18n, and only the most-recent receipt's photos are fetched (`receipts[0]`) — both pre-date this change and are consistent with the rest of the page. Not regressions.
- **Decision**: ACCEPTED (out of scope; could be tracked separately if the i18n rule is strictly enforced)
