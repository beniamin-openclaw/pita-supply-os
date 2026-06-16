---
date: 2026-06-16T00:12:37+03:00
researcher: Claude (Opus 4.8)
git_commit: 1741a2fc2c4d9e1890c3f84546575331fb21e510
branch: claude/wz-photos-supabase-storage
repository: beniamin-openclaw/pita-supply-os
topic: "Replace Google Drive WZ-photo upload with Supabase Storage (upload + in-app signed-URL viewing)"
tags: [research, codebase, wz-photos, supabase-storage, goods-receiving, gr-01]
status: complete
last_updated: 2026-06-16
last_updated_by: Claude (Opus 4.8)
---

# Research: WZ photo upload via Supabase Storage

**Date**: 2026-06-16T00:12:37+03:00
**Researcher**: Claude (Opus 4.8)
**Git Commit**: 1741a2fc2c4d9e1890c3f84546575331fb21e510
**Branch**: claude/wz-photos-supabase-storage
**Repository**: beniamin-openclaw/pita-supply-os

## Research Question

Ground the implementation of the deferred GR-01 WZ delivery-note photo path: replace the
dead-end Google Drive upload with a **private Supabase Storage bucket** (server-side
`service_role` upload), add **in-app photo viewing via short-lived signed URLs**, and
**re-enable** the feature (`WZ_PHOTOS_ENABLED`). Scope locked: upload + viewing; the
GoStock-accountant email hand-off stays deferred. Client library (supabase-py vs storage3 vs
raw REST) to be recommended by research.

## Summary

The design is **already decided and authoritative** in [`context/foundation/infrastructure.md:50-72`](context/foundation/infrastructure.md) (the 2026-06-12 update): private bucket, server-side `service_role` upload, sign URLs on demand, never persist a signed URL. This research confirms that decision against the current Supabase API and pins down **every code touchpoint**.

Key conclusions:

