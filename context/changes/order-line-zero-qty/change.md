---
change_id: order-line-zero-qty
title: Zeroing an order line quantity does not drop the line or update the total
status: implementing
created: 2026-09-28
updated: 2026-09-28
archived_at: null
---

## Notes

Operator feedback (Marek, operations manager, 2026-09-28): "Poprawiając na 0 w zamówieniu rekord się nie kasuje i wartość się nie poprawia" — setting a line quantity to 0 in an order neither removes the line nor updates the value. Hypothesis: 0 is used as the "not set" sentinel for manager_final_qty_purchase, so effective-qty helpers fall back to captain_final.

Note for Marek (Polish, for the operator to pass on after release):
"Wpisanie 0 przy produkcie w zamówieniu i Zapisz usuwa go teraz z zamówienia na stałe — wiersz zostaje na liście jako skreślony (Anulowane przez managera), nie trafia do maila do dostawcy ani do sumy. Linie, których nie ruszasz, dalej idą w ilości kapitana."

Prod SQL: `prod-sql.sql` (pre-check / apply / audit). Dry-run 2026-09-28 on a local pre-0024 copy with ROLLBACK: pre-check expected total 4 = audit flagged 4, transport untouched flagged 0, open zero flagged 0; the dispatched-zero branch flagged its one line and A3 listed it.
