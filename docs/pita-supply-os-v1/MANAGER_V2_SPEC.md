All four key critique points are confirmed against source:

- **GAP 1**: PATCH would inherit no concurrency guard (`update_order` only guards `manager_sent→manager_sent`; `update_order_lines` has none).
- **GAP 3**: `main.py:1217` writes `manager_comment = final.manager_comment` which defaults to `""` (`models.py:173`) — partial payloads wipe comments.
- **GAP 4**: `suppliers.csv` has no `portal_url` or `phone` column; `email=TBD` for Coca-Cola. The `cchbcshop.com` URL is asserted, not in seed/config.
- **GAP 5**: dispatch default `sent_method="gmail"` while `ordering_method` enum uses `email`.

I have everything needed. Producing the final spec markdown body incorporating all eight gaps, with a precise backend exists-vs-add section and a concrete G1–G4+ phased build order.

# Manager Dashboard v2 — Spec (Phase G)

Successor to the minimal `Przejmij / Odrzuć / Zamów` queue
(`frontend/src/pages/ManagerPage.tsx`, Phase F3) and the original v0 mockup spec
(`MANAGER_DASHBOARD_SPEC.md`). This document defines the **richer manager UI** the
operator actually needs: review every line of every order, change the decision,
save it (`manager_final`) *without* dispatching, see the captain↔manager
deviation, then dispatch through the correct channel with a preview-and-editable
email.

> **Continuity note.** v0 imagined a two-pane review screen with editable manager
> quantities and a Gmail draft preview. F3 shipped only the state machine +
> one-click confirm. v2 (Phase G) finally builds the review screen and adds:
> persisted manager edits *before* dispatch, an **editable** email body,
> channel-aware dispatch (email / Coca-Cola portal / phone / manual), and an
> order-history view.

> **Grounding discipline.** Every "already backed" claim in §6 was verified
> against source. Where a fact is *not* grounded in code/config/seed (notably the
> Coca-Cola portal URL and per-manager identity), it is labelled **UNVERIFIED**
> and must be confirmed with the operator before the relevant phase ships. Do not
> treat placeholders as facts.

---

## 1. Goals

1. **See everything.** For a claimed order, show every line with full context:
   product, units, current stock, target, suggestion, what the point asked for
   (`captain_final`), what the manager will order (`manager_final`), both deltas,
   reason code, and both comments.
2. **Change and save the decision.** The manager edits `manager_final_qty` and
   `manager_comment` per line. The change is **persisted** (`manager_final`) and
   survives reload — *without* forcing an immediate dispatch.
3. **Surface the captain↔manager deviation.** Make it obvious where the manager
   overrode the point's request, by how much, and why.
4. **Dispatch with a human-reviewable artifact.** Preview the supplier email,
   **edit the body inline**, then send to Gmail or copy to clipboard.
5. **Be channel-aware.** Email suppliers → Gmail compose / clipboard; Coca-Cola →
   portal link + copy list (manual); phone supplier → show the number; internal →
   manual mark. Never pretend a portal/phone order went out by email.
6. **Recent orders (history).** A read-only list of already-dispatched orders.
   Lower priority — ships last (G4).

### Non-goals (unchanged from v0)

- No receiving / WZ photos, no GoStock files, no analytics/trends.
- No auto-send. Dispatch always produces a draft / link / number for a human.
- No multi-location consolidation. WOLA only in v0 (queue call is already
  hardcoded to `WOLA`; keep that until multi-location is a real requirement).
- No real per-manager identity (see §9, edge case 8). `manager_user` is a single
  shared proxy today.

---

## 2. Two deviation axes — name them explicitly

The backend already tracks **one** delta; v2 introduces a **second**. Do not
conflate them.

- **`delta_vs_suggestion_pct`** (already on `OrderLine`, computed at submit/edit):
  `captain_final` vs the system `suggested`. This is the *captain's* deviation
  from the algorithm. It drives `deviation_count` / `reason_count` badges and the
  >20%-needs-a-reason gate. **Already fully backed.**
- **`delta_manager_vs_captain`** (NEW, v2, frontend-computed, **not** persisted as
  a column): `manager_final` vs `captain_final`. This is the *manager's* override
  of what the point asked for — the operator's headline requirement ("track
  deviations between what the point wants and what the manager orders"). Computed
  live in the UI; the underlying numbers (`captain_final_qty_purchase`,
  `manager_final_qty_purchase`) are both persisted, so the delta is always
  re-derivable and never needs its own sheet column.

Formula (UI):
```
delta_manager_vs_captain_pct =
  (manager_final_qty_purchase - captain_final_qty_purchase)
  / max(captain_final_qty_purchase, 1)
```
Display as signed % with the absolute purchase-unit difference in a tooltip
(e.g. `+50% (+1 karton)`).

