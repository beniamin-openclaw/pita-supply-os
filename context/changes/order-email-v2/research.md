---
date: 2026-09-28T15:01:32+02:00
researcher: Claude (Opus 5.5)
git_commit: b4c4253e560a997b222ad704cd9ea401ffffe273
branch: claude/loving-feynman-2e6946
repository: pita-supply-os
topic: "Supplier order e-mail v2 — where the builders, draft mechanism, CC rule, master data and tests live, and what the parallel lanes change"
tags: [research, codebase, email, gmail, dispatch, emailBody, gmail_url, gmailDraft, locations, _meta]
status: complete
last_updated: 2026-09-28
last_updated_by: Claude (Opus 5.5)
---

# Research: Supplier order e-mail v2

**Date**: 2026-09-28T15:01:32+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: b4c4253
**Branch**: claude/loving-feynman-2e6946
**Repository**: pita-supply-os

## Research Question

What must change, and where, to ship the operator-approved per-order supplier e-mail
(location send-as alias as sender via a Gmail API draft in biuro@, location mailbox CC,
manager signature, location phone, delivery date gated on the `delivery-calendar` lane,
Polish diacritics, declined units) — and what constrains it (twin builders, parallel
lanes, tests, prod data)? See `frame.md` for the problem framing.

## Summary

- The e-mail is built twice: `frontend/src/pages/manager/lib/emailBody.ts` (authoritative —
  seeds the editable subject/body in `DispatchPanel` and `ResendPanel`) and
  `supply-os-v1/app/gmail_url.py` (re-open URL returned by `/api/manager/dispatch`, and the
  server-side dispatch validation: no email / no lines / URL > 8000 → `ValueError` → 400).
  Every prior e-mail change touched both "byte-identical"; that is the top regression risk.
- The Gmail draft mechanism exists (`gmailDraft.ts`: OAuth implicit-grant popup, BroadcastChannel
  relay, `drafts.create`) but builds MIME with only `To`/`Subject`; it has no `From`, no `Cc`,
  no account check, no token reuse. The draft lands in whichever account the manager picks.
- Gmail keeps a `From` that is a send-as alias of the authorized mailbox and silently
  replaces any other with the primary address. `users.getProfile` and `users.drafts.get`
  work with the existing `gmail.compose` scope; `users.settings.sendAs.list` does not.
- `requested_delivery_date` is never chosen by a Captain: `CaptainMP.tsx:518` computes it
  from `supplier.delivery_days` with a today+1 fallback; prod has 64/64 e-mail orders since
  2026-09-01 at exactly `order_date + 1`. The `delivery-calendar` lane (status `preparing`,
  migration 0025, no plan yet) makes it a real proposal and explicitly leaves rendering to
  this lane.
- Two further lanes rewrite inputs of the builders: `order-line-zero-qty` (0024,
  plan_reviewed) moves the effective-qty rule into `app/order_qty.py` / `lib/orderQty.ts`;
  `supplier-product-order-minimum` (0023, plan_reviewed) moves line ordering into
  `app/product_order.py` / `lib/productOrder.ts`. Both expect the e-mail builders to call
  their helper, not re-implement the rule.
- Master data: `locations` has no sender/phone column; `_meta` has no signer key.
  Adding two nullable `Location` fields needs `models.py`, `_LOCATION_COLUMNS`, a migration
  and the integration fixture (hardcoded list) — sheets/seed need no code change.
- All purchase units on active prod supplier_products (szt, opak, kg, zgrzewka, box,
  karton, blok, skrzynka, wiadro, pojemnik) are in `PACK_UNIT_FORMS`.

## Detailed Findings

### Frontend builder and its consumers

- `emailBody.ts:36-38` subject `Zamówienie {location_name}`; `:48-50` resend subject
  `Dosyłka — …`; `:66-139` body: ASCII-only greeting/intro/header (`Dzien dobry`,
  `Prosze o przygotowanie zamowienia`, `Ilosc`, `(zamowienie #…)` — no archived decision
  made this deliberate, the subject already uses diacritics), lines filtered by
  `effectiveQtyFor > 0` and sorted by `order_line_id` (`:76-78`), qty via `String(qty)`
  (dot decimal, mirrors Python `:g`), raw `purchase_unit`, then extra items / Komentarz,
  `ADRES DOSTAWY`, blank `Proszę o dostawę w dniu:`, fixed `Dostawa możliwa od godziny 11:00`,
  `Pozdrawiam,` / `Pita Bros` / company footer.
