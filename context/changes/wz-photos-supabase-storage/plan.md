# WZ Photo Upload via Supabase Storage — Implementation Plan

## Overview

Re-enable the deferred GR-01 WZ delivery-note photo feature by replacing the dead-end Google Drive upload with a **private Supabase Storage bucket**. Photos upload server-side with the `service_role` key; they are viewed in-app through **short-lived (1h) signed URLs minted on demand**. The Google Drive code is removed outright. Backend-first and phased so the test suite is green at the end of every phase.

## Current State Analysis

- The upload endpoint `captain_receipt_photos` ([`supply-os-v1/app/main.py:2293-2377`](../../../supply-os-v1/app/main.py)) calls `drive.ensure_order_folder()` + `drive.upload_photo()` and persists `wz_photo_folder_id` / `wz_photo_folder_url` / `wz_photo_count` / `received_with_missing_wz` via `backend.update_receipt(...)`.
- `app/drive.py` is a confirmed structural dead-end: a Google service account has no Drive storage quota (`403 storageQuotaExceeded`, prod 2026-06-10). It has never worked in production, so no Drive photo data exists to migrate.
- The feature is hidden behind a frontend constant `WZ_PHOTOS_ENABLED = false` ([`ReceiveDeliveryPage.tsx:34`](../../../frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx)). The upload call, persist-first ordering, and retry-photos button already exist and work.
- The only place receipt photos surface today is a dead Drive-folder `<a>` link in the receipt card at [`OrderDetailPage.tsx:239-256`](../../../frontend/src/pages/captain-mp/OrderDetailPage.tsx).
- Storage is a **side-service** called directly from the route (like `drive.py`), *not* a `_choose_backend()` backend. All four WZ fields on `Receipt` are optional/defaulted, so renaming a column does not trip `ConfigDriftError`.
- The repo has **no Supabase usage yet**; the S-10 datastore migration has not started. This change stands up the shared Supabase project and ships standalone.

### Key Discoveries:

- Authoritative design already decided: [`infrastructure.md:50-72`](../../foundation/infrastructure.md) — private bucket, `service_role` server-side upload, sign-on-demand, never persist a signed URL, `content-type` must be explicit (else served as `text/html`), `sb_secret_…` key format.
- Side-service pattern to mirror exactly: `app/drive.py` — module singleton + `is_configured()` degrade gate + `reset_*()` for tests + **lazy import inside functions**.
- Row serialization is header-order driven (`sheets._model_to_row` / `_get_column_order`, [`sheets.py:332-391`](../../../supply-os-v1/app/sheets.py)); a defaulted column rename needs no `sheets.py` code change, only a model + live-Sheet header edit.
- Tests must stay order-independent — set env once in `tests/conftest.py` ([lessons.md](../../foundation/lessons.md)).
- `requirements.txt` (Railpack source) and `pyproject.toml` deps must stay in sync ([`requirements.txt:1-5`](../../../supply-os-v1/requirements.txt)).

## Desired End State

A Wola Captain on a dispatched order opens the receive screen, attaches WZ photos (camera capture), and confirms; the photos land in the private `wz-photos` bucket under `wz/<order_id>/`. Back on the order detail page, the receipt card shows a thumbnail grid of those photos (signed URLs, tap to enlarge) instead of a dead Drive link. The receipt row stores only `wz_photo_path_prefix` + `wz_photo_count` (never a URL). `drive.py` and `google-api-python-client` are gone. `python -m pytest` and `npm run build`/`lint` are green; a real upload+view works in prod after cutover.

## What We're NOT Doing

- **No accountant / GoStock email hand-off** — the signed-URL-expiry-for-email concern stays deferred to a later change.
- **No Sheets→Postgres datastore migration (S-10)** — only the photo side-service touches Supabase; order data stays on Sheets behind `_choose_backend()`.
- **No new receipt-detail route/page** — viewing is an inline grid in the existing `OrderDetailPage` receipt card.
- **No backend env kill-switch** — `supabase_storage.is_configured()` (creds present) is the sole backend gate; the frontend constant is the UI gate.
- **No change to the upload transport** — multipart endpoint path, `apiPostFormData`, and `PhotoUploadControl` are untouched.
- **No Manager-side photo view** — receiving + photo viewing remain Captain-only, as today.

