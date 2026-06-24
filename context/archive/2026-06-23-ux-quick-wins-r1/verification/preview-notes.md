# UI verification notes — ux-quick-wins-r1

The interactive preview harness can't run in this environment (the local node/rollup
build issue), so each UI-visible change is verified by code trace + unit tests + the
production build. No screenshots; these notes are the proof of what was checked.

## Phase 1 — deviation threshold 25%
- **Screen/route**: captain submit `/captain-v2` (ProductCard pill).
- **Check**: `compute.ts` gate is `absDeviation > 25`; pill state mirrors the backend
  `_evaluate_submit_line` gate (`delta_pct > 0.25`).
- **Verified by**: `compute.test.ts` (22% → yellow/no-reason; 26% → red/requiresReason)
  + backend `test_queue_deviation_threshold_is_25pct`. Both suites green.

## Phase 2 — no-baseline copy
- **Screens**: captain submit pill (`compute.ts`/ProductCard), captain order detail
  `/captain-v2/orders/:id` (`OrderDetailPage.tsx`), manager line table
  (`OrderLineTable.tsx`).
- **Check**: when `suggested_qty_purchase === 0`, the pill uses
  `state.noBaseline{No,}Reason` (no `{pct}` interpolation), and the two bare-% cells
  render `t("deviation.noBaseline")` ("brak bazy") instead of a large/∞ %.
- **Verified by**: `compute.test.ts` asserts `messageVars.pct` is undefined for
  suggestion-0 rows (so "+∞%" cannot render); inline guards traced at both detail/table
  sites. Build + lint green (new i18n keys typecheck as `StringKey`).

## Phase 3 — variance hue ≠ deviation hue
- **Screens**: receiving `/captain-v2/orders/:id/receive` (`ReceiptLineCard.tsx`),
  order detail receipt section (`OrderDetailPage.tsx`).
- **Check**: variance now `text-sky-700` (over) / `text-indigo-700` (under); deviation
  stays `text-orange-700`/`text-red-700`. The two no longer share a hue on one screen.
- **Verified by**: `grep` confirms `.text-sky-700` + `.text-indigo-700` are JIT-compiled
  into `dist/assets/*.css`; source grep confirms both variance sites use sky/indigo.

## Phase 4 — recount gate at receiving
- **Screen**: `/captain-v2/orders/:id/receive`.
- **Checks**:
  1. On load, `delivered` is seeded `""` for every line (was `effectiveOrderedQtyPurchase`)
     → all fields start blank with a "Wpisz ilość" placeholder.
  2. The submit button is disabled until every line has a value
     (`!receiptSaved && !allLinesEntered`), and `handleSubmit` also bails with
     `delivery.allLinesRequired` if any line is blank (defense-in-depth) — no line is
     silently defaulted to the ordered qty (the old `: effectiveOrderedQtyPurchase(l)`
     fallback was removed; blanks are blocked, entered values sent via `Number(v)`).
  3. A one-tap "= zamówione" button fills that line with `ordered`
     (`onChange(line.order_line_id, ordered)`); `DecimalInput` reseeds its buffer on the
     external value change, so the field shows the value and stays overridable.
  4. Post-save lock + photo retry intact: `receiptSaved` still drives `readOnly`, the
     green lock banner, and the retry-photos path (which skips the recount gate because
     quantities are already committed). The "= zamówione" button is hidden when
     `readOnly`.
- **Verified by**: code trace of `ReceiveDeliveryPage.tsx` + `ReceiptLineCard.tsx`;
  build + lint green. (No unit harness exists for these components yet — pre-existing.)

## Phase 5 — order-history nav
- **Screen**: every captain-v2 screen (`CaptainTabs.tsx`, under the brand header).
- **Check**: a persistent third tab "Historia" (lucide `History` icon) links to
  `/captain-v2/orders`; active-state split so Historia owns `/captain-v2/orders…`,
  Inventory owns `/captain-v2/inventory…`, and the submit tab owns the bare `/captain-v2`.
  Reaches order history (and receipts, via order detail) in one tap from any screen.
- **Verified by**: code trace; build + lint green. Existing hamburger + inline history
  affordances left intact (plan scope: redundant discoverability is harmless).

## Residual note
Three tabs now share the `flex-1` strip; labels (Zamówienia / Historia / Remanent) fit
the existing layout. Worth an eyeball on a ~380px device during live verification, but no
overflow is expected (icons are 16px, labels ≤10 chars).