- `joinCc` (`:151-163`) — dedup, "@" gate, via `splitRecipients` from `lib/transport.ts`.
- `buildGmailComposeUrl` (`:178-195`) — also used by `lib/transport.ts:258`
  (`buildTransportGmailUrl`); must stay unchanged.
- `DispatchPanel.tsx:217-361` (`EmailDispatch`): seeds subject/body in lazy `useState`,
  "Odśwież" re-seeds; `cc = joinCc(detail.cc_email, detail.location_email)`; the `<a>`
  "Otwórz w Gmail" fires `onDispatch("email")` on click (no preventDefault).
  `DispatchPanel` is keyed by `order_id` at `OrderDetailPane.tsx:345` (re-seed per order).
- `ResendPanel.tsx` — same builder, subject prefix, `useMemo` (not editable, not keyed),
  never dispatches.
- `ManagerPage.tsx:306-336` `handleDispatch` → `api.managerDispatch`, stores
  `gmail_compose_url` in session-only `dispatchedLinks` (`:78`, `:570`), rendered as the
  re-open link at `OrderDetailPane.tsx:310-319,356-364`. `busy = busyId === order_id`
  (`OrderDetailPane.tsx:123`).
- Tests pinning output: `emailBody.test.ts` (ADRES DOSTAWY, blank date line, fixed window,
  `Pozdrawiam,\nPita Bros…` footer, extra items/Komentarz order, subjects, joinCc, URL
  gates); `DispatchPanel.test.tsx` (transport branch renders no Gmail control; email branch
  renders link "Otwórz w Gmail").

### Gmail draft mechanism (`gmailDraft.ts`)

- `buildMimeMessage` (`:98-126`) — `To`, RFC 2047 `Subject`, multipart/mixed, body part +
  attachments; `attachments: []` already yields a valid message. No `From`/`Cc`.
- `buildGmailAuthUrl` (`:238-252`) — `response_type=token`, scope `gmail.compose`,
  `prompt=select_account`, `include_granted_scopes`; no `login_hint`.
- `requestGmailAccessToken` (`:283-367`) — popup opened synchronously, BroadcastChannel
  primary + opener fallback, 90 s deadline, no `popup.closed` poll (lessons.md).
  No token cache: every click re-opens the popup (`PrintViews.tsx:96`). Callback payload
  (`OAuthGmailCallback.tsx`) carries no `expires_in`.
- `createGmailDraft` (`:374-393`) — `POST users/me/drafts`, returns `{id}`.
- Transport usage `PrintViews.tsx:91-142`: gated on `VITE_GOOGLE_CLIENT_ID`
  (`frontend/.env.example:16-17`, set on Vercel), opens `mail/u/0/#drafts` afterwards.
  OAuth client: internal app "Pita Supply OS", GCP project `pita-supply-os`
  (`context/archive/2026-08-21-to-ordering-pago/plan.md` ~399). Live E2E 2026-08-28 used
  biuro@.
- `gmailDraft.test.ts` pins MIME shape, subject encoding, auth URL params, hash parsing,
  Pago/driver subjects — Transport output must stay byte-identical.

### Gmail API facts (external, ≥2 sources each; see frame.md row 2)

- Valid send-as `From` kept by `drafts.create` and on send; invalid `From` silently
  replaced by the primary address (SO 64071077, 25485963; Web Apps SE 182237; gmass.co).
- Scopes: `getProfile` and `drafts.get` accept `gmail.compose`; `sendAs.list` requires
  `gmail.settings.basic` or broader (official reference + SO 46034224).
- `login_hint` pre-selects the account, does not force it; `hd` is a UI nudge only in the
  implicit flow. RFC 2047 encoded display names in `From` are accepted.

### Backend twin and dispatch (`gmail_url.py`, `main.py`)

