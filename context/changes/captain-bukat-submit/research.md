---
date: 2026-06-05T15:30:55Z
researcher: Claude Opus (10x-research)
git_commit: c78ad6d
branch: main
repository: beniamin-openclaw/pita-supply-os
topic: "S-01 — Captain submits a Bukat order with visible suggestion math: validate existing capability against Bukat data + find Bukat-specific gaps"
tags: [research, codebase, captain-submit, bukat, frontend, suggestion-engine, S-01]
status: complete
last_updated: 2026-06-05
last_updated_by: Claude Opus (10x-research)
---

# Research: S-01 Captain submits a Bukat order with visible suggestion math

**Date**: 2026-06-05T15:30:55Z
**Researcher**: Claude Opus (10x-research)
**Git Commit**: c78ad6d (local; 2 commits unpushed — GitHub permalinks omitted, file:line refs are local)
**Branch**: main
**Repository**: beniamin-openclaw/pita-supply-os

## Research Question

S-01 (`captain-bukat-submit`): "Captain selects supplier **Bukat**, sees Wola product lines, enters current stock, reviews suggestion math, sets final purchase qty (with reason where deviation rules apply), and submits so the order lands on the Manager queue same-day." The roadmap frames it as *largely validation of existing capability against Bukat data*. Map what already exists (backend + both captain UIs + tests) and identify any **Bukat-specific gaps** that block the slice.

## Summary

**The backend, data, and the live captain UI are already Bukat-capable end-to-end. There is exactly ONE real change needed for a clean S-01, and it is in the frontend.**

- **Live pilot route** is `/captain-v2` → `CaptainMP.tsx` (and `/` redirects there). It selects suppliers dynamically — **no Pago hardcoding** on the live path.
- **Backend submit is fully supplier-agnostic** — no supplier is special-cased; Bukat validates/persists identically to Pago. F-01 (archived 2026-06-05) made Bukat data correct: `SUP_BUKAT` active, 14 `supplier_products`, 14/14 WOLA `location_product_settings` join cleanly → 14 orderable lines.
- **THE GAP (Tier A):** `CaptainMP.tsx` auto-selects `suppliers[0]`, which in CSV order is `SUP_BLUESERV` — a supplier with **0 orderable lines at WOLA**. So a captain opening the pilot screen lands on an **empty** "Brak produktów" view and must manually tap the Bukat chip every time. The supplier picker also shows ~5 suppliers that resolve to empty product lists. This is a UX/correctness-of-default gap, not a backend blocker.
- **Everything else Pago-related is cosmetic/legacy:** the `SUP_PAGO` hardcodes live only on the unrouted-for-pilot `/captain` placeholder and the unlinked `/debug` page, plus two doc comments.
- **Safety net is thin:** backend has good generic pytest coverage (all fixtures use `SUP_PAGO`, none use Bukat); the frontend has **no test runner at all**; there is **no product CI** (local `pytest` is the only gate); and the backend test suite has a known order-dependence risk (no `conftest.py`).

## Detailed Findings

### Live route & the two captain UIs

- `/captain-v2` → `CaptainMP.tsx` is the **production pilot** route; `/` redirects to it (`frontend/src/App.tsx:40`, `:50-55`).
- `/captain` → `CaptainPage.tsx` is a **legacy placeholder** (its own header says "placeholder"); routed but not the pilot (`App.tsx:42-47`).
- `/debug` → `DebugPage.tsx` is an **unlinked diagnostic** page, no auth gate (`App.tsx:97`).

### Backend captain-submit surface (supplier-agnostic)

