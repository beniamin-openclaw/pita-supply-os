# Round 2 — post-review findings (HARDENED)

Seven findings from the post-deploy review, re-planned after an adversarial
hardening pass (Fable) that rejected the first draft. `plan-r2-draft.md` is not
kept; the decisions that changed are recorded inline below.

Baselines: backend 637 unit / 20 integration / ruff; frontend 290 / build / lint.
Prod is live on `c15e32a`.

---

## F0 (NEW, found during hardening) — the Pago supplier draft ships a filtered order

**Not in the original seven. Found while verifying F1, and it is live.**

`PrintViews.tsx:105-111`: the "Szkic Gmail — zamówienie" path builds its body with
`buildDraftBody` (`gmailDraft.ts:166-201`), which lists **no products at all** —
it is a cover letter pointing at the attachment. The attachment is
`buildTransportPagoPrintDoc`, which I filtered to `warehouse_pickup` only.
`PdfDoc = "driver" | "pago"` (`PrintViews.tsx:55`) — there is no separate
unfiltered order document.

So for Pago, everything ordered outside the six flagged items reaches nobody: not
the body, not the attachment. Before my filter the document listed everything.

**Why this is not simply "revert the filter".** The operator's Pago catalogue has
eight positions. Master data maps ~24 products to `SUP_PAGO`, including till
rolls, envelopes, markers, staples, napkins and trays. Either Pago sells those
and the filter is wrong, or master data wrongly assigns them and the catalogue is
right. **That is an operator question, not an engineering one.**

**Decision.** Do not restructure the documents on a guess. Make the loss
**visible** instead — which is F7, promoted from a nicety to the safety net for
this. Ask the operator which of the two is true, in the report.

---

## F1 — Ad-hoc items never reach the supplier on the Transport path

Three builders exist, not two. `emailBody.ts` + `gmail_url.py` are the matched
single-order pair and were both patched. `buildTransportEmailBody`
(`transport.ts:87`) and `buildDraftBody` (`gmailDraft.ts:166`) are the Transport
pair and neither carries the fields. Migration 0013's own header says "BOTH
builders", which is what made the gap invisible to the review that checked them.

**Rejected from the first draft: de-duplicating ad-hoc text across locations.**
Items serialise as `"{name} - {qty} {unit}"` (`extraItems.ts:29-45`), so WOLA
"Feta - 5 kg" plus BRACKA "Feta - 5 kg" would have been collapsed to one line and
the supplier sent 5 kg instead of 10. That under-orders. The planned test would
have encoded the bug as a requirement.

**Changes.**
- `TransportBatchOrder.extra_items` / `.captain_note` on the backend model and
  `_enrich`; TS mirror **optional** (`extra_items?: string`) with `?? ""` at every
  reader — an FE-ahead-of-BE deploy would otherwise `undefined.trim()` inside the
  `useMemo` at `TransportPage.tsx:762` and take the whole Transport page down.
- Both Transport builders gain one "Pozycje spoza katalogu" block, listing every
  member order's lines **verbatim, never de-duplicated**, without location
  attribution (the supplier doc was just stripped of locations for that reason).
- The DRIVER text and PDF get the same items **with** location attribution —
  those are our documents, and the driver is who physically delivers the extra
  feta to Bracka.
- `captain_note` goes to the Manager on the batch detail only, never to a supplier.

## F2 — The Polish UI prints English nouns

`tPlural` composes `${prefix}.${form}.${noun}` (`i18n/index.ts:120`). Nine keys
are defined reversed, lookup misses, the `.many` fallback misses, and
`index.ts:127` returns the raw `${n} ${noun}`.

**Rename** (verified as the only wrong ones, and referenced nowhere except
through `tPlural`, so the rename is type-safe via `StringKey`):
`manager.lines.{one,few,many}` → `manager.{one,few,many}.lines`;
`manager.deviations.*` likewise; `dates.delivery.days.*` →
`dates.delivery.{one,few,many}.days`.

**Key-integrity test**, scoped to `tPlural` only (`t()` is already type-checked
through `StringKey`). It must (a) assert it found at least 9 call sites and
(b) fail on a non-literal argument — otherwise a regex miss passes vacuously.
Write it so it FAILS on today's code before doing the rename.

## F3 — DESCOPED: an ad-hoc-only order cannot be submitted

**The first draft proposed relaxing `CaptainSubmitRequest.lines` to allow a
zero-`order_lines` order. Hardening rejected it, and it was right.** Four
downstream gates reject that shape, and one of them destroys data:

