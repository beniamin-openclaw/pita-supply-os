# Transport v2 Implementation Plan

## Overview

Make the Transport screen the one place where a Pago + Magazyn Mory run is sent and marked:
two "Wyślij" buttons that create verified Gmail drafts in the order mailbox (biuro@) with the
PDF attached, a "Cofnij wysłanie" that puts a sent batch back into draft, a Pago ZOW e-mail
body without off-catalogue items, an explicit approval for off-catalogue items that should go
to PAGO, a driver e-mail that always states date/time/driver/vehicle, Pago/Mory chips instead
of the supplier dropdown, and a history list that is sorted newest first and filterable by city
and supplier. No migration.

## Current State Analysis

- `frontend/src/pages/manager/transport/PrintViews.tsx` — two PDF downloads + two Gmail-draft
  buttons. The drafts use the unverified `requestGmailAccessToken` (any account), no `From`,
  and do not change the batch status or leave a trace.
- `frontend/src/pages/manager/TransportPage.tsx` — sent view has "Kopiuj listę dla kierowcy" +
  "Otwórz email" (`buildTransportDriverText`, `buildTransportGmailUrl`) — the latter opens a
  compose window to the SUP_PAGO list with every product in the body ("Zamówienie zbiorcze
  Pago"). Draft view has "Zapisz i wyślij" / "Zatwierdź transport" (finalize, no e-mail).
  Supplier `<select>` lists every ordering supplier.
- `frontend/src/pages/manager/lib/gmailDraft.ts` `buildDraftBody` is shared by the Pago and the
  driver draft and always appends the off-catalogue block — the ZOW body leaked extras.
- `transportAutoLabel` (`lib/transport.ts`) uses `pickup_date ?? created`, so a batch without a
  pickup date is labelled with its creation weekday as if it were the pickup
  ("Transport Poniedziałek · Warszawa · 05.10.26" for TRN-20261005-PAGO-7b64e0, pickup null).
- Eligible list (`GET /api/manager/transport/eligible?include_companions=true`) returns the lead
  block newest-first, then the companion block newest-first — the combined list jumps back in
  time halfway. Prod also holds nine stale `manager_claimed` Pago/Mory orders from 21.09–01.10.
- Backend: finalize sends every claimed member (`manager_sent`, `sent_method='transport'`);
  there is no way back from `sent`. `_log_transport_event` exists; event details are free text.
  `TransportDraftConfig` has no mailbox; `settings.order_mailbox` (default biuro@pitabros.pl)
  is exposed only on `ManagerOrderDetail`.
- `lib/orderEmailDraft.ts` `createVerifiedOrderDraft` (order-email-v2) does token → profile
  check → draft → From check, with no attachments.

### Prod facts (SELECT only, 2026-10-05 19:10)

- SUP_PAGO e-mail list: finanse@, fakturymeze@gmail.com, manager@, three Lineage addresses.
  SUP_MORY: no e-mail, `ordering_method='manual'`.
- `_meta.transport_driver_recipients` = 3 addresses; drivers and vehicles dictionaries set.
- Headers: TRN-20261005-PAGO-7b64e0 `sent` (pickup/driver/vehicle null); nine `cancelled`
  test/old batches; one headerless legacy batch TRN-20260822-PAGO-b642d7.
- Extras are newline-separated "Name - qty unit" lines.

## Desired End State

Filter bar on top: `Pago` and `Magazyn Mory` chips (both on, at least one stays on) and city
tiles (all on). The eligible list and the history list follow both filters and are newest
first. Batch rows show supplier badges; a batch without a pickup date is labelled
"Transport · Warszawa" (no fake weekday).

In a batch, one "Dokumenty i wysyłka" panel holds: the two PDF downloads, "Wyślij zamówienie",
"Wyślij listę kierowcy", the status line (sent at, last drafts with time and mailbox), "Oznacz
jako wysłane bez maila" and, on a sent batch, "Cofnij wysłanie".

"Wyślij …" opens an in-page confirmation card (not `window.confirm` — the OAuth popup needs the
next click's user activation): recipients, From (order mailbox), missing logistics fields as a
soft warning, for the order the off-catalogue checklist (unticked by default; ticked lines go to
the ZOW PDF in a separate section, never into the body), what will happen to the status, and
that the previous draft of the same document is replaced. Its confirm button runs, as its FIRST
await, the verified token for the order mailbox, then (order on a draft batch) finalize →
reload detail → PDF → verified draft → draft event → reload. The driver list never changes the
status. Nothing is ever sent by the app.

"Cofnij wysłanie" moves a sent batch back to draft (members `manager_sent` → `manager_claimed`),
refused when any member has a receipt or the batch is a headerless legacy one.

## What We're NOT Doing

- No migration, no new columns. Draft ids live in transport event details.
- No change to single-order e-mails (other suppliers), recipients lists or Pago's PDF layout
  beyond the approved-extras section.
- No sending (`gmail.compose` only). No prod data writes from code or from the agent.
- No change to receiving: captains record differences at receipt.

## Implementation Approach

Three code phases plus verification. Phase 1 (backend) and Phase 2 (frontend lib + contract)
run in parallel; Phase 3 (UI) builds on Phase 2. Every phase keeps its suites green.

## Phase 1: Backend (supply-os-v1)

### Changes Required

1. `models.py`:
   - `TransportDraftConfig.order_mailbox: str = ""`.
   - `TransportBatchSummary.supplier_ids: list[str] = Field(default_factory=list)` — distinct
     member supplier ids, the batch (lead) supplier first, then the others sorted; a header-only
     batch with no members gives `[header.supplier_id]`.
   - `TransportReopenRequest {transport_id: str}`; `TransportReopenResponse {transport_id: str,
     reopened: list[str], skipped: list[TransportSkippedOrder]}` (reuse the finalize skip model).
   - `TransportDraftCreatedRequest {transport_id: str, kind: Literal["order", "driver"],
     gmail_draft_id: str (pattern ^[A-Za-z0-9_-]{1,200}$), mailbox: str = "" (max 200),
     approved_extras: list[str] = [] (max 50 items, each max 300 chars),
     replaced_draft_id: str = "" (same pattern or empty)}`.
2. `main.py`:
   - `manager_transport_draft_config` fills `order_mailbox` from `settings.order_mailbox`.
   - `manager_transport_batches` fills `supplier_ids`.
   - `POST /api/manager/transport/reopen` (`require_manager`): 503 when the header store is
     unavailable (mirror finalize/cancel); 404 when the batch has no header (legacy) or does not
     exist; 409 when header status is not `sent`; 409 listing locations when any member is
     `closed` or `_has_receipts` is true — checked for ALL members before any write. Then each
     `manager_sent` member: `update_order(status=manager_claimed, sent_method=None,
     manager_sent_at=None, expected_status=manager_sent)`; a status conflict goes to `skipped`;
     members in other statuses are left alone and reported in `skipped`. Header → `draft`,
     `sent_at=None`. Event `batch_reopened` (details: reopened order ids). Never touches lines.
     Amended after the backend review: a member write that hits a backend error → 503 with the
     header left `sent` (event logged, retry is safe); nothing reopened and no member already
     claimed → 409 with the header left `sent`; receipts are re-read after the member loop and a
     member that got a receipt meanwhile is written back to `closed` (skip reason "delivery
     recorded during reopen") — this narrows the race, it does not close it.
   - `POST /api/manager/transport/draft-created` (`require_manager`): 404 unknown batch / no
     header, 409 when cancelled, 409 for `kind=order` on a batch that is not `sent` (finalize
     first); logs `order_draft_created` / `driver_draft_created` with details
     `draft_id=<id>; mailbox=<mailbox>[; replaced=<id>][; extras=<a> | <b>]` (newlines in extras
     collapsed to spaces); returns the `TransportEvent`. Best-effort logging must not hide a
     failure here: if the event cannot be written, return 503.
3. Tests in `tests/test_transport.py` (or a new `tests/test_transport_v2.py`): summary
   `supplier_ids` (combined, pago-only, empty draft); draft-config mailbox; reopen happy path
   (statuses, header, event), 409 not sent, 409 with receipts (no member changed), 404 legacy,
   conflict → skipped; draft-created both kinds, validation 422, cancelled 409, details format.

### Success Criteria

- `ruff check .` and `python -m pytest` pass; integration suite unaffected.

## Phase 2: Frontend lib and contract

### Changes Required

1. `types.ts`: `TransportDraftConfig.order_mailbox?: string`; `TransportBatchSummary.supplier_ids?:
   string[]`; `TransportReopenRequest/Response`; `TransportDraftCreatedRequest`.
2. `apiClient.ts`: `transportEligible(supplier_id, include_companions = true)` (sends the flag
   value), `transportReopen(transport_id)`, `transportDraftCreated(req)`.
3. `lib/orderEmailDraft.ts`: split `createVerifiedOrderDraft` into
   `acquireVerifiedGmailToken({clientId, mailbox})` (login hint, reuse, profile check,
   remember token) and `createVerifiedDraftWithToken(token, {from, to, cc?, subject, body,
   attachments?})` (MIME → draft → From check → delete + `SenderRewrittenError`); the old
   function composes them, behaviour unchanged for DispatchPanel/ResendPanel.
4. `lib/gmailDraft.ts`:
   - `buildPagoDraftEmail`: subject `Zlecenie odbioru wlasnego - {label}` plus ` - {pickup_date}`
     only when set; body = greeting, attachment line, pickup line (date[/time], or "termin do
     potwierdzenia"), closing, signature. No product, no extra item, no location text.
   - `buildDriverDraftEmail`: always prints date, time, driver, vehicle lines (value or "do
     potwierdzenia"), the batch notes when set, every member's off-catalogue block, attachment
     line, closing, signature.
5. `lib/transport.ts`:
   - Remove `buildTransportDriverText`, `buildTransportEmailSubject`, `buildTransportEmailBody`,
     `buildTransportGmailUrl` and their tests/i18n keys if nothing else uses them.
   - `transportAutoLabel` without `pickup_date`: `Transport · {cities}` — no weekday, no date.
   - `TRANSPORT_CHIP_SUPPLIER_IDS = ["SUP_PAGO", "SUP_MORY"]`,
     `transportScopeFromChips({pago, mory}) -> {leadSupplierId, includeCompanions}`
     (both → PAGO + companions; Pago → PAGO alone; Mory → MORY alone).
   - `transportLocationCity(locationId, locationsById)`, `transportCityOptions(...)`,
     `sortTransportBatches` (pickup date, else created date, desc; then created desc),
     `filterTransportBatches(batches, {supplierIds, cities}, locationsById)` (a batch without
     locations always shows), `sortEligibleNewestFirst`.
   - `pagoExtraItemLines(detail)` — lead-supplier members' extra lines `{key, locationName,
     text}`; `buildTransportPagoPrintDoc(detail, label, approvedExtraItems = [])` gains
     `approvedExtraItems`; `buildTransportDriverPrintDoc` gains `notes`.
   - `missingLogisticsFields(detail)` → ordered subset of
     `pickup_date | pickup_time | driver | vehicle`.
   - `latestTransportDraft(events, kind)` → `{draftId, mailbox, at} | null` parsed from the
     newest `*_draft_created` event details; event labels for `order_draft_created`,
     `driver_draft_created`, `batch_reopened`.
6. `lib/transportPdf.ts`: ZOW PDF prints an "uzgodnione pozycje dodatkowe" section only when
   `approvedExtraItems` is non-empty; driver PDF prints the notes.
7. i18n keys for the above; Vitest for every new or changed helper, including "no Pago body
   contains a product name or an extra item" and the label fix.

### Success Criteria

- `npm run build`, `npm run lint`, `npm run test` pass (Homebrew node).

## Phase 3: Frontend UI

### Changes Required

1. `TransportPage.tsx`: filter bar (supplier chips + city tiles) replacing the supplier select;
   eligible list scope from chips, sorted newest first, city-filtered, selection pruned to what
   is visible; history fetched once for all suppliers, filtered + sorted with the helpers, rows
   with supplier badges; empty chip-disabled sections hidden in the draft UI; remove copy/open
   e-mail buttons and their memos; draft footer keeps save + cancel, the send actions move to
   the panel.
2. New `transport/TransportSendPanel.tsx` (replaces `PrintViews.tsx`): downloads, the two
   "Wyślij" buttons with the confirmation card, status line, "Oznacz jako wysłane bez maila",
   "Cofnij wysłanie". Send disabled while the matrix has unsaved changes (hint shown) or the
   recipients are invalid (tooltip). Errors via `describeDraftError`. Success shows a link to the
   mailbox drafts (`gmailDraftsUrl(mailbox)`). The previous draft of the same kind (from events)
   is deleted best-effort only after the new draft exists.
3. Component tests for the panel (mocked api + draft functions): order send on a draft batch
   calls token → finalize → draft → draft-created in that order; driver send never finalizes;
   unapproved extras never reach the PDF builder; reopen calls the endpoint and refreshes.

### Success Criteria

- Suites, lint and build pass; manual run against a local backend with auth on shows the flow.

## Phase 4: Verify, review, ship

1. Full backend + frontend checks. 2. Independent impl review (review-opus-xhigh), fixes.
3. Commit, push, PR, CI green, merge → Railway + Vercel; verify `/health`, the new Vercel bundle
for the merge commit and `GET /api/manager/transport/draft-config` returning `order_mailbox`.
4. Roadmap row + AGENTS.md test counts in the same change.

### Operator steps (not code)

- Mark ORD-20261004-BRO-MORY-8fbdd2 and ORD-20261004-KEN-MORY-06569d as sent (Manager → order →
  "Oznacz jako wysłane") so Browary and KEN can receive Magazyn goods on 06.10.
- Decide the stale `manager_claimed` orders (21.09–01.10): mark sent or cancel.
- First live run: Wola + Bracka transport for 07.10 from the app; check the biuro@ draft, send it
  by hand.

## Testing Strategy

Unit: builders (bodies, subjects, label, PDFs), filters/sorting, scope mapping, event parsing,
orderEmailDraft split. Backend: endpoint tests above. Component: send panel sequencing.
Manual: live E2E by the operator on prod after deploy (drafts only).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Backend

- [x] 1.1 Models + draft-config mailbox + summary supplier_ids — ef66936
- [x] 1.2 Reopen endpoint — ef66936
- [x] 1.3 Draft-created endpoint — ef66936
- [x] 1.4 Backend lint + tests pass — ef66936

### Phase 2: Frontend lib and contract

- [x] 2.1 Types + apiClient — ef66936
- [x] 2.2 orderEmailDraft split — ef66936
- [x] 2.3 Pago and driver e-mail builders — ef66936
- [x] 2.4 transport.ts helpers, removals, label fix — ef66936
- [x] 2.5 PDF sections — ef66936
- [x] 2.6 Frontend build + lint + tests pass — ef66936

### Phase 3: Frontend UI

- [x] 3.1 Filter bar, eligible and history lists — ef66936
- [x] 3.2 Send panel with confirmation card, mark-only, undo-send — ef66936
- [x] 3.3 Removals of old buttons — ef66936
- [x] 3.4 Component tests + suites pass — ef66936

### Phase 4: Verify, review, ship

- [x] 4.1 Independent impl review addressed — ef66936
- [ ] 4.2 PR merged, CI green
- [ ] 4.3 Live: /health, new bundle, draft-config mailbox
- [ ] 4.4 Operator E2E on the 07.10 run
