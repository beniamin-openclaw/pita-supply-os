---
change_id: email-total-to-manager-panel
title: Move the estimated total out of the supplier email into the Manager panel
status: implementing
created: 2026-06-23
updated: 2026-06-23
archived_at: null
---

## Notes

Remove the estimated total value (`total_value_estimate_pln`, "Łączna wartość szacunkowa") from the supplier dispatch email — both the Python `gmail_url.py` body builder and the authoritative TS `emailBody.ts` builder, plus the backend test that asserts it — and instead show it in the Manager order-detail panel under the order summary and above the action buttons.

Source: live demo round 2/3 (2026-06-23), backlog item #7 — see `docs/pita-supply-os-v1/DEMO_FEEDBACK.md`. Owner-confirmed decision: the supplier must not see our estimated value; it is internal (Manager) only. Research grounded the exact leak sites + the panel insertion point — see `research.md`.
