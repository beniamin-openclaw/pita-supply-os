---
change_id: order-line-zero-qty
title: Zeroing an order line quantity does not drop the line or update the total
status: impl_reviewed
created: 2026-09-28
updated: 2026-09-28
archived_at: null
---

## Notes

Operator feedback (Marek, operations manager, 2026-09-28): "Poprawiając na 0 w zamówieniu rekord się nie kasuje i wartość się nie poprawia" — setting a line quantity to 0 in an order neither removes the line nor updates the value. Hypothesis: 0 is used as the "not set" sentinel for manager_final_qty_purchase, so effective-qty helpers fall back to captain_final.

Note for Marek (Polish, for the operator to pass on after release):
"Wpisanie 0 przy produkcie w zamówieniu i Zapisz usuwa go teraz z zamówienia na stałe — wiersz zostaje na liście jako skreślony (Anulowane przez managera), nie trafia do maila do dostawcy ani do sumy. Linie, których nie ruszasz, dalej idą w ilości kapitana."

Prod SQL: `prod-sql.sql` (pre-check / apply / audit). Dry-run 2026-09-28 on a local pre-0024 copy with ROLLBACK: expected_flagged 3 = audit flagged 3, zero_flagged 0; a dispatched e-mail line with manager 0 / captain 3 was listed by A3 and stayed unflagged; column gone after ROLLBACK.

Deploy order (hard gate): apply 0024 on prod BEFORE merging. Without the column the new backend fails every order_lines INSERT (captain submit, captain edit, Manager add-line, Transport add-location) and every Manager save / dispatch UPDATE. Old code after the migration is unaffected (extra column ignored, default false).

Impl-review decisions (reviews/impl-review.md):
- Backfill marks only positive manager_final, so no existing line changes its effective quantity; the migration is re-runnable.
- A release back to captain_submitted (Odrzuć do poprawy, Transport remove-order / cancel / empty-column auto-remove at finalize) clears the flag on the Manager's zeros, so the order reads at the Captain's quantities again, as before this change. Positive Manager values keep today's behaviour.
- Dispatch: a line missing from a partial payload keeps its effective quantity (a saved explicit 0 stays 0; a legacy positive manager_final now wins over the Captain's). The UI always sends every line, so no visible effect.