| Consumer | Result |
|---|---|
| `manager_dispatch` — `manager_finals` `min_length=1` (`models.py:256`) | 422; the button is disabled anyway |
| `gmail_url.build_draft_url:206-211` | raises on empty → 400 |
| `manager_transport_finalize` (`main.py:4230-4300`) | **auto-removes the order from the batch**, clears its marker, releases it — silently, forever |
| `captain_receipt_submit` — `ReceiptSubmitRequest.lines` `min_length=1` | 422; the order can never reach `closed` |

Shipping the button without all four would give a Captain a Wyślij that produces
an order nobody can dispatch, send, or close.

**Decision: fix the lie, not the lifecycle.** Ad-hoc items as an *addition to a
real order* work today and are what the operator actually described ("mamy event,
potrzebujemy czegoś, czego nie mamy"). Only the zero-catalogue case is broken,
and it exists solely because Phase 3 activated Allegro and Selgros without giving
them `location_product_settings`.

**Changes.** Hide the ad-hoc section when the supplier has no catalogue at this
location, and say why in the empty state. The real remedy is master data: give
those two suppliers product catalogues. A full ad-hoc-only order lifecycle is a
separate change, not a patch.

## F4 — The Captain draft discards ad-hoc items and the comment

Wider than the first draft assumed. `draftHasValues` (`CaptainMP.tsx:50-58`)
gates all three write sites and the restore banner, so an ad-hoc-only draft is
never even saved. The flush ref (`:285-300`) carries only `lines`. The restore
runs inside the orderable `.then` (`:227-247`) and must apply even when `items`
is `[]`. `discardDraft` (`:320-338`) must clear both new fields.

Extend `DraftState`, and keep reading a legacy draft that has neither — never
crash on an old shape.

## F5 — CSV timestamps are raw UTC

`inventoryCsv.ts:66-68` does `iso.replace("T", " ")` while screens render
Europe/Warsaw, so a 22:15 UTC count shows as 00:15 next day on screen, the
previous day in the CSV, and disagrees with its own filename.

Format Europe/Warsaw as `YYYY-MM-DD HH:MM`, `hourCycle: "h23"` (`hour12:false`
can emit "24:00"), no offset suffix. **The bare-date fallback must stay
date-only** — `formatIsoForCsv` also receives `count_date` (`:91`), and
converting "2026-09-01" would print "2026-09-01 02:00". Same formatter for
`last_edited_at` (`:86`). `inventoryCsv.test.ts:60,78` assert the old output and
must be rewritten; add the cross-midnight case, which is the whole bug.

## F6 — `transport_events` 500s on Supabase when its table is missing

`main.py:3841` catches only `sheets.WorksheetNotFound`; Supabase raises
`ProgrammingError`. This is the precedent `_load_inventory_events_safe` was
modelled on — the model was fixed, the original was not. Give it the same
`_load_transport_events_safe` treatment.

## F7 — PROMOTED: make the excluded Pago lines visible

Now the safety net for F0. **Rejected from the first draft: a count-based
"warning".** `warehouse_pickup = false` is the normal state for most of a mixed
Pago batch, so a count would fire on every batch and be ignored. One bit cannot
separate "correctly excluded dry good" from "warehouse product missing its flag".

**Changes.** Show the Manager the excluded product **names** on the Transport
screen and before the draft flow, informational styling, in the
`WeightStrip.tsx:53-57` idiom — "Nie ujęto w zleceniu odbioru: Serwetki PB,
Tacki bez logo, …". Handle `every(l => l.warehouse_pickup === undefined)` as a
distinct "brak danych" state (an FE-ahead-of-BE deploy), not as "all excluded".
No schema change, no master-data editor — the app has no editing UI for any
master data and one boolean does not justify the first.

---

## Sequencing

No migration. F2, F5, F6 are independent and can land first. F1 needs its
backend deployed before or with its frontend (D2). F4 after F1. F3 and F7 are
frontend-only.

## Verification

Backend `pytest` + `ruff` + integration on the local demo Postgres; frontend
tests + build + lint; then E2E on demo with auth ENABLED and role-correct tokens.

## For the operator

**Does Pago actually sell till rolls, envelopes, markers, staples, napkins and
trays?** Master data maps ~24 products to `SUP_PAGO`; the supplied catalogue has
eight. If Pago does not sell them, the fix is master data, not documents.