## Implementation Approach

Add the Supabase side-service and config first (Drive still live → suite green), then swap the endpoint + rename the schema + add the viewing endpoint and remove Drive in one atomic phase (suite green again), then the frontend, then the manual prod cutover. The new `app/supabase_storage.py` mirrors `drive.py`'s shape one-to-one so the route change is a near-drop-in. Object layout is folder-per-order (`wz/<order_id>/<receipt_id>-NN.ext`) to preserve the old per-order grouping; signing happens only at view/upload time.

## Critical Implementation Details

- **Content-type is mandatory on upload.** Supabase defaults missing content-type to `text/html`, so a JPEG would refuse to render in the browser. Pass the `UploadFile.content_type` straight through to `file_options={"content-type": mime}`; keep the existing non-image 400 guard ahead of the storage call.
- **Never persist a signed URL.** Store `wz_photo_path_prefix` (`wz/<order_id>`); mint signed URLs on demand in the upload response and the viewing endpoint. `create_signed_url(...)` returns a dict — read the `"signedURL"` key (verify against the live response in the first test).
- **`service_role` key is server-side only**, never in the SPA — the SPA already reaches Storage only through `/api/*`. Initialize the client with the service key (it has `BYPASSRLS`, so no `storage.objects` RLS policies are needed); an accidental anon-key init makes private-bucket uploads fail silently under RLS.
- **Atomic Drive removal.** `main.py` imports and uses `drive` until the endpoint is swapped — delete `drive.py` / `test_drive.py` / the `google-api-python-client` dep **in the same phase** as the endpoint swap (Phase 3), not before, so no phase ends with a broken import.
- **`upsert: "false"` + unique names** (`{receipt_id}-{idx:02d}{ext}`) so a re-confirm never silently overwrites a prior receipt's photo.

## Phase 0: Provision Supabase (manual prerequisite)

### Overview

Stand up the Supabase project and the private bucket the backend will use. Purely operational — no repo code. The code phases mock the client and do not depend on this, but prod cutover (Phase 4) does.

### Changes Required:

#### 1. Supabase project + private bucket

**File**: none (Supabase dashboard / SQL console).

**Intent**: Create (or designate) the Supabase project that will also host the future datastore, then create a **private** Storage bucket named `wz-photos`. Capture the project URL and the `service_role` secret key for Phase 4.

