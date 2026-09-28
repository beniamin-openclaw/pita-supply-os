# Frame Brief: Supplier order e-mail v2

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Per-order supplier e-mails today go out from whatever Google account the manager is
logged into (Gmail compose URL, sender chosen by hand), the delivery-date line is
blank, and the e-mail carries neither the location phone nor the name of the manager
who sent it. The operator approved (2026-09-28) a new layout: From = the location's
send-as alias, CC = the location mailbox, subject with the delivery date, a filled
delivery line, the location phone, and the sending manager's signature.

## Initial Framing (preserved)

- **User's stated cause or approach**: the compose-URL mechanism cannot set the
  sender, so the e-mail should be created as a Gmail API draft in biuro@pitabros.pl
  with `From:` set to the location alias (reusing the Transport `gmailDraft.ts`
  OAuth + BroadcastChannel flow); content gaps are closed with new master data
  (`locations.phone`, a per-location sender column, a signer config in `_meta`).
- **User's proposed direction**: rebuild `emailBody.ts` + its backend twin
  `gmail_url.py` to the approved layout, add a "Zrób draft w Gmailu" button next
  to the existing "Otwórz w Gmail" fallback, migration 0026 + an operator-applied
  prod SQL file; render the delivery date only once the `delivery-calendar` lane
  has merged.
- **Pre-dispatch narrowing**: not asked separately — the brief already fixes scope
  (8 numbered rules, coordination, STOPs). Operator-owned open points are collected
  for the post-plan-review STOP instead of interrupting now (see Narrowing Signals).

## Dimension Map

Where the approved e-mail could fail to reach the supplier as intended:

1. **Authorizing mailbox** — the draft lands in whichever account completes the
   OAuth popup; the alias `From` only makes sense if that account is biuro@.
2. **Alias honoring by Gmail** — the API may keep or rewrite a `From` that is not a
   verified send-as of the authorizing account.  ← initial framing's mechanism
3. **Delivery-date data quality** — `requested_delivery_date` may be a computed
   default rather than a real date.
4. **Two-builder lockstep + client-side signer choice** — the backend twin builds
   the re-open URL without knowing which signer the manager picked in the browser.
5. **Dispatch coupling** — today the state-write fires on a synchronous link click;
   an async draft call changes the ordering and failure modes.
6. **Master-data readiness** — aliases, phones and the signer list are not in the
   database; alias spelling and WOLA's sender are unconfirmed.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1. Draft lands in the clicker's own mailbox, not necessarily biuro@ | `gmailDraft.ts:238-316` (`prompt=select_account`, no `login_hint`), `createGmailDraft` posts to `users/me/drafts`; `PrintViews.tsx:96-134` opens `mail/u/0/#drafts` (first signed-in account); memory `transport-zbiorczy-live`: draft is "in the mailbox of WHOEVER clicks" | STRONG — biuro@ must be chosen explicitly; the code must steer and verify it |
| 2. Gmail keeps an alias `From` only for a send-as of the authorized account | External research 2026-09-28 (official Gmail API reference + SO 64071077, 25485963, Web Apps SE 182237, gmass.co): a valid send-as `From` is kept by `drafts.create` and on later send; an invalid one is NOT rejected — Gmail silently falls back to the primary address. Admin-console aliases and "Send mail as" aliases are both honored. Scopes: `users.getProfile` and `users.drafts.get` accept `gmail.compose`; `users.settings.sendAs.list` does NOT (needs `gmail.settings.basic`). `login_hint` pre-selects but does not force the account; `hd` is only a UI nudge in the implicit flow | STRONG — a wrong mailbox fails silently (draft from the wrong sender), so the flow must check `getProfile.emailAddress` before and the draft's `From` after, within the existing `gmail.compose` scope |
| 3. `requested_delivery_date` is a default, not a choice | `CaptainMP.tsx:518` sets it from `getRequestedDeliveryDate(supplier.delivery_days)` (no date picker; `dates.ts:17-45` falls back to today+1); prod read-only: 64/64 e-mail orders sent since 2026-09-01 have `requested_delivery_date = order_date + 1` | STRONG — rendering it today would send a guess; the "keep blank until delivery-calendar merges" rule is load-bearing |
| 4. Backend twin cannot reproduce the signer choice | `gmail_url.py:170-232` builds from `Order`/`Location` only; `ManagerDispatchRequest` has no signer field (`types.ts:583-587`); `ManagerPage.tsx:325` keeps the URL for re-open | STRONG — the twin needs the signer as an input (or a documented default) to stay byte-identical |
| 5. Async draft changes dispatch ordering | `DispatchPanel.tsx:320-333` fires `onDispatch("email")` in the `<a>` click; `ManagerPage.tsx:306-336` persists `manager_sent` | WEAK as a risk — a draft is never sent, so "draft created, dispatch 409" is harmless; "draft failed" must not dispatch. A design decision for /10x-plan, not a reframe |
| 6. Master data not ready | prod read-only 2026-09-28: `locations` has no sender/phone column; 5 active locations (WOLA, BRACKA, BROWARY, KEN, NORBLIN), ELEKTROWNIA/WESTFIELD inactive with no company data; `_meta` has `transport_drivers` (incl. Marek Złotopolski, Sławomir Glanowski) but no signer key; memory `mailbox-access-agents` lists `wolskamalpa@pitabros.pl` as a Wola office alias and `manager@pitabros.pl` as Marek | STRONG — seed data needs operator confirmation before the SQL file |

