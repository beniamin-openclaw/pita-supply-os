---
change_id: order-screen-ux-fixes
title: Order-screen UX fixes — optional current stock, over-max alert, pre-claim manager label
status: implemented
created: 2026-06-16
updated: 2026-06-16
archived_at: null
---

## Notes

Three frontend-only UX fixes on the order screens (sibling to manager-queue-ux), runnable parallel to S-10. Grounded 2026-06-16; all frontend, no backend change. Pairs with the `manager-ux-feedback-backlog` memory.

**(A) Captain order screen — over-max/deviation alert must fire even when OBECNY STAN (current stock) is blank.** Today `computeRowState` (`frontend/src/pages/captain-mp/lib/compute.ts:66`) short-circuits to grey/no-alert when `current_stock_qty_base === ""`, so an order far above max shows no warning. **Decision (owner, 2026-06-16): treat blank stock as UNKNOWN** — keep SUGESTIA `"—"` (don't presume a count), but fire the over-max alert independent of stock; coerce blank→0 on submit as a backend backstop (the deviation gate then also catches it server-side).

**(B) Captain submit — current stock is NOT required.** Build an order line from any row where ZAMAWIASZ (`captain_final_qty_purchase`) was entered, even if stock is blank (coerce blank→0). Today `CaptainMP.tsx:349` filters `payloadLines` to rows with BOTH `current_stock` and order qty non-empty, so ordering without counting stock yields 0 lines → backend 422 "lines: List should have at least 1 item after validation, not 0". Fixing B also removes the most common trigger of that English 422 (error-localization stays a separate Parked item).

**(C) Manager — "Bez zmian vs kapitan" must NOT show before the manager claims the order.** The i18n `manager.managerSummaryNone` (`frontend/src/i18n/strings.ts:363`) renders at `OrderDetailPane.tsx:163` whenever `summary.changeCount === 0`, with no status guard; for `captain_submitted` `changeCount` is always 0 (manager_final falls back to captain qty), so the label fires pre-claim. Fix = status-guard the manager-vs-captain summary until `manager_claimed`/`manager_sent` — same call-site the `dispatched` flag from manager-queue-ux already threads (`OrderDetailPane.tsx:89-96`).

**Structure (owner decision):** one change, 3 phases — Phase 1 = Bug B (line assembly), Phase 2 = Bug A (alert), Phase 3 = Bug C (manager label). A+B are coupled ("current stock optional"); C is a small status-guard.
