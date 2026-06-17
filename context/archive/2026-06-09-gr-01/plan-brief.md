# GR-01 Goods Receiving — Plan Brief

> Full plan: `context/changes/gr-01/plan.md`
> Research: `context/changes/gr-01/research.md`

## What & Why

A Captain confirms a delivery against a dispatched order — recording delivered quantity per line (vs. ordered) and uploading WZ delivery-note photos — so there is a durable, analyzable record of what actually arrived. Photos are stored on Google Drive, ready for later cross-check/ML against what the Captain confirmed. The receiving step is a parked PRD Non-Goal being pulled forward as an MVP on the current stack.

## Starting Point

Orders today end at `manager_sent` after the Manager dispatches them; there is no receiving step. The data-layer seam (`_choose_backend()`) already hosts `inventory_counts`/`inventory_count_lines` as a precedent entity. The service account holds a `drive.file` scope but never calls Drive; there is no file-upload path in either backend or frontend, and no server-side email.

## Desired End State

A Captain opening one of their `manager_sent` orders sees "Potwierdź dostawę", records delivered quantities + WZ photos, and confirms. A `receipts`/`receipt_lines` record is persisted, photos land in a per-order Google Drive folder, and the order detail then shows "Dostawa potwierdzona" with a Drive folder link. The photos + confirmed numbers are available for later analysis.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Email / accountant hand-off | **None in MVP**; show Drive folder link in-app | User doesn't want photos emailed; defer the notification — removes the entire (nonexistent) server-side send subsystem | Plan |
| Photo storage | **Google Drive**, folder-per-order, via Drive API + service account | Only buildable-today option (base64-in-Sheets impossible; Supabase blocked on S-10); reuses existing GCP infra | Research → Plan |
| Drive folder contents | **Photos only** (numbers stay in `receipt_lines`) | Single source of truth for quantities; analysis joins photo + sheet via the same SA | Plan |
| Send/failure model | **Persist receipt first, upload photos after, warn + flag on fail** | A flaky-mobile photo failure must never lose the confirmed delivery | Plan |
| Photo required? | **Required, with a `received_with_missing_wz` flag** | Enforces the WZ-capture habit without hard-blocking a Captain who can't photograph | Plan |
| Data model | Standalone append-only `receipts`/`receipt_lines`; **no `OrderStatus` change** | Mirrors inventory-count precedent; Tier-1 forbids touching the status workflow | Research → Plan |
| Scope vs gates | **Build now on the sheet stack; prod deploy out of scope** | Ships parallel to S-10; respects "don't stack two big changes"; deploy gated on D-01 | Research → Plan |

## Scope

**In scope:** Captain confirm-delivery screen (delivered-vs-ordered per line, variance), WZ multi-photo upload to Google Drive (folder-per-order), the `receipts`/`receipt_lines` entity + Captain read/list endpoints, in-app Drive folder link, backend + Drive-mocked tests.

**Out of scope:** Any email/notification; new `OrderStatus` or order-status change; Manager/owner receipt-view UI; structured-summary file in Drive; production deployment (D-01); Supabase/S-10; Telegram alerts; OCR/ML.

## Architecture / Approach

Backend-first. A new entity (`receipts`/`receipt_lines`) sits behind `_choose_backend()`, mirroring `inventory_counts` (models → `sheets.py` read/append/get/update → Captain routes), fully testable in seed/mock mode. A new `drive.py` side-service (reusing the SA credentials + `drive.file`) handles a find-or-create per-order folder and photo upload via a multipart endpoint; it degrades to 503 when unconfigured. The frontend adds the first file-upload path: a confirm screen reached from the order detail, a multipart `apiClient` helper, and a mobile-camera photo control with client-side compression. Confirm = persist receipt (JSON) → then upload photos (multipart); a photo failure leaves the receipt flagged `received_with_missing_wz` and retryable.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend — `receipts` entity | Persisted receipt + Captain submit/detail/list routes (no Drive) | Getting the effective-ordered snapshot + variance right; tab header drift |
| 2. Backend — Drive upload | `drive.py` + multipart photos endpoint, folder-per-order, flag flip | `drive.file` folder-share nuance; needs live creds only for manual verify |
| 3. Frontend — confirm screen | Receive screen, multipart helper, mobile camera + compression, order-detail entry | First-ever file upload + camera/compression on real phones |

**Prerequisites:** Owner creates the `receipts`/`receipt_lines` Sheet tabs and a "WZ Photos" Drive folder shared to the service account (+ `SUPPLY_OS_GDRIVE_WZ_FOLDER_ID`). Code can be written/tested without these (seed + mocks); they gate manual verification only.
**Estimated effort:** ~3 sessions, one per phase.

## Open Risks & Assumptions

- **Assumption (flagged):** receipts are standalone + append-only and do **not** change the order's status (a re-confirm makes a new receipt). Override at review if a `closed` transition is wanted.
- **Drive `drive.file` scope** must be able to write into the shared WZ folder; if visibility issues arise, switch to a Shared Drive (setup-time, not a code change).
- **Prod is gated on D-01** (`main` isn't live) — this plan stops at green automated tests + a branch/PR; deployment is owner-run and separate.
- Live Google Drive credentials are needed only for Phase 2 manual verification, not for building or unit-testing.

## Success Criteria (Summary)

- A Captain can confirm a `manager_sent` delivery with delivered-vs-ordered quantities and a WZ photo, and the receipt + photo persist (photo in a per-order Drive folder).
- The order detail surfaces "Dostawa potwierdzona" + a working Drive folder link; discrepancies and missing-WZ are visible.
- A photo-upload failure never loses the confirmed receipt (persist-first), and the upload is retryable.