---

## 3. Layout — two-pane

Desktop-first (manager works on a laptop). Target ≥1024px; below that the right
pane stacks under the queue. Keep the existing blue header strip + toast.

```
┌───────────────────────────────────────────────────────────────────────────┐
│  PITA BROS — Manager Dispatch        Today: Fri 2026-05-29   [Odśwież][Wyloguj]│
├──────────────────────────┬────────────────────────────────────────────────┤
│  QUEUE (left, ~360px)    │  ORDER DETAIL (right, fills rest)                │
│                          │                                                  │
│  ▸ Do przejęcia (2)      │  WOLA → Pago      ORD-…-PAGO-0af7   [status pill]│
│   ┌────────────────────┐ │  Captain submitted 09:30 · cutoff Tue 14:00      │
│   │ WOLA → Pago        │ │  Delivery requested: 2026-05-30                  │
│   │ 18 linii · 1 240 zł│ │ ┌──────────────────────────────────────────────┐│
│   │ 2 odchyl · 1 powód │ │ │ PER-LINE EDIT TABLE (section 4)              ││
│   │ cutoff za 5h       │ │ │                                              ││
│   └────────────────────┘ │ └──────────────────────────────────────────────┘│
│                          │  Manager summary: 3 zmiany vs kapitan, +180 zł   │
│  ▸ W realizacji (1)      │ ┌──────────────────────────────────────────────┐│
│   ┌────────────────────┐ │ │ DISPATCH PANEL (section 5)                   ││
│   │ WOLA → Bukat  ⏳    │ │ │ channel-aware: email / portal / phone / manual││
│   └────────────────────┘ │ └──────────────────────────────────────────────┘│
│                          │                                                  │
│  ▸ Zamówione (history)   │                                                  │
└──────────────────────────┴────────────────────────────────────────────────┘
```

### Left pane — queue

Three collapsible groups, each backed by one `GET /api/manager/queue` call with a
different `status` (exactly as today):

- **Do przejęcia** — `status=captain_submitted`. Action: select → open detail
  read-only with a prominent **Przejmij** (claim) button.
- **W realizacji** — `status=manager_claimed`. Action: select → open detail in
  **edit mode**. This is the working set.
- **Zamówione** — `status=manager_sent`. Read-only history (§7).

Card content is already supplied by `ManagerQueueItem`: location → supplier name,
`line_count`, `total_value_estimate_pln`, `deviation_count`, `reason_count`,
`cutoff_iso`, `last_edited_at` (edited badge), `captain_submitted_at`. Sort is
already correct server-side (urgent-first for pending; for `manager_sent` the sort
key is `captain_submitted_at` as a proxy — see §7). Keep the 60s auto-refresh.

Selecting a card loads detail via `GET /api/manager/order/{id}`. The currently
selected card is highlighted; selection survives the 60s refresh.

### Right pane — order detail

Header band: `location_name → supplier_name`, `order_id` (mono), status pill,
`captain_submitted_at`, `cutoff_iso` (red if past), `requested_delivery_date`,
order `notes`. If status is `captain_submitted`, the only enabled action is
**Przejmij** — the table renders read-only. Editing requires claiming first
(matches the backend gate: dispatch / line-edit require `manager_claimed`).

---

## 4. Per-line editing table

The heart of the screen. One row per `ManagerOrderLineDetail` (all fields already
returned by `GET /api/manager/order/{id}`).

| Col | Source field | Editable | Notes |
|-----|--------------|----------|-------|
| Produkt | `product_name_pl` + `is_critical` badge | no | critical = red dot |
| Jedn. | `purchase_unit` (with `inventory_unit` + `units_per_purchase_unit` in tooltip) | no | |
| Stan | `current_stock_qty_base` | no | inventory unit |
| Cel | `target_stock_qty_base` | no | |
| Sugestia | `suggested_qty_purchase` (base in tooltip) | no | the algorithm |
| **Punkt chce** | `captain_final_qty_purchase` | no | what the point asked for |
| Δ vs sug. | `delta_vs_suggestion_pct` + `reason_code` | no | captain's deviation (§2) |
| **Manager zamawia** | `manager_final_qty_purchase` | **YES** | number stepper, ≥0 |
| **Δ vs punkt** | computed (§2) | no | manager's override, signed |
| Komentarz mgr | `manager_comment` | **YES** | short text |
| Komentarz kpt | `captain_comment` | no | tooltip/expand |

### Edit semantics

- **Default value of "Manager zamawia"** = `manager_final_qty_purchase` if it is
  > 0 (already saved earlier), else `captain_final_qty_purchase`. This mirrors
  `gmail_url._effective_qty` exactly, so the email and the table never disagree.