**Contract**: A bucket `wz-photos` with `public = false` exists. Service-role key is in the current `sb_secret_…` format (flag for rotation if it's a legacy `eyJ…` JWT). Credentials are recorded in the operator's secret store only — never committed.

### Success Criteria:

#### Automated Verification:

- _None (manual provisioning phase)._

#### Manual Verification:

- The `wz-photos` bucket exists and is **private** (Storage → bucket shows "Private").
- Project URL (`https://<ref>.supabase.co`) and `service_role` key are captured in the operator's secret store.
- Key format confirmed `sb_secret_…` (or noted for rotation).

**Implementation Note**: This phase is operator-run. Pause for human confirmation that the bucket exists and credentials are captured before relying on it in Phase 4. Phases 1–3 can proceed in parallel without it.

---

## Phase 1: Backend foundation — config, deps, Supabase side-service

### Overview

Add the dependency, settings, and the new `app/supabase_storage.py` side-service plus its mocked unit tests. **Drive stays in place** this phase so the suite remains green.

### Changes Required:

#### 1. Dependency

**File**: `supply-os-v1/requirements.txt`, `supply-os-v1/pyproject.toml`

**Intent**: Add the official Supabase Python SDK so the side-service can talk to Storage. Keep both files in sync (requirements.txt is the Railpack install source).

**Contract**: Add `supabase>=2.10,<3` to `requirements.txt` and to `pyproject.toml [project.dependencies]`. (`httpx` arrives transitively and becomes a runtime dep — acceptable.) Do not remove `google-api-python-client` yet (Drive is still imported until Phase 3).

#### 2. Settings

**File**: `supply-os-v1/app/config.py`

**Intent**: Add Supabase Storage config under the existing `SUPPLY_OS_` prefix, with the secret key as `SecretStr`.

**Contract**: New `Settings` fields: `supabase_url: str = ""`, `supabase_service_role_key: SecretStr = SecretStr("")`, `supabase_wz_bucket: str = "wz-photos"`. Leave `gdrive_wz_folder_id` in place for now (removed with Drive in Phase 3).

#### 3. New side-service module

**File**: `supply-os-v1/app/supabase_storage.py` (new)

**Intent**: A Drive-shaped side-service: cached client singleton, `is_configured()` degrade gate, `reset_client()` for tests, lazy SDK import. Upload returns the stored object **path**; viewing signs on demand.

**Contract**: Public surface —
- `is_configured() -> bool` → `bool(settings.supabase_url and settings.supabase_service_role_key.get_secret_value() and settings.supabase_wz_bucket)`.
- `reset_client() -> None`.
- `upload_photo(object_path: str, content: bytes, mime_type: str) -> str` → uploads to the bucket and returns `object_path`.
- `list_photos(prefix: str) -> list[str]` → full object paths under `prefix`.
- `create_signed_url(object_path: str, expires_in: int = 3600) -> str`.

Lazy import + key calls (non-obvious SDK shape — snippet justified):

```python
def _client():
    global _client_instance
    if _client_instance is not None:
        return _client_instance
    from supabase import create_client  # lazy — module imports clean without the SDK
    _client_instance = create_client(
        settings.supabase_url, settings.supabase_service_role_key.get_secret_value()
    )
    return _client_instance

# upload: content-type MUST be explicit, upsert false to never clobber
_client().storage.from_(settings.supabase_wz_bucket).upload(
    path=object_path, file=content,
    file_options={"content-type": mime_type or "application/octet-stream", "upsert": "false"},
)
# sign: returns a dict; the URL is under "signedURL"
return _client().storage.from_(b).create_signed_url(object_path, expires_in)["signedURL"]
```

#### 4. Test env isolation

**File**: `supply-os-v1/tests/conftest.py`

**Intent**: Keep the suite insulated from a real `.env` and order-independent.

**Contract**: Add `os.environ.setdefault("SUPPLY_OS_SUPABASE_URL", "")` and `…SUPABASE_SERVICE_ROLE_KEY", "")` (and optionally the bucket) before any app import.

#### 5. Side-service unit tests

**File**: `supply-os-v1/tests/test_supabase_storage.py` (new)

**Intent**: Cover the new module offline by mocking the SDK client (mirrors how `test_drive.py` mocked the Drive service).

**Contract**: Tests for `is_configured()` (false without creds, true with all three); `upload_photo` asserts `storage.from_(bucket).upload(...)` called with the right path + `content-type` + `upsert:"false"` and returns the path; `create_signed_url` returns the `"signedURL"` value; `reset_client()` drops the singleton. The SDK is patched (e.g. via `reset_client()` + monkeypatching `_client`), so the real package is never called.

### Success Criteria:

#### Automated Verification:

- Backend tests pass: `cd supply-os-v1 && python -m pytest`
- New module imports without the SDK installed at import time (lazy import): `python -c "import app.supabase_storage"`
- Lint passes: `cd supply-os-v1 && ruff check .`

#### Manual Verification:

- `app/supabase_storage.py` mirrors `drive.py`'s gate/singleton/lazy-import shape.

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 2.

---

## Phase 2: Backend schema reshape (models)

### Overview

Rename the Drive-shaped receipt fields to storage-agnostic ones and add the response models the new viewing endpoint needs. Isolated from the route swap so the model delta is reviewable on its own. (Drive endpoint still runs — it writes `wz_photo_path_prefix` only after Phase 3, so this phase keeps `update_receipt` callers compiling by updating field names everywhere they appear.)

### Changes Required:

#### 1. Receipt models

**File**: `supply-os-v1/app/models.py`

**Intent**: Replace the Drive folder fields with a single storage path prefix; drop the stored URL field (URLs are signed on demand). Add a photo-item model for the viewing + upload responses.

**Contract**:
- `Receipt`: rename `wz_photo_folder_id` → `wz_photo_path_prefix: Optional[str] = None`; **remove** `wz_photo_folder_url`. Keep `wz_photo_count`, `received_with_missing_wz`.
- Apply the same rename/removal to `ReceiptDetail`, `ReceiptSummary`.
- New `ReceiptPhotoItem(BaseModel)`: `name: str`, `signed_url: str`.
- `ReceiptPhotoUploadResponse`: remove `wz_photo_folder_url`; change `uploaded: list[dict]` → `uploaded: list[ReceiptPhotoItem]`; keep `wz_photo_count`, `received_with_missing_wz`.

#### 2. Detail/summary builders

**File**: `supply-os-v1/app/main.py`

**Intent**: Update the receipt detail + list builders that reference the removed/renamed fields so they compile and stop emitting `wz_photo_folder_*`.

**Contract**: In `captain_receipt_detail` and `captain_receipts`, drop `wz_photo_folder_url` / `wz_photo_folder_id` references; surface `wz_photo_path_prefix` + `wz_photo_count` (the detail no longer carries a folder URL — viewing uses the new endpoint added in Phase 3).

### Success Criteria:

#### Automated Verification:

- Backend tests pass after updating field references: `cd supply-os-v1 && python -m pytest`
- Lint passes: `cd supply-os-v1 && ruff check .`

#### Manual Verification:

- No remaining references to `wz_photo_folder_id` / `wz_photo_folder_url` in `app/` (grep clean).

**Implementation Note**: Pause for human confirmation after automated verification.

---

## Phase 3: Backend endpoint swap + viewing endpoint + Drive removal

### Overview

Point the upload endpoint at Supabase, add the sign-on-demand viewing endpoint, then delete the Drive module/test/dependency. One atomic phase so no intermediate state has a broken `drive` import.

### Changes Required:

#### 1. Swap the upload endpoint

**File**: `supply-os-v1/app/main.py`

**Intent**: Replace Drive calls with Supabase Storage. No folder creation — compute a deterministic prefix. Persist the path prefix + count; return freshly-signed URLs so the just-uploaded photos can render immediately.

**Contract**: In `captain_receipt_photos`:
- Swap the import `from . import … drive …` → `… supabase_storage …`; gate becomes `if not supabase_storage.is_configured(): 503` (message references the Supabase env vars).
- Remove `ensure_order_folder`; set `prefix = f"wz/{receipt.order_id}"`.
- Per file (keep the non-image 400 guard, empty-skip, name `{receipt_id}-{idx:02d}{ext}`): `object_path = f"{prefix}/{name}"`; `supabase_storage.upload_photo(object_path, content, ctype)`; collect `ReceiptPhotoItem(name=name, signed_url=supabase_storage.create_signed_url(object_path))`.
- `backend.update_receipt(receipt_id, wz_photo_path_prefix=prefix, wz_photo_count=new_count, received_with_missing_wz=False)`.
- Return `ReceiptPhotoUploadResponse(..., uploaded=<items>)`.

#### 2. New viewing endpoint

**File**: `supply-os-v1/app/main.py`

**Intent**: List + sign all WZ photos for a receipt's order, on demand. Mirrors the sheet-only / location-scoped / degrade guards of the sibling receipt routes.

**Contract**: `GET /api/captain/receipt/{receipt_id}/photos` → `list[ReceiptPhotoItem]`, Captain auth. 503 in seed mode / when storage unconfigured; 404 if the receipt is missing or another location's. Resolves the receipt's `wz_photo_path_prefix` (fallback `wz/<order_id>`), `supabase_storage.list_photos(prefix)`, signs each at 1h. Empty list when no photos.

#### 3. Remove Drive

**File**: `supply-os-v1/app/drive.py` (delete), `supply-os-v1/tests/test_drive.py` (delete), `supply-os-v1/app/config.py`, `supply-os-v1/requirements.txt`, `supply-os-v1/pyproject.toml`, `supply-os-v1/.env.example`

**Intent**: Excise the dead Drive integration now that nothing imports it.

**Contract**: Delete `drive.py` + `test_drive.py`; remove `gdrive_wz_folder_id` from `config.py`; remove `google-api-python-client` from both dep files; in `.env.example` remove `SUPPLY_OS_GDRIVE_WZ_FOLDER_ID` and add `SUPPLY_OS_SUPABASE_URL` / `SUPPLY_OS_SUPABASE_SERVICE_ROLE_KEY` / `SUPPLY_OS_SUPABASE_WZ_BUCKET`. Confirm no other `drive` references remain (grep).

#### 4. Rewrite affected tests

**File**: `supply-os-v1/tests/test_receipt_photos.py`, `tests/test_receipt_sheets.py`, `tests/test_receipt_detail.py`, `tests/test_config_creds.py`

**Intent**: Re-point mocks from `drive` to `supabase_storage`, update field names, add viewing-endpoint coverage.

**Contract**:
- `test_receipt_photos.py`: patch `supabase_storage.is_configured/upload_photo/create_signed_url`; assert `update_receipt` kwargs use `wz_photo_path_prefix`; update the unconfigured-503 message; keep content-type-400 / location-404 / not-found / `WorksheetNotFound`-503. Add tests for `GET …/photos` (happy list, seed-mode 503, wrong-location 404, empty list).
- `test_receipt_sheets.py`: `RECEIPT_HEADERS` and `test_update_receipt_writes_changed_cells` use `wz_photo_path_prefix` (drop `wz_photo_folder_url`).
- `test_receipt_detail.py`: `_fake_receipt` + assertions drop the Drive URL; assert `wz_photo_path_prefix` / `wz_photo_count`.
- `test_config_creds.py`: remove the `drive.is_configured()` assertion from the b64-creds test (Sheets-creds tests unchanged).

### Success Criteria:

#### Automated Verification:

- Full backend suite passes: `cd supply-os-v1 && python -m pytest`
- No Drive references remain: `! grep -rn "drive\|gdrive\|google-api-python-client" supply-os-v1/app supply-os-v1/requirements.txt supply-os-v1/pyproject.toml`
- Lint passes: `cd supply-os-v1 && ruff check .`
- App imports: `cd supply-os-v1 && python -c "import app.main"`

#### Manual Verification:

- Reading the upload endpoint, no signed URL is ever passed to `update_receipt` (only the path prefix is persisted).
- The viewing endpoint degrades (503/404/empty) exactly like sibling receipt routes.

**Implementation Note**: Pause for human confirmation after automated verification.

---

## Phase 4: Frontend — re-enable flag + signed-URL viewing grid

### Overview

Flip the feature on and replace the dead Drive link with an inline thumbnail grid driven by the new viewing endpoint.

### Changes Required:

#### 1. Re-enable upload

**File**: `frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx`

**Intent**: Turn the photo control back on.

**Contract**: Set `WZ_PHOTOS_ENABLED = true` (or remove the constant and its guard). No other change — upload call/retry already wired.

#### 2. Types

**File**: `frontend/src/types.ts`

**Intent**: Mirror the reshaped backend models (match optionality per lessons).

**Contract**: In `ReceiptDetail` / `ReceiptSummary`: remove `wz_photo_folder_url`; rename `wz_photo_folder_id` → `wz_photo_path_prefix?: string | null`. Add `ReceiptPhotoItem { name: string; signed_url: string }`. `ReceiptPhotoUploadResponse`: drop `wz_photo_folder_url`; `uploaded: ReceiptPhotoItem[]`.

#### 3. API client

**File**: `frontend/src/apiClient.ts`

**Intent**: Add the viewing call; the upload call is unchanged.

**Contract**: `receiptPhotoUrls: (receipt_id) => apiGet<ReceiptPhotoItem[]>("/api/captain/receipt/{id}/photos", "captain")`.

#### 4. Viewing grid

**File**: `frontend/src/pages/captain-mp/OrderDetailPage.tsx`

**Intent**: Replace the Drive-folder `<a>` (lines ~239-256) with a thumbnail grid of signed-URL images; keep the `received_with_missing_wz` amber badge.

**Contract**: When a confirmed receipt has `wz_photo_count > 0`, fetch `api.receiptPhotoUrls(receipt_id)` and render `<img src={signed_url}>` thumbnails (tap to open full size); handle empty/error states. Remove the `delivery.openFolder` Drive link usage.

#### 5. Copy

**File**: `frontend/src/i18n/strings.ts`

**Intent**: Drop the Drive wording; add viewing copy (Polish UI).

**Contract**: Replace `delivery.openFolder` ("…Google Drive") with photo-viewing copy; add e.g. `delivery.viewPhotos`, `delivery.photoCount`, `delivery.photoLoadError`. Keep `delivery.missingWz`.

### Success Criteria:

#### Automated Verification:

- Frontend builds: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`
- No Drive copy remains: `! grep -rn "Google Drive\|openFolder\|wz_photo_folder" frontend/src`

#### Manual Verification:

- With Supabase configured locally, the receive screen shows the photo control; attaching + confirming uploads succeed.
- The order detail receipt card renders the uploaded photos as a grid; tapping enlarges; a fresh reload re-signs and still shows them.
- A receipt with no photos shows the amber "missing WZ" badge, no broken images.

**Implementation Note**: Pause for human confirmation of the manual UI testing before Phase 5.

---

## Phase 5: Production cutover

### Overview

Wire prod to Supabase and rename the live Sheet column. Operational; gated on Phase 0 being done.

### Changes Required:

#### 1. Railway env vars

**File**: none (Railway dashboard / CLI).

**Intent**: Give the prod backend the Supabase creds.

**Contract**: Set `SUPPLY_OS_SUPABASE_URL`, `SUPPLY_OS_SUPABASE_SERVICE_ROLE_KEY`, `SUPPLY_OS_SUPABASE_WZ_BUCKET=wz-photos` via `railway variables --set`. Confirm `SUPPLY_OS_GDRIVE_WZ_FOLDER_ID` is gone.

#### 2. Live Sheet header rename

**File**: none (Google Sheet `receipts` tab).

**Intent**: Align the live header with the renamed model field. Safe — prod never persisted a Drive photo, so no data is lost.

**Contract**: Rename the `receipts` header cell `wz_photo_folder_id` → `wz_photo_path_prefix`; optionally delete the now-unused `wz_photo_folder_url` column. (Per `sheets._validate_headers`, the field is optional so the app tolerates either header during the edit window.)

### Success Criteria:

#### Automated Verification:

- _None (prod operational steps)._

#### Manual Verification:

- `GET /health/internal` (manager auth) shows the expected backend; prod logs show no Supabase-config warning.
- A real Captain upload on a dispatched test order succeeds; the photo appears in the `wz-photos` bucket under `wz/<order_id>/`.
- The order detail page renders the uploaded photo via a signed URL in prod.
- Per the "merged ≠ live" lesson: verify against the **running** prod endpoint, not just a green deploy.

**Implementation Note**: Use a safe test order — do not place or alter a real supplier order while testing.

---

## Testing Strategy

### Unit Tests:

- `test_supabase_storage.py` — `is_configured()` gating, `upload_photo` call shape (path + content-type + upsert), `create_signed_url` `"signedURL"` extraction, `reset_client()`.
- `test_receipt_photos.py` — upload happy path (path prefix persisted, count incremented, flag flipped, signed URLs returned), non-image 400, unconfigured 503, location 404, `WorksheetNotFound` 503; viewing endpoint happy/empty/503/404.
- `test_receipt_sheets.py` / `test_receipt_detail.py` — renamed column round-trips and enriched detail without the Drive URL.

### Integration Tests:

- End-to-end via FastAPI `TestClient` with `supabase_storage` mocked (no live bucket in CI): submit receipt → upload photos → fetch `…/photos`.

### Manual Testing Steps:

1. Local: set Supabase env vars to the real project; run backend + frontend; receive a dispatched test order, attach 2 photos, confirm.
2. Open order detail → verify the thumbnail grid; tap to enlarge; hard-reload → photos still load (re-signed).
3. Confirm the bucket shows `wz/<order_id>/<receipt_id>-01.jpg` etc.; confirm the receipt row stores the path prefix, not a URL.
4. Negative: a receipt with no photos shows the amber badge and no broken images.

## Performance Considerations

Per-page-load signing adds one Supabase call per photo on the order detail view (only when a receipt exists). Volumes are tiny (pilot, a few photos per order). 1h TTL avoids re-signing within a session if the page isn't reloaded. Phone JPEGs are client-compressed to ≤1.2 MB before upload (existing `PhotoUploadControl`).

## Migration Notes

- **No code data migration.** The live `receipts` Sheet header rename (Phase 5) is the only data step; safe because no Drive photo data exists.
- **Bucket must pre-exist** (Phase 0) — the SDK does not auto-create it; a missing bucket raises a `StorageException` on first upload.
- **Key format** — use the `sb_secret_…` service-role key; if the project still issues legacy `eyJ…`, it works until end-2026 but flag for rotation. Never decode/parse the key.

## References

- Research: [`context/changes/wz-photos-supabase-storage/research.md`](research.md)
- Authoritative design: [`context/foundation/infrastructure.md:50-72`](../../foundation/infrastructure.md)
- Side-service pattern: [`supply-os-v1/app/drive.py`](../../../supply-os-v1/app/drive.py)
- Upload endpoint: [`supply-os-v1/app/main.py:2293-2377`](../../../supply-os-v1/app/main.py)
- Prior change: [`context/changes/gr-01/plan.md`](../gr-01/plan.md)
- Supabase docs: [upload](https://supabase.com/docs/reference/python/storage-from-upload), [signed URL](https://supabase.com/docs/reference/python/storage-from-createsignedurl)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 0: Provision Supabase (manual prerequisite)

#### Manual

- [ ] 0.1 `wz-photos` bucket exists and is private
- [ ] 0.2 Project URL + `service_role` key captured in operator secret store
- [ ] 0.3 Key format confirmed `sb_secret_…` (or noted for rotation)

### Phase 1: Backend foundation — config, deps, Supabase side-service

#### Automated

- [x] 1.1 Backend tests pass: `python -m pytest`
- [x] 1.2 Module imports without SDK at import time: `python -c "import app.supabase_storage"`
- [x] 1.3 Lint passes: `ruff check .`

#### Manual

- [ ] 1.4 `supabase_storage.py` mirrors `drive.py` gate/singleton/lazy-import shape

### Phase 2: Backend schema reshape (models)

#### Automated

- [ ] 2.1 Backend tests pass after field-reference updates: `python -m pytest`
- [ ] 2.2 Lint passes: `ruff check .`

#### Manual

- [ ] 2.3 No `wz_photo_folder_id` / `wz_photo_folder_url` references remain in `app/` (grep clean)

### Phase 3: Backend endpoint swap + viewing endpoint + Drive removal

#### Automated

- [ ] 3.1 Full backend suite passes: `python -m pytest`
- [ ] 3.2 No Drive references remain (grep `app/` + dep files)
- [ ] 3.3 Lint passes: `ruff check .`
- [ ] 3.4 App imports: `python -c "import app.main"`

#### Manual

- [ ] 3.5 No signed URL passed to `update_receipt` (only path prefix persisted)
- [ ] 3.6 Viewing endpoint degrades (503/404/empty) like sibling receipt routes

### Phase 4: Frontend — re-enable flag + signed-URL viewing grid

#### Automated

- [ ] 4.1 Frontend builds: `npm run build`
- [ ] 4.2 Lint passes: `npm run lint`
- [ ] 4.3 No Drive copy remains (grep `frontend/src`)

#### Manual

- [ ] 4.4 Receive screen shows photo control; attach + confirm uploads succeed (Supabase configured)
- [ ] 4.5 Order detail renders photo grid; tap enlarges; reload re-signs and still shows
- [ ] 4.6 No-photo receipt shows amber badge, no broken images

### Phase 5: Production cutover

#### Manual

- [ ] 5.1 Railway env vars set; `GDRIVE_WZ_FOLDER_ID` gone; no Supabase-config warning in prod logs
- [ ] 5.2 Live Sheet `receipts` header renamed `wz_photo_folder_id` → `wz_photo_path_prefix`
- [ ] 5.3 Real upload on a safe test order lands in `wz/<order_id>/` and renders via signed URL in prod
- [ ] 5.4 Verified against the running prod endpoint (not just a green deploy)
