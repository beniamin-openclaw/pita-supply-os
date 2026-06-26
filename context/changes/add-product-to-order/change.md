---
change_id: add-product-to-order
title: Add ad-hoc product to order from orderable list
status: impl_reviewed
created: 2026-06-26
updated: 2026-06-26
archived_at: null
---

## Notes

dodaj możliwość dopisania produktu do
zamówienia, którego nie było w sugerowanej/orderable liście — dla Captaina
(na submit w CaptainMP ORAZ na edycji) i dla Managera (na zamówieniu
manager_claimed). To backlog #5 z DEMO_FEEDBACK round-1.

Grounding:
- Backend: supply-os-v1/app/main.py — captain_submit, captain_order_edit,
  manager_order_save, manager_dispatch; model OrderLineSubmit (models.py).
  Linia dodana ad-hoc musi przejść te same bramki walidacji co istniejące
  (orderable dla supplier+location, critical/deviation/over-MAX reason).
- Endpoint /api/captain/orderable już zwraca produkty dostawcy — "dodaj
  produkt" = wybór z orderable, którego jeszcze nie ma na zamówieniu.
- Frontend: captain-mp/OrderEditPage.tsx JUŻ ma logikę add (captain edit) —
  rozszerz na CaptainMP submit + Managera (OrderDetailPane/OrderLineTable).
- Zasady repo: API tylko przez apiClient.ts; copy tylko przez i18n/;
  persistencja przez _choose_backend(); widoczna matematyka sugestii;
  ŻADNYCH realnych zamówień z testów (back-out on submit).

Chain: /10x-new → /10x-research → /10x-plan → /10x-plan-review →
/10x-implement → /10x-impl-review → /10x-archive. Verify: /verify + na prodzie
po deployu (pattern: testuję na żywym prodzie, nie lokalnie).
