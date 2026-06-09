# GR-01 Goods Receiving Implementation Plan

## Overview

Add a Captain-facing **goods-receiving** flow on a dispatched order: the Captain records delivered quantity per line (vs. ordered), uploads WZ delivery-note photo(s), and confirms. The confirmation persists a new append-only **`receipts` / `receipt_lines`** entity (mirroring `inventory_counts`, behind `_choose_backend()`), and the photos are uploaded to **Google Drive** (folder-per-order) via the Drive API + the existing service account. The Drive folder link is surfaced in the app. **No email is sent** — the accountant hand-off is deferred to a later phase.

## Current State Analysis

- **No goods-receiving exists.** Order lifecycle ends at `manager_sent` (`supply-os-v1/app/models.py:18`); `closed`/`cancelled` are defined but never written by any route.
- **The data-layer seam** (`_choose_backend()`, `supply-os-v1/app/main.py:228`) is the only persistence path. `inventory_counts`/`inventory_count_lines` is the canonical "new entity behind the seam" precedent (`supply-os-v1/app/sheets.py:687`+, `supply-os-v1/app/main.py:1413`+). `seed_loader.py` has no entity loaders and needs none — routes degrade with `if backend is not sheets`.
- **No file upload anywhere.** Backend has no `python-multipart`/`UploadFile`; frontend `apiClient.ts:50` is JSON-only; no image/camera handling exists in the frontend.
- **Drive is half-wired.** The service account already declares `drive.file` in `SCOPES` (`supply-os-v1/app/sheets.py:51`) but never calls the Drive API; `google-api-python-client` is not a dependency (`supply-os-v1/pyproject.toml:6`).
- **No server-side email.** The dispatch email is a Gmail compose URL a human clicks (`supply-os-v1/app/gmail_url.py:130`). GR-01 deliberately avoids email entirely, so none of this is touched.
- Full grounding: `context/changes/gr-01/research.md`.

## Desired End State

A Captain viewing one of their location's `manager_sent` orders sees a **"Potwierdź dostawę"** action. It opens a screen listing each ordered line with its ordered qty pre-filled as the delivered qty (editable), a variance indicator, a required WZ-photo control (mobile camera), and a "who received" field. On confirm: a `receipt` + `receipt_lines` are persisted, the photos land in a per-order Google Drive folder, and the order detail then shows "Dostawa potwierdzona" with the Drive folder link. If photo upload fails, the receipt still persists, flagged `received_with_missing_wz`, and the photo upload is retryable. Verified by: backend pytest (seed + sheet-mock + Drive-mock), `npm run build`/`lint`, and manual mobile-camera + Drive checks.

### Key Discoveries:

- Mirror `inventory_counts` exactly — models, `sheets.py` read/append/get, `_persist_*`, route degradation, header-validated tabs (`supply-os-v1/app/sheets.py:219`, `:247`, `:697`).
- "Ordered" baseline per line = effective qty = `manager_final_qty_purchase` if > 0 else `captain_final_qty_purchase` (mirror `_effective_qty`, `supply-os-v1/app/gmail_url.py:31`).
- Status-gate template: the Edit button gated on `order.editable` (`frontend/src/pages/captain-mp/OrderDetailPage.tsx:191`); GR-01 gates on `order.status === "manager_sent"`.
- `drive.file` scope is sufficient to create files/subfolders the app owns inside a parent folder shared to the service account — already in `SCOPES`, no scope change.
- ID format: mirror `_generate_count_id` (`supply-os-v1/app/main.py:1416`) → `RCP-YYYYMMDD-LOC3-6hex`.
- Lessons (`context/foundation/lessons.md`): L2 seam (load-bearing), L3 secrets→`.env.example` only, L5 English skill artifacts, L6 conftest sets backend, L7 TS optionality mirrors Pydantic.

## What We're NOT Doing

