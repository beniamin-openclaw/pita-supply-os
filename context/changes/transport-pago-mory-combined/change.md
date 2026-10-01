---
change_id: transport-pago-mory-combined
title: One Pago transport run also carries Magazyn Mory orders
status: impl_reviewed
created: 2026-09-28
updated: 2026-09-29
archived_at: null
---

## Notes

Operator decision 2026-09-28 (option 2B, accepted with inventory-card-order):

- One Transport run carries SUP_PAGO and SUP_MORY orders.
- The Pago pickup document and the Pago order e-mail/PDF carry Pago lines only.
- The driver list, PDF and Gmail draft carry everything, in supplier blocks Pago → Mory, each block in `display_order`.
- Mory members join the batch like Pago members, leave the queue with the batch, and are finalized with it.

Build now; merge only after the new locations start on 1.10; open a PR. Stop before merge and before any prod migration or data step. Never send a Pago e-mail from the app. Grounding: `pago-data-unity/proposal.md` (Mory is `manual`, batches single-supplier, driver collects Magazyn items on the Pago run).
