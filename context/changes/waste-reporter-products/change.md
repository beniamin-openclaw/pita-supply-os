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

Exact next step: Ben tests the deployed production entry with a real reporter name and an extra master product, checks history/CSV, then confirms acceptance. Migration0033 and PR85 were explicitly approved and deployed as e4d4c549; both hosting artifacts, post-merge CI and production read-only UI/API/CSV checks pass. Local full E2E already covers save/recovery. Manual acceptance/archive remain pending; Office messages remain unchanged/unsent. See release-verification.md.
