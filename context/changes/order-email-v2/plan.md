# Supplier Order E-mail v2 Implementation Plan

## Overview

Ship the per-order supplier e-mail the operator approved on 2026-09-28: sent as a
Gmail API **draft** in the biuro@pitabros.pl mailbox with `From:` set to the location's
send-as alias, CC to the location mailbox, Polish copy with declined units, the location
phone, the sending manager's signature (Marek by default, switchable to Sławek), and the
delivery date in the body and subject — the date only once the `delivery-calendar` lane has
made it a real date. The compose-URL link stays as a fallback. Pago/Transport is untouched.

## Current State Analysis

(From `frame.md` + `research.md`.)

- Content is built twice: `frontend/src/pages/manager/lib/emailBody.ts` (authoritative,
  seeds the editable subject/body in `DispatchPanel` / `ResendPanel`) and
  `supply-os-v1/app/gmail_url.py` (re-open URL + dispatch-time validation). Every prior
  change kept them byte-identical; tests pin the old strings on both sides.
- Delivery is a Gmail compose URL opened by an `<a>` whose click also fires the dispatch
  state-write (`DispatchPanel.tsx:320-333`). The sender is whatever account is signed in.
- `gmailDraft.ts` already does draft-only Gmail API writes for Transport (OAuth
  implicit-grant popup + BroadcastChannel, `gmail.compose`), but its MIME has no `From`/`Cc`,
  there is no account check, no token reuse, and the draft lands in whichever account the
  user picks. Gmail silently replaces a `From` that is not a send-as alias of the
  authorized mailbox; `getProfile` and `drafts.get` work under `gmail.compose`.
- `requested_delivery_date` is a computed default (today+1 fallback, 64/64 e-mail orders
  since 2026-09-01 are exactly next-day) until `delivery-calendar` (0025, not merged) lands.
- `locations` has no sender alias or phone; `_meta` has no signer list. Prod: 5 active
  locations (WOLA, BRACKA, BROWARY, KEN, NORBLIN).
- A URL over 8000 chars makes `build_draft_url` raise → dispatch 400. Harmless today
  (the FE hides the only dispatch trigger), but it would break a draft-path dispatch.
- Sibling lanes: `order-line-zero-qty` (0024) owns the effective-qty rule
  (`app/order_qty.py` / `lib/orderQty.ts`), `supplier-product-order-minimum` (0023) owns
  line order (`app/product_order.py` / `lib/productOrder.ts`). Both expect the e-mail
  builders to call their helper.
- Coordinator relay 2026-09-28: 0023 merged to main (2641da3, live) and touched both
  builders — rebase on `origin/main` BEFORE Phase 2 edits `gmail_url.py` / `emailBody.ts`.
  0024 is PR #39 (not merged): quantities MUST come from `order_qty.effective_ordered_qty`
  (backend) and `lib/orderQty.ts` (frontend). Never reintroduce "manager_final > 0 else
  captain_final" anywhere in this lane — under #39 a manager-zeroed line ("Anulowane przez
  managera") has manager_final 0 and must stay out of the supplier e-mail. If #39 is still
  unmerged when Phase 2 starts, rebase onto its branch (or wait) rather than adding a local
  fallback.

## Desired End State

On a claimed e-mail-channel order the manager sees `Od: Pita Bros Bracka <bracka@pitabros.pl>`,
`Do:`, `DW: pitabrosbracka@gmail.com`, a `Podpis` select (Marek / Sławek, remembered per
browser), the editable subject/body in the new layout, and a primary **"Zrób draft w
Gmailu"** button. Clicking it signs in (popup pre-selecting biuro@, reused for ~50 min),
refuses with a clear message if the account is not biuro@, creates the draft, verifies Gmail
kept the alias as `From` (deletes the draft and refuses otherwise), then marks the order
sent exactly as today. "Otwórz w Gmail" remains as a fallback (CC keeps biuro@). The
dosyłka panel uses the same layout and offers the same draft button without dispatching.
The backend re-open URL renders the identical body for the same signer. Two golden
fixtures pin both builders to the same text. Verified by the automated suites and a live
E2E in the operator's browser after deploy.