- `GET /api/captain/orderable` (`supply-os-v1/app/main.py:132-151`): `supplier_id` is a pure query param; location is derived from the captain token (`require_captain`, `app/auth.py:52-85`; dev fallback returns `WOLA` when tokens empty, `auth.py:66`). Orderable = `supplier_products` for that supplier **intersected** with this location's `location_product_settings` (`main.py:146-150`). No `active` filtering on supplier/supplier_product (operator responsibility).
- `POST /api/captain/suggest` (`main.py:154-188`): preview only; delegates to `compute_suggestion` (`app/suggestion.py:73-110`).
- `POST /api/captain/submit` (`main.py:279-435`): ordered validation gates — (1) unknown supplier → 400 (`_resolve_master_data`, `main.py:223-242`); per line: (2a) supplier_product orderable, (2b) product exists, (2c) location_product_setting exists, (2d) supplier_product↔product mapping, (2e) compute suggestion using the SupplierProduct's `rounding_rule`, (2f) critical under-order without `reason_code` → 400, (2g) >20% deviation without `reason_code` → 400, (2h) >20% deviation WITH reason → warning. Order id `ORD-YYYYMMDD-<LOC3>-<SUP4>-<6hex>` (`main.py:245-251`).
- **Persistence caveat (matters for "appears on Manager queue"):** `_choose_backend()` returns `sheets` only when `DATA_BACKEND=sheet` AND configured, else `seed_loader` (`main.py:193-202`). In **seed mode the submit is NOT persisted** — `_persist_order` returns False and a warning "Order was not persisted (read-only backend)" is appended (`main.py:254-276`, `:424-427`); the Manager queue then returns `[]` (`main.py:550-554`). So end-to-end "order lands on the queue" requires **sheet mode** (prod is sheet mode).
- No supplier id is defaulted/hardcoded anywhere in `app/`. Bukat is not special-cased.

### Live captain-mp flow (CaptainMP.tsx) — stock → suggestion → submit

- **Supplier selection**: `SupplierPicker.tsx:40-84` renders supplier chips; `activeSupplierId` drives it; chosen id flows straight into `api.orderable()` / `api.captainSubmit()`. **No hardcoded supplier.**
- **Default selection (THE GAP)**: `CaptainMP.tsx:77-81` does `setActiveSupplierId(suppliers[0].supplier_id)`. Suppliers arrive in CSV order (`/api/suppliers` is an unsorted raw read, `main.py:96-97`, `seed_loader.py:76`), so index 0 = `SUP_BLUESERV`. Verified WOLA orderable-line counts: BLUESERV **0**, BUKAT **14**, COCACOLA 0, EUROFOOD 0, FILBER 3, INTERMLECZ 28, KUCHNIE 1, PAGO 6, INTERNAL 0. → default landing screen is empty.
- **Picker shows empty suppliers**: `CaptainMP.tsx:60` filters only `s.active` (all 10 are active); zero-product suppliers still render as chips (`SupplierPicker.tsx`).
- **Stock entry**: numeric input per `ProductCard.tsx:150-177` → `line.current_stock_qty_base`.
- **Visible math (Tier-1)**: `lib/compute.ts:7-14` computes `suggestedBase = max(0, target - current)`, `suggestedPurchase = ceil(suggestedBase / units_per_purchase_unit)`, displayed as "need {base} {unit} → {purchase} {purchaseUnit}" (`ProductCard.tsx:215-220`). Note: the frontend preview **always ceils (full_only)**; the backend recomputes authoritatively per `rounding_rule`. For Bukat (all SKUs default `full_only`) the two agree — but this is a latent divergence point tied to S-09 (sub-kg rounding).
- **Deviation state machine**: `compute.ts:39-117` → green/yellow/orange/red/grey + `requiresReason`. Red (>20% deviation or critical-zero without reason) **blocks** submit; critical-missing is a **non-blocking** amber warning with "Wyślij mimo to".
- **Reason/comment**: `ReasonPicker.tsx` shown when `requiresReason`; comment required when reason = `OTHER`.
- **Draft persistence**: `auth.ts:79-126` (`saveDraft`/`loadDraft`/`clearDraft`, 24h TTL) + `CaptainMP.tsx:132-140` (500ms debounce auto-save) + resume banner (`:315-342`). Satisfies the PRD NFR "no entered stock lost mid-submit."
- **Submit**: `CaptainMP.tsx:183-228` builds payload (drops lines with empty stock/qty), calls `api.captainSubmit({supplier_id: activeSupplierId, requested_delivery_date, lines, notes})`, toasts success, clears draft, auto-advances to next un-submitted supplier.
- **i18n**: all captain copy via `useT()` / `src/i18n/strings.ts`; **no hardcoded supplier names** (supplier names come from the API). Compliant with the frontend rule.

