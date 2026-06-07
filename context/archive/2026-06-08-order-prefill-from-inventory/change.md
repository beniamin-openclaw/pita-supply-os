---
change_id: order-prefill-from-inventory
title: Order screen — opt-in pre-fill of current stock from the latest inventory snapshot
status: archived
created: 2026-06-08
updated: 2026-06-08
archived_at: 2026-06-07T23:37:46Z
---

## Notes

Roadmap **S-07** (FR-017, US-02). Prereq S-06 (done — snapshots persist). When the Captain starts a per-supplier order, offer an **opt-in** pre-fill of `current_stock` from the **latest** location inventory snapshot. **Double safeguard** (per PRD): the offer **names the snapshot's date/time**, and nothing fills without the Captain clicking accept. Values stay editable; ordering without any inventory behaves exactly as today (Tier-1 manual-entry flow must NOT regress).

- **Backend:** `GET /api/captain/inventory/latest` → latest `InventoryCount` for the token's location (sheet-only; seed mode → null, mirroring `captain_orders`). Returns `{count_id, count_date, count_submitted_at, line_count, lines:[{product_id, current_stock_qty_base, count_comment}]}`.
- **Frontend (CaptainMP):** fetch the snapshot once on mount; an opt-in prefill banner (separate from the draft banner) named by date/time; accept fills `current_stock` for matching orderable lines only; per-supplier dismiss.
- **Testing:** SYNTHETIC data only — no real orders, no live dispatch (hard rule). Edge cases simulated + flagged in `notes/edge-cases.md` (fed by the scout workflow `w0lafv5zc`).

Autonomous persistent run: full 10x flow (plan → plan-review self → implement → impl-review → archive); progress on disk (plan.md Progress + SHAs); `notes/RESUME.md` as the cross-compact anchor.