- Editing a cell recomputes **Δ vs punkt** live and re-colors the row.
- Setting `manager_final = 0` means "don't order this line" — it is dropped from
  the email body (the existing `_effective_qty > 0` filter already does this).
  Show such rows struck-through, not hidden, so the manager sees the decision.
- `manager_comment` is free text, soft-capped (e.g. 200 chars).
- A line is "dirty" once the manager touches qty or comment. Dirty count feeds the
  **Manager summary** strip ("3 zmiany vs kapitan, wartość +180 zł").

### Read-modify-write rule (prevents comment data loss — see §6 add #1, GAP-fix)

Whenever the UI sends a line to **any** write endpoint (PATCH save *or* dispatch),
it MUST send the **current** value of *both* `manager_final_qty_purchase` *and*
`manager_comment` for that line — never a partial payload. The backend overwrites
`manager_comment` with whatever the payload carries (`main.py:1217`,
`OrderLineManagerFinal.manager_comment` defaults to `""`), so a qty-only edit that
omits the comment would **silently wipe a previously-saved comment**. The frontend
is the single read-modify-write owner: load detail → mutate in memory → send the
full current line state for every touched line.

### Row color coding

Driven by **Δ vs punkt** (manager override), which is the v2 headline. Keep the
captain-deviation reason badge inline in the "Δ vs sug." column so both axes are
visible at once.

- Neutral (white): `manager_final == captain_final` (manager agrees with point).
- Blue tint: manager **changed** the line (any non-zero override) — the thing the
  operator wants to see at a glance.
- Amber: `manager_final == 0` (line cancelled by manager).
- The old red/orange "captain deviation without reason" state is **not possible
  here**: submit/edit already reject >20% captain deviations without a reason, so
  by the time a manager sees a line it is audit-clean on the captain axis.

### Validation before dispatch

- At least one line with effective qty > 0 (else the Gmail builder raises
  `ValueError` → 400; pre-empt it in the UI and disable **Zamów**).
- No hard gate on manager override size in v0 (the manager is the authority).
  Optional soft warning if a manager override exceeds, say, 50% — non-blocking.

---

## 5. Dispatch panel — channel-aware

The panel renders differently based on `supplier.ordering_method`
(`email | portal | phone | manual`). The dashboard must **never** offer an email
send for a portal/phone supplier — that was the v0 footgun.

`ordering_method` is on the `Supplier` model (`models.py:60`) and in `types.ts`,
but is **not** currently returned by `GET /api/manager/order/{id}`
(`ManagerOrderDetail` carries `supplier_email` only). See §6 add #2.

### `sent_method` ↔ `ordering_method` mapping (resolves naming mismatch — GAP-fix)

Today the request default is `sent_method="gmail"` (`models.py:179`) and F3
hardcodes `sent_method: "gmail"` (`ManagerPage.tsx:105`), but the
`ordering_method` enum uses `email` (not `gmail`). v2 fixes this by defining one
explicit mapping the UI must apply when building the dispatch payload:

| `ordering_method` | `sent_method` value sent |
|-------------------|--------------------------|
| `email` | `"email"` |
| `portal` | `"portal"` |
| `phone` | `"phone"` |
| `manual` | `"manual"` |

`sent_method` is the **transport actually used** and is persisted to
`orders.sent_method` for audit. The legacy `"gmail"` default and F3's hardcoded
`"gmail"` MUST change to `"email"`; the backend default in `ManagerDispatchRequest`
should also become `"email"` so a defaulted dispatch is consistent with the enum.

### 5a. `email` (Pago, Bukat, Eurofood, Filber, Intermlecz, Kuchnie Świata, Blue Service)

