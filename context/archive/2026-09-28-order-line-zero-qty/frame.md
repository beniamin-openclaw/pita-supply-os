# Frame Brief: Zeroing an order line quantity

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Marek (operations manager), 2026-09-28: "Poprawiając na 0 w zamówieniu rekord
się nie kasuje i wartość się nie poprawia" — when a line quantity in an order is
corrected to 0, the line is not removed and the value is not corrected.

## Initial Framing (preserved)

- **User's stated cause or approach**: 0 is used as the "not set" sentinel for
  `manager_final_qty_purchase`; `gmail_url._effective_qty`,
  `main._effective_ordered_qty`, `lib/orderQty.ts::effectiveOrderedQtyPurchase`
  and `manager_order_save`'s untouched-line branch fall back to `captain_final`
  when `manager_final` is 0.
- **User's proposed direction**: confirm the hypothesis; find which screen(s)
  and whether a zeroed line reaches the supplier e-mail (decides severity);
  check the Captain edit path in case Marek meant that screen.
- **Pre-dispatch narrowing**: not asked. The operator delegated the chain up to
  plan-review and named the candidate screens (Manager order screen, Transport,
  Captain edit); Marek is not in the loop, so "which screen" was answered from
  code instead. It did not matter: the two Manager screens share one root.

## Dimension Map

1. **Captain edit / submit** — a 0 line is kept as a row and the total is not
   recomputed.
2. **Manager single-order screen, draft seeding after save** — the saved 0 is
   read back as "unset" and the draft snaps back to the captain qty. ← initial framing (FE side)
3. **Backend readers of `manager_final`** — totals, the server-built Gmail URL,
   receipts and the Transport aggregate fall back to `captain_final`. ← initial framing (BE side)
4. **Transport matrix** — the same seeding / aggregate rule on the batch screen.
5. **Data model** — the column itself cannot represent "Manager explicitly set 0".

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1. Captain path | `captain-mp/lib/buildPayloadLines.ts:20-24` drops qty-0 rows; `captain_order_edit` replaces the line set (`supabase_backend.replace_order_lines_atomic`) and recomputes the total (`main.py:1534`). Zeroing the last line is blocked with the explicit `apiError.orderEmpty` toast. Captain cannot edit after claim (`main.py:1450`). | NONE |
| 2. Manager screen reseed | `ManagerPage.handleSave` → `refreshAll` → `loadDetail` → `setDrafts(seedDrafts(d))` (`ManagerPage.tsx:127,291`); `seedDrafts`/`baselineFor`/`draftQty` use `effectiveManagerQtyPurchase` = `manager_final > 0 ? manager_final : captain_final` (`draftState.ts:23-46`, `lib/orderQty.ts:16-19`). The row is back at the captain qty, neutral, Δ "—". `dispatchPayload` then sends every line with its draft qty (`draftState.ts:91-100`) and `DispatchPanel` builds the e-mail from the same draft (`DispatchPanel.tsx:68,208`). | STRONG |
| 3. Backend readers | `gmail_url._effective_qty` (`gmail_url.py:26-30`) → the "Otwórz email" re-open URL; `manager_order_save` untouched branch (`main.py:2166-2169`) → total re-inflated on the next save; `_effective_ordered_qty` (`main.py:3403-3409`) → receipts pre-fill/variance (`:3478`), transport aggregate (`:3885`), finalize empty-column guard (`:4703`); `_effective_qty_changes` old-qty (`:1805`). Frontend twins: `ReceiveDeliveryPage.tsx:79,268`, Captain headline qty `OrderDetailPage.tsx:330`, `ResendPanel.tsx:33`. Tests lock the fallback in: `test_gmail_url.py:308`, `test_transport.py:282`, `test_manager_save.py:320`. | STRONG |
| 4. Transport matrix | `seedTransportDrafts` uses the same helper (`transport.ts:362-375`), reseeded after every save (`TransportPage.tsx:411,446-457`); aggregate/PDF/driver list read the server aggregate (rule 3). Only captain-origin lines are affected; add-line / prefill skeletons (captain 0) are consistent. | STRONG (same root) |
| 5. Data model | `order_lines.manager_final_qty_purchase numeric(12,4) NOT NULL DEFAULT 0` (`migrations/0001_initial_schema.sql:122`), `OrderLine.manager_final_qty_purchase: float = 0` (`models.py:173`); Sheets/seed parse a blank cell to the default 0. Nothing records whether the Manager touched a line. After dispatch the FE writes every line, so 0 is mostly unambiguous there — except Transport finalize (writes no `manager_final`, `main.py:4788`) and legacy/partial-payload rows. | STRONG (root) |

