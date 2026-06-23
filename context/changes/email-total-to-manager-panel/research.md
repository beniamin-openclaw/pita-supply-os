---
date: 2026-06-23
researcher: Claude (Opus 4.8)
git_commit: b5ca36e
branch: claude/exciting-curie-e20933
repository: pita-supply-os
topic: "Move the estimated total out of the supplier dispatch email into the Manager panel"
tags: [research, dispatch-email, manager-ui, gmail_url, emailBody]
status: complete
last_updated: 2026-06-23
last_updated_by: Claude (Opus 4.8)
---

# Research: Move the estimated total out of the supplier email into the Manager panel

## Research Question

The supplier dispatch email leaks our internal estimated value ("Łączna wartość szacunkowa" /
`total_value_estimate_pln`). The owner wants it removed from the email and shown instead in the
Manager order-detail panel (under the order summary, above the action buttons). Where exactly does
it leak, what test pins it, and where does it go in the Manager UI?

## Summary

The total leaks through **two** independent email-body builders that must stay in sync:
- **Frontend `emailBody.ts`** — the *authoritative* builder; this is what the Manager actually sends
  (the Gmail compose URL the dispatch panel opens).
- **Backend `gmail_url.py`** — a parallel builder used by `manager_dispatch` to build a server-side
  Gmail URL.

One backend test asserts the total is present and must be updated. The Manager UI shows **no**
absolute total today (only a `valueDeltaPln` change-vs-captain). The value field is already in scope
on `ManagerOrderDetail`, so surfacing it in `OrderDetailPane.tsx` is a pure add.

## Detailed Findings

### Where the total leaks (remove from both)

- **`frontend/src/pages/manager/lib/emailBody.ts:81-83`** — authoritative builder (what's sent):
  ```ts
  if (totalValuePln != null) {
    out.push(`Laczna wartosc szacunkowa: ${formatPln(totalValuePln)} zl`);
  }
  ```
- **`supply-os-v1/app/gmail_url.py:101-104`** — backend builder:
  ```python
  if order.total_value_estimate_pln is not None:
      body_lines.append(
          f"Laczna wartosc szacunkowa: {_format_pln(order.total_value_estimate_pln)} zl"
      )
  ```
- The total is in the **body only** (not the subject) in both.

### Test that pins it

- **`supply-os-v1/tests/test_gmail_url.py:214-225`** — `test_build_url_body_includes_total_with_polish_decimal_comma`
  asserts `"668,00 zl" in body`. Must be updated to assert the total is **absent** (invert the
  intent) rather than deleted outright, so we keep a regression guard against the value reappearing.

### Where it goes (Manager panel)

- **`frontend/src/pages/manager/OrderDetailPane.tsx`** renders the summary strip (≈ lines 163-194,
  shows `valueDeltaPln`, not the absolute total) and then the action buttons:
  - `captain_submitted` block ≈ line 198 (Przejmij ≈ 207, Anuluj ≈ 214)
  - `manager_claimed` block ≈ line 224 (Odrzuć ≈ 228, Anuluj ≈ 236, `<DispatchPanel>` ≈ 245)
- **Insertion point**: ≈ line 197, after the summary strip and before the first button block.
- `order.total_value_estimate_pln` is already on the `ManagerOrderDetail` the component receives
  (no new fetch). It may be `null` → render nothing when absent.

### i18n

- **`frontend/src/i18n/strings.ts`** — follow the `manager.detail.*` namespace (e.g.
  `manager.detail.submitted`, `manager.detail.delivery` ≈ lines 383-387). Closest value formatter:
  `orders.detail.total` (`"Wartość: {value} PLN"`, line 523). Add
  `manager.detail.totalValue`: `{ pl: "Wartość szacunkowa: {value} PLN", en: "Estimated value: {value} PLN" }`.

## Architecture Insights

- Two email builders is a known duplication seam (the F1-style "keep the two in sync" pattern). Any
  change to the dispatch email body MUST touch both `emailBody.ts` and `gmail_url.py` or they drift —
  the TS one is what the Manager actually sends; the Python one backs `manager_dispatch`.
- `DESIGN_HANDOFF.md` explicitly forbids showing monetary value in the **Captain** submit sticky bar,
  but never specified the **Manager** email — so the total's presence there is an undocumented default,
  not a deliberate decision. Removing it aligns the email with the "supplier sees no internal value"
  intent.

## Historical Context (from prior changes)

- `docs/pita-supply-os-v1/DEMO_FEEDBACK.md` (Round 1 backlog item #2/#7) records the explicit
  owner decision: *"Supplier email leaks 'Łączna wartość szacunkowa' — value should be Manager-panel
  only."* Not yet implemented; this change implements it.
- `context/archive/2026-06-07-dispatch-email-content/` touched the email subject + product-name
  format only — it never touched the total line. No prior change addresses this.

## Open Questions

- None blocking. Minor: keep the regression test as an **absence** assertion (recommended) vs delete
  it — decided in the plan (keep-as-absence).
