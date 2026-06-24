---
change_id: order-ordered-by
title: Captain order carries a required "who orders" (ordered_by), shown to the Manager
status: implemented
created: 2026-06-24
updated: 2026-06-24
archived_at: null
---

## Notes

Captain order submit carries a REQUIRED "who orders" (`ordered_by`) free-text attribution, surfaced to the Manager in the queue and the order detail. Mirrors the existing `received_by` (Receipt/ReceiptSubmitRequest) and `count_user` (InventoryCount/InventoryCountSubmitRequest) pattern: required (`min_length=1`) on the INPUT request, `Optional[str] = None` on the persisted `Order` model (legacy rows have no value).

Backend (`supply-os-v1/app`):
- `models.py`: add `CaptainSubmitRequest.ordered_by: str = Field(min_length=1)` + `Order.ordered_by: Optional[str] = None` + `ordered_by: Optional[str] = None` on `ManagerQueueItem` and `ManagerOrderDetail`.
- `main.py`: `captain_submit` writes `ordered_by=req.ordered_by` on the Order; `manager_queue` + `manager_order_detail` carry it onto their responses. Captain edit does NOT require it — the submit value persists.
- Round-trip the column in both backends: `supabase_backend.py` (column mapping — model on an existing optional `orders` column such as `sent_method`/`cancel_reason`), plus `sheets.py`/`seed_loader.py`. Add an empty `ordered_by` column to the seed `orders.csv` (blank for existing rows).
- NO prod migration. Build/test on seed only.

Frontend (`frontend/src`):
- Required "who orders" field in the Captain submit form; copy via `i18n/strings.ts` (PL+EN); send in `CaptainSubmitRequest` via `apiClient.ts`. Mirror types in `types.ts`.
- Manager: show "Zamówił: X" in the queue and order detail.

Tests: submit without `ordered_by` → 422; manager queue+detail carry the field. Frontend with Homebrew node (`PATH=/opt/homebrew/bin:$PATH npm run build|lint|test`); backend `python3 -m pytest`.

Guardrails: persistence via `_choose_backend()`, frontend API only via `apiClient.ts`, copy only via `i18n/`, never a real dispatch from a test, artifacts in English, mirror Pydantic→TS.
