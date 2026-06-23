# Demo Feedback Log — Pita Supply OS

Living log of operator (owner) feedback from live in-store demos. Each round records
verbatim feedback, what was confirmed working, and the bugs/asks it produced — grounded
to `file:line` so each item can become a change.

---

## Round 3 — 2026-06-23 (post-deploy verification of `order-qty-display`)

Owner verified `order-qty-display` live (effective-qty + manager hint + received overlay + rounding
all working). Two follow-ups raised → both shipped same day:

- **A — supplier email leaks the estimated value** (Round-1 backlog #7). → change **`email-total-to-manager-panel`**
  (live): removed "Łączna wartość szacunkowa" from BOTH email builders (`emailBody.ts` + `gmail_url.py`),
  added "Wartość szacunkowa: X PLN" to the Manager panel above the action buttons; inverted the
  backend test to guard it stays out.
- **B — receiving "shows wrong"**: Awokado captain-ordered 3 → manager 2 → received 3, but the
  order-detail headline showed a big "2" (ordered). → change **`receiving-received-headline`** (live):
  post-delivery the line now leads with the **received** qty ("Dostarczono" label), with
  "Zamówiono: X · Różnica: Y" (from the receipt snapshot) as a labeled secondary; pre-delivery the
  ordered headline is now labeled too. Resolved research inconsistencies 1–4 (see the change's
  `research.md`).

**Deferred receiving backlog (research §5, not yet built):** Manager has no visibility of received
qty / variance / discrepancies (learning-loop gap); the receive screen pre-fills delivered = ordered
with no recount gate; variance colour overlaps the deviation-% colour. Separate future changes.

## Round 2 — 2026-06-23 (post-deploy verification of `demo-blocker-decimals-save`)

Owner ran the live link (`pita-supply-os.vercel.app`, Captain + Manager on phone) after the
decimal-comma + receipt-save-lock fix shipped. Verdict: **"prawie wszystko działa"** (almost
everything works).

### ✅ Confirmed working live (closes `demo-blocker-decimals-save`)

- Decimal commas accepted on phone (Cytryna `0,6` → suggestion `1,4`, target 2 kg).
- Comma-entered order now reaches the Manager queue.
- Inventory + receipt inputs accept commas.
- Manager edit-qty accepts decimals (`0,6` / `1,8`).
- Receipt confirmation: quantities lock after save; only WZ photos remain (photo retry no
  longer drops edits).

### 🐞 Bug A — Captain order detail shows captain qty, not the manager's final

> "jak idę potwierdzić zamówienie, to pojawia mi się 1,4 kg, mimo że u managera zmieniłem na
> 1,8 kg i zapisałem przed wysłaniem … po zapisaniu Cytryna nadal jest 1,4."

- **Symptom:** Manager changed Cytryna `1.4 → 1.8` and dispatched. The Captain's order-detail
  card still shows **1.4 kg**. The "Confirm delivery" screen correctly shows **1.8** ordered.
- **Root cause:** [OrderDetailPage.tsx:190](../../frontend/src/pages/captain-mp/OrderDetailPage.tsx)
  hardcodes `line.captain_final_qty_purchase`. It never falls back to `manager_final_qty_purchase`.
- **The rule already exists, twice:** `effectiveManagerQtyPurchase`
  ([managerLine.ts:21](../../frontend/src/pages/manager/lib/managerLine.ts)) and `effectiveOrdered`
  ([ReceiveDeliveryPage.tsx:22](../../frontend/src/pages/captain-mp/ReceiveDeliveryPage.tsx)) —
  both = `manager_final if > 0 else captain_final`, mirroring backend `gmail_url._effective_qty`.
  The order-detail card is the one place that didn't get it.
- **Fix:** one shared `effectiveOrderedQtyPurchase(line)` helper; reuse in all three places;
  order-detail card displays the effective qty. Data is correct (receipt proves 1.8 persisted) —
  this is **display only**.
- **Scope extension (from Item C clarification):** the order-detail view must also surface the
  **received** qty per line once a receipt exists. Today the receipt box only shows a "confirmed +
  photo" banner ([OrderDetailPage.tsx:236-293](../../frontend/src/pages/captain-mp/OrderDetailPage.tsx)),
  not the per-line `received_qty_purchase` / variance. So after the full cycle (captain 1.4 →
  manager 1.8 → received 2.2) the Captain never sees the corrected numbers on the main view.
  Pull `api.receipt(receipt_id)` (`ReceiptDetail` has per-line received + variance) and overlay it
  on the matching lines. Still display-only, no backend change.

### 🐞 Bug B — Float-precision quantities in the variance display

> "Dodałem 2,2 do 2,2, i ta różnica po przecinku itd. jest tragiczna. Musisz zaokrąglić do
> … dwóch miejsc po przecinku."

- **Symptom:** Delivered 2.2 vs ordered 1.8 → "Różnica: **+0.40000000000000013 kg**".
- **Root cause:** [ReceiptLineCard.tsx:27](../../frontend/src/pages/captain-mp/components/ReceiptLineCard.tsx)
  computes `Number(delivered) - ordered` and prints it raw (binary float artifact).
- **Fix:** shared `roundQty(n)` (round to 2 dp, trim trailing zeros) applied to the variance
  (and any other computed-qty display). Owner asked for 2 dp.

### ✔️ Item C — CLARIFIED → folded into Bug A (not a missing-action bug)

> "po przyjęciu i zmianie tego przyjęcia zamówienie cały czas wyglądało tak samo … na pierwszym
> widoku jest stara wartość, potem jak wchodzę w [dostawę] pojawia się nowa wartość edytowana
> przez menadżera … po przyjęciu poprawnie się przyjmuje ze zdjęciem, natomiast nie ma poprawionej
> wartości produktu."

- **Not** about a missing receiving entry point. The complaint is the **frozen first view**: the
  order-detail screen keeps showing the captain's original number while the manager's final (and
  later the received qty) only appear on the receive screen. → this is exactly **Bug A** + its
  scope extension above.
- **Verify during implement:** owner also said edits made on the receive screen "nie zapisują
  progresu" before final submit. The receipt itself saves correctly (with photo) — confirm there's
  no edit-loss in the receive flow *distinct from* the intended post-save lock (Phase 2). Likely
  just the display, but repro before closing.

---

## Round 1 — M-01 in-store demo (~11 items)

Captured earlier; items #1 (decimal commas) + #2 (receipt-edit save loss) were the P0 blockers
→ shipped as `demo-blocker-decimals-save` (validated in Round 2 above). Remaining backlog,
each a candidate change (not yet started):

1. Deviation threshold too low — raise 20% → **25%** (owner: "-17% dla cebuli, minimum 25%").
2. Supplier email leaks "Łączna wartość szacunkowa" — value should be **Manager-panel only**.
3. Supplier email needs the **exact delivery address**.
4. **Name field on orders** (who placed it) — mandatory.
5. **Add-product to an order** — both Manager and Captain.
6. **Variable targets by day of week** (avocado 4; salad/arugula vary weekday vs weekend).
7. **Bucket units** (tzatziki) — kg → wiadro 3 kg / 6 kg, "co 6"; ∞-deviation copy on bucket lines.
8. **Order history more visible** (hamburger nav).

(Concurrent master-data work is also in flight — e.g. Halloumi counted in pcs not kg, #12.)