### Pago references (the gap-hunt, ranked)

- **Tier A — must decide for S-01 (live code):** `CaptainMP.tsx:77-81` default `suppliers[0]` (→ BlueServ, empty). Optionally `CaptainMP.tsx:60` / `SupplierPicker.tsx` (zero-product suppliers shown).
- **Tier B — cosmetic/legacy (does NOT block S-01):** `CaptainPage.tsx:16` `useState("SUP_PAGO")` (legacy `/captain`); `DebugPage.tsx:22` `?supplier_id=SUP_PAGO` (unlinked `/debug`); `apiClient.ts:5` comment; `models.py:234` stale comment "(Tue 14:00 dla Pago)".
- **Tier C — already-OK (Bukat wired):** `suppliers.csv:3` SUP_BUKAT active + email; `supplier_products.csv:42-55` 14 rows active; 14/14 WOLA settings join; `/api/suppliers` returns Bukat selectable; submit path supplier-agnostic.

### Tests / safety net

- `tests/test_captain_submit.py` (18 tests) covers every gate: unknown supplier/product, orderable, location setting, critical under-order ±reason, >20% deviation ±reason, auth, location-from-auth, seed-vs-sheet persistence, order_id format, total. **All fixtures use `SUP_PAGO`; none use `SUP_BUKAT`.**
- `tests/test_suggestion.py` (9 tests) strongly covers the visible-math contract (rounding rules, packaging overage, fractional units, IEEE-754 cleanup, explanation text). This is the Tier-1 guardrail.
- `tests/test_captain_orders.py` (own-orders/edit) is mock-driven, `SUP_PAGO`.
- **No `tests/conftest.py`** → order-dependence risk (lesson "tests must be order-independent"): per-file `os.environ.setdefault` can lose to an earlier `app.config` import.
- **No product CI** (`.github/workflows` doesn't run `supply-os-v1`/`frontend`) — local `python -m pytest` is the only gate (lesson "verify CI actually runs the product's tests").
- **Frontend has no test runner** at all (AGENTS.md: "add Vitest before relying on the agent to verify UI changes") — so the `CaptainMP.tsx` default-selection change has zero automated frontend coverage today.

## Code References

- `frontend/src/App.tsx:40,50-55` — `/captain-v2` → CaptainMP (live pilot); `/` redirect
- `frontend/src/App.tsx:42-47,97` — `/captain` (legacy CaptainPage), `/debug` (DebugPage)
- `frontend/src/pages/captain-mp/CaptainMP.tsx:77-81` — **default `suppliers[0]` selection (the gap)**
- `frontend/src/pages/captain-mp/CaptainMP.tsx:60` — supplier filter (only `s.active`)
- `frontend/src/pages/captain-mp/CaptainMP.tsx:183-228` — submit handler + payload build
- `frontend/src/pages/captain-mp/components/SupplierPicker.tsx:40-84` — supplier chip selection
- `frontend/src/pages/captain-mp/components/ProductCard.tsx:150-177,215-220` — stock input + visible-math display
- `frontend/src/pages/captain-mp/lib/compute.ts:7-14,39-117` — suggestion math + deviation state machine
- `frontend/src/auth.ts:79-126` — draft persistence (24h TTL)
- `frontend/src/pages/CaptainPage.tsx:16` — legacy `SUP_PAGO` default
- `frontend/src/pages/DebugPage.tsx:22` — debug `SUP_PAGO`
- `supply-os-v1/app/main.py:132-151` — `captain_orderable`
- `supply-os-v1/app/main.py:279-435` — `captain_submit` (validation gates + persistence)
- `supply-os-v1/app/main.py:193-202,254-276` — `_choose_backend` + `_persist_order` (seed = no persist)
- `supply-os-v1/app/main.py:528-554` — manager queue returns `[]` in seed mode
- `supply-os-v1/app/auth.py:52-85` — `require_captain` (token→location; WOLA dev fallback)
- `supply-os-v1/app/suggestion.py:73-110` — `compute_suggestion` (backend source of truth)
- `supply-os-v1/tests/test_captain_submit.py` — 18 gate tests (SUP_PAGO fixtures)
- `supply-os-v1/tests/test_suggestion.py` — 9 visible-math tests
- `docs/pita-supply-os-v1/seed/suppliers.csv:3` — SUP_BUKAT (active, email, Mon–Sat 16:00)
- `docs/pita-supply-os-v1/seed/supplier_products.csv:42-55` — 14 Bukat rows

## Architecture Insights

- **Supplier is data, not code.** The whole captain path keys off `supplier_id` as a runtime value; "switch the pilot to Bukat" is fundamentally a data + default-selection concern, not a code-branching one. The only place code *assumes* a supplier is the frontend default `suppliers[0]`.
- **Two sources of the suggestion number.** Frontend `compute.ts` (always-ceil preview) and backend `suggestion.py` (rounding_rule-aware, authoritative on submit). They agree for Bukat today; divergence only appears once S-09 introduces sub-unit rounding — keep them in sync or have the UI defer to `/api/captain/suggest`.
- **Seed vs sheet is the demo boundary.** "Appears on the Manager queue" only holds in sheet mode; seed mode submits in-memory and the queue is empty. Validating S-01 end-to-end means sheet mode + submit-and-back-out (never a real order).
- **The data-layer seam holds.** Submit persists only via `_choose_backend()` → no route imports a backend directly (lesson respected).

## Historical Context (from prior changes)

- `context/archive/2026-06-05-bukat-master-data-ready/audit.md` (F-01, prerequisite — **done**): 8-cell Bukat diff applied to seed + live sheet; suggestions re-validated; closed Open Roadmap Q2. Residual P009/P010 over-max warning is cosmetic, deferred to S-09.
- `context/archive/2026-06-05-inventory-count/` (S-06): added the captain-mp inventory screen; closeout lesson "tests must be order-independent (conftest, not per-file)" — directly applies to any S-01 test work.
- `app/main.py` phase tags: C3 (`/api/captain/submit`), E3 (own-orders/edit), D0 (manager queue) — S-01 is the C3 surface validated against Bukat; E3 edit is out of scope.
- Roadmap S-01 risk: visible-math is **Tier-1 (must not regress)**; "**No real supplier order is placed by submit**"; capability "present in the baseline."

## Related Research

- `context/archive/2026-06-05-bukat-master-data-ready/audit.md` — the Bukat data baseline S-01 depends on.
- (No prior `research.md` for the captain-submit surface; this is the first.)

## Open Questions

1. **Default supplier behaviour** — pick the fix for the Tier-A gap: (a) explicitly default-select Bukat, (b) reorder/curate the supplier list so the pilot supplier is first, or (c) hide/skip suppliers with 0 orderable lines at the location. (a) is the most pilot-focused; (c) is the most general. A plan-level decision.
2. **Scope of S-01** — thin (just fix the default so the Bukat flow is reachable + a manual sheet-mode smoke) vs broader (also retire the `CaptainPage`/`DebugPage` Pago hardcodes + add a Bukat submit test). Roadmap says "validation of existing capability," favouring thin.
3. **Test strategy** — add a Bukat-fixture backend test for submit? And/or introduce `conftest.py` to kill the order-dependence risk while we're here? Frontend has no runner, so the default-selection change can't be unit-tested without first adding Vitest (likely out of scope — manual verification instead).
4. **Frontend/backend suggestion parity** — leave the always-ceil preview as-is for S-01 (fine for Bukat) and revisit under S-09, or note it explicitly in the plan as a known divergence.