```
┌─ Wysyłka: e-mail do dostawcy ──────────────────────────────────────────────┐
│ Do:      zamowienia@pago.pl                          (from supplier.email)  │
│ Temat:   Zamowienie ORD-… - Pago - dostawa 2026-05-30        [edytowalny]   │
│ Treść:   ┌──────────────────────────────────────────────────────────────┐  │
│          │ Dzien dobry,                                                  │  │
│          │ Prosze o przygotowanie zamowienia:                            │  │
│          │ 1. | Souvlaki Kurczak | 3 karton                              │  │
│          │ …                                                             │  │
│          │ (fully editable <textarea>, seeded from the generated body)   │  │
│          └──────────────────────────────────────────────────────────────┘  │
│ [Otwórz w Gmail ▸]   [Kopiuj treść]   [Kopiuj adres]                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

Behaviour:

- **Preview is generated client-side** from the current `manager_final` quantities
  + subject rule, so the manager sees exactly what will be sent and can edit it
  *before* committing. The body generator mirrors `gmail_url._build_body` (Polish
  plaintext, `Lp. | Produkt | Ilosc`, skip qty 0, total + address + delivery-date
  footer). Port that to a shared TS helper.
- **Edited body is the source of truth for the link** (approach 4(b), see §6 add
  #4): the frontend builds the final Gmail compose URL from the edited text and the
  dispatch call is used only for the state write-back. The current backend
  `dispatch` *rebuilds* the body server-side and ignores edits, so honoring the
  manager's edits requires the frontend to own the URL.
- **Otwórz w Gmail** — render as a real `<a href>` the manager clicks (never
  `window.open`; F3 already learned popup blockers eat compose opens). Clicking it
  triggers the dispatch state write.
- **Kopiuj treść / Kopiuj adres** — clipboard fallback for when the manager prefers
  their own mail client or the URL exceeds `MAX_GMAIL_URL_LENGTH = 8000`
  (`gmail_url.py:23`). When the body exceeds the limit, hide "Otwórz w Gmail", keep
  copy-to-clipboard, and show a hint.

> **URL-validity invariant tradeoff (approach 4(b), GAP-fix).** Today the backend
> builds the URL *first* and refuses to write `manager_sent` if it would fail —
> "state on disk should never be `manager_sent` without a usable URL"
> (`main.py:1245-1256`). Moving URL construction into the browser **drops that
> server-side guarantee**: the dispatch call would mark `manager_sent` even if no
> valid URL was produced. v2 accepts this tradeoff *only* if the frontend
> re-implements the 8000-char length check (and the body builder + URL-encoding) in
> TS and keeps them in sync with the Python original, **and** the UI is solely
> responsible for never invoking dispatch unless a usable URL or clipboard fallback
> exists. If we are unwilling to own that invariant client-side, fall back to
> approach 4(a) (backend keeps building/validating the URL from an accepted
> `email_body` override). This is a real safety regression vs. the current backend
> and must be a conscious choice, not a silent simplification.

### 5b. `portal` (Coca-Cola — `SUP_COCACOLA`, `email=TBD` in seed)

No email. Render:

```
┌─ Wysyłka: portal dostawcy (ręcznie) ───────────────────────────────────────┐
│ Coca-Cola zamawia się przez portal — system nie wysyła automatycznie.       │
│ [Otwórz portal Coca-Cola ▸]  → {supplier.ordering_url}                      │
│ Lista do przepisania:                                                       │
│   ┌──────────────────────────────────────────────────────────────────┐     │
│   │ Produkt              | Ilość        | (kod dostawcy jeśli jest)    │     │
│   │ Coca-Cola 0.5 PET    | 5 zgrzewek   | …                            │     │
│   └──────────────────────────────────────────────────────────────────┘     │
│ [Kopiuj listę]        [Oznacz jako zamówione ✓]                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Portal URL is UNVERIFIED.** The string `https://cchbcshop.com/websitePL/en/`
  appears nowhere in code, config, or seed — `suppliers.csv` has no portal-URL
  column and Coca-Cola's `email=TBD`. Earlier drafts presented it as fact; it is
  not grounded. Two acceptable resolutions, in order of preference:
  1. **(Preferred, matches repo "no hardcoded magic" style)** Add an `ordering_url`
     column to `suppliers` (+ model + types + the detail join, §6 add #6) and source
     the link from master data. The UI renders whatever master data provides; the
     URL never lives in code.
  2. **(Interim)** Render a placeholder labelled "URL do potwierdzenia z operatorem"
     and gate it behind operator confirmation before G3 ships. Do not ship a
     guessed live URL.
- Copy-paste table uses the same `manager_final` qty (with `supplier_product_name`
  / supplier code where available) so the manager retypes nothing they can copy.
- **Oznacz jako zamówione** is the explicit state write: the manager confirms they
  placed the order on the portal → order goes `manager_sent` with
  `sent_method="portal"`. The payload sends the **full effective line set** (each
  line defaulting to `captain_final` if untouched) so it satisfies the dispatch
  endpoint's `min_length=1` requirement (GAP-fix, see §6 add #3) — never an empty
  array.

### 5c. `phone` (Kamino — `SUP_KAMINO`)

```
┌─ Wysyłka: telefon ─────────────────────────────────────────────────────────┐
│ Kamino zamawia się telefonicznie.                                           │
│ ☎ +48 … (tel: link)     [Skopiuj listę do odczytania]                       │
│ [Oznacz jako zamówione ✓]  → sent_method="phone"                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

- Phone number: there is **no `phone` column** in the supplier schema today
  (`suppliers.csv` columns: `supplier_id, supplier_name, email, ordering_method,
  delivery_days, cutoff_time, minimum_order_value_pln, active, notes`). v0 fallback:
  surface `supplier.notes`; add a dedicated `phone` field later (§6 add #6,
  optional). Show a `tel:` link when a number is known, else show "brak numeru —
  uzupełnij w master data".
- The "Oznacz jako zamówione" payload follows the same full-line-set rule as portal
  (§5b), `sent_method="phone"`.

### 5d. `manual` (`SUP_INTERNAL`)

Internal production — should not normally reach this queue. If it does, show an
info note and a **Oznacz jako zamówione** with `sent_method="manual"` (full line
set, no email, no portal).

---

## 6. Backend: what exists vs what to add

Two halves below, each line tagged with the source location verified.

### A) Already supported — no backend work needed

| Capability | Where (verified) |
|------------|------------------|
| Queue, 3 statuses, all badge counts, cutoff, server-side sort | `GET /api/manager/queue?status=…`, `main.py:595-621` |
| Full order detail with **every** field the table needs (`captain_final_qty_purchase`, `manager_final_qty_purchase`, `delta_vs_suggestion_pct`, `reason_code`, both comments, `purchase_unit`, `units_per_purchase_unit`, `price_estimate_pln`, `supplier_email`) | `GET /api/manager/order/{id}` → `ManagerOrderLineDetail`, `main.py:624-699` |
| Claim / release state machine with optimistic-concurrency re-reads | `POST /api/manager/claim/{id}`, `POST /api/manager/release/{id}` |
| Dispatch + per-line write-back + Gmail URL (persists `manager_final_qty_purchase`/`_base` + `manager_comment`, flips to `manager_sent`, stamps `manager_sent_at`/`sent_method`/`total_value_estimate_pln`, returns compose URL) | `POST /api/manager/dispatch`, `main.py:1148-1284` |
| Sheet columns `order_lines.manager_final_qty_purchase`, `manager_final_qty_base`, `manager_comment`; `orders.sent_method` | `models.py:134` + `order_lines` schema |
| Generic per-cell batch writers reusable for save-without-dispatch | `sheets.update_order_lines` (`sheets.py:551`), `sheets.update_order` (`sheets.py:496`) |
| `_effective_qty` (manager_final if >0 else captain_final), 8000-char guard, no-email/empty/too-long `ValueError` | `gmail_url.py:23,31-35,141-169` |
| `ordering_method` enum (`email\|portal\|phone\|manual`) on the Supplier model + TS types | `models.py:60`, `types.ts:21,41` |

> **Net: no new sheet columns are required for the must-haves.**
> Save-without-dispatch reuses the existing `manager_final*`/`manager_comment`
> columns; channel-aware dispatch reuses `orders.sent_method`. Adds 1–5 below are
> endpoint/model-level. Only the optional add #6 (phone / portal-URL columns) and
> deferred body persistence touch the schema.

### B) Needs adding — concrete, ordered by phase

1. **Save manager edits WITHOUT dispatch — `PATCH /api/manager/order/{order_id}`
   (the central v2 gap).** Today the *only* path that writes `manager_final` to the
   sheet is `dispatch`, which force-flips status to `manager_sent` (verified:
   `main.py:1148-1284`; no standalone save path exists). The operator wants to
   review/change and **save** across sessions before sending.
   - **Body:** reuse `list[OrderLineManagerFinal]` (`order_line_id`,
     `manager_final_qty_purchase`, `manager_comment`). Apply the §4 read-modify-write
     rule: the UI always sends the **full current** qty *and* comment per touched
     line (prevents the comment-clobber data-loss path at `main.py:1217`).
   - **Implementation:** compute `manager_final_qty_base = qty * units_per_pu`
     (resolve via `supplier_products`, same as dispatch), call
     `sheets.update_order_lines(order_id, line_updates)`, recompute + write
     `total_value_estimate_pln`, and **leave status `manager_claimed`**.
   - **Concurrency (GAP-fix — do NOT assume dispatch's guard applies).**
     `update_order`'s `OrderAlreadyDispatchedError` fires *only* on a
     `manager_sent → manager_sent` transition (`sheets.py:521`), and
     `update_order_lines` has **no status guard at all** — it matches purely by line
     id (`sheets.py:551-609`). So a PATCH that keeps `manager_claimed` inherits
     **zero** protection, and a concurrent dispatch could flip the order to
     `manager_sent` while PATCH silently overwrites the dispatched line quantities.
     The PATCH endpoint MUST do its own preflight: `invalidate_cache("orders")` →
     re-read the order → **reject with 409 if status != `manager_claimed`** before
     writing lines. A narrow TOCTOU window remains (no row-level lock in Sheets);
     accept it explicitly, or, to close it, add an optional `expected_status` guard
     inside `update_order_lines`. Document the residual race in the spec rather than
     implying the existing mechanism covers PATCH.
   - **Empty-payload / `min_length` (GAP-fix):** decide PATCH semantics for "I
     cleared all my edits." Recommended: PATCH accepts an empty array as a no-op (do
     NOT reuse dispatch's `min_length=1` constraint on PATCH), or document that
     clearing requires re-sending each line at its `captain_final` default.

2. **Expose `ordering_method` on order detail.** `ManagerOrderDetail` carries
   `supplier_email` only (`main.py:682-698`, `models.py:237-254`) — it does **not**
   return `ordering_method`, so the dispatch panel can't branch. Add
   `ordering_method` (and ideally `supplier_notes`) to `ManagerOrderDetail`;
   the `suppliers_by_id` lookup is already present in `manager_order_detail`. Mirror
   in `types.ts`.

3. **Make dispatch channel-agnostic.** `POST /api/manager/dispatch`
   **hard-requires `supplier.email`** (400 at `main.py:1187-1194`) and
   *unconditionally* builds the Gmail URL (`main.py:1247-1256`). For
   `portal`/`phone`/`manual` that is wrong.
   - Only build/require the Gmail URL when `ordering_method == "email"`. For other
     methods, skip the URL, still write `manager_final` + status + `sent_method` from
     the request, and return `gmail_compose_url=null`.
   - Make `ManagerDispatchResponse.gmail_compose_url` `Optional[str]` (currently
     `str` at `models.py:185`).
   - Change the request default `sent_method` from `"gmail"` to `"email"` and have
     the UI send the §5 mapping values.
   - Keep `manager_finals` non-empty: portal/phone "mark ordered" sends the full
     effective line set (GAP-fix, §5b), so `min_length=1` is satisfied without a
     real email.

4. **Editable email body — decision.**
   - **(Recommended, v0) Frontend owns the final URL (approach 4(b)).** Dispatch
     becomes purely a state write-back (`manager_final` + status + `sent_method`);
     the **manager-edited** body is turned into the Gmail compose URL **in the
     browser** and opened via a clicked `<a>`. No body persistence. Honors edits
     exactly and keeps URL-length handling client-side. **Tradeoff (must accept
     explicitly):** this drops the server-side "no `manager_sent` without a usable
     URL" invariant (`main.py:1245`) and requires re-implementing the 8000-char check
     + body builder + encoding in TS, kept in sync with the Python original (see §5a
     callout).
   - **(Alternative, approach 4(a))** Backend accepts optional
     `email_subject`/`email_body` overrides on the dispatch request and uses them
     instead of regenerating; `gmail_url.build_draft_url` accepts a pre-built body.
     Slightly more work, but **preserves** the server-side URL-validity invariant.
     Prefer this if we are unwilling to own the invariant client-side.
   - **Body persistence** is *not* required by stated needs and there is no
     `email_body` column today. **Defer.** If audit later wants "what exactly did we
     email", add `orders.email_body_sent`.

5. **No-op confirmed — no extra sheet columns for must-haves.** (Adds 1–4 are
   endpoint/model-level only.)

6. **Optional master-data columns (schema touch — deferred unless §5b/§5c block).**
   - `suppliers.ordering_url` — to ground the Coca-Cola portal link in master data
     instead of code (resolves the UNVERIFIED URL, §5b). Preferred over hardcoding.
   - `suppliers.phone` — dedicated phone column for `phone` suppliers (§5c);
     otherwise read from `notes`. Lowest-effort path defers this until there is more
     than one phone supplier.

---

## 7. Recent orders (history) — lower priority (G4)

Read-only. Backed entirely by existing endpoints —
`GET /api/manager/queue?status=manager_sent` for the list +
`GET /api/manager/order/{id}` for detail.

- List shows: location → supplier, dispatched date, line count, total,
  `sent_method`. **Caveat (verified):** the `manager_sent` queue sort key is
  `captain_submitted_at`, used as a *proxy* for dispatch time (`main.py:613-620`) —
  there is no `manager_sent_at` sort today. If precise dispatch-time ordering is
  wanted, surface `manager_sent_at` via the detail call or add it to
  `ManagerQueueItem`.
- Detail renders the same table **read-only**, showing the final `manager_final`
  quantities and both Δ axes for audit.
- Re-opening the email link is **session-only** today (F3 keeps compose URLs in
  React state, lost on reload). With frontend-built URLs (approach 4(b)) v2 can
  regenerate the Gmail link on demand from the persisted `manager_final` — no extra
  backend. A side-benefit of approach 4(b).
- **Audit-value caveat:** until real per-manager auth lands (§9 edge case 8),
  history cannot attribute "who dispatched" beyond the shared `manager-default`
  proxy.

---

## 8. States & transitions (recap, enforced by backend)

```
captain_submitted ──Przejmij (claim)──▶ manager_claimed ──Zamów (dispatch)──▶ manager_sent
        ▲                                     │
        └──────── Odrzuć do poprawy (release)─┘   (PATCH save: stays manager_claimed)
```

- **Read-only** when `captain_submitted` (must claim to edit) and when
  `manager_sent` (done). Editable only in `manager_claimed`.
- **Concurrency is NOT uniform across transitions (corrected).** `claim`,
  `release`, and `dispatch` do a forced cache-invalidate + re-read before writing,
  and dispatch's `OrderAlreadyDispatchedError` guard covers the
  `manager_sent` transition. The **new PATCH save does not inherit any of this** —
  it must do its own preflight + 409 (see §6 add #1). Earlier drafts that claimed
  "all transitions already guard, PATCH does the same" were factually wrong about
  the existing mechanism.
- **Save-then-release behavior (specify, GAP-fix).** `release` does **not** clear
  `manager_final` line values. So if a manager PATCH-saves edits then releases the
  order to `captain_submitted`, the saved `manager_final` quantities **persist on
  the line rows**, and a later re-claim defaults "Manager zamawia" to those stale
  values via `_effective_qty`. v2 chooses **persist-through-release** (drafts
  survive a bounce) — surface a note on re-claim ("wcześniejsze zmiany managera
  zachowane") so it is not surprising. If the operator prefers discard-on-release,
  that is a separate `release` change, out of scope for G2.

### UI state per pane

- **Loading**: skeleton rows in the table; queue cards show spinner.
- **No selection**: right pane shows an empty hint ("Wybierz zamówienie z kolejki").
- **Empty queue group**: dashed empty card (as today).
- **Saving / dispatching**: disable the table + dispatch buttons, show inline
  "Pracuję…" (reuse the F3 pattern); re-enable on toast.
- **Dirty unsaved edits**: a sticky "Zapisz zmiany" affordance; warn on navigating
  away with unsaved manager edits.

---

## 9. Edge cases

1. **Order claimed, captain can't edit** — already enforced (captain PATCH requires
   `captain_submitted`, `main.py:913`). Detail shows captain values as read-only
   history.
2. **Concurrent dispatch / already sent** — `update_order` raises
   `OrderAlreadyDispatchedError` → 409 (`sheets.py:521-533`). UI shows "już wysłane
   gdzie indziej", refreshes the queue, returns to read-only.
3. **Concurrent PATCH save while another actor dispatches** — PATCH's own preflight
   (§6 add #1) rejects with 409 if status is no longer `manager_claimed`; UI
   refreshes detail. Residual TOCTOU window acknowledged.
4. **Stale selection after refresh** — if the selected order changed status (e.g.
   released back), re-fetch detail; if it 404s, clear selection with a toast.
5. **All lines set to 0 by manager** — block dispatch (no orderable lines), surface
   "Zamówienie puste — co najmniej jedna pozycja > 0". For portal/phone, "Oznacz
   jako zamówione" sends the full effective line set, so an all-zero order is still
   blocked client-side rather than 422-ing on `min_length`.
6. **Gmail URL too long (>8000 chars)** — hide "Otwórz w Gmail", keep "Kopiuj
   treść", show hint. Pago (18 lines) is well under; large Intermlecz orders (26
   SKUs) are the realistic trigger. With approach 4(b) the **frontend** owns this
   check (the server guard is bypassed — §5a).
7. **Supplier has `ordering_method=email` but no email** — data error (Coca-Cola
   even has `email=TBD` but is `portal`, so this is mainly a guardrail). Show a
   blocking note "brak adresu e-mail w master data" with copy-to-clipboard fallback;
   do not silently 400.
8. **No real per-manager identity (UNVERIFIED guarantee).** `manager_user` is a
   hardcoded proxy `"manager-default"` (`main.py:1267`); two human managers are
   indistinguishable to the backend. "Claimed by *this* manager" framing is
   aspirational — claim/save attribution and history's "who did it" cannot be
   enforced until real manager auth lands. Affects cases 1, 3, and §7 audit value.
   Spec must not promise per-manager guarantees in v2.
9. **Past cutoff** — card + header show red "po cutoff"; dispatch still allowed
   (manager judgment), optionally with a confirm.
10. **Seed backend / sheet not configured** — detail + dispatch already 503 in
    non-sheet mode; queue returns `[]`. UI degrades to the existing graceful
    empty/error states.

---

## 10. Phased build order

Ship in thin, independently-testable slices. Each slice keeps the app working.

**G1 — Two-pane shell + read-only detail table (frontend only).**
Replace the card-list `ManagerPage` with queue-left / detail-right. Wire
`managerQueue` (3 statuses) + `managerOrder`. Render the full per-line table
**read-only**, both Δ axes (Δ vs punkt computed client-side). Keep claim / release
/ dispatch-as-is buttons working through the new shell. *No backend change.* Big UX
win, de-risks the layout, ships first.

**G2 — Editable manager qty + save-without-dispatch (the core).**
- Backend: add `PATCH /api/manager/order/{id}` (add #1) **including its own 409
  preflight (GAP 1 fix) and the read-modify-write comment contract (GAP 3 fix)** —
  these are data-loss bugs the moment PATCH persists comments, so they land *in*
  G2, not deferred.
- Frontend: make "Manager zamawia" + "Komentarz mgr" editable, live Δ recompute,
  dirty tracking, "Zapisz zmiany"; always send full qty+comment per touched line.
  Delivers the operator's core "review, change, **save**" requirement, persisting
  `manager_final` independent of dispatch.

**G3 — Channel-aware dispatch + editable email.**
- Backend: expose `ordering_method` (add #2); make dispatch channel-agnostic +
  `gmail_compose_url` Optional + `sent_method` default `"email"` (add #3). Optional:
  `suppliers.ordering_url` for the portal link if we ground it in master data (add
  #6).
- Frontend: dispatch panel branches email / portal / phone / manual using the §5
  `sent_method` mapping (replaces F3's hardcoded `"gmail"`); editable email body via
  the shared TS body-builder; frontend-built Gmail URL with client-side 8000-char
  check (approach 4(b), accepting the §5a invariant tradeoff); copy-to-clipboard;
  Coca-Cola portal link (UNVERIFIED URL confirmed with operator or sourced from
  `ordering_url` *before* this ships); phone number from notes.
- Closes the dispatch requirement.

**G4 — Recent orders (history).**
Read-only `manager_sent` list + read-only detail + on-demand email-link
regeneration. Pure frontend on existing endpoints (plus optional `manager_sent_at`
surfacing for precise ordering, §7).

**Deferred / optional (post-G):** `suppliers.phone` column, `orders.email_body_sent`
persistence, multi-location queue (drop the hardcoded `WOLA`), soft warning on large
manager overrides, real per-manager auth (unblocks §9 case 8 audit guarantees),
closing the PATCH TOCTOU window with a row-level `expected_status` guard.

---

## 11. i18n / copy

Extend the existing `manager.*` keys in `frontend/src/i18n/strings.ts`. New keys
(PL primary, EN secondary): detail header labels, table column headers,
`manager.deltaVsCaptain`, `manager.save` / `manager.saved`,
`manager.dispatch.email|portal|phone|manual`, `manager.openGmail`,
`manager.copyBody`, `manager.copyList`, `manager.copyAddress`, `manager.openPortal`,
`manager.markOrdered`, `manager.emptyOrder`, `manager.urlTooLong`, `manager.noEmail`,
`manager.unsavedWarning`, `manager.draftKeptAfterRelease`, `manager.portalUrlTbd`.
Reuse existing `claim/release/dispatch/working/openEmail` keys.

---

## 12. Acceptance criteria

- [ ] Manager opens a `manager_claimed` order and sees **every** line with
      captain-wants / manager-orders / both deltas / reason / comments.
- [ ] Manager changes a `manager_final` qty and a comment, clicks Save, reloads, and
      the change persists (status still `manager_claimed`).
- [ ] A qty-only edit does **not** wipe a previously-saved `manager_comment` (full
      read-modify-write payload verified).
- [ ] A concurrent dispatch during a PATCH save yields a 409, not a silent
      overwrite of dispatched quantities.
- [ ] Δ vs punkt updates live and re-colors the row as the manager edits.
- [ ] For an email supplier, the manager previews the body, **edits it**, opens
      Gmail with the edited text, OR copies it to clipboard; URL >8000 chars hides
      the Gmail button and keeps copy.
- [ ] For Coca-Cola, no email is offered; the portal link (sourced from master data
      or an operator-confirmed value, **not** a guessed URL) opens and "Oznacz jako
      zamówione" moves the order to `manager_sent` with `sent_method="portal"`.
- [ ] For Kamino (phone), the number/notes show and the order can be marked ordered
      with `sent_method="phone"`.
- [ ] Dispatch is blocked when all lines are 0; portal/phone "mark ordered" sends a
      non-empty line set (no 422 on `min_length`); 409 on concurrent dispatch is
      handled gracefully.
- [ ] `sent_method` written to the sheet matches the §5 mapping
      (`email/portal/phone/manual`), not the legacy `"gmail"`.
- [ ] Zamówione (history) lists sent orders read-only with their final quantities
      and `sent_method`.