- `gmail_url.py:26-30` `_effective_qty`; `:52-61` subject; `:64-167` body (same content as
  TS); `:170-232` `build_draft_url` (raises on no email / no lines / all zero / > 8000).
- `main.py:749-758` `_join_cc`; `:1079-1204` `manager_order_detail` joins
  `delivery_address`, `city`, `company_*`, `location_email`, `cc_email=settings.order_cc_email`;
  `:1959-2100` `manager_dispatch`, `build_draft_url(...)` at `:2076-2085` with
  `cc_email=_join_cc(settings.order_cc_email, location.email)`, `ValueError` → 400.
  A too-long URL therefore fails the dispatch itself — today invisible because the FE
  hides the link (the only dispatch trigger) when the URL is too long; a draft path would
  hit it.
- `ManagerDispatchRequest` (`models.py:294-301`): `order_id`, `manager_finals`, `sent_method`.
- `config.py:93` `order_cc_email = "biuro@pitabros.pl"`; no other dispatch e-mail setting.
- `requested_delivery_date` is only passed through for display (`main.py:718, 965, 1188,
  1326, 1385, 1535`); never read by `gmail_url.py`.
- Tests: `test_gmail_url.py` (subject, lines, diacritics, no total, zero skip, raises,
  fixed window `:332`, address `:355`, footer `:401` — pins `Pozdrawiam,\nPita Bros`,
  blank date line `:454`, cc `:467-486`, extra items/Komentarz `:500-551`);
  `test_manager_dispatch.py` (`gmail_compose_url` presence, cc composition `:689-733`,
  `test_join_cc_helper`); `test_manager_queue.py:581,620` (detail `cc_email`,
  `location_email`).

### Master data seam

- `Location` (`models.py:88-105`); Supabase reads `SELECT *` but writes via
  `_LOCATION_COLUMNS` (`supabase_backend.py:100-103`); sheets (`sheets.py:203-227`) and
  seed (`seed_loader.py:48-59`, `docs/pita-supply-os-v1/seed/locations.csv`) map generically
  — optional fields need no code change. Migration 0019 (commit `5223478`) is the template:
  migration, model, `_LOCATION_COLUMNS`, `manager_order_detail`, DATA_MODEL.md, seed CSV,
  TS type, builders, tests, integration fixture.
- Integration fixture `test_supabase_integration.py:70-229`: hardcoded per-file
  `read_text` + `exec_driver_sql` (0008 and 0018 deliberately skipped); migrations must stay
  free of the percent sign.
- `_meta`: `load_meta` on supabase (`:334-341`) and sheets (`:281-304`), absent on seed;
  `GET /api/manager/transport/draft-config` (`main.py:5341-5382`, `TransportDraftConfig`
  `models.py:1417-1431`) degrades every field to "" on any failure; 6 tests in
  `test_transport.py:2952-3026`.
- Prod (read-only, 2026-09-28): active locations WOLA, BRACKA, BROWARY, KEN, NORBLIN;
  inactive ELEKTROWNIA, FORUM, KAMIENICA, KULINARNA, SLONY, STARY_BROWAR, SUPERSAM,
  WESTFIELD. `locations.email` set for WOLA/BRACKA/BROWARY/KEN/NORBLIN/ELEKTROWNIA/FORUM/
  STARY_BROWAR. `_meta.transport_drivers` = "Marek Złotopolski, Mateusz Miecznikowski,
  Sławomir Glanowski". Location phones in `docs/pita-supply-os-v1/COMPANY_ENTITIES.md:12-29`.

### Formatting helpers

- `i18n/packUnits.ts` `packUnitLabel(n, unit, lang)` — one/few/many for integers, `frac`
  for non-integers, raw unit when unmapped. `pluralForm` in `i18n/index.ts`.
- UI quantities use decimal comma (`lib/packUnits.ts::formatPackQty`); the supplier e-mail
  uses dot (`String(qty)` / `:g`) for twin parity. Prod email-supplier orders are almost
  all integers (1 fractional line in the sampled Bukat/Intermlecz orders).
- Weekday/date: `lib/transport.ts:503-533` (`transportWeekdayLabel` with
  `timeZone: "UTC"`, `transportShortDate` dd.MM.yy from UTC fields) — the pattern for
  parsing `YYYY-MM-DD` without timezone shift. No short Polish weekday ("wt") helper exists.