- **No email / notification** of any kind (accountant hand-off deferred to a later phase). No SMTP, no Gmail API.
- **No new `OrderStatus`** and **no order-status change** on receipt — the order stays `manager_sent`; the receipt is a standalone child record (Tier-1: don't break the status workflow). *(Assumption — flagged for review.)*
- **No structured-summary file in Drive** — the Drive folder holds photos only; the ordered-vs-delivered numbers live in `receipt_lines`.
- **No Manager/owner receipt-view UI** — read endpoints can come in a later phase; MVP is Captain-only capture + in-app Drive link.
- **No production deployment / D-01 wiring** — out of scope; deploy stays owner-run and gated on D-01.
- **No S-10/Supabase** — built on the current sheet stack; the Drive `fileId`/folder ref on the receipt keeps it S-10-portable.
- **No Telegram alerts, no OCR/ML** — roadmap items; storage is merely designed to enable them later.

## Implementation Approach

Backend-first, in the established order (schema → store → routes → client). Phase 1 stands up the persisted entity and is fully testable without Google credentials (seed + mocked sheet). Phase 2 adds the Drive side as a self-contained side-service that degrades when unconfigured. Phase 3 builds the Captain screen and the first file-upload path in the frontend. Each phase is independently verifiable; nothing here requires touching the dispatch/email code.

## Critical Implementation Details

- **Persist-first ordering.** The confirm endpoint persists the receipt + lines synchronously and does **not** depend on Drive. Photos upload in a *separate* call afterward. A photo-upload failure therefore never loses the confirmed delivery — the receipt remains, flagged `received_with_missing_wz`, and the upload is retryable. This is the chosen "persist first, warn on fail" behavior.
- **`received_with_missing_wz` lifecycle.** Set `True` at confirm (no photos yet); the photos endpoint flips it `False` once ≥ 1 photo lands and increments `wz_photo_count`.
- **Ordered baseline is server-resolved, not client-trusted.** For each submitted `order_line_id`, the backend looks up the order line and snapshots the effective ordered qty (`manager_final` if > 0 else `captain_final`); the client only sends `received_qty_purchase`.
- **Drive folder is find-or-create per order.** `ensure_order_folder(order_id)` queries the WZ parent for a subfolder named `{order_id}` and reuses it, so re-confirms / multiple receipts for one order share a single folder. Idempotent.
- **Append-only receipts.** A re-confirm creates a new `receipt_id` (no edit/upsert), mirroring inventory counts. "Latest" = newest `received_submitted_at`. *(Assumption — flagged for review.)*
- **Seam discipline (L2).** Routes resolve persistence only via `_choose_backend()`; `drive.py` is a side service (not a data backend) and must degrade to a clear 503 (sheet mode, Drive unconfigured) or in-memory warning (seed mode), never a raw 500.

---

## Phase 1: Backend — `receipts` entity (sheet-backed, no Drive yet)

### Overview

Stand up the persisted goods-receipt entity and its Captain routes, fully testable without Google credentials. Photo fields exist on the model but stay empty this phase.

### Changes Required:

#### 1. Domain models

**File**: `supply-os-v1/app/models.py`

**Intent**: Add the receipt entity + request/response shapes, mirroring the `InventoryCount*` family. Photo/flag fields live on the header so Phase 2 can fill them without a schema change.

**Contract**:
- `ReceiptLine` — `receipt_line_id`, `receipt_id`, `order_id`, `order_line_id`, `product_id`, `supplier_product_id`, `ordered_qty_purchase: float = 0`, `received_qty_purchase: float = 0`, `variance_qty_purchase: float = 0`, `receipt_comment: str = ""`.
- `Receipt` — `receipt_id`, `order_id`, `location_id`, `supplier_id`, `receipt_date: date`, `received_by: Optional[str] = None`, `received_submitted_at: Optional[datetime] = None`, `line_count: int = 0`, `discrepancy_count: int = 0`, `received_with_missing_wz: bool = True`, `wz_photo_folder_id: Optional[str] = None`, `wz_photo_folder_url: Optional[str] = None`, `wz_photo_count: int = 0`, `notes: str = ""`, `lines: list[ReceiptLine] = Field(default_factory=list)`.
- `ReceiptLineSubmit` — `order_line_id`, `received_qty_purchase: float = Field(ge=0)`, `receipt_comment: str = ""`.
- `ReceiptSubmitRequest` — `order_id`, `received_by: str = Field(min_length=1)`, `receipt_date: Optional[date] = None`, `lines: list[ReceiptLineSubmit] = Field(min_length=1)`, `notes: str = ""`.
- `ReceiptSubmitResponse` — `receipt_id`, `order_id`, `receipt_date`, `line_count`, `discrepancy_count`, `received_with_missing_wz`, `warnings: list[str] = Field(default_factory=list)`.
- `ReceiptDetailLine` — enriched: `+ product_name_pl`, `purchase_unit`, `inventory_unit`, `is_critical`.
- `ReceiptDetail` — full record: `+ location_name`, `supplier_name`, enriched `lines`.
- `ReceiptSummary` — list row (no lines): `receipt_id`, `order_id`, `location_id`, `receipt_date`, `received_submitted_at`, `received_by`, `line_count`, `discrepancy_count`, `received_with_missing_wz`, `wz_photo_count`, `wz_photo_folder_url`.

#### 2. Sheets adapter — read/append/get/update

**File**: `supply-os-v1/app/sheets.py`

**Intent**: Add the receipt persistence functions mirroring the inventory-count block, plus an `update_receipt` (mirroring `update_order`) that Phase 2's photo endpoint uses to attach Drive refs. Import the two new models.

**Contract**:
- `load_receipts() -> list[Receipt]` → `_read_with_ttl("receipts", Receipt)`.
- `load_receipt_lines() -> list[ReceiptLine]` → `_read_with_ttl("receipt_lines", ReceiptLine)`.
- `append_receipt(receipt: Receipt) -> None` → `_open_worksheet` + `_get_column_order` + `append_row`, then `invalidate_cache("receipts")`.
- `append_receipt_lines(lines: list[ReceiptLine]) -> None` → enforce single `receipt_id`, `append_rows`, `invalidate_cache("receipt_lines")`.
- `get_receipt(receipt_id) -> Receipt | None` → join header + lines, `model_copy(update={"lines": lines})`.
- `update_receipt(receipt_id, **kwargs) -> None` → mirror `update_order` (`supply-os-v1/app/sheets.py:558`): find row by `receipt_id`, `batch_update` changed cells, `invalidate_cache("receipts")`. No status-transition guard needed.

#### 3. Routes — submit, detail, list

**File**: `supply-os-v1/app/main.py`

**Intent**: Add a receipt section mirroring the inventory-count routes: an ID generator, a `_persist_receipt` seed-degrading helper, and three Captain endpoints. Validation enforces that the target order is the Captain's and is dispatched.

**Contract**:
- `_generate_receipt_id(location_id, today) -> "RCP-YYYYMMDD-LOC3-6hex"` (mirror `_generate_count_id`, `:1416`).
- `_persist_receipt(backend, receipt, lines) -> bool` (mirror `_persist_inventory_count`, `:1423`; `getattr` guard → warn + `False` on seed).
- `POST /api/captain/receipt/submit` (`require_captain`) → resolve `order = backend.get_order(order_id)`; **404** if `None` or `order.location_id != location_id`; **409** if `order.status != manager_sent`; for each `ReceiptLineSubmit`, find the matching `order` line (**400** if `order_line_id` not in the order), snapshot `ordered_qty_purchase` = effective qty, compute `variance = received − ordered`; build `ReceiptLine` rows; `discrepancy_count` = lines with `variance != 0`; `received_with_missing_wz = True`; `receipt_date` defaults to Warsaw today, future → **400**; **sheet-only — seed mode → 503** (the order lives only in the sheet, mirroring `captain_order_detail`); persist via `_persist_receipt`; sheet mode without the tabs → **503** (catch `WorksheetNotFound`).
- `GET /api/captain/receipt/{receipt_id}` (`require_captain`) → location-scoped enriched `ReceiptDetail`; seed → **503**; `WorksheetNotFound` → **503**; missing/wrong-location → **404**.
- `GET /api/captain/receipts?order_id=` (`require_captain`) → location-scoped `list[ReceiptSummary]`, newest first; seed → `[]`; `WorksheetNotFound` → `[]`.

#### 4. Backend tests

**File**: `supply-os-v1/tests/test_receipt_submit.py`, `test_receipt_detail.py`, `test_receipt_sheets.py`

**Intent**: Mirror the inventory test suite. Cover happy path, the 404/409/400 gates, seed-mode warning, `WorksheetNotFound` → 503, and the sheets adapter with gspread mocked at `_open_worksheet`.

**Contract**: pytest + pytest-mock; `conftest.py` already sets `SUPPLY_OS_DATA_BACKEND=seed` (L6). Assert `ordered_qty_purchase` uses the effective-qty rule and `variance`/`discrepancy_count` are correct.

### Success Criteria:

#### Automated Verification:
- Lint passes: `cd supply-os-v1 && ruff check .`
- Tests pass: `cd supply-os-v1 && python -m pytest`
- New receipt tests pass: `cd supply-os-v1 && python -m pytest tests/test_receipt_submit.py tests/test_receipt_detail.py tests/test_receipt_sheets.py`

#### Manual Verification:
- With `receipts`/`receipt_lines` tabs created and `SUPPLY_OS_DATA_BACKEND=sheet`, `POST /api/captain/receipt/submit` on a `manager_sent` order writes both tabs; detail + list return it.
- Submitting against a non-`manager_sent` order returns 409; against another location's order returns 404.
- Seed mode returns 503 (goods receiving is sheet-only, like order detail).

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual steps before Phase 2.

---

## Phase 2: Backend — Google Drive WZ photo upload

### Overview

Add a self-contained Drive side-service and a multipart photo-upload endpoint that stores WZ photos in a per-order Drive folder and attaches the folder reference to the receipt.

### Changes Required:

#### 1. Dependencies

**File**: `supply-os-v1/pyproject.toml`

**Intent**: Add the Drive API client and FastAPI's multipart parser.

**Contract**: add `google-api-python-client>=2.0` and `python-multipart>=0.0.9` to `dependencies`.

#### 2. Config + env

**File**: `supply-os-v1/app/config.py`, `supply-os-v1/.env.example`

**Intent**: Add the WZ Drive parent-folder id setting; document it. Reuse the existing service-account credentials (no new secret beyond the folder id).

**Contract**: `Settings.gdrive_wz_folder_id: str = ""` (env `SUPPLY_OS_GDRIVE_WZ_FOLDER_ID`). Empty → Drive disabled. Add a `===== Google Drive (WZ photos) =====` block to `.env.example` (L3: example only, no secret values).

#### 3. Drive service module

**File**: `supply-os-v1/app/drive.py` (new)

**Intent**: A thin Drive wrapper using the existing SA credentials and the `drive.file` scope. Find-or-create a per-order subfolder; upload a photo; expose `is_configured()`. Degrades cleanly when unconfigured.

**Contract**:
- `is_configured() -> bool` — `gdrive_wz_folder_id` set AND SA creds present (reuse the credential-loading logic from `sheets.py:_client`; factor a shared helper or replicate).
- `ensure_order_folder(order_id: str) -> tuple[str, str]` — query the WZ parent for a child folder named `order_id`; create if absent; return `(folder_id, web_view_link)`. Idempotent.
- `upload_photo(folder_id, filename, content: bytes, mime_type) -> tuple[str, str]` — `files().create` with `MediaIoBaseUpload`; return `(file_id, web_view_link)`.
- Build the Drive service via `googleapiclient.discovery.build("drive", "v3", credentials=...)`.

#### 4. Photo-upload route

**File**: `supply-os-v1/app/main.py`

**Intent**: A location-scoped multipart endpoint that uploads one or more WZ photos for an existing receipt to its order's Drive folder, then flips the receipt's `received_with_missing_wz` off and records the folder ref + count.

**Contract**:
- `POST /api/captain/receipt/{receipt_id}/photos` (`require_captain`, `files: list[UploadFile] = File(...)`) → require sheet backend + `drive.is_configured()` else **503**; `get_receipt` → **404** if missing/wrong location; `ensure_order_folder(receipt.order_id)`; upload each file (validate `content_type` starts with `image/`); `update_receipt(receipt_id, wz_photo_folder_id=…, wz_photo_folder_url=…, wz_photo_count=existing+n, received_with_missing_wz=False)`; return an upload summary (`receipt_id`, `wz_photo_count`, `wz_photo_folder_url`, `received_with_missing_wz`, uploaded file refs).

#### 5. Tests

**File**: `supply-os-v1/tests/test_receipt_photos.py`, `supply-os-v1/tests/test_drive.py`

**Intent**: Drive fully mocked (no network). Cover find-or-create folder, multi-file upload + flag flip, the 503-when-unconfigured and 404 paths, and non-image rejection.

**Contract**: monkeypatch `drive.is_configured` / the Drive service; assert `update_receipt` is called with the expected folder ref + `received_with_missing_wz=False`.

### Success Criteria:

#### Automated Verification:
- Deps install: `cd supply-os-v1 && pip install -e ".[dev]"`
- Lint passes: `cd supply-os-v1 && ruff check .`
- Tests pass (Drive mocked): `cd supply-os-v1 && python -m pytest`

#### Manual Verification:
- With a real `SUPPLY_OS_GDRIVE_WZ_FOLDER_ID` (folder shared to the SA) + sheet mode, uploading photos creates a per-order subfolder, returns a working `wz_photo_folder_url`, and flips `received_with_missing_wz` to false.
- Re-uploading for the same order reuses the same folder (no duplicate).
- Drive unconfigured → 503 with a clear message; the receipt from Phase 1 stays intact and flagged.

**Implementation Note**: After automated verification passes, pause for human confirmation (this is the only phase needing live Google credentials) before Phase 3.

---

## Phase 3: Frontend — delivery-confirm screen + photo upload

### Overview

Build the Captain "Potwierdź dostawę" screen (first file-upload path in the app), wire it from the order detail, and surface the Drive folder link / missing-WZ state.

### Changes Required:

#### 1. Types

**File**: `frontend/src/types.ts`

**Intent**: Mirror the new Pydantic models; match optionality to the source (L7). Do **not** change the `OrderStatus` union.

**Contract**: add `ReceiptLineSubmit`, `ReceiptSubmitRequest`, `ReceiptSubmitResponse`, `ReceiptDetailLine`, `ReceiptDetail`, `ReceiptSummary`, `ReceiptPhotoUploadResponse`.

#### 2. apiClient — multipart helper + receipt calls

**File**: `frontend/src/apiClient.ts`

**Intent**: Add a parallel FormData helper (don't touch the JSON `request()`); add typed receipt shortcuts.

**Contract**: `apiPostFormData<T>(path, form: FormData, role): Promise<T>` — `fetch` without an explicit `Content-Type` (browser sets the multipart boundary), forwards the Bearer token, same 401 handling as `request()`. Add `api.receiptSubmit`, `api.receiptUploadPhotos(receipt_id, files)`, `api.receipt(receipt_id)`, `api.captainReceipts(order_id)`.

#### 3. Route + order-detail entry

**File**: `frontend/src/App.tsx`, `frontend/src/pages/captain-mp/OrderDetailPage.tsx`

**Intent**: Register the receive route and add the entry point + receipt-status surfacing on the order detail.

**Contract**: new `<Route path="/captain-v2/orders/:order_id/receive">` wrapped in `<AuthGate role="captain">` (after `:order_id/edit`, `App.tsx:99`). In `OrderDetailPage`, when `order.status === "manager_sent"`, fetch `api.captainReceipts(order_id)`: if none → a "Potwierdź dostawę" button → navigate to the receive route; if a receipt exists → show "Dostawa potwierdzona {date}", `discrepancy_count`, a Drive folder link, and — when `received_with_missing_wz` — a warning + "Dodaj zdjęcia WZ" affordance.

#### 4. Receive-delivery screen + components

**File**: `frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx` (new), `components/ReceiptLineCard.tsx` (new), `components/PhotoUploadControl.tsx` (new)

**Intent**: The confirm screen, modeled on `CaptainMP`/`OrderEditPage` (per-line `Record` state, `StickyActionBar`, `Toast`, `ConfirmSubmitDialog`). Per-line delivered-qty inputs default to the ordered qty with a variance badge; a required photo control with mobile camera + client compression; a "who received" field. Submit = persist receipt, then upload photos.

**Contract**:
- `ReceiveDeliveryPage` — load `api.captainOrder(order_id)`; init per-line state `received = effective ordered`; on confirm: `api.receiptSubmit(...)` → then `api.receiptUploadPhotos(receipt_id, files)`; on photo failure show a warning toast and navigate to the detail (receipt persists, flagged); 409/404 handled like `OrderEditPage`.
- `ReceiptLineCard` — product name, ordered qty, delivered-qty number input (`inputMode`, accessible), variance badge.
- `PhotoUploadControl` — `<input type="file" accept="image/*" capture="environment" multiple>`, compress via `browser-image-compression`, `URL.createObjectURL` thumbnails (revoke on unmount), remove-photo, count.

#### 5. i18n + dependency

**File**: `frontend/src/i18n/strings.ts`, `frontend/package.json`

**Intent**: Add bilingual `delivery.*` copy keys; add the compression lib.

**Contract**: append `delivery.*` entries (`{pl,en}`) to the flat `STRINGS` dict before its `as const satisfies` close; `npm install browser-image-compression`.

### Success Criteria:

#### Automated Verification:
- Install: `cd frontend && npm install`
- Build passes: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`
- Unit tests pass (if any added): `cd frontend && npm run test`

#### Manual Verification:
- On a phone, "Potwierdź dostawę" opens the camera; a photo is captured, compressed, and previewed.
- Confirm persists the receipt; the order detail then shows "Dostawa potwierdzona" + a working Drive folder link.
- A line with delivered ≠ ordered shows the variance badge and lands as a discrepancy.
- If photo upload fails, the receipt is still saved and the detail shows the missing-WZ warning + retry.

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual mobile/Drive steps.

---

## Testing Strategy

### Unit Tests:
- Backend: receipt submit validation (404/409/400 gates), effective-ordered snapshot + variance/discrepancy math, seed-mode warning, `WorksheetNotFound` → 503; sheets adapter append/get/update (gspread mocked); Drive folder find-or-create + upload + flag flip (Drive mocked); non-image rejection.
- Frontend: per-line variance computation and the photo-required/missing-WZ gating, if a Vitest harness is added.

### Integration Tests:
- End-to-end (sheet mode, Drive mocked): submit a receipt for a `manager_sent` order → upload photos → detail reflects folder ref + `received_with_missing_wz=false`.

### Manual Testing Steps:
1. Dispatch a test order to `manager_sent` (safe test data — never a real supplier order).
2. As the location Captain, open the order → "Potwierdź dostawę".
3. Adjust one line's delivered qty (create a discrepancy), capture a WZ photo, set "received by", confirm.
4. Verify the receipt rows, the per-order Drive folder + photo, and the in-app folder link.
5. Retry path: block Drive, confirm, verify the receipt persists flagged, then upload photos successfully.

## Performance Considerations

- Compress photos client-side before upload (target ~1–1.5 MB, `maxWidthOrHeight` ~2000) so a multi-photo delivery stays within fetch/Vercel/FastAPI body limits and uploads quickly on mobile data.
- Drive uploads are a handful of files per delivery at pilot volume — synchronous upload is acceptable; no batching/queue needed.
- Receipt reads reuse the existing 60 s TTL sheet cache.

## Migration Notes

Owner-run, one-time (document in the change folder; the agent cannot do these):
1. **Create two Google Sheet tabs** in the existing spreadsheet:
   - `receipts` — header row: `receipt_id, order_id, location_id, supplier_id, receipt_date, received_by, received_submitted_at, line_count, discrepancy_count, received_with_missing_wz, wz_photo_folder_id, wz_photo_folder_url, wz_photo_count, notes`.
   - `receipt_lines` — header row: `receipt_line_id, receipt_id, order_id, order_line_id, product_id, supplier_product_id, ordered_qty_purchase, received_qty_purchase, variance_qty_purchase, receipt_comment`.
2. **Create a "WZ Photos" Drive folder**, share it with the service-account email as **Editor**, and set `SUPPLY_OS_GDRIVE_WZ_FOLDER_ID` to its id. (Drive API is already enabled on the GCP project; `drive.file` scope is already declared.)
3. No data migration/backfill — both entities are new and append-only.

## References

- Research: `context/changes/gr-01/research.md`
- Entity precedent: `supply-os-v1/app/main.py:1413`+ (inventory), `supply-os-v1/app/sheets.py:687`+
- Effective-qty rule: `supply-os-v1/app/gmail_url.py:31`
- Status-gate template: `frontend/src/pages/captain-mp/OrderDetailPage.tsx:191`
- Lessons: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — receipts entity

#### Automated
- [x] 1.1 Lint passes: `cd supply-os-v1 && ruff check .` — 24a5a68
- [x] 1.2 Full test suite passes: `cd supply-os-v1 && python -m pytest` (313 passed) — 24a5a68
- [x] 1.3 New receipt tests pass: `test_receipt_submit.py test_receipt_detail.py test_receipt_sheets.py` (32) — 24a5a68

#### Manual
- [ ] 1.4 Sheet mode: submit on a manager_sent order writes both tabs; detail + list return it
- [ ] 1.5 Non-manager_sent order → 409; another location's order → 404
- [ ] 1.6 Seed mode returns 503 (goods receiving is sheet-only, like order detail)

### Phase 2: Backend — Google Drive WZ photo upload

#### Automated
- [x] 2.1 Deps declared in pyproject (google-api-python-client, python-multipart); Drive client lazy-imported so tests pass without it installed — 0b9a60b
- [x] 2.2 Lint passes: `cd supply-os-v1 && ruff check .` — 0b9a60b
- [x] 2.3 Tests pass (Drive mocked): full suite 326 — 0b9a60b

#### Manual
- [ ] 2.4 Real Drive folder: upload creates a per-order subfolder, returns a working link, flips the flag
- [ ] 2.5 Re-upload for the same order reuses the same folder
- [ ] 2.6 Drive unconfigured → 503; the Phase-1 receipt stays intact and flagged

### Phase 3: Frontend — delivery-confirm screen + photo upload

#### Automated
- [x] 3.1 Install (Homebrew node): `cd frontend && npm install browser-image-compression` — 80bea05
- [x] 3.2 Build passes: `cd frontend && npm run build` (tsc + vite, 1641 modules) — 80bea05
- [x] 3.3 Lint passes: `cd frontend && npm run lint` (0 problems) — 80bea05
- [ ] 3.4 Vitest: BLOCKED by a pre-existing node-25/jsdom `localStorage.clear` failure in `src/test/setup.ts` (commit a17b9e0) that fails all 11 existing tests, unrelated to GR-01 — flagged as a separate task

#### Manual
- [ ] 3.5 Mobile: camera capture → compress → preview works
- [ ] 3.6 Confirm persists; order detail shows "Dostawa potwierdzona" + working Drive link
- [ ] 3.7 Delivered ≠ ordered shows the variance badge and lands as a discrepancy
- [ ] 3.8 Photo-upload failure: receipt still saved, detail shows missing-WZ warning + retry
