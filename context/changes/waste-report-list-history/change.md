---
change_id: waste-report-list-history
title: Scrollable waste catalog and integrated report histories
status: impl_reviewed
created: 2026-11-04
updated: 2026-11-04
archived_at: null
---

Ben requested autonomous 10x delivery of an order-style scrollable product list, default today, retained additions, Captain History integration and a Manager segment beside Inventory with date selection and CSV. Prepare a merge-ready reviewable result; no production merge/deploy is authorized. Interpret “lista 11” as a 1:1 product list, preserving the accepted 17-item catalog, not an unexplained reduction to 11 products.

Continue the isolated `codex/supply-v2-waste-report` lane from `d05a3f3`. Preserve the parent waste-report plan/review as historical evidence. This follow-up supersedes the old application release candidate only after its new checks/review. Scope includes UI/history and bounded role-scoped Captain CSV capability if needed; no purchasing/inventory mutation, extra dependency, signed-in Telegram retrieval or staff communication.

Exact next step: review plan, implement list and history surfaces, verify authenticated real-Postgres browser flows and product suites, save screenshots/reviews, commit and prepare the final merge proposal. The existing migration0032 prerequisite must be disclosed/verified; do not claim a merge alone creates database tables.

Read-only production preflight: existing Railway service `pita-supply-os` selects Supabase. Using its existing authorized database connection, a read-only transaction confirmed `locations` exists and both `waste_reports` / `waste_report_lines` are absent. No data/schema/runtime changed and no credential was logged. Therefore a safe production merge is conditional on operator-approved migration0032; a merge-only deployment cannot be claimed from the current schema.

Ben subsequently explicitly approved migration0032 only. It is applied and verified; see `migration-preflight.md`. No merge, deployment or restart occurred. Continue local UI/review/CI handoff.

Application candidate `d955721` is committed, locally verified and independently approved. Evidence: `verification.md`, `reviews/impl-review.md`; current merge handoff `merge-proposal.md` supersedes the parent application proposal. No application merge/deploy performed. Remote PR/CI is the remaining preparation step.
