# Supplier Order E-mail v2 — Plan Brief

> Full plan: `context/changes/order-email-v2/plan.md`
> Frame brief: `context/changes/order-email-v2/frame.md`
> Research: `context/changes/order-email-v2/research.md`

## What & Why

The operator approved a new per-order supplier e-mail: sent from the location's alias in
biuro@, CC to the location mailbox, Polish copy, location phone, the sending manager's
signature, and the delivery date. Frame: produce the approved content in both builders,
and deliver it as a biuro@ draft whose sender alias is verified — not merely requested —
while the delivery date stays blank until a real date exists.

## Starting Point

Two builders (`emailBody.ts`, `gmail_url.py`) produce an ASCII-ish body opened via a Gmail
compose link from whichever account is signed in. A draft mechanism exists for Transport
but has no `From`/`Cc`, no account check and no token reuse. The delivery date is a
next-day default in every order (64/64), so it cannot be printed yet.

## Desired End State

The manager clicks "Zrób draft w Gmailu"; the draft appears in biuro@ as
`Pita Bros Bracka <bracka@pitabros.pl>` with the location mailbox in DW and Marek's (or
Sławek's) signature, the order is marked sent, and a wrong account is refused before any
draft exists. The fallback link still works. Dosyłka uses the same path. The date appears
the moment the operator flips one switch after `delivery-calendar` lands.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Mechanism | Gmail API draft in biuro@, `From` = alias; compose link as fallback | Only way to set the sender without `gmail.send` | Frame |
| Mailbox check | `getProfile` before, draft `From` after; refuse + delete on mismatch | Gmail rewrites a bad `From` silently | Research |
| Date | Env switch, default off; blank `Dostawa: __________, od godziny 11:00` | Date is a guess until the calendar lane | Frame / Plan |
| Signers | `_meta.order_email_signers` JSON; select in panel, remembered per browser | Config, not code; no per-manager auth | Plan |
| CC | Draft: location mailbox; fallback: + biuro@ | biuro@ already holds the sent draft | Brief / Plan |
| Twin builders | Kept byte-identical, pinned by shared golden fixtures + declension parity test | Brief requires the twin; comments alone drifted before | Research / Plan |
| Draft vs dispatch | Draft first, dispatch after verified draft | A failed dispatch leaves only an unsent draft | Plan |
| Token | Reused ~50 min per mailbox, `login_hint` = biuro@ | ~10 orders/day, one popup | Plan |
| Quantities | Decimal comma, declined units | Matches the UI; "Polish everywhere" | Plan |
| Too-long URL | Dispatch no longer fails; re-open link just absent | Draft path has no URL limit | Research |

## Scope

**In scope:** migration 0026 (`locations.sender_email`, `phone`), settings, signer config,
detail fields, both builders, dispatch signer, Gmail draft path with checks, dispatch +
dosyłka UI, i18n, tests, prod SQL file for the operator.

**Out of scope:** Pago/Transport sending, real sending, server-side Gmail, computing
delivery dates, per-manager identity, table column alignment.

## Architecture / Approach

Backend adds data (columns, `_meta` signers, settings) and exposes it on
`ManagerOrderDetail`; both builders render the same text from it (golden fixtures).
Frontend `orderEmailDraft.ts` orchestrates token → profile check → draft → `From` check,
reusing `gmailDraft.ts` primitives; the panels call it, then the unchanged dispatch API.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data and config seam | Columns, settings, signers, detail fields, prod SQL draft | Migration fixture wiring |
| 2. Content v2 in both builders | New layout, golden fixtures, dispatch signer | Twin drift; weekday off-by-one |
| 3. Gmail draft path | Verified-alias drafts, UI, dosyłka | Silent browser/OAuth failures |
| 4. Rebase, verify, PR | On top of 0023/0024, PR, E2E | Sibling-lane conflicts in builders |

**Prerequisites:** operator confirms alias spellings, WOLA sender, Marek's e-mail, biuro@ access
for Marek/Sławek; operator applies 0026 + prod SQL before merge.
**Estimated effort:** ~2 sessions for phases 1–3, plus rebase and a live E2E.

## Open Risks & Assumptions

- Aliases must be send-as addresses of biuro@ (memory screenshot 2026-07-23 says they are);
  the `From` check catches a missing one.
- Marek/Sławek must be able to sign in as biuro@ in their browser.
- Sibling lanes may land in any order; the builder seam keeps the rebase to two call sites.

## Success Criteria (Summary)

- A real order produces a biuro@ draft from the location alias, with the approved text.
- A wrong account never produces a draft or a "sent" order.
- Both builders render byte-identical text (tests), and no guessed date reaches a supplier.