### Key Discoveries:

- `emailBody.ts:66-139` / `gmail_url.py:64-167` — the two bodies; tests pinning them:
  `emailBody.test.ts`, `test_gmail_url.py`, `test_manager_dispatch.py:689-733`,
  `test_manager_queue.py:581,620`.
- `gmailDraft.ts` `buildMimeMessage`, `buildGmailAuthUrl` (~255), `requestGmailAccessToken`
  (~315, opens the popup before any await), `createGmailDraft` (~388) — Transport output must stay byte-identical
  (`gmailDraft.test.ts`, `PrintViews.tsx:91-142`).
- `main.py:1079-1204` (`manager_order_detail`), `:1959-2100` (`manager_dispatch`),
  `:749-758` (`_join_cc`), `:5341-5382` (`_meta` degrade pattern).
- Migration template: 0019 (commit `5223478`); integration fixture lists migrations by hand
  (`test_supabase_integration.py:70-229`); no percent sign in migrations.
- Date parsing without timezone shift: `lib/transport.ts:503-533` (`timeZone: "UTC"`).
- Declension: `i18n/packUnits.ts`; all active prod purchase units are mapped.

## What We're NOT Doing

- No change to Pago / Transport sending (`ordering_method = 'transport'` branch, Transport
  drafts, `PrintViews.tsx` behaviour).
- No real sending: drafts only, `gmail.compose` scope only (no `gmail.send`, no
  `gmail.settings.basic` / `sendAs.list`).
- No server-side Gmail access (no service account / domain-wide delegation).
- Not computing or proposing delivery dates — that is `delivery-calendar`. This lane only
  renders `requested_delivery_date` behind a switch.
- No per-manager identity: the signer is a per-browser preference, not auth.
- No column padding/alignment in the product table (proportional fonts make it moot).
- No change to the effective-qty rule or line order (sibling lanes own them).
- No prod data writes by the agent; the prod SQL file is applied by the operator.

## Implementation Approach

Four phases: (1) data/config seam with no e-mail change, (2) new content in both builders
pinned by shared golden fixtures, (3) the draft delivery path and UI, (4) rebase on the
sibling lanes, flip decisions, verify, PR. Content and delivery are separate so the
content change is reviewable on its own and the fallback link benefits from it too.

Decisions taken in this plan (operator confirms at the post-plan-review STOP):

