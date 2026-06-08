# Cluster 7 — product/correctness decisions (flagged, NOT designed away)

Surfaced by the design audit but they are **product decisions, not styling** — each needs an
owner call and its own change. Out of scope for `screens-design-audit` (plan "What We're NOT Doing").

## C7-1 — Money visibility to the Captain

- **Problem:** the Captain sees PLN totals on the orders list + detail, but the submit dialog
  *deliberately hides money* from the Captain. The policy contradicts itself.
- **Evidence:** `OrdersListPage.tsx:99`, `OrderDetailPage.tsx:100` (show PLN) vs
  `ConfirmSubmitDialog.tsx:11` (“the captain screen hides money”).
- **Options:** (a) hide PLN everywhere on the Captain side (consistent with the dialog), or
  (b) show it everywhere (drop the dialog's hide). Pick one policy and apply uniformly.

## C7-2 — “Blank = not counted, 0 = real zero” on inventory

- **Problem:** the inventory screen's core data rule (empty field ≠ a typed 0) is never explained
  in the UI. A Captain who has zero of something will likely leave it blank → the line silently
  drops from the snapshot.
- **Evidence:** `InventoryCountPage.tsx:314-318` (subtitle never states the rule); the
  `countedLines` filter + backend submit enforce `0 ≠ unknown`.
- **Options:** (a) add explicit copy + maybe a “0 / pomiń” affordance, or (b) treat blank as 0
  (changes the data model — heavier). Likely (a). Correctness-adjacent.

## C7-3 — Gmail dispatch couples “open draft” with “mark sent”

- **Problem:** the “Otwórz w Gmail” link fires the dispatch write (`onDispatch("email")`) *and*
  navigates, without `preventDefault`. A blocked popup / middle-click marks the order
  `manager_sent` with **no email opened** — a silent “ordered but never sent” against the PRD
  guardrail “no path loses the order.” This is bug-shaped, not design.
- **Evidence:** `DispatchPanel.tsx:285-287`.
- **Options:** (a) decouple — open the draft, then a separate explicit “Oznacz wysłane” confirm;
  (b) detect the popup and only mark sent on success. Prefer (a). **Highest priority of the three.**
