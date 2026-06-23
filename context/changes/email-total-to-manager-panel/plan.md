# Move the estimated total out of the supplier email into the Manager panel — Implementation Plan

## Overview

Remove the internal estimated value ("Łączna wartość szacunkowa" / `total_value_estimate_pln`) from
the supplier dispatch email, and surface it instead in the Manager order-detail panel (under the
order summary, above the action buttons). Owner decision (DEMO_FEEDBACK backlog #7): the supplier
must never see our internal value estimate; it is Manager-only.

## Current State Analysis

The total is built into the email body by **two** parallel builders that must stay in sync, and
pinned by one backend test. The Manager UI shows no absolute total today.

### Key Discoveries (from research.md):

- `frontend/src/pages/manager/lib/emailBody.ts:81-83` — the **authoritative** builder (what the
  Manager actually sends via the Gmail compose URL) appends `Laczna wartosc szacunkowa: … zl`.
- `supply-os-v1/app/gmail_url.py:101-104` — the backend builder appends the same line.
- `supply-os-v1/tests/test_gmail_url.py:214-225` — `test_build_url_body_includes_total_with_polish_decimal_comma`
  asserts the total IS in the body.
- `frontend/src/pages/manager/OrderDetailPane.tsx` — summary strip (~163-194) shows only
  `valueDeltaPln`; action buttons start ~198 (`captain_submitted`) / ~224 (`manager_claimed`).
  `order.total_value_estimate_pln` is already in scope on the `ManagerOrderDetail` prop.
- i18n namespace `manager.detail.*` in `frontend/src/i18n/strings.ts`.

## Desired End State

- The dispatch email body (sent + backend-built) contains NO estimated-total line.
- The Manager order-detail panel shows "Wartość szacunkowa: X PLN" between the summary strip and the
  action buttons, for any order whose `total_value_estimate_pln` is set; renders nothing when null.
- The backend test is inverted to guard that the total stays OUT of the email body.

Verify: open a dispatch Gmail draft from the Manager panel — body has no "Łączna wartość szacunkowa";
the panel shows the value above the buttons.

## What We're NOT Doing

- Not removing `total_value_estimate_pln` from the data model, the API responses, or the Captain's
  order views (the Captain never saw a PLN total in the sticky bar anyway, per DESIGN_HANDOFF).
- Not changing how the total is computed.
- Not touching the email subject, product lines, or any other email content.
- Not the receiving-display change (that is the separate `receiving-*` change, Bug B).

## Implementation Approach

Delete the total line from both builders in lockstep, invert the pinning test to an absence guard,
then add a small read-only value line in the Manager panel. Backend + frontend verified by their own
gates. One phase — the change is small and cohesive.

## Phase 1: Total out of the email, into the Manager panel

### Changes Required:

#### 1. Remove the total from the authoritative TS email builder

**File**: `frontend/src/pages/manager/lib/emailBody.ts`

**Intent**: Stop appending the estimated-total line to the email body the Manager sends.

**Contract**: Delete the `if (totalValuePln != null) { out.push("Laczna wartosc szacunkowa: …") }`
block (~81-83). If `totalValuePln` (and any now-unused param/import) becomes dead, remove it too so
lint stays clean. Check for and update any `emailBody` unit test asserting the total line.

#### 2. Remove the total from the backend email builder

**File**: `supply-os-v1/app/gmail_url.py`

**Intent**: Keep the backend Gmail-URL builder in sync — no estimated-total line.

**Contract**: Delete the `if order.total_value_estimate_pln is not None: body_lines.append(…)` block
(~101-104). Leave `_format_pln` if still used elsewhere; remove only if now unused.

#### 3. Invert the pinning test to an absence guard

**File**: `supply-os-v1/tests/test_gmail_url.py`

**Intent**: Turn the "total is present" assertion into a regression guard that the total is ABSENT,
so the value can't silently return to the supplier email.

**Contract**: Rename/repurpose `test_build_url_body_includes_total_with_polish_decimal_comma` to
assert the formatted total (and the "wartosc szacunkowa" label) is NOT in the decoded body. Keep the
Polish-decimal order fixture so the test still exercises a real total value.

#### 4. Show the value in the Manager panel

**File**: `frontend/src/pages/manager/OrderDetailPane.tsx`

**Intent**: Render the estimated value where the Manager (not the supplier) sees it — under the order
summary, above the action buttons.

**Contract**: Between the summary strip (~194) and the first button block (~197-198), add a read-only
line that renders `t("manager.detail.totalValue", { value: order.total_value_estimate_pln.toFixed(2) })`
only when `order.total_value_estimate_pln != null`. Match the surrounding muted/summary styling.

#### 5. i18n key

**File**: `frontend/src/i18n/strings.ts`

**Intent**: Label copy (PL/EN) for the panel value.

**Contract**: Add `"manager.detail.totalValue": { pl: "Wartość szacunkowa: {value} PLN", en: "Estimated value: {value} PLN" }`.

### Success Criteria:

#### Automated Verification:

- Backend tests pass (incl. the inverted gmail_url test): `cd supply-os-v1 && python -m pytest`
- Frontend build/type-check passes: `PATH=/opt/homebrew/bin:$PATH npm run build`
- Frontend lint passes: `PATH=/opt/homebrew/bin:$PATH npm run lint`
- Frontend unit tests pass: `PATH=/opt/homebrew/bin:$PATH npm run test`

#### Manual Verification:

- Open a dispatch Gmail draft from the Manager panel (do NOT send — inspect the draft only; **never
  place a real supplier order from a test**): the body has NO "Łączna wartość szacunkowa" line.
- The Manager order-detail panel shows "Wartość szacunkowa: X PLN" between the summary and the action
  buttons; an order with no total shows no line.
- The supplier email otherwise looks unchanged (subject, product lines intact).

**Implementation Note**: After automated checks pass, pause for manual confirmation before the
phase-end commit.

## Testing Strategy

### Unit Tests:
- Backend: the inverted `test_gmail_url` (total absent); existing gmail_url body tests still pass.
- Frontend: any `emailBody` test updated to not expect the total.

### Manual Testing Steps:
1. As Manager, claim + open the dispatch panel for a test order; open the Gmail draft; confirm the
   body has no estimated total. Back out (do not send).
2. Confirm the panel shows "Wartość szacunkowa: …" above the action buttons.

## Migration Notes

None — no data/schema change.

## References

- Research: `context/changes/email-total-to-manager-panel/research.md`
- Leak sites: `frontend/src/pages/manager/lib/emailBody.ts:81`, `supply-os-v1/app/gmail_url.py:101`
- Panel: `frontend/src/pages/manager/OrderDetailPane.tsx:~197`
- Feedback: `docs/pita-supply-os-v1/DEMO_FEEDBACK.md` (backlog #7)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Total out of the email, into the Manager panel

#### Automated

- [x] 1.1 Backend tests pass (incl. inverted gmail_url test): `cd supply-os-v1 && python -m pytest`
- [x] 1.2 Frontend build/type-check passes: `PATH=/opt/homebrew/bin:$PATH npm run build`
- [x] 1.3 Frontend lint passes: `PATH=/opt/homebrew/bin:$PATH npm run lint`
- [x] 1.4 Frontend unit tests pass: `PATH=/opt/homebrew/bin:$PATH npm run test`

#### Manual

- [ ] 1.5 Dispatch Gmail draft body has NO estimated-total line (inspect draft, do not send)
- [ ] 1.6 Manager panel shows "Wartość szacunkowa: X PLN" above the action buttons
- [ ] 1.7 Order with no total shows no value line; rest of the email unchanged