## Narrowing Signals

- The date is never chosen by a Captain (no picker, 64/64 next-day) — rules out
  shipping the date line independently of `delivery-calendar`
  (`sharp-tharp-b7ea7d/context/changes/delivery-calendar`, status `preparing`,
  not merged).
- `order-line-zero-qty` (plan_reviewed) and the display-order lane are not merged
  either; both touch the same builders — rebase points in the brief stand.
- Operator questions deferred to the post-plan-review STOP: alias spelling (incl.
  whether WOLA uses `wolskamalpa@` or `biuro@`), `marek@` vs `manager@` in the
  signature, whether Marek/Sławek can sign in as biuro@ in their Chrome, whether the
  "dosyłka" panel follows the new layout and gets the draft button, which of
  KULINARNA/KAMIENICA maps to `kulinarna@`.

## Cross-System Convention

The repo already runs the exact mechanism for Transport (`gmailDraft.ts`, lessons.md
"Browser-integration features fail SILENTLY in layers"): per-user OAuth popup,
BroadcastChannel relay, draft-only, live E2E in the operator's browser required.
Master-data additions follow the 0019 pattern (nullable column, applied by the
operator before the code) and `_meta` dictionaries follow `transport_drivers`.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: produce the approved e-mail content in
> both builders, and deliver it as a biuro@ draft whose sender alias is verified —
> not merely requested — while the delivery date stays blank until a real date exists.

The initial framing held. Two refinements matter for the plan: the alias only works
when the OAuth account is biuro@ (so the flow must pre-select and check the
authorized mailbox, not just warn in prose), and the date/subject rendering is a
switch that flips when `delivery-calendar` lands, not something this lane can decide.

## Confidence

**HIGH** — code and prod data agree on dimensions 1, 3, 4 and 6; dimension 2 is an
external fact checked below.

## What Changes for /10x-plan

Plan the content rewrite (both builders, CC rule, signer, phone, Polish copy) and the
draft path as separate phases; make the date line a gated behaviour tied to the
calendar lane; give the backend twin a signer input; seed data only through an
operator-approved diff-before/audit-after SQL file.

## References

- `frontend/src/pages/manager/lib/emailBody.ts`, `supply-os-v1/app/gmail_url.py`,
  `frontend/src/pages/manager/lib/gmailDraft.ts`, `frontend/src/pages/manager/DispatchPanel.tsx`,
  `frontend/src/pages/manager/ResendPanel.tsx`, `frontend/src/pages/ManagerPage.tsx:306-336`,
  `frontend/src/pages/manager/transport/PrintViews.tsx:92-140`,
  `frontend/src/pages/captain-mp/CaptainMP.tsx:518`, `frontend/src/pages/captain-mp/lib/dates.ts`
- `docs/pita-supply-os-v1/COMPANY_ENTITIES.md` (location phones)
- Parallel lanes: `delivery-calendar`, `order-line-zero-qty` (other worktrees)
