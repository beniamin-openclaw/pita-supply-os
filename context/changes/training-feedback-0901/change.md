---
change_id: training-feedback-0901
title: Training-session feedback — ordering UX, master data, transport documents
status: implemented
created: 2026-09-01
updated: 2026-09-02
archived_at: null
---

## Notes

Operator feedback from the 2026-09-01 onboarding training for 4 locations (Wolska,
Bracka, KEN, Browary), plus the manager review meeting recorded the same day.

Scope is deliberately one project in four stages (operator decision):

1. **App / ordering UX** — order-level "overrule all" reason, PL category names in the
   inventory count, editable inventory count with an audit log + name, per-supplier
   free-text "add product" and "add comment", name autocomplete, supplier minimum-order
   value shown as information (never a hard gate; default 400 PLN until real values land).
2. **Master data** — gyros cut/whole split, KEN two separate chicken SKUs, cooked
   pęczak / chickpeas as separate production items, gas cylinders open vs closed,
   crates empty vs holding empty bottles, remove "bąbila", Tiro 3 kg → 2 kg, unify tapes,
   activate Allegro + Selgros (already present as `active = false`), add Corfu Beer
   Pilsner for Bracka/KEN/Wolska.
3. **Transport / driver documents** — the Pago self-pickup document must list Pago
   products only; entity block changes from "The Greek Gourmet Małgorzata Kubiak-Vafidis"
   to **Pita Bros sp. z o.o., NIP 9522100633, ul. W. Laskonogiego 9, 02-496 Warszawa**
   (operator-confirmed 2026-09-01); driver list drops the "LOTS" column, gets a Pago
   section on top, and fixes units (Tiro / rolls in pieces or packs, not kg).
4. **Later (not in this change)** — Telegram notifications and alerts, delivery schedule
   templates, cross-supplier order combining, product-availability agent via Goorder.

Decided and explicitly OUT of scope: the 25% deviation threshold stays as-is; no
package/crate rounding rule (the override stays the operator's tool); no per-employee
logins.

Blocked on operator input: real per-supplier minimum order values (Trello card
https://trello.com/c/PG9I61nu, due 2026-09-04), the unified tape list, the bottle-crate
pairing rules (pending Bartek), and the Telegram alert specification.

## Handover flags

**One string changed meaning, not just wording.** The Pago pickup document's
section bar (`manager.transport.print.pagoDoc.pickupBar`) read "Odbiór własny z
magazynu **The Greek Gourmet**" and now reads "…z magazynu **Pita Bros**". Every
other site in that swap names the *buying entity*, which the operator confirmed.
This one names the **warehouse the goods are collected from** — a different
thing. It was changed on the operator's blanket instruction ("nie ma już towaru
DeGourmet, wszędzie pisz PitaBros"), but if the physical pickup point is a
third-party cold store (Lineage), the line may now be factually wrong on a
document a driver hands over. Worth one look before the pilot leans on it.

**Two Transport read paths derive the batch supplier differently.** The detail
endpoint now prefers the `transport_batches` header row; the batches LIST
endpoint still reads `group[0].supplier_id`. The plan only named the detail site,
and prod data shows no batch has ever held two suppliers, so list and detail
cannot disagree today — but they would if one ever did.

**The seam parity test is one-directional.** `test_supabase_backend.py`'s
`test_seam_parity_supabase_is_superset_of_sheets` computes `sheets - supabase`,
so a function added to Supabase and forgotten in Sheets passes silently. Both
backends were checked by hand for this change; the next one should not rely on
that test alone.

## Post-implementation review (2026-09-02, after deploy)

Independent review with all four commits live. The four earlier impl-review fixes
were re-verified and all hold. Nothing was found that breaks the code — but seven
places where the app tells a user something that is not true. In severity order:

1. **Ad-hoc items never reach the supplier on the Transport path.** Both
   single-order email builders were patched, the Transport one was not, and the
   data does not even reach the frontend (`TransportBatchOrder` stops at `lines`).
   The Captain screen promises "trafi do dostawcy jako osobna pozycja". For any
   order combined into a batch — which is every Pago order — it does not.
2. **`tPlural` key order is inverted at two call sites**, so the Polish UI prints
   English nouns: the Manager queue reads "7 lines · 3 deviations" and the Captain
   supplier strip reads "2 days" instead of "dostawa: 2 dni". Pre-dates this
   change; the dev-only `console.warn` keeps prod silent. Four other call sites
   use the correct order, including the two this change added — so an author has
   no signal which is right.
3. **An ad-hoc-only order cannot be submitted.** The section deliberately renders
   for a supplier with no catalogue, but the action bar is gated on
   `orderableItems.length > 0` and the payload rejects zero lines. Phase 3
   activated Allegro and Selgros, which have no thresholds — so a Captain can fill
   the form and find no Wyślij button anywhere.
4. **The Captain draft discards ad-hoc items and the comment.** `DraftState` holds
   only `lines`, while the restore banner asserts the entry is remembered.
5. **CSV timestamps are raw UTC** while every screen renders Europe/Warsaw, so a
   late-evening count produces a file whose `Data` row contradicts its own
   filename by a day. The trailing `+00:00` also makes Excel treat it as text.
6. **`transport_events` still 500s on Supabase when its table is missing** —
   `main.py` catches only the Sheets `WorksheetNotFound`. This is the precedent
   `_load_inventory_events_safe` was modelled on; the model was fixed, the
   original was not.
7. **`warehouse_pickup` has no write path.** It is hand-maintained SQL, so a new
   Pago cold-storage product inherits `false` and silently never prints on the
   pickup document.

Top test gap: an i18n key-integrity test resolving every `t()` / `tPlural()` call
site against `STRINGS`. 290 green tests did not catch findings 2.

Rollback note: `5706f0c` must not be reverted alone — it carries the `!isPago`
escape, without which every non-Pago order document empties silently.

## Closing note (2026-09-03)

Archived with four items deliberately open, all of them operator actions rather
than engineering work:

1. **Phase 0 RLS** — `prod-sql-phase0.sql` written but never run; nine backup
   tables still readable with the anon key. Re-verified open on 2026-09-03.
2. **Phase 3 master data** — `prod-sql-phase3.sql` written and dry-run clean on
   the demo DB, but never run on prod: Bombilla is still active, Corfu Pilsner
   still `szt`. The gyros split, gas-cylinder split and cooked chickpeas are all
   still pending in it. The Pago/Mory cleanup landed separately and supersedes
   only that file's Pago rows.
3. **Marek's inputs** — roll pack sizes, tapes, crates, bottle-crate rules and
   the supplier minimums. Two Trello cards, both due 2026-09-04.
4. **Live PDF check on prod** — the operator has not confirmed the two Transport
   documents by eye. `lessons.md` is explicit that this class of feature fails
   silently past green tests, so it stays open rather than being assumed.

Everything engineering-side shipped and is live: four rounds of code across
`656bbea…c93dd57`, three migrations, two independent reviews plus one adversarial
plan hardening, and a second review round whose four risks were also fixed.

Follow-on work identified but deliberately NOT taken here:
- **"Cofnij wysyłkę"** — there is no path back from `manager_sent`; analysed and
  scoped, needs its own change.
- **Telegram notifications and the delivery schedule** — the operator's own
  "later stage" from the training feedback.
- **A standalone ad-hoc order** for a supplier with no catalogue — hardening
  rejected the shortcut; the real remedy is giving Allegro and Selgros catalogues.
