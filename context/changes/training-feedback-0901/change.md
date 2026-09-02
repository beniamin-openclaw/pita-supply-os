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
