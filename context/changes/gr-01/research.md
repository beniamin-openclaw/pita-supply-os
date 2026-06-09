---
date: 2026-06-09T12:55:06+02:00
researcher: beniamin-openclaw
git_commit: 29217f5ebd8088e0c40c1889c06a5d58d54240d1
branch: claude/admiring-blackwell-f31c63
repository: admiring-blackwell-f31c63 (pita-supply-os)
topic: "GR-01 Goods Receiving — Captain confirms delivery, uploads WZ photo, auto-emails accountant"
tags: [research, codebase, goods-receiving, email-send, photo-storage, data-layer, gr-01]
status: complete
last_updated: 2026-06-09
last_updated_by: beniamin-openclaw
---

# Research: GR-01 Goods Receiving

**Date**: 2026-06-09T12:55:06+02:00
**Researcher**: beniamin-openclaw
**Git Commit**: 29217f5ebd8088e0c40c1889c06a5d58d54240d1
**Branch**: claude/admiring-blackwell-f31c63 (not on main; not pushed — local refs only, no GitHub permalinks)
**Repository**: pita-supply-os

## Research Question

GR-01 adds a **Goods Receiving** flow: a Captain confirms a delivery against a dispatched order — entering delivered quantity per line (vs. ordered), uploading WZ delivery-note photo(s) — which triggers an **automatic email** (ordered/delivered table + discrepancies + WZ photo **as attachment**) to `officebropb@gmail.com` (prod, eventually GoStock) and `beniamin@pitabros.pl` (test). A human then keys the PO into GoStock manually (GoStock has no API yet).

Three architectural decisions drive the research: **(1) photo storage** — Google Drive vs Supabase Storage (S-10) vs base64-in-Sheets; **(2) ML/WZ processing** — future, but storage must enable it; **(3) Telegram discrepancy alerts** — phase 2. (2) and (3) are roadmap items and do not block GR-01.

## Summary

**The headline finding: the binding constraint is not photo storage — it is email.** GR-01's requirement to send an *automatic* email with a *binary attachment* breaks the existing email architecture at the protocol level. The whole dispatch stack is built on a **Gmail compose URL** (`https://mail.google.com/mail/?view=cm&...`) that a human clicks Send on — and compose URLs **cannot carry attachments** and never send automatically. There is **zero server-side email-send code anywhere** in the repo. So GR-01 must introduce a genuinely new send pathway. The good news: this is architecturally *cleaner* for GR-01 than for dispatch, because the GR-01 email is machine→accountant (no human edit step), so a fully automated server-side send actually fits the use case.

**Photo storage** resolves clearly: **Google Drive is the only option buildable today.** base64-in-Sheets is mathematically impossible (Sheets caps a cell at 50,000 chars; the *smallest* usable phone photo is ~137,000 base64 chars — 3–140× over). Supabase Storage is the right long-term home but is **blocked on S-10**, which is `proposed`, not provisioned. ADR-001 already foresaw exactly this ("Sheets won't hold image blobs; either move data to Supabase or add a separate Drive/S3 for files").

**Data model** has a clean precedent: mirror `inventory_counts`/`inventory_count_lines` exactly — a standalone entity behind `_choose_backend()`, keyed to `order_id`, **without** adding a new `OrderStatus` (Tier-1 forbids breaking the status workflow). The data-model doc already reserves the names **`receipts` + `receipt_lines`** for "Phase 2 — receiving + WZ".