- localStorage convention: flat keys + try/catch (`auth.ts:11-31`, `i18n/index.ts`
  `supply_os_lang`).
- i18n: `strings.ts` `satisfies Record<string, StringEntry>` enforces PL+EN per key;
  `pluralKeys.test.ts` only guards `tPlural` call sites. Supplier-facing e-mail text stays
  literal in the builder (twin parity), UI copy goes through `t()`.

## Code References

- `frontend/src/pages/manager/lib/emailBody.ts:36-195` — subject/body/CC/URL builders
- `supply-os-v1/app/gmail_url.py:26-232` — backend twin + dispatch validation
- `frontend/src/pages/manager/lib/gmailDraft.ts:98-393` — MIME, OAuth, drafts.create
- `frontend/src/pages/manager/DispatchPanel.tsx:217-361` — EmailDispatch
- `frontend/src/pages/manager/ResendPanel.tsx` — dosyłka
- `frontend/src/pages/ManagerPage.tsx:306-336,570` — dispatch + re-open link
- `frontend/src/pages/manager/OrderDetailPane.tsx:123,305-364` — panel mounting
- `frontend/src/pages/manager/transport/PrintViews.tsx:61,91-142` — Transport draft usage
- `supply-os-v1/app/main.py:749-758,1079-1204,1959-2100,5341-5382`
- `supply-os-v1/app/models.py:88-105,294-301,450-511,1417-1431`
- `supply-os-v1/app/supabase_backend.py:100-103,334-341`
- `supply-os-v1/tests/test_supabase_integration.py:70-229`
- `frontend/src/pages/captain-mp/CaptainMP.tsx:518`, `captain-mp/lib/dates.ts:17-45`

## Architecture Insights

- Twin-builder rule: any content change lands in both builders with mirrored tests. A
  shared golden fixture (one expected text read by both test suites) would turn "keep
  byte-identical" from a comment into a test.
- Delivery mechanisms are separate from content: compose URL (fallback, sender unknown)
  and API draft (sender = alias in biuro@). CC differs by mechanism by design.
- Config dictionaries live in `_meta` with a degrade-to-empty read route.
- Single-helper rules from sibling lanes (effective qty, line order) should be the only
  place those rules live; builders take them as inputs.

## Historical Context (from prior changes)

- `context/archive/2026-06-06-manager-bukat-email-dispatch/` — the two-builder split.
- `context/archive/2026-06-07-dispatch-email-content/` — subject `Zamówienie {location}`,
  supplier-facing names.
- `context/archive/2026-06-23-email-total-to-manager-panel/` — total never in the e-mail.
- `context/archive/2026-06-25-email-delivery-address/` — address line rule.
- `context/archive/2026-06-26-email-delivery-time/` — date dropped deliberately, fixed 11:00.
- `context/archive/2026-07-25-feedback-r7-tushar/` — blank date line (date = guess), biuro@
  CC, byte-identical rule called "the main regression risk".
- `context/archive/2026-08-21-to-ordering-pago/` — OAuth client, three silent-failure layers.
- `context/archive/2026-09-17-week2-feedback-quantities/` — location e-mail CC (0019),
  dosyłka (0020).

## Related Research

- `sharp-tharp-b7ea7d/context/changes/delivery-calendar/research.md` (other worktree)
- `wonderful-albattani-d25a04/context/changes/order-line-zero-qty/plan.md` (other worktree)
- `xenodochial-cerf-3c59f5/context/changes/supplier-product-order-minimum/plan.md` (other worktree)

## Open Questions (operator-owned, for the post-plan-review STOP)

1. Alias spelling per location; WOLA: `biuro@` (brief) or `wolskamalpa@` (memory note of a
   Wola office alias); which of KULINARNA / KAMIENICA maps to `kulinarna@`.
2. Signature e-mail for Marek: `marek@pitabros.pl` (brief) vs `manager@pitabros.pl`
   (memory note).
3. Can Marek and Sławek sign in as biuro@ in their browser for the OAuth popup?
4. Does the dosyłka panel get the new layout and the draft button?
5. Decimal separator in quantities (dot today, comma in the UI).
