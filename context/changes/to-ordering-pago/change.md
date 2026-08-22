---
change_id: to-ordering-pago
title: Manager Transport — aggregate location orders into one Pago order + usage
status: implementing
created: 2026-08-21
updated: 2026-08-21
archived_at: null
---

## Notes

Manager "Transport" for Pago: collect submitted location orders, combine them into one aggregated PAGO order, and record the per-location quantities as usage (zużycie) — replacing the legacy "Ordering PB v5 prod" spreadsheet flow.

Operator constraints from the request (2026-08-21):
- Analyze the legacy spreadsheet `Ordering PB v5 prod` (Google Sheet 1jNMwKNHpbSCsak9Yuo9UPgMYM10CJ1dEO4ghDdaVPcU) as the source of truth for the current manual flow (city selection panel, PB Orders Apps Script menu, working view, ORDER fill-in, usage/zużycie recording).
- Delivery mode: 10x autonomous, TDD, subagent-driven development (Opus 5 medium as implementer subagents; Fable 5 high as orchestrator/reviewer/critic).
- STOP after research + plan and propose the approach to the operator before implementing.

**Adversary-pair decision (2026-08-21, proactive — new-entity/status-workflow territory).** Devil's advocate attacked the two-new-entities design (transfer_orders + transfer_order_lines): no cross-entity atomicity for N order transitions + aggregate insert, captain-edit race when combining from captain_submitted, manager_sent/sent_method overload, no Order→Transport reverse link, unverified premise that prod has any SUP_PAGO orders. Constructive critic proposed A′: NO new tables — a batch marker on the existing `orders` row (reuse idle `supplier_order_reference` with a `TRN-` id format), combine = the existing guarded `update_order(..., expected_status=...)` per order, aggregation computed read-time from frozen `order_lines` via a pure function shaped like `_aggregate_suggestion_review`, usage = the frozen order_lines themselves. **Reconciled: adopt A′** — it removes the atomicity problem structurally (no aggregate row to orphan; worst case is a smaller batch + explicit skipped[] report), needs zero migration and zero new seam functions (fits hard rule best), has a suggestion-review-sized test surface instead of a receipts-sized one, and is trivially reversible while 6 operator questions are still open. Devil's-advocate risks carried into the plan as requirements: claim-first transition path, per-order outcome reporting, queue/detail "TRN" chip via exposing the marker, prod SUP_PAGO order-count precondition check, and the explicit accepted trade that v1 output is copy/print (manual last mile to Pago remains until an email/PDF follow-up + master-data batch).

Local dump of the spreadsheet (markdown export, 536k chars):
`/Users/ben/.claude/projects/-Users-ben-Desktop-Jarvis-JARVIS-V2-10xDEVS/0b60e287-89e9-4531-8995-55b06cb15506/tool-results/mcp-3e1b56c7-13d9-46a3-b0ed-4c03121c54b2-read_file_content-1787343032301.txt`

**Naming decision (2026-08-21, operator):** feature name = **Transport** (PL UI "Transporty", route /manager/transport, API /api/manager/transport/*, batch id prefix TRN-, sent_method="transport", i18n manager.transport.*). Rejected: "TO Ordering". Any residual "TO" wording in older artifact prose refers to the same concept.

**Operator decisions (2026-08-21, evening):**
- Pago Transport-order email goes to the LEGACY SHEET'S PAGO DISTRIBUTION LIST (finanse@pitabros.pl, fakturymeze@gmail.com, manager@pitabros.pl, PBTransporterBro@gmail.com, biuro@pitabros.pl, gosia@vafidis.pl + emea.pl.*@lineagelogistics.com — exact membership to be confirmed at the gated master-data batch). Implementation: the Transport email builder treats supplier.email as a comma/semicolon-separated recipient list (Gmail compose `to` accepts commas); the "@" gate still applies.
- Driver notification email (address depends on which driver is chosen) — explicitly DEFERRED by the operator ("na ten moment bez znaczenia, potem to zrobimy"). v1 keeps the driver list private in-app; a per-driver send is a follow-up lane.
