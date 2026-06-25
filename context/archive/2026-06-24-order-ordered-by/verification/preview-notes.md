# UI Preview Notes — order-ordered-by

The browser preview harness is **not available in this environment**, so UI behavior was
verified statically: production `tsc -b && vite build` passes (types + bundle clean),
ESLint clean, 77 vitest tests pass, and the rendering logic was traced in source. A live
browser check on the deployed build is left for the operator (this project verifies on
prod, per house practice). Below: what was verified, and the manual checklist to confirm
on the deployed bundle.

## Screen 1 — Captain submit (`/captain-v2`, `CaptainMP.tsx`)

**Verified in source + build:**
- New required field **"Kto zamawia / Who orders"** rendered above the product list:
  label with a red `*`, `<input type="text" id="order-ordered-by">`, helper line
  "Wymagane przed wysłaniem / Required before sending". Copy via
  `t("captain.orderedByLabel|Placeholder|Required")` (PL+EN present in `strings.ts`).
- Submit is **disabled while the name is blank** (`StickyActionBar` `orderedByMissing`
  folded into `submitDisabled`); when stock is filled but the name is blank the bar shows
  the required-hint instead of the green "ready" state. Matches the
  `InventoryCountPage` / `ReceiveDeliveryPage` disabled-button pattern.
- On submit, the request carries `ordered_by: orderedBy.trim()` (via `apiClient.captainSubmit`).
- `orderedBy` persists across suppliers in one session (not cleared on submit).

**Manual checks to confirm on the deployed build:**
- [ ] The "Kto zamawia" field appears above the products; PL and EN both render (toggle language).
- [ ] Submit button is greyed/disabled until a name is typed; typing a name enables it.
- [ ] Submitting with a name succeeds; the order reaches the Manager queue.
- [ ] (Direct check) submitting via API without `ordered_by` returns a localized 422 ("Kto zamawia").

## Screen 2 — Manager queue + detail (`/manager`, `ManagerQueue.tsx` + `OrderDetailPane.tsx`)

**Verified in source + build:**
- Queue card: `{item.ordered_by && <span>{t("manager.orderedBy", { value })}</span>}` renders
  **"Zamówił: {name}"** in the bottom metadata row; omitted cleanly when absent (legacy orders).
- Detail header: `{detail.ordered_by && <span>{t("manager.detail.orderedBy", { value })}</span>}`
  renders **"Zamówił: {name}"**; omitted when absent.
- Both keys are PL+EN ("Zamówił: {value}" / "Ordered by: {value}").
- Backend round-trips the field onto both responses (covered by `test_manager_queue.py`).

**Manual checks to confirm on the deployed build:**
- [ ] An order placed with the new field shows "Zamówił: {name}" on the queue card and in the detail header.
- [ ] A legacy order (no `ordered_by`) renders with no empty "Zamówił:" artifact.

## Console / network

No live preview to capture console/network here. The production build emits no type or
lint errors; no new runtime code paths beyond conditional rendering of a string and one
extra request field.