| # | Decision | Choice (recommended) | Alternative |
|---|----------|----------------------|-------------|
| D1 | Date switch | Backend setting `order_email_delivery_date_enabled` (env `SUPPLY_OS_ORDER_EMAIL_DELIVERY_DATE_ENABLED`, default **false**), exposed on the order detail; flipped on Railway when `delivery-calendar` is live | Hard-coded constant flipped by a follow-up commit |
| D2 | Blank date wording (switch off) | `Dostawa: __________, od godziny 11:00`, subject without date | Omit the day entirely: `Dostawa: od godziny 11:00` |
| D3 | Signer storage | `_meta.order_email_signers` = JSON list `[{name, phone, email}]`; first = default | Pipe-separated string like `transport_drivers` |
| D4 | How the FE gets sender / phone / signers / mailbox / switch | New optional fields on `ManagerOrderDetail` (no new endpoint, no load race) | Separate `GET /api/manager/order-email-config` |
| D5 | CC per path | Draft: location mailbox minus sender. Fallback link + backend re-open URL: biuro@ + location mailbox (today's rule). Backend `_join_cc` unchanged — it only builds the fallback URL | Exclude the sender on both paths |
| D6 | Wrong mailbox | Check `getProfile` first; not the mailbox → no draft, no dispatch, clear message | Create anyway + warn |
| D7 | Alias rewritten by Gmail | Read the draft's `From`; mismatch → delete that draft, no dispatch, clear message | Keep the draft + warn |
| D8 | Draft vs dispatch order | Draft first, dispatch only after a verified draft; dispatch failure leaves a harmless unsent draft (message says so) | Dispatch first |
| D9 | Token reuse | In-memory token cached ~50 min per mailbox (`login_hint`), cleared on 401; Transport keeps per-click behaviour | Popup on every click |
| D10 | Dosyłka | Same layout + signer select + draft button (no dispatch) | Layout only, compose link only |
| D11 | Quantity format | Decimal comma (`1,5 kg`) in both builders, as in the UI | Keep dot (`1.5 kg`) |
| D12 | Too-long URL at dispatch | Non-fatal: dispatch succeeds with `gmail_compose_url = null` | Keep 400 |
| D13 | After a draft | No auto-opened tab; toast + session-only "Otwórz szkice (biuro@)" link on the sent order | Auto-open Drafts like Transport |

## Critical Implementation Details

- **Popup gesture**: `requestGmailAccessToken` must be the first thing the click handler
  calls (it opens the popup synchronously). Nothing may be awaited before it, or the popup
  is blocked. A cached token skips the popup; an expired cached token surfaces "Sesja
  Google wygasła — kliknij ponownie" (a retry after `await` would be popup-blocked).
- **No double dispatch**: while the draft flow runs (popup + three Gmail calls) the parent
  `busy` is still false, and the fallback `<a>` today only skips the callback
  (`if (!busy)`) but still navigates. The panel needs its own `drafting` state that disables
  the draft button and renders the fallback link inert (no href, `aria-disabled`) until the
  flow ends; `handleDispatch` gets a re-entry guard (ignore a call while `busyId` is set).
- **Panel unmount**: a successful dispatch refreshes the order to `manager_sent`, which
  unmounts `DispatchPanel`. The success message must therefore be a toast plus
  session state in `ManagerPage` (like `dispatchedLinks`), not local panel state.
- **Date parsing**: parse `YYYY-MM-DD` by parts / `Date.UTC` + `getUTCDay()` (0 = Sunday)
  in TS and `date.fromisoformat().weekday()` (0 = Monday) in Python; tests must cover a
  Sunday and a Monday so an off-by-one shows up.
- **Rebase seam**: keep filtering + sorting of visible lines in one function per builder
  (`visibleLines` / `_visible_lines`) so the rebase onto 0023/0024 swaps one call site each.

## Phase 1: Data and config seam

### Overview

Add the columns, settings, signer parsing and detail fields the e-mail needs, with no change
to the e-mail text yet. Prepare the prod SQL file (not applied).

### Changes Required:

#### 1. Migration 0026

**File**: `supply-os-v1/migrations/0026_location_sender_and_phone.sql`

**Intent**: Additive nullable columns for the send-as alias and the location phone,
following 0019's header (why, rollback, applied-by-operator-before-code, no percent sign).

**Contract**: `locations.sender_email varchar(120)`, `locations.phone varchar(40)`, both
`ADD COLUMN IF NOT EXISTS`, nullable. `phone` stores the display form (`600 722 252`).

#### 2. Models and backend seam

**File**: `supply-os-v1/app/models.py`, `supply-os-v1/app/supabase_backend.py`

**Intent**: `Location.sender_email` / `Location.phone` (`Optional[str] = None`) and both in
`_LOCATION_COLUMNS`; new `OrderEmailSigner(name: str, phone: str = "", email: str = "")`;
`ManagerOrderDetail` gains `sender_email`, `location_phone`, `order_mailbox`
(`Optional[str] = None`), `delivery_date_in_email: bool = False`,
`email_signers: list[OrderEmailSigner] = []`; `ManagerDispatchRequest.signer_email:
Optional[str] = None`. Sheets/seed need no code change (generic mapping).

**Contract**: field names above; all optional/defaulted so older clients keep working.

#### 3. Settings

**File**: `supply-os-v1/app/config.py`

**Intent**: `order_mailbox: str = "biuro@pitabros.pl"` (the mailbox hosting the aliases and
the default sender) and `order_email_delivery_date_enabled: bool = False` (D1), each with
a comment explaining who flips it and when.

**Contract**: env `SUPPLY_OS_ORDER_MAILBOX`, `SUPPLY_OS_ORDER_EMAIL_DELIVERY_DATE_ENABLED`.

#### 4. Signer parsing + detail join

**File**: `supply-os-v1/app/gmail_url.py`, `supply-os-v1/app/main.py`

**Intent**: pure `parse_order_email_signers(raw) -> list[OrderEmailSigner]` (invalid JSON,
non-list, entries without a name → dropped; never raises) and
`resolve_signer(signers, email) -> Optional[OrderEmailSigner]` (match by e-mail,
case-insensitive; unknown/None → first; empty list → None). In `main.py` a
`_load_email_signers(backend)` that reads `load_meta()` and degrades to `[]` on **any**
`Exception` (seed has no `load_meta`; sheets raises `RuntimeError` when no sheet id is set,
which is what every sheets-patched detail test hits), mirroring
`manager_transport_draft_config`.
`manager_order_detail` fills the five new fields: `sender_email = location.sender_email`
if it carries "@", else `settings.order_mailbox`; `location_phone = location.phone`.

**Contract**: `_meta` key `order_email_signers`; JSON list of `{name, phone, email}`.

#### 5. Types, fixture, docs, seed

**Files**: `frontend/src/types.ts`, `supply-os-v1/tests/test_supabase_integration.py`,
`docs/pita-supply-os-v1/DATA_MODEL.md`, `docs/pita-supply-os-v1/seed/locations.csv`

**Intent**: mirror the new detail fields and `signer_email` as optional TS fields (lessons:
mirror Pydantic optionality), add `OrderEmailSigner`; read + execute 0026 in the
integration fixture after 0019; document the columns; give the WOLA seed row a phone.

#### 6. Prod SQL file (prepared, not applied)

**File**: `context/changes/order-email-v2/prod-sql.sql`

**Intent**: diff-before / apply / audit-after (lessons "Master-data ops"): A. SELECT current
`location_id, sender_email, phone`; B. UPDATE aliases + phones per location (values only
after the operator confirms spelling at the STOP); C. upsert `_meta.order_email_signers`
(Marek first, then Sławek); D. audit — every active location has `sender_email` with "@"
or NULL (WOLA), phones match `COMPANY_ENTITIES.md`, signer JSON parses. Rollback = the A
snapshot + `DELETE FROM _meta WHERE key = 'order_email_signers'`.

### Success Criteria:

#### Automated Verification:

- Backend lint + tests pass: `cd supply-os-v1 && ruff check . && python -m pytest -q`
- Integration suite applies 0026: `python -m pytest -m integration -q` (CI job `backend-integration`)
- New unit tests: `parse_order_email_signers` (valid, invalid JSON, missing name, non-list), `resolve_signer` (match, case, unknown → first, empty → None), detail exposes the five fields incl. alias fallback to `order_mailbox`, `_load_email_signers` degrades on seed / exception
- Frontend build + lint + tests pass: `cd frontend && npm run build && npm run lint && npm run test`

#### Manual Verification:

- `prod-sql.sql` reviewed by the operator (not applied yet)

**Implementation Note**: pause after this phase only if automated checks fail; the manual
item is covered at the STOP.

---

## Phase 2: E-mail content v2 in both builders

### Overview

Rewrite subject and body to the approved layout in both builders, pinned together by
shared golden fixtures; make dispatch carry the signer and tolerate a too-long URL.

### Changes Required:

#### 1. Frontend builder

**File**: `frontend/src/pages/manager/lib/emailBody.ts`

**Intent**: new layout (see Contract). `buildEmailBody(detail, effectiveQtyFor, signer)`
and `buildEmailSubject(detail)` read `detail.delivery_date_in_email`,
`detail.requested_delivery_date`, `detail.location_phone`. Visible lines via one
`visibleLines(detail, effectiveQtyFor)` (filter > 0, sort by `order_line_id` until the
0023 rebase). Quantity `formatEmailQty` = shortest decimal with a comma; unit via
`packUnitLabel(qty, unit, "pl")`. New helpers `formatDeliveryDayLong` ("wtorek 29.09.2026")
and `formatDeliveryDayShort` ("wt 29.09"), timezone-safe. New `draftCc(detail)` (location
mailbox minus `sender_email`) and `fallbackCc(detail)` (= today's `joinCc(cc_email,
location_email)`). `buildGmailComposeUrl` and `joinCc` unchanged (Transport uses them).

**Contract** (switch on; `[…]` = only when present):

```
Subject: Zamówienie {location_name} – dostawa {wt} {dd.MM}     (switch off or no date: "Zamówienie {location_name}")
Dzień dobry,

proszę o przygotowanie zamówienia:

Lp. | Produkt | Ilość
{i}.  | {supplier_product_name || product_name_pl} | {qty} {declined unit}

[Pozycje spoza katalogu:\n{extra_items}\n]
[Komentarz:\n{captain_note}\n]
Dostawa: {wtorek 29.09.2026 | __________}, od godziny 11:00
[ADRES DOSTAWY: {name, address, city}]
[Telefon lokalu: {location_phone}]

Pozdrawiam,
{signer.name | "Pita Bros"}
[tel. {phone} · {email}]      (either part alone when the other is empty)
[{company_name}\n{company_address}\nNIP: {company_nip}]
(zamówienie #{order_id})
```

Resend subject: `Dosyłka — {subject}`.

#### 2. Backend twin

**File**: `supply-os-v1/app/gmail_url.py`

**Intent**: byte-identical port: `_build_subject(order, location, include_delivery_date)`,
`_build_body(..., signer, include_delivery_date)` reading `location.phone`; Python
`_PL_PACK_UNIT_FORMS` (one/few/many/frac, same keys as `PACK_UNIT_FORMS`) +
`_pl_plural_form`; comma quantity from `f"{qty:g}"`; Polish weekday tables;
`_visible_lines`. `build_draft_url(..., signer=None, include_delivery_date=False)`;
a URL over the limit raises `GmailUrlTooLongError(ValueError)`.

**Contract**: new keyword params with defaults; `GmailUrlTooLongError` subclass so existing
`except ValueError` callers keep working.

#### 3. Dispatch

**File**: `supply-os-v1/app/main.py`

**Intent**: `manager_dispatch` resolves the signer from `req.signer_email` against
`_load_email_signers`, passes `signer` and
`include_delivery_date=settings.order_email_delivery_date_enabled`; catches
`GmailUrlTooLongError` → `url = None` and proceeds (D12) — this `except` must come before
the existing `except ValueError` (→ 400) at `main.py:2086`. No-email / no-lines stay 400.
`_join_cc` unchanged (D5).

#### 4. Frontend callers

**Files**: `DispatchPanel.tsx`, `ResendPanel.tsx`, `OrderDetailPane.tsx`, `ManagerPage.tsx`,
`ManagerArchivePage.tsx` (passes `onDispatch={noop}`), `apiClient.ts` types

**Intent**: pass the chosen signer into the builders (the `signer` param is optional —
omitted means the legacy "Pita Bros" closing, so untouched test calls keep compiling);
`onDispatch(sentMethod, signerEmail?, opts?)` threaded through `OrderDetailPane` to
`handleDispatch`, which sends `signer_email`. The portal/phone/manual "mark ordered" paths
call it without a signer. Signer choice via a small hook
`useOrderEmailSigner(signers)` backed by localStorage key `supply_os_order_email_signer`
(try/catch, lazy initializer, falls back to the first signer when the stored e-mail is not
configured). A `Podpis` select in both panels; changing it re-seeds subject/body in
`EmailDispatch` (same as "Odśwież").

#### 5. Golden fixtures + parity tests

**Files**: `supply-os-v1/tests/fixtures/order_email/*.json|*.txt`,
`supply-os-v1/tests/test_order_email_golden.py`,
`frontend/src/pages/manager/lib/emailBody.golden.test.ts`

**Intent**: two scenarios shaped as `ManagerOrderDetail` + effective quantities + signer +
switch: (a) Bracka × Bukat, switch on, delivery on a Tuesday, fractional qty, several
declension forms, phone, company; (b) Wola × Intermlecz, switch off, extra items +
captain note, no phone, no signers. Each suite builds subject + body from the same JSON and
compares with the same `.txt`. A Python test also parses the `pl:` table out of
`frontend/src/i18n/packUnits.ts` and asserts it equals `_PL_PACK_UNIT_FORMS`.

#### 6. Update pinned tests

**Files**: `emailBody.test.ts`, `test_gmail_url.py`, `test_manager_dispatch.py`,
`DispatchPanel.test.tsx`

**Intent**: rewrite assertions for the new strings deliberately (greeting, date line, footer
with signer), keep the invariants (no total, zero lines skipped, supplier-facing names,
CC gates, extra items before Komentarz before address, raises). Add: Sunday/Monday weekday
cases, switch off/on, missing date with switch on, signer variants, phone absent,
dispatch with `signer_email` renders that signer in `gmail_compose_url`, too-long URL →
200 with `gmail_compose_url` null.

### Success Criteria:

#### Automated Verification:

- Golden fixtures pass on both sides (note: `tsc -b` excludes test files; eslint + vitest cover them): `python -m pytest -q tests/test_order_email_golden.py` and `npx vitest run src/pages/manager/lib/emailBody.golden.test.ts`
- Declension table parity test passes
- Full backend + frontend suites, lint, build pass (as in Phase 1)

#### Manual Verification:

- The two rendered examples in the STOP message match what the builders produce for the fixtures

---

## Phase 3: Gmail draft delivery path

### Overview

Add the verified-alias draft path next to the fallback link, for dispatch and dosyłka.

### Changes Required:

#### 1. Gmail primitives

**File**: `frontend/src/pages/manager/lib/gmailDraft.ts`

**Intent**: `buildMimeMessage` gains optional `from: {name, email}` (RFC 2047 display name
when non-ASCII) and `cc` — emitted only when given, so Transport output is unchanged.
`buildGmailAuthUrl` gains optional `loginHint`. `requestGmailAccessToken(clientId,
opts?: {loginHint?, reuse?})` caches the token in memory for 50 min per `loginHint` when
`reuse` (D9); `clearGmailTokenCache()`. New thin wrappers: `getGmailProfileEmail(token)`,
`getGmailDraftFrom(token, draftId)` (`drafts.get` `format=metadata&metadataHeaders=From`),
`deleteGmailDraft(token, draftId)`. A 401 from any of them clears the cache.

**Contract**: all additions optional; existing Transport calls compile and behave as before.

#### 2. Orchestration

**File**: `frontend/src/pages/manager/lib/orderEmailDraft.ts` (new)

**Intent**: `createVerifiedOrderDraft({clientId, mailbox, from, to, cc, subject, body})`:
token (reuse, `loginHint = mailbox`) → profile e-mail must equal `mailbox`
(case-insensitive) else `WrongMailboxError(actual)` → create draft → read `From`; address
must equal `from.email` else delete the draft and throw `SenderRewrittenError(actual)` →
return `{draftId}`. Pure helpers (`addressFromHeader`, error classification) unit-tested;
the fetch calls are mocked in tests.

#### 3. Dispatch panel UI

**File**: `frontend/src/pages/manager/DispatchPanel.tsx`

**Intent**: rows `Od:` (`{location_name} <{sender_email}>`), `Do:`, `DW:` (`draftCc`), `Podpis`
select; primary **Zrób draft w Gmailu** (rendered when `VITE_GOOGLE_CLIENT_ID` is set,
disabled when no recipient / empty order / busy), which runs the orchestration and, only on
success, calls `onDispatch("email", signerEmail, {draftMailbox})`. "Otwórz w Gmail" becomes
secondary with a one-line hint (sender chosen by hand in Gmail; DW also biuro@) and keeps
`fallbackCc` + its current click-to-dispatch behaviour. Errors render inline in Polish
(wrong mailbox names the account used and the one required; sender rewritten; session
expired; popup blocked; Gmail API error with detail). Without a client ID the panel looks
as today plus the new rows.

#### 4. Sent-order confirmation

**Files**: `ManagerPage.tsx`, `OrderDetailPane.tsx`

**Intent**: after a draft-backed dispatch, toast "Szkic utworzony w {mailbox} — zamówienie
oznaczone jako wysłane" and keep session-only `draftedOrders[orderId] = mailbox`; the sent
view shows "Szkic w Gmailu ({mailbox}) — Otwórz szkice" linking
`https://mail.google.com/mail/?authuser={mailbox}#drafts`. If the draft succeeded but
dispatch failed, the error toast says the draft exists and is unsent.

#### 5. Dosyłka

**File**: `frontend/src/pages/manager/ResendPanel.tsx`

**Intent**: same rows + `Podpis` select + draft button (subject `Dosyłka — …`), success/error
shown inline (the panel stays mounted); never dispatches (D10).

#### 6. Copy

**File**: `frontend/src/i18n/strings.ts`

**Intent**: PL + EN keys for the new rows, button, hint, success, errors, signer label.
Supplier-facing e-mail text stays literal in the builders.

### Success Criteria:

#### Automated Verification:

- `gmailDraft.test.ts`: existing Transport assertions unchanged and passing; new cases for `From` (ASCII + RFC 2047 name), `Cc`, `loginHint`, token cache hit / expiry / clear
- `orderEmailDraft.test.ts`: happy path; wrong mailbox → no create; rewritten `From` → delete called, error thrown; 401 → cache cleared
- `DispatchPanel.test.tsx`: transport branch still renders no Gmail control; draft success calls `onDispatch` with the signer; draft failure does not; while drafting the fallback link is inert; no client ID → no draft button, link still present
- Full frontend build + lint + test, backend suite unchanged green

#### Manual Verification:

- Deferred to the post-deploy live E2E (Phase 4)

---

## Phase 4: Rebase, switches, verify, PR

### Overview

Land on current main with the sibling lanes, make the date/lane decisions, verify, open the PR,
STOP before merge, then E2E after deploy.

### Changes Required:

#### 1. Rebase onto sibling lanes

**Intent**: merge `main`. If 0024 landed: `_visible_lines` filters via
`order_qty.effective_ordered_qty` (no local `_effective_qty` is ever added — see the coordinator note in Current State); the TS builder keeps the
injected `effectiveQtyFor` (panels pass `draftQty`, which 0024 fixes upstream —
`lib/orderQty.ts` already exists on this branch). If 0023 landed: sort via `compareProductOrder` /
`product_order.line_sort_key`. Regenerate golden `.txt` only where the lane changes order,
and say so in the PR. If `delivery-calendar` landed, note in the PR that the operator should
set `SUPPLY_OS_ORDER_EMAIL_DELIVERY_DATE_ENABLED=true` after checking one proposed date.

#### 2. Prod SQL values

**Intent**: fill `prod-sql.sql` with the spellings/phones/signer data confirmed at the STOP.

#### 3. Roadmap + docs

**Intent**: roadmap Horizon 3 row for `order-email-v2`; `.env.example` notes for the two new
settings; AGENTS.md claims re-checked (lessons: reconcile docs in the same change).

### Success Criteria:

#### Automated Verification:

- `/verify` green (backend ruff + pytest, frontend build + lint + vitest); CI green on the PR incl. `backend-integration`

#### Manual Verification:

- Operator applies migration 0026, then `prod-sql.sql` (A → B → C → D), before merge
- After merge + deploy: new Vercel bundle and Railway commit confirmed live
- Live E2E in the operator's browser on a real claimed order, sent to a safe recipient (never a real supplier from a test): draft appears in biuro@ Drafts with `From: Pita Bros <location> <alias>`, DW = location mailbox, signature Marek; switch to Sławek changes the signature; signing in as a non-biuro account is refused with no draft
- Dosyłka draft created on a post-send edited order; fallback link still opens compose

## Testing Strategy

### Unit Tests:

- Builders on both sides via shared golden fixtures + targeted cases (weekday edges, switch,
  signer variants, phone, declension one/few/many/frac/unmapped, comma quantities).
- Signer parsing/resolution; detail fields; dispatch signer + too-long URL.
- MIME headers; token cache; orchestration error paths.

### Integration Tests:

- `backend-integration` applies 0026 and round-trips `Location.sender_email` / `phone`.

### Manual Testing Steps:

1. Claimed Bracka order → panel shows Od/Do/DW/Podpis; click draft → biuro@ popup → draft
   in biuro@ with the alias sender; order moves to sent; toast + "Otwórz szkice" link.
2. Repeat within 50 min → no popup.
3. Sign in as another account → refusal, no draft, order still claimed.
4. Fallback link → Gmail compose with biuro@ + location in DW; order marked sent.
5. Post-send edit → dosyłka draft with `Dosyłka —` subject; order stays sent.

## Performance Considerations

One extra `_meta` read per order-detail load (tiny table). Draft path adds three small Gmail
API calls per order.

## Migration Notes

0026 is additive and nullable; apply before the backend that lists the columns in
`_LOCATION_COLUMNS` (reads use `SELECT *` and the model defaults, so code without the
columns still works). Rollback: `ALTER TABLE locations DROP COLUMN IF EXISTS sender_email,
DROP COLUMN IF EXISTS phone;` + delete the `_meta` key. The date switch defaults off, so
merging before `delivery-calendar` never sends a guessed date.

## References

- Frame: `context/changes/order-email-v2/frame.md`
- Research: `context/changes/order-email-v2/research.md`
- Template change: migration 0019 / commit `5223478`
- Transport draft: `frontend/src/pages/manager/transport/PrintViews.tsx:91-142`
- Lessons: "Browser-integration features fail SILENTLY in layers", "Deploy end-to-end before
  asking the user to live-test", "Master-data ops: diff before, audit after"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data and config seam

#### Automated

- [x] 1.1 Backend lint + tests pass — 22aa686
- [x] 1.2 Integration suite applies 0026 — 22aa686
- [x] 1.3 New unit tests for signer parsing/resolution, detail fields, degrade — 22aa686
- [x] 1.4 Frontend build + lint + tests pass — 22aa686

#### Manual

- [x] 1.5 prod-sql.sql reviewed by the operator

### Phase 2: E-mail content v2 in both builders

#### Automated

- [x] 2.1 Golden fixtures pass on both sides — 3f92fd1
- [x] 2.2 Declension table parity test passes — 3f92fd1
- [x] 2.3 Full backend + frontend suites, lint, build pass — 3f92fd1

#### Manual

- [x] 2.4 Rendered STOP examples match the fixtures — 3f92fd1

### Phase 3: Gmail draft delivery path

#### Automated

- [x] 3.1 gmailDraft tests: Transport unchanged, new From/Cc/loginHint/cache cases — 1a68bc1
- [x] 3.2 orderEmailDraft tests: happy path and error paths — 1a68bc1
- [x] 3.3 DispatchPanel tests: transport branch, draft success/failure, no client ID — 1a68bc1
- [x] 3.4 Full frontend build + lint + test, backend green — 1a68bc1

#### Manual

- [ ] 3.5 Deferred to the post-deploy live E2E (Phase 4)

### Phase 4: Rebase, switches, verify, PR

#### Automated

- [ ] 4.1 /verify green and CI green on the PR

#### Manual

- [x] 4.2 Operator applies 0026 then prod-sql.sql before merge
- [ ] 4.3 New bundle and Railway commit confirmed live
- [ ] 4.4 Live E2E of the draft in the operator's browser
- [ ] 4.5 Dosyłka draft and fallback link checked