**Sequencing**: GR-01 is a **parked PRD Non-Goal**, outside Horizon 2. Two gates sit in front of production: **D-01** (deploy wiring — `main` is not live in prod) and **S-10** (the owner's named next move). Proceeding with GR-01 is a conscious scope decision the owner must make.

---

## Detailed Findings

### A. Email send-path gap — the crux

**There is no server-side email send anywhere.** A full-repo search for `smtplib`, `aiosmtplib`, `sendgrid`, `resend`, `postmark`, `mailgun`, `ses`, `boto3`, `MIMEMultipart`, `email.message`, `messages.send`, Gmail API send, `nodemailer` returned **zero** product-code hits. The only email module is [`gmail_url.py`](supply-os-v1/app/gmail_url.py), which does no I/O.

**The current dispatch flow** (`manager_dispatch`, [main.py:1170](supply-os-v1/app/main.py)):
1. `POST /api/manager/dispatch` → for an EMAIL-channel supplier, calls `gmail_url.build_draft_url(...)` ([main.py:1277](supply-os-v1/app/main.py)) — a **pure URL builder, no network call** ([gmail_url.py:130](supply-os-v1/app/gmail_url.py)).
2. Returns `ManagerDispatchResponse.gmail_compose_url` (a `str | None`).
3. Frontend stores that URL only as a **session-only "re-open" link** (`ManagerPage.tsx:262`).
4. The email the manager *actually sends* is built **client-side** by `frontend/src/pages/manager/lib/emailBody.ts`, rendered as editable subject/body, and opened via a real `<a target="_blank" href={composeUrl}>` (`DispatchPanel.tsx:280`). **The human clicks Send inside Gmail.**

**Two coupled constraints carried from S-02** (documented in the big NOTE at [gmail_url.py:122](supply-os-v1/app/gmail_url.py) and `emailBody.ts`):
- The email body is built in **two parallel places** (backend `gmail_url.py` + frontend `emailBody.ts`) that must change together.
- `MAX_GMAIL_URL_LENGTH = 8000` ([gmail_url.py:23](supply-os-v1/app/gmail_url.py)) — over which the backend 400s and the FE hides the button.

**Service-account scopes** ([sheets.py:49](supply-os-v1/app/sheets.py)) are `spreadsheets` + `drive.file` only — **no Gmail scope**. **Config/secrets** ([config.py:14](supply-os-v1/app/config.py)) have **no email-send settings** of any kind.

**The exact gap, and candidate send mechanisms:**

| Capability | Today | GR-01 needs |
|---|---|---|
| Build email text | ✅ (TS + Python URL builders) | reuse / adapt |
| Send automatically (no human click) | ❌ absent | **new** |
| Attach a binary file (WZ photo) | ❌ impossible via compose URL | **new (server-side MIME)** |
| Send credentials/config | ❌ none | **new env vars** |

- **SMTP via stdlib `smtplib` + Gmail app password** — *lowest friction*: stdlib only (no new dep), works on any Gmail/Workspace account, binary attachments are first-class (`MIMEMultipart` + `MIMEBase`). Needs one secret (`SUPPLY_OS_GMAIL_APP_PASSWORD`).
- **Gmail API `messages.send` via service-account domain-wide delegation** — reuses the existing SA, but requires `pitabros.pl` to be a Workspace domain, **two** admin grants (GCP scope + Workspace DWD), and a new `google-api-python-client` dependency. Cannot impersonate a plain `@gmail.com`.
- **Transactional provider (Resend/SendGrid/Postmark)** — best attachment ergonomics, decoupled from Google, but a new paid vendor not currently chosen (not in `docs/tooling.md`).

> **Architectural note:** the GR-01 email is machine→accountant and needs no human edit, so it should be a **new, separate send pathway** — do *not* retrofit it into `manager_dispatch`. The existing supplier-dispatch compose-URL flow stays as-is.

### B. Photo storage feasibility

**`drive.file` scope is declared but never exercised.** It's present at [sheets.py:51](supply-os-v1/app/sheets.py) only because gspread needs it to open a spreadsheet by id. There is **no** `googleapiclient.discovery`, `drive.files().create()`, or `MediaFileUpload` anywhere; the backend depends on `gspread` + `google-auth` but **not** `google-api-python-client`.

**Critical `drive.file` nuance:** the scope grants access only to files *the app itself created*. A service-account-created Drive file lands in the **SA's own driveless storage**, invisible in any human's My Drive unless shared back. To land photos in a browsable folder you either (a) create a `WZ Photos` folder, **share it with the SA email**, and create files in it, or (b) use the broader `https://www.googleapis.com/auth/drive` scope. Either way: **a one-time owner ops step**, confirmed by `docs/pita-supply-os-v1/GCP_SERVICE_ACCOUNT_SETUP.md:240` (the SA cannot create files in your Drive by default).

**No file-upload infrastructure exists** — zero `multipart`, `UploadFile`, `FormData`, or image handling in any `.py`/`.ts`/`.tsx`. Both backend (`python-multipart` + FastAPI `UploadFile`) and frontend must be built from scratch.

| Criterion | A: Google Drive | B: Supabase Storage | C: base64-in-Sheets |
|---|---|---|---|
| Buildable today | ✅ (2 new deps + 1 owner ops step) | ❌ blocked on S-10 (`proposed`) | ❌ physically impossible |
| New deps/provisioning | `google-api-python-client`, `python-multipart`; share folder w/ SA | Supabase project + `storage3`/`supabase-py` SDK | base64 chunking hack |
| Fits existing stack | High (same GCP project/SA; Drive API already enabled) | Low now / High at target state | High but impossible |
| ML-future (stable URL/bytes) | ✅ via Drive API `files.get(alt=media)` | ✅ best — signed/public URLs, no Google auth | ❌ no URL, no MIME |
| Key risk | `drive.file` share-back nuance; new auth-token path | blocked on S-10; lock-in warning (`infrastructure.md:171`) | 50k-char cell limit; would blow the 60 writes/min quota |

**base64-in-Sheets is a non-starter:** 1 MB photo → ~1.37M chars vs the 50,000-char cell limit; even a 0.1 MB photo is 2.7× over. Chunking a 5 MB photo ≈ 100 cells ≈ 100 writes ≈ the entire Sheets 60/min quota for one photo. `sheets.py:641` already flags the write-quota ceiling. ADR-001 categorically rejected image blobs in Sheets.

> **Storage + email interplay (MVP shape):** Captain uploads → backend stores bytes to **Drive** (durable record + ML-ready) **and** attaches the same bytes to the outgoing email in the same request. Store the Drive `fileId` on the receipt so a later S-10/Supabase migration is a metadata move, not a rewrite. The brief's "wgrane do aplikacji, dołączone do orderu" means the photo must be **retained on the order**, so durable storage is genuinely required (not attach-and-forget).

### C. Data model — mirror `inventory_counts`, do not touch `OrderStatus`

**OrderStatus lifecycle** ([models.py:18](supply-os-v1/app/models.py)): `draft → captain_submitted → manager_claimed → manager_sent`, plus `closed`/`cancelled` which are **defined but never set by any route** (only referenced in FE i18n/status helpers). Transitions: submit ([main.py:427](supply-os-v1/app/main.py)), claim ([main.py:1122](supply-os-v1/app/main.py)), release ([main.py:1162](supply-os-v1/app/main.py)), dispatch ([main.py:1295](supply-os-v1/app/main.py)).

**Recommendation: standalone entity, no new status.** Tier-1 names the status workflow "do not break"; a new `goods_received` status would ripple through every queue filter, sort key, and FE status branch. A delivery is a *child of an order* (like `order_lines`), supports partial/second/disputed deliveries, and doesn't map to a linear status bump. If a receipt should close the order, issue a thin `update_order(order_id, status=OrderStatus.CLOSED.value)` — `CLOSED` already exists; only the writing route is new.

**The exact `inventory_counts` template to mirror** (`receipts` / `receipt_lines` — names already reserved in `docs/pita-supply-os-v1/DATA_MODEL.md:224`):
- **models.py** — `InventoryCount` ([models.py:396]), `InventoryCountLine` ([models.py:386]), submit request/response ([models.py:415],[models.py:430]), summary/detail variants ([models.py:456]+). Add the `Receipt*` analogues.
- **sheets.py** — `load_inventory_counts`/`load_inventory_count_lines` ([sheets.py:687],[sheets.py:692]), `append_inventory_count`/`append_inventory_count_lines` ([sheets.py:697],[sheets.py:710]), `get_inventory_count` ([sheets.py:732]). All built from `_read_with_ttl` ([sheets.py:247]), `_open_worksheet` + `_get_column_order` + `append_row(s)`, and `model_copy(update={"lines": lines})`.
- **seed_loader.py** — **no changes**: seed mode never gains the new functions; routes degrade via `if backend is not sheets`.
- **main.py** — `_generate_count_id` ([main.py:1416]), `_persist_inventory_count` ([main.py:1423], `getattr`-guarded seed fallback), and the submit/latest/counts/detail routes with the two `WorksheetNotFound` patterns (optional routes → `[]`/`None`; write/detail routes → `503` with an actionable "create the tabs" message).
- **Google Sheet tabs** — add `receipts` + `receipt_lines`. Header validation (`_validate_headers`, [sheets.py:219]) requires a column for every **no-default** Pydantic field.
- **IDs** — `_generate_order_id` = `ORD-YYYYMMDD-LOC3-SUP4-6hex` ([main.py:256]); `_generate_count_id` = `INV-YYYYMMDD-LOC3-6hex` ([main.py:1416]). Use `RCP-YYYYMMDD-LOC3-6hex`; line ids `RL-{receipt_id}-{idx:03d}`.
- **Attribution** — free-text `received_by` (required in the request, optional on the persisted model for legacy-row safety), mirroring `count_user` ([models.py:424], [main.py:1563]); location comes from the Captain token.
- **Tests** — mirror `test_inventory_submit.py`, `test_inventory_counts.py`, `test_inventory_manager.py`, `test_inventory_sheets.py` (gspread mocked at `_open_worksheet`). conftest sets `SUPPLY_OS_DATA_BACKEND=seed` session-wide (Lesson 6).

**Prior design input** (`docs/pita-supply-os-v1/ROADMAP.md` Phase 2): "Required WZ photo per receipt; if missing → `received_with_missing_wz` status flag." Worth carrying as a receipt-level flag rather than an order status.

### D. Frontend — new Captain screen + first-ever file upload

**Routing** (`frontend/src/App.tsx`): Captain order detail is `/captain-v2/orders/:order_id` (`OrderDetailPage.tsx`); edit is `/captain-v2/orders/:order_id/edit`. **Add** `/captain-v2/orders/:order_id/receive` → new `DeliveryConfirmPage` (parallel to `/edit`).

**Status-gating template** (`OrderDetailPage.tsx:191`): the Edit button is gated on `order.editable` (= `status===captain_submitted`). The "Potwierdź dostawę" button follows the same shape, gated on `order.status === "manager_sent"`. The `manager_sent` badge already exists (`lib/orderStatus.ts:30`).

**apiClient is JSON-only** (`apiClient.ts:50` — hard-codes `application/json` + `JSON.stringify`; **no multipart path**). Recommendation: **add a parallel `apiPostFormData<T>()` helper** (don't touch `request()`), and split the flow into a multipart **photo-upload** call returning `photo_id[]`, then a small JSON **confirm** call referencing those ids. Keeps the confirm payload lean and lets the backend stream photo bytes to Drive independently.

**No image/file handling exists at all** — zero `<input type="file">`, `capture=`, `FileReader`, `canvas`, or compression. Must build:
- `<input type="file" accept="image/*" capture="environment" multiple>` (rear camera on mobile).
- **Client-side compression** — phone JPEGs are 2–4 MB each; 3–5 per delivery = 10–20 MB. Add `browser-image-compression` (new npm dep) with `maxSizeMB`/`maxWidthOrHeight`.
- `URL.createObjectURL` thumbnails (revoke on unmount).

**i18n** — single flat dict `frontend/src/i18n/strings.ts` (`{pl,en}` entries), consumed via `useT()`. Append `delivery.*` keys (English artifacts rule, Lesson 5, applies to skill artifacts — UI copy stays bilingual pl/en as today).

**Types** (`frontend/src/types.ts`) — the screen reads `CaptainOrderDetail` (status gate, `lines`) and `ManagerOrderLineDetail` (`manager_final_qty_purchase` as "ordered", `purchase_unit`). Add `DeliveryLineSubmit` / `DeliveryConfirmRequest` / `DeliveryConfirmResponse`. Match optionality to the Pydantic source (Lesson 7).

**Closest analog form** — `CaptainMP.tsx` (per-line `Record<string, …>` state, `ProductCard`, `StickyActionBar`, `Toast`, `ConfirmSubmitDialog`) and `OrderEditPage.tsx`'s `handleSubmit` try/catch with 409 handling.

### E. Sequencing, gates, and guardrails

- **GR-01 is a parked PRD Non-Goal** (`prd.md:239`, `roadmap.md:288`: "GoStock integration, receiving/WZ … parked"). It sits **outside Horizon 2**. Proceeding expands scope beyond the planned bridge — a conscious owner decision.
- **D-01 (deploy wiring) blocks production** — `context/changes/deployment/deployment-plan.md`: Vercel isn't pointed at the new repo, and the droplet isn't redeployed from `main` (S-09 `TENTH_KG` is on `main` but not live, 500-ing `supplier_products` in sheet mode). New backend code won't reach prod until D-01 is done. All deploy steps are owner-run.
- **S-10 (Supabase)** is the owner's named next move and the urgent Horizon-2 backend change (`roadmap.md:207`). Sequencing rule (`roadmap.md:185`): "Don't stack two big changes." Design GR-01 entities to slot into the S-10 seam without rework (store Drive `fileId` as metadata).
- **GoStock**: no API in v0–Phase 2; manual PO entry is the *designed* bridge (`BRIEF.md:72`). The email-to-accountant is correct; CSV export is Phase 3, live API Phase 4.
- **Test guardrail (mirror the Hard rule):** the existing suite "backs out on submit — no real supplier orders." GR-01's analog: **no real email to the accountant from tests.** Make recipients env-driven, default to the `beniamin@pitabros.pl` test sink, and never hit `officebropb@gmail.com` from a test.
- **Secrets (Lesson 3):** new email credentials + Drive folder id go to `.env.example` only, never committed.

## Code References

- `supply-os-v1/app/gmail_url.py:130` — `build_draft_url`: pure compose-URL builder (no send); `:23` `MAX_GMAIL_URL_LENGTH=8000`; `:122` two-builder coupling NOTE.
- `supply-os-v1/app/main.py:1170` — `manager_dispatch` (compose-URL dispatch); `:1413`+ inventory routes (the entity template); `:256`/`:1416` id generators; `:1423` `_persist_inventory_count` seed-fallback.
- `supply-os-v1/app/sheets.py:49` — SCOPES (`drive.file`, no Gmail); `:687`–`:748` inventory read/append/get to mirror; `:219` `_validate_headers`; `:247` `_read_with_ttl`.
- `supply-os-v1/app/config.py:14` — Settings: no email-send/storage vars.
- `supply-os-v1/app/models.py:18` — `OrderStatus` (closed/cancelled unused); `:374`–`:508` inventory models to mirror as `Receipt*`.
- `frontend/src/apiClient.ts:50` — JSON-only `request()`; needs a parallel multipart helper.
- `frontend/src/pages/captain-mp/OrderDetailPage.tsx:191` — `editable` status-gate template.
- `frontend/src/App.tsx` — Captain routes; add `/orders/:order_id/receive`.
- `frontend/src/i18n/strings.ts` — flat bilingual dict; append `delivery.*`.
- `frontend/src/types.ts` — `CaptainOrderDetail` / `ManagerOrderLineDetail`; add `Delivery*` types.

## Architecture Insights

- **The email pattern, not the storage pattern, is the load-bearing decision.** Storage resolves to "Drive now, Supabase at S-10." Email forces a brand-new server-side send with MIME attachments — pick the mechanism (SMTP-app-password is lowest-friction) before planning.
- **Keep GR-01's send pathway separate from supplier dispatch.** Dispatch = human-edited compose URL (stays). GR-01 = automated machine→accountant send (new). Different semantics, different code.
- **The `_choose_backend()` seam (Lesson 2, "load-bearing") makes the new entity routine** — `receipts`/`receipt_lines` is a near-mechanical copy of `inventory_counts`, with seed-mode graceful degradation handled entirely in `main.py`.
- **Design for S-10 portability now:** store the photo as a storage-agnostic reference (`fileId`/URL) on the receipt so the Drive→Supabase move is metadata-only.
- **Mobile-first upload is new ground:** rear-camera capture + client compression are required, not optional, given phone photo sizes vs. fetch/Vercel/FastAPI body limits.

## Historical Context (from prior changes)

- `context/archive/2026-06-06-manager-bukat-email-dispatch/` + `2026-06-07-dispatch-email-content/` — established the **compose-URL, human-clicks-Send** email model and the dual backend/frontend body builders. GR-01's attachment requirement is the first thing to break this model.
- `context/archive/2026-06-05-inventory-count/plan.md` — canonical **new-entity-behind-`_choose_backend()`** precedent (mirrors `orders`/`order_lines`). `2026-06-08-order-prefill-from-inventory/` — lesson: "fill only empty fields and name the source."
- `docs/pita-supply-os-v1/ADR-001-hybrid-hosting.md:159` — foresaw the WZ-photo storage problem: "Sheets won't hold image blobs; either move data to Supabase or add a separate Drive/S3 for files."
- `docs/pita-supply-os-v1/DATA_MODEL.md:224` — reserves `receipts` + `receipt_lines` for "Phase 2 — receiving + WZ"; `ROADMAP.md` Phase 2 — "required WZ photo per receipt; if missing → `received_with_missing_wz`."
- `context/changes/deployment/deployment-plan.md` — D-01 deploy gate (prod is behind `main`).
- `context/foundation/infrastructure.md` — datastore → Supabase (urgent); email = "keep compose-URL human-send + add server-side audit log (hybrid)"; Supabase pooler footgun (use 5432, not the 6543 pooler).
- `context/foundation/lessons.md` — L2 seam (load-bearing), L3 secrets-audit, L5 English artifacts, L6 conftest env, L7 TS optionality.
- Telegram (phase-2 alerts) is a **separate** product on the same droplet (`stack-assessment.md:79`, `DROPLET_DEPLOY_RUNBOOK.md:402`) — reusable infra, but not part of Supply OS and not yet designed.

## Related Research

- No prior `research.md` for goods-receiving — this is first-time thinking. Closest priors are the two email-dispatch archives and the inventory-count archive listed above.

## Open Questions

1. **Email send mechanism** — SMTP + Gmail app password (lowest-friction, stdlib) vs Gmail API + DWD (reuses SA, needs Workspace + 2 admin grants + new dep) vs transactional provider (Resend/SendGrid). *Decide before planning.* Is `pitabros.pl` a Google Workspace domain (gates the DWD option)?
2. **Photo storage for MVP** — confirm **Google Drive** (recommended) with a `WZ Photos` folder shared to the SA, storing `fileId` on the receipt for S-10 portability. Owner must create+share the folder and decide `drive.file` vs full `drive` scope.
3. **Order-close semantics** — does a confirmed receipt transition the order to `CLOSED`, or leave it `manager_sent` with the receipt as a separate record? (Recommend: separate record; optional thin `CLOSED` write.)
4. **WZ-photo requiredness** — is a photo mandatory per receipt (with a `received_with_missing_wz` flag fallback), or optional in the MVP?
5. **Sequencing** — proceed with GR-01 before/in-parallel-with S-10 and D-01? GR-01 is a parked Non-Goal outside Horizon 2; production needs D-01 first.
6. **Multi-delivery / partial-delivery** — does one order allow multiple receipts over time, or exactly one? (Entity model supports many; confirm the pilot scope.)
