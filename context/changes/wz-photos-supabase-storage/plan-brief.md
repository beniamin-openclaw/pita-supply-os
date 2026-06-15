# WZ Photo Upload via Supabase Storage — Plan Brief

> Full plan: `context/changes/wz-photos-supabase-storage/plan.md`
> Research: `context/changes/wz-photos-supabase-storage/research.md`

## What & Why

Re-enable the deferred GR-01 WZ delivery-note photo feature by moving photo storage from Google Drive (a structural dead-end — a service account has no Drive quota, `403 storageQuotaExceeded` in prod) to a **private Supabase Storage bucket**. Photos upload server-side with the `service_role` key and are viewed in-app via short-lived signed URLs. This unblocks the one missing piece of goods-receiving and stands up the shared Supabase project ahead of the later datastore migration.

## Starting Point

GR-01 shipped with the receipt entity and the full upload UI, but photo upload is hidden behind a frontend `WZ_PHOTOS_ENABLED = false` flag because the Drive path never worked in production. The upload endpoint, multipart transport, and camera-capture control all exist; only the storage backend is broken. The sole place photos surface today is a dead "open Drive folder" link in the order detail receipt card.

## Desired End State

A Captain attaches WZ photos on a dispatched order and confirms; the photos land in the private `wz-photos` bucket under `wz/<order_id>/`. The order detail receipt card shows them as a signed-URL thumbnail grid (tap to enlarge, reload always re-signs). The receipt stores only a path prefix + count — never a URL. Google Drive code and its dependency are gone.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Storage target | Private Supabase bucket, `service_role` server-side, signed URLs | Bills to the project not an identity — kills the Drive quota/scope problem class | Research/Infra |
| Integration shape | New `app/supabase_storage.py` side-service (not a `_choose_backend()` backend) | Object storage is a different axis; mirrors `drive.py` exactly | Research |
| Client library | `supabase-py` SDK | Official, sync-by-default; `storage3` is archived; raw REST unjustified | Research |
| Supabase provisioning | None exists — plan stands up project + bucket (Phase 0) | S-10 hasn't started; keep it self-contained | Plan |
| Drive code | Fully remove (`drive.py`, `test_drive.py`, `google-api-python-client`) | Confirmed dead-end; no dead code or unused dep | Plan |
| Schema | Rename `wz_photo_folder_id`→`wz_photo_path_prefix`, drop `wz_photo_folder_url` | Names match reality; sign on demand, never store a URL | Plan |
| Backend gate | `supabase_storage.is_configured()` only (creds present) | One source of truth; mirrors `drive.is_configured()` | Plan |
| Viewing UI | Inline thumbnail grid in `OrderDetailPage` | Reuses the one receipt-render spot; smallest diff | Plan |
| Signed-URL TTL | 1 hour | Ample for view-then-act; tight leak window; reload always re-signs | Plan |

## Scope

**In scope:** Supabase side-service + config/deps; endpoint swap to Supabase; sign-on-demand viewing endpoint; schema/model/TS reshape; remove Drive; re-enable flag; inline photo grid; i18n; prod cutover.

**Out of scope:** accountant/GoStock email hand-off; Sheets→Postgres datastore migration (S-10); new receipt-detail route; backend env kill-switch; Manager-side photo view; any change to the upload transport.

## Architecture / Approach

The route resolves data persistence via `_choose_backend()` (unchanged) and calls `supabase_storage` directly as a side-service — exactly how it called `drive` today. Upload: `POST /api/captain/receipt/{id}/photos` (multipart, unchanged) → `supabase_storage.upload_photo("wz/<order_id>/<receipt_id>-NN.ext", bytes, content_type)`; persist `wz_photo_path_prefix` + count. View: new `GET /api/captain/receipt/{id}/photos` lists objects under the prefix and signs each at 1h. The SPA only ever talks to `/api/*` — the `service_role` key never leaves the backend.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 0. Provision Supabase | Project + private `wz-photos` bucket + key | Manual; bucket must be private |
| 1. Backend foundation | `supabase_storage.py` + config + deps + tests (Drive still live) | SDK call shape / lazy-import correctness |
| 2. Schema reshape | Renamed receipt fields + photo-item model | Catching every field reference |
| 3. Swap + view + remove Drive | Endpoint on Supabase, viewing endpoint, Drive deleted | Atomic removal — no broken `drive` import mid-phase |
| 4. Frontend | Flag on, signed-URL grid, types, i18n | Photo grid empty/error states |
| 5. Cutover | Railway vars + live Sheet header rename + prod smoke | "merged ≠ live" — verify running prod |

**Prerequisites:** A Supabase account (project created in Phase 0). Railway access for Phase 5. Access to the live Sheet to rename one header.
**Estimated effort:** ~2–3 sessions across 5 phases (Phase 0 + 5 are short manual steps; 1–4 are the work).

## Open Risks & Assumptions

- **Content-type gotcha**: Supabase defaults a missing content-type to `text/html` — must pass it explicitly or images won't render.
- **Anon-vs-service key**: an accidental anon-key init makes private-bucket uploads fail silently under RLS — initialize only with the service-role key.
- **Never persist a signed URL** — store the path prefix, sign on demand; a stored URL would expire.
- **Sheet header rename** assumes no Drive photo data exists in prod (confirmed — Drive never worked).
- **`httpx` becomes a runtime dep** (pulled by `supabase-py`); harmless but noted.

## Success Criteria (Summary)

- A Captain can attach WZ photos to a dispatched order, confirm, and immediately see them in the order detail receipt card; a later reload still shows them.
- Photos live in the private bucket; the receipt stores a path prefix, never a URL; no Drive code or dependency remains.
- `python -m pytest`, `ruff check .`, `npm run build`, and `npm run lint` all pass; a real upload+view works against running prod.