## Narrowing Signals

Step 3 was conclusive (dimensions 2–5 strong and one root, dimension 1 none), so
the questioning step was skipped. Supporting signals:

- Prod (read-only, 2026-09-28): managers routinely lower quantities on sent
  orders (e.g. 18 → 6, 2 → 1), yet no `manager_sent`/`closed` line since
  2026-08-22 has `manager_final = 0` with `captain_final > 0` (7 such lines ever).
  Consistent with zeros being lost before dispatch; not proof on its own.
- Prod: 0 sent orders were edited after send and `order_events` is empty, so the
  report comes from a claimed (pre-dispatch) order or the Transport screen, not
  the post-send edit.
- Update (coordinator, later on 2026-09-28): PR #33 merged, `SUP_PAGO.ordering_method
  = 'transport'` on prod, so Pago now leaves only through Transport; the Pago
  reconciliation lane reports a live case (Bracka order of 07.09, Bifteki: the
  Manager's 0 went back to the Captain's quantity) — reported, not re-verified here.
- Prod at frame time: `SUP_PAGO.ordering_method = manual` — the app sends no Pago e-mail, so
  the Transport exposure is documents/totals, not a supplier e-mail. E-mail
  suppliers (Bukat, Filber, Blue Service, Intermlecz, Kuchnie Świata) go through
  the single-order dispatch path.

## Cross-System Convention

The ambiguity was already known and patched at the display layer only:
`context/archive/2026-06-16-manager-queue-ux/plan.md:30-41` recorded that before
dispatch "a 0 means manager hasn't set it yet" and added the `dispatched` flag to
`lineVisualState`, while stating that "a manager who actively types 0 SHOULD see
the line as cancelled". That intent survives only until the first save. The
usual convention for an "unset vs zero" field is a nullable value or an explicit
"set" marker; this codebase has neither.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: a Manager's explicit 0 on a
> captain-ordered line is not durable — the data model cannot tell "Manager set
> 0" from "Manager has not set anything", so every reader after the save
> (draft reseed, totals, e-mail builders, receipts, Transport aggregate) restores
> the captain quantity.

The initial framing was correct on the mechanism; the reframe is about scope and
severity. It is not one helper: the storage cannot hold the fact, so fixing only
`_effective_qty` or only the draft seeding leaves the other readers wrong.
Severity is HIGH for e-mail suppliers: zero → **Zapisz** → the page reloads → the
line shows the captain qty again → **Wyślij** puts the line back into the Gmail
draft at the captain qty and writes that qty over the saved 0. Zeroing and
dispatching without an intermediate save sends a correct client-side e-mail, but
the server "Otwórz email" link, the receipt pre-fill and the Captain's headline
qty still show the captain qty. "Record not deleted" is by design (lines keep
their learning history; a zeroed line reads as cancelled), so the plan should
make the 0 stick, not delete rows.

## Confidence

**HIGH** — every link is traced to file:line, three independent sweeps agree,
the Captain path is ruled out, and the archive shows the ambiguity was
previously recognised and only patched for display. The exact screen Marek used
is unconfirmed (Manager order screen or Transport); both share the root.

## What Changes for /10x-plan

Plan around making "Manager explicitly set this line" representable and
honoured by every reader of `manager_final` (backend and frontend twins,
including the byte-identical e-mail builders and the Transport aggregate), with
a migration story for existing rows where 0 means "unset". Keep lines (no
deletion) and keep `order_lines` history columns intact.

## References

- Source files: `frontend/src/pages/ManagerPage.tsx:118-130,282-296,305-312`;
  `frontend/src/pages/manager/lib/draftState.ts:23-100`;
  `frontend/src/lib/orderQty.ts:16-19`; `frontend/src/pages/manager/lib/managerLine.ts:22,79-84`;
  `frontend/src/pages/manager/lib/transport.ts:362-375`;
  `supply-os-v1/app/gmail_url.py:26-30`; `supply-os-v1/app/main.py:1805,2003-2028,2159-2169,3403-3409,3478,3885,4703,4788`;
  `supply-os-v1/migrations/0001_initial_schema.sql:122`.
- Prior decision: `context/archive/2026-06-16-manager-queue-ux/plan.md:30-41`.
- Investigation: three read-only sub-agent sweeps (Captain path, Transport
  matrix, all `manager_final` readers) + read-only prod queries on 2026-09-28.
