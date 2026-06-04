# Pita Bros Supply OS v1 — Wola Pilot Workspace

Project workspace for the Captain-submits / Manager-dispatches order workflow,
piloted at **Wola** with one supplier and ~20 products.

## Documents in this folder

- [BRIEF.md](BRIEF.md) — Problem, user, solution, scope, success metrics
- [DATA_MODEL.md](DATA_MODEL.md) — 7 tables, columns, conversion logic
- [SHEETS_SCHEMA.md](SHEETS_SCHEMA.md) — Google Sheets backbone structure
- [MANAGER_DASHBOARD_SPEC.md](MANAGER_DASHBOARD_SPEC.md) — Dashboard view, actions, mockup brief
- [ROADMAP.md](ROADMAP.md) — Phase 1 (now) and Phases 2–4 (postponed; nothing removed)

## Source spec

`/Users/ben/Downloads/Pita_Bros_Supply_OS_v1_Handoff_Cutoff_Spec.md`

This workspace narrows the source spec into the smallest end-to-end vertical
slice that solves the Manager's send-order pain. **Every other spec item is
preserved in [ROADMAP.md](ROADMAP.md) under "Postponed."** Nothing is removed.

## Language convention

- All system text, field names, status codes, reason codes: **English**.
- Product names and units (e.g., "Halloumi", "karton", "kg"): **Polish** (kept
  as they appear in GoStock and on supplier invoices).

## Pilot footprint

| Item            | Value                                                        |
| --------------- | ------------------------------------------------------------ |
| Location        | Wola (`WOLA`)                                                |
| Suppliers       | 1 (TBD — needs to be picked)                                 |
| Products        | ~20 (TBD — should include 2–3 packaged-unit items like Halloumi, Suwlaki, plus stable items) |
| Users (Captain) | 1 (Wola Captain)                                             |
| Users (Manager) | 1 (one person from management/office dispatching all orders) |
| Data backbone   | Google Sheets (shared via Drive)                             |
| Mockup tool     | Claude artifact (HTML/CSS, iterable)                         |
| Send channel    | Gmail draft (one supplier email-based for v0)                |

## Lane

- Worktree: `.claude/worktrees/romantic-elbakyan-3d712b`
- Branch: `claude/romantic-elbakyan-3d712b`
- Owner: Ben (CFO/CTO) + Claude

## Open decisions (next slice)

1. Pick the v0 supplier for Wola.
2. Confirm the ~20 v0 products with their `inventory_unit` and `purchase_unit`.
3. Choose the Google Drive folder where the master Sheet lives.
4. Decide who plays "Manager" role for v0 dispatch (you, Manager Bro, or Office Bro).