1. **It's a side-service swap, not a backend swap.** WZ photos go through a sibling module called *directly* from the route (like `app/drive.py`), NOT through `_choose_backend()`. Mirror `drive.py`'s exact shape: lazy import, `is_configured()` degrade gate, cached client singleton, `reset_*()` for tests. ([Lessons "Never bypass the data-layer seam"](context/foundation/lessons.md) still holds — but object storage is a different axis from the tabular data seam; `drive.py` already documents itself as "a SIDE service, not a data backend".)
2. **No Pydantic/sheet schema *migration* is strictly required** — all four WZ fields on `Receipt` are optional/defaulted, so `_validate_headers` won't raise `ConfigDriftError`. But the Drive-shaped fields (`wz_photo_folder_id`, `wz_photo_folder_url`) change *meaning*; the clean move is to rename `wz_photo_folder_id` → `wz_photo_path_prefix` (one-time, safe operator column rename in the live Sheet — no Drive data was ever persisted in prod).
3. **Recommended client: `supabase-py`** (official SDK, sync-by-default). `storage3` was archived 2025-09-08 and merged into the supabase-py monorepo; raw REST is unjustified work. Cost: `httpx` becomes a runtime dep (it's dev-only today).
4. **Viewing**: add a dedicated `GET /api/captain/receipt/{receipt_id}/photos` endpoint that lists + signs URLs on demand; display them as an inline thumbnail grid in the existing `OrderDetailPage` receipt card (replacing the dead Drive-folder link). No new route required.
5. **The upload transport is unchanged end-to-end** — same multipart `POST /api/captain/receipt/{id}/photos`, same `apiPostFormData`, same `PhotoUploadControl`. Only the backend storage destination changes, plus the flag flip.

## Detailed Findings

### Backend — the photo path (`supply-os-v1/`)

**Upload endpoint** `captain_receipt_photos` — [`app/main.py:2293-2377`](supply-os-v1/app/main.py). Gate order:
- `backend is not sheets` → 503 (`app/main.py:2312-2317`)
- `not drive.is_configured()` → 503 referencing `SUPPLY_OS_GDRIVE_WZ_FOLDER_ID` (`app/main.py:2318-2325`) — **this becomes the Supabase gate.**
- `get_receipt` guarded by `WorksheetNotFound`; wrong location → 404 (`2326-2337`)
- empty `files` → 400 (`2338-2339`)

Drive calls to replace:
- `drive.ensure_order_folder(receipt.order_id)` → `(folder_id, folder_url)` (`app/main.py:2341`) — **deleted**; the prefix `wz/<order_id>/` is a naming convention, not a resource to create.
- per-file loop: empty-skip, `content_type.startswith("image/")` → 400, name `{receipt_id}-{idx:02d}{ext}`, `drive.upload_photo(folder_id, name, content, ctype)` (`app/main.py:2343-2358`) — **becomes** `supabase_storage.upload_photo(path, content, ctype)`.
- `backend.update_receipt(receipt_id, wz_photo_folder_id=…, wz_photo_folder_url=…, wz_photo_count=new_count, received_with_missing_wz=False)` (`app/main.py:2363-2370`).

**Side-service to mirror** `app/drive.py` ([full file, 1-127](supply-os-v1/app/drive.py)): `is_configured()` (`39-41`), `reset_service()` (`44-47`), lazy `_drive_service()` import (`60-69`), `ensure_order_folder` (`72-102`), `upload_photo` (`105-126`). The Supabase module keeps `is_configured()` / `reset_client()` / lazy `_client()` and drops the folder abstraction.

**Models** ([`app/models.py`](supply-os-v1/app/models.py)): `Receipt` WZ fields `received_with_missing_wz: bool = True`, `wz_photo_folder_id: Optional[str]=None`, `wz_photo_folder_url: Optional[str]=None`, `wz_photo_count: int=0` (~`554-574`). Same fields echoed in `ReceiptDetail`, `ReceiptSummary`, `ReceiptPhotoUploadResponse`. Storage-agnostic (keep): `wz_photo_count`, `received_with_missing_wz`. Drive-shaped (change meaning): `wz_photo_folder_id` → `wz_photo_path_prefix`; `wz_photo_folder_url` → drop (sign on demand) or repurpose.

**Sheets persistence** ([`app/sheets.py`](supply-os-v1/app/sheets.py)): `update_receipt` (`785-811`), `append_receipt` (`736-746`), `get_receipt` (`771-782`), `load_receipts` (`726-728`). `_model_to_row`/`_get_column_order` (`332-391`) lay rows out by the live header row; adding/renaming a *defaulted* column needs no code change and won't trip `_validate_headers` (`ConfigDriftError` only fires on missing **required** fields).

**Viewing endpoint (new)**: `captain_receipt_detail` ([`app/main.py:2218-2290`](supply-os-v1/app/main.py)) returns `ReceiptDetail` carrying only `wz_photo_folder_url` (folder link) + count — no per-photo URLs. Recommended: new `GET /api/captain/receipt/{receipt_id}/photos` → `list[{name, signed_url}]` (pure on-demand signing, no persistence, own 503 guard), keeping `ReceiptDetail` stable. Alternative (rejected as default): enrich `ReceiptDetail` with `wz_photo_urls` — couples every detail fetch to Storage availability.

### Frontend — `frontend/`

- **Flag**: `const WZ_PHOTOS_ENABLED = false;` at [`ReceiveDeliveryPage.tsx:34`](frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx) gates only the `PhotoUploadControl` render (`202-204`). The upload call (`api.receiptUploadPhotos`, `110-112`), persist-first ordering, and the "retry photos" button (`225-229`) already exist and work. Flip to `true`.
- **`PhotoUploadControl`** ([`components/PhotoUploadControl.tsx`](frontend/src/pages/captain-mp/components/PhotoUploadControl.tsx)): camera capture, `browser-image-compression` (≤1.2MB/2000px), thumbnail previews, emits `File[]`. **Storage-agnostic — no change.**
- **Display today**: the *only* place receipt/WZ data is shown is the receipt card in [`OrderDetailPage.tsx:207-258`](frontend/src/pages/captain-mp/OrderDetailPage.tsx) — an `<a href={wz_photo_folder_url}>` "Otwórz zdjęcia WZ (Google Drive)" link (`239-256`, never populated in prod since Drive failed) + a `received_with_missing_wz` amber badge. **Replace the link with an inline signed-URL `<img>` grid; keep the badge.** There is no receipt-detail route in `App.tsx`.
- **Types** ([`types.ts`](frontend/src/types.ts)): `ReceiptDetail` (`428-446`), `ReceiptSummary` (`448-460`), `ReceiptPhotoUploadResponse` (`462-468`) carry the Drive-shaped fields; `uploaded[].{file_id,file_url}` (`467`) become storage path + signed URL. Mirror backend optionality per [lessons "Mirror Pydantic optionality in TypeScript"](context/foundation/lessons.md).
- **apiClient** ([`apiClient.ts`](frontend/src/apiClient.ts)): `receiptSubmit` (`264-267`), `captainReceipts` (`268-272`), `receipt` (`273-274`), `receiptUploadPhotos` (`276-282`) via `apiPostFormData` (`181-212`). Upload call signature unchanged; **add** `receiptPhotoUrls(receipt_id)` for the new viewing endpoint.
- **i18n** (`frontend/src/i18n/strings.ts`, `delivery.*`): change `delivery.openFolder` (drops the "Google Drive" wording); add e.g. `delivery.viewPhotos` / `delivery.photoCount` / `delivery.photoLoadError`. `delivery.missingWz` stays.

### Tests, deps, secrets, schema (`supply-os-v1/`)

**Tests to change:**
- `tests/test_receipt_photos.py` (1-164) — primary rewrite: swap `drive.is_configured/ensure_order_folder/upload_photo` mocks for the new module; `update_receipt` kwargs `wz_photo_folder_id` → `wz_photo_path_prefix`; update the unconfigured-503 message. Content-type-400 / location-404 / not-found / `WorksheetNotFound`-503 tests stay (logic lives in `main.py` before the storage call).
- `tests/test_drive.py` (1-77) — rename to `test_supabase_storage.py`, rewrite for the new module (drop the `googleapiclient` lazy-import stub).
- `tests/test_config_creds.py` (1-138) — `test_b64_only_satisfies_sheets_and_drive_gates` (127-137): the Drive-gate assertion no longer applies; Sheets-creds tests are unaffected (Sheets stays on GCP).
- `tests/test_receipt_sheets.py` (1-318) — `RECEIPT_HEADERS` (20-35) + `test_update_receipt_writes_changed_cells` (285-302): `wz_photo_folder_id` → `wz_photo_path_prefix`.
- `tests/test_receipt_detail.py` (1-149) — `_fake_receipt` (22-50) + `test_receipt_detail_happy` (111-128): Drive URL → Supabase pattern.
- `tests/conftest.py` (1-34) — add `os.environ.setdefault` blanks for the new Supabase vars (preserve order-independence per [lessons "Tests must be order-independent"](context/foundation/lessons.md)).

**Deps** (keep `requirements.txt` AND `pyproject.toml` in sync — `requirements.txt` is the Railpack source, [`requirements.txt:1-5`](supply-os-v1/requirements.txt)): add `supabase` (pulls `httpx`, `storage3`, `postgrest`, `gotrue`, `realtime` transitively); `httpx` thereby becomes runtime (dev-only today). `google-auth` must stay (Sheets); `google-api-python-client` can be dropped only if `drive.py` is removed entirely.

**Secrets / deploy** ([`config.py`](supply-os-v1/app/config.py), `.env.example`, Railway runbook): convention is `env_prefix="SUPPLY_OS_"` + `SecretStr`. Add `supabase_url: str=""`, `supabase_service_role_key: SecretStr`, `supabase_wz_bucket: str="wz-photos"`. Remove/deprecate `gdrive_wz_folder_id` (and its `.env.example` line — Railway intentionally leaves it blank). Set the three vars via `railway variables --set`; no `Procfile`/`railway.toml` change.

**Data schema**: `receipts` Sheet tab columns today (from `RECEIPT_HEADERS`): `… received_with_missing_wz, wz_photo_folder_id, wz_photo_folder_url, wz_photo_count, notes`. Change: rename `wz_photo_folder_id` → `wz_photo_path_prefix` (stores `wz/<order_id>`); decide `wz_photo_folder_url` (recommend drop — sign on demand). No seed CSV for receipts (sheet-only). Live Sheet `receipts` tab is a manual operator column rename — safe, since prod never persisted a Drive photo.

### Supabase Storage integration (confirmed against current API)

Recommended module `app/supabase_storage.py` (mirrors `drive.py`):
```python
BUCKET = settings.supabase_wz_bucket  # "wz-photos"
_client = None
def is_configured() -> bool:
    return bool(settings.supabase_url and settings.supabase_service_role_key.get_secret_value())
def reset_client() -> None: ...
def _supabase_client():
    global _client
    if _client is not None: return _client
    from supabase import create_client  # lazy
    _client = create_client(settings.supabase_url,
                            settings.supabase_service_role_key.get_secret_value())
    return _client
def upload_photo(path, content, mime_type) -> str:          # path e.g. wz/<order_id>/<name>
    _supabase_client().storage.from_(BUCKET).upload(
        path=path, file=content,
        file_options={"content-type": mime_type, "upsert": "false"})
    return path                                              # store the PATH, not a URL
def list_photos(prefix) -> list[str]: ...                   # storage.from_(BUCKET).list(prefix)
def create_signed_url(path, expires_in=3600) -> str:
    return _supabase_client().storage.from_(BUCKET).create_signed_url(path, expires_in)["signedURL"]
```

Sources: [supabase-py upload](https://supabase.com/docs/reference/python/storage-from-upload), [create signed URL](https://supabase.com/docs/reference/python/storage-from-createsignedurl), [buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [storage-py archived](https://github.com/supabase/storage-py), [supabase 2.x PyPI](https://pypi.org/project/supabase/).

## Code References

- `supply-os-v1/app/main.py:2293-2377` — `captain_receipt_photos` upload endpoint (Drive calls to swap)
- `supply-os-v1/app/main.py:2318-2325` — `drive.is_configured()` 503 gate → Supabase gate
- `supply-os-v1/app/main.py:2218-2290` — `captain_receipt_detail` (where viewing connects)
- `supply-os-v1/app/drive.py:1-127` — side-service pattern to mirror
- `supply-os-v1/app/models.py:554-574` — `Receipt` WZ fields (+ `ReceiptDetail`/`Summary`/`PhotoUploadResponse`)
- `supply-os-v1/app/sheets.py:785-811` — `update_receipt`; `736-746` append; `332-391` row serialization
- `supply-os-v1/app/config.py:46-50,71-120` — Drive folder id + SA-creds resolver (add Supabase settings)
- `frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx:34` — `WZ_PHOTOS_ENABLED` flag
- `frontend/src/pages/captain-mp/OrderDetailPage.tsx:239-256` — current Drive-folder link to replace
- `frontend/src/apiClient.ts:276-282` — `receiptUploadPhotos` (unchanged); add `receiptPhotoUrls`
- `supply-os-v1/tests/test_receipt_photos.py` / `test_drive.py` / `test_receipt_sheets.py` / `test_receipt_detail.py` / `test_config_creds.py` / `conftest.py` — test surface

## Architecture Insights

- **Storage is a separate axis from the data-layer seam.** `_choose_backend()` swaps tabular backends (seed/sheets/→Postgres); object storage is a directly-called side-service that degrades via `is_configured()`. Keeping it out of the seam is consistent with `drive.py` and avoids over-coupling.
- **Persist-first, photos-second is already the contract** (frontend + backend): the receipt saves (flagged `received_with_missing_wz=True`) before photos upload, and upload is retryable in place. The Supabase swap preserves this exactly.
- **Sign on demand, store the path.** The single load-bearing storage rule: persist `wz_photo_path_prefix`, never a signed URL (URLs expire). All viewing signs fresh.
- **Decoupled from S-10.** This touches only the receipt photo path, not order data — it ships standalone before the Sheets→Postgres migration, while standing up the shared Supabase project.

## Open Questions (for the plan to resolve)

1. **`wz_photo_folder_url` fate** — drop the column (recommended; sign on demand) vs keep/repurpose. Affects models + the live Sheet header + TS types.
2. **Backend re-enable flag** — `WZ_PHOTOS_ENABLED` is a *frontend* constant. Does the backend also need an env kill-switch, or is `supabase_storage.is_configured()` (creds present) sufficient as the backend gate? (Recommend: `is_configured()` is the backend gate; don't conflate it with the frontend UI flag.)
3. **Bucket provisioning** — one-time manual step (private `wz-photos` bucket via dashboard/SQL); the SDK does not auto-create it. Encode as a runbook/migration checklist item with a human-confirmation pause.
4. **Service-role key format** — confirm the project key is the new `sb_secret_…` format (legacy `eyJ…` works until end-2026 but flag for rotation). Never decode/parse it; server-side only, never in the SPA.
5. **`google-api-python-client` removal** — drop only if `drive.py` is deleted outright vs left as a dead stub.
6. **Accountant-email TTL (out of scope here, but flagged)** — when the deferred GoStock email path lands, a 1h signed URL dies before the accountant reads it; resolve then by attaching bytes or a long/­re-signable link. Do not let this leak into this change.

## Historical Context (from prior changes)

- [`context/foundation/infrastructure.md:50-72`](context/foundation/infrastructure.md) — **authoritative decision** (2026-06-12): Supabase Storage private bucket, `service_role` server-side upload, signed URLs; drive.py→Supabase mapping table; anti-bias notes (content-type=text/html default, anon-key RLS silent-fail, never persist a signed URL, `sb_secret_` key format). Also: photos can ship before the datastore migration (`:72`).
- [`context/changes/gr-01/plan.md`](context/changes/gr-01/plan.md) — GR-01 built the receipt entity + Drive Phase 2 on the sheet stack, explicitly "No S-10/Supabase", accountant email deferred. This change re-does Phase 2's storage on Supabase.
- Memory `gr-01-wz-photos-supabase` — GR-01 shipped without working photo upload; Drive dead-end (service account has no storage quota, `403 storageQuotaExceeded` confirmed prod 2026-06-10); deferred to Supabase behind `WZ_PHOTOS_ENABLED`.
- [`context/foundation/lessons.md`](context/foundation/lessons.md) — relevant priors: never bypass the data-layer seam; mirror Pydantic optionality in TS; order-independent tests (conftest env); "merged ≠ live" (verify the running artifact, esp. the manual backend deploy).

## Related Research

- [`context/changes/gr-01/research.md`](context/changes/gr-01/research.md) — original goods-receiving + WZ-photo exploration (Drive era).

## Next step

`/10x-plan wz-photos-supabase-storage` — the design is decided and touchpoints are enumerated; resolve the six open questions inline in the plan.
