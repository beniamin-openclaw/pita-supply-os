---
change_id: demo-blocker-decimals-save
title: Fix decimal-comma inputs and receipt-edit save loss (P0 demo blockers)
status: archived
created: 2026-06-23
updated: 2026-06-23
archived_at: 2026-06-23T14:53:50Z
---

## Notes

fix two P0 live-demo blockers: (1) Polish decimal commas — number inputs use Number("0,6")=NaN so weight-goods lines silently drop from the payload (no suggestion, "ordering without stock" warning, order never reaches Manager); fix with a shared comma→dot parseDecimal across ProductCard/buildPayloadLines/InventoryCountPage/ReceiptLineCard. (2) Receipt confirmation BIG ERROR — on photo-retry the `if(!receiptId)` guard in ReceiveDeliveryPage skips re-submitting edited quantities, so qty edits after a photo failure are silently lost while photos upload fine.
