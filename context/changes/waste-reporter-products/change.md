---
change_id: waste-reporter-products
title: Reporter attribution and full-database waste products
status: impl_reviewed
created: 2026-11-05
updated: 2026-11-05
archived_at: null
---

Ben confirmed the deployed waste feature works, then requested mandatory reporter first name using existing form conventions, plus a searchable + Product selection from the entire product database, delivered end to end. Continue autonomous 10x workflow with delegated design/triage decisions; preserve the accepted 17-item list, local scoped drafts, atomic save, immutable uncertain retries and original audit. Existing production baseline is ae643989/PR84; Ben's acceptance belongs to that baseline, not this extension.

Use isolated branch codex/waste-reporter-products in the existing clean worktree. Implementation, tests, local real-Postgres E2E and independent review are authorized. A concrete production proposal must identify migration0033 and rollback before final promotion under AGENTS. Never create fake production observations or supplier orders, send Office messages, or access signed-in Telegram.

Exact next step: confirm final-head hosted product CI on draft PR85, then request Ben's explicit approval for migration0033and the application production promotion. Local implementation/E2E and independent reviews pass; all production actions and new-feature human acceptance remain pending. No live-test handoff until deployment is confirmed.
