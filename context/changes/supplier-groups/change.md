---
change_id: supplier-groups
title: Supplier groups — Pago + Magazyn Mory as one Manager filter option, Filber "zamówione (bez e-maila)"
status: implementing
created: 2026-10-17
updated: 2026-10-17
archived_at: null
---

## Notes

Lane M item 5 of `porzadek-2026-10` (`context/changes/porzadek-2026-10/contracts.md`, WP9). Ben's
decision D4 of 17.10:

- Pago and Magazyn Mory are grouped in the UI only. The data stays as it is: two suppliers, their
  own orders, catalogues and Transport blocks.
- Filber gets a "zamówione" button. There is no third aggregation layer (Filber does not join the
  Pago Transport run; `main.py` `_TRANSPORT_COMPANION_SUPPLIERS` is unchanged).

Context (plan.md of `porzadek-2026-10`): 47 orders stood claimed on 17.10, among them Pago 22,
Mory 13 and Filber 4. Marek must be able to mark every order sent in the app.
