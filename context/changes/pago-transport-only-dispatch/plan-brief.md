# Transport-only supplier channel — Plan Brief

> Full plan: `context/changes/pago-transport-only-dispatch/plan.md`
> Research: `context/changes/pago-transport-only-dispatch/research.md`
> Adversary-pair decision: `context/changes/pago-transport-only-dispatch/decision-note.md`

## What & Why

A Wola order for Pago was dispatched from the ordinary Manager queue as a plain-text e-mail to
the Lineage warehouse, carrying per-location quantities, a delivery address and a delivery
date to a supplier whose arrangement is self-pickup. Pago orders are supposed to leave through
a Manager Transport batch, which produces a short e-mail with a PDF attachment and no
per-location data. Nothing in the app enforced that, and it has now happened three times.

## Starting Point

`manager_dispatch` is the only per-order path that sends an order, and it happily serves any
supplier whose `ordering_method` is a real channel. The one existing transport guard only
rejects an order already stamped into a draft batch. Pago was accidentally protected until
`suppliers.email` was filled with the real Lineage distribution list; that removed the
accident and nobody noticed.

## Desired End State

`SUP_PAGO.ordering_method` is `transport`. A Manager opening a Pago order sees an amber notice
and a link to the Transport screen where the dispatch controls used to be. There is no e-mail
composer to open, no list to copy and no "Oznacz jako zamówione" to press, and a request sent
straight to the API returns 409 without writing anything.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Flag shape | Fifth `OrderingMethod` value, not a boolean column | The channel switch already exists and dispatch already treats it as the source of truth; a boolean adds a second orthogonal axis | Adversary pair |
| Guard condition | Unconditional for the channel, no `TRN-` exception | A batch member never legitimately reaches `manager_dispatch`; the marker has four states that would wave an order through | Devil's advocate |
| Where the mail is actually stopped | The frontend branch, not the 409 | The Gmail link opens a prefilled compose window before the POST is sent, so the server answer arrives too late | Devil's advocate |
| Stale-bundle behaviour | Accepted as safe | An old build matches none of its four channel branches and renders no dispatch control; `t()` degrades instead of throwing | Plan (verified) |
| Queue chip | Not doing it | A claimed order can still be folded into a batch, so the panel notice comes before any irreversible step | Constructive critic |
| Seed CSV | Untouched | Shared fixture for the whole backend suite; Captain screens default to Pago | Constructive critic |
| `ordering_method` for Pago | `manual` today, `transport` after the build is live, never `email` again | The enum gives the column one true value | Adversary pair |

## Scope

**In scope:** migration 0021 widening the CHECK; the `transport` enum member; a guard in
`manager_dispatch`; the `transport` branch in `DispatchPanel` with Polish and English copy;
backend route tests and the first `DispatchPanel` component test; an operator SQL file.

**Out of scope:** release, cancel, save and add-line stay open for a transport-only supplier;
`ResendPanel` and `ManagerQueueItem` untouched; the Transport flow untouched; the seed CSV
untouched; the disposition of the three already-sent orders is an operator decision.

## Architecture / Approach

One value, one guard, one branch. The backend refuses the write; the frontend removes the
affordance. Both are needed: the server guard protects the order status and the batch
aggregate, the frontend branch protects the mailbox. Everything keys off master data that all
three backends already read, so no column list, sheet header or CSV changes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Backend | Enum member, migration, unconditional guard, tests | Integration fixture must apply 0021 or the CI Postgres job breaks while local pytest stays green |
| 2. Frontend | Transport branch, notice, link, first panel test | Missing the `titleKey` entry leaves a heading reading "undefined" |
| 3. Operator package | Gated prod SQL and the change log entry | The data pass running before the build is live takes every supplier-reading screen down |

**Prerequisites:** migration 0021 applied on prod; step 1 of the repair, setting Pago to
`manual`, already run.
**Estimated effort:** one session across three phases.

## Open Risks & Assumptions

- Deploy ordering is inverted from the usual rule. A `transport` value read by a build without
  the enum member raises a `ValidationError` and 500s every supplier-reading screen; the repo
  has had this exact failure before with `tenth_kg`. Sequence is migration, deploy, verify,
  then data pass.
- A batch member skipped at finalize on an already-sent batch has no dispatch exit once the
  guard lands. Cancel still works, so it is recoverable, but it is worth knowing.
- The three orders already sent stay `manager_sent` with `sent_method='email'`. They keep
  working for receiving and post-send edit; only their resend panel changes shape.

## Success Criteria (Summary)

- A Manager cannot send a Pago order from the queue by any route, and is told where to go.
- Every other supplier dispatches exactly as before.
- The Transport batch flow, including its PDF draft and recipients, is unchanged.
