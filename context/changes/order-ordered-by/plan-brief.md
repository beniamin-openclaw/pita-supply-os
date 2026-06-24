# Order `ordered_by` ("who orders") — Plan Brief

> Full plan: `context/changes/order-ordered-by/plan.md`

## What & Why

Captain orders are currently anonymous (only a location proxy is recorded). This change adds a REQUIRED free-text "who orders" (`ordered_by`) captured at submit and shown to the Manager in the queue and order detail — so the Manager knows which person placed each order. It copies the proven `received_by` (Receipt) / `count_user` (InventoryCount) pattern.

## Starting Point

`CaptainSubmitRequest` has no attribution field. Two sibling flows already collect a required name and store it as an optional model field; the Captain submit screen builds its request in `CaptainMP.tsx handleSubmit`; the Manager already renders optional metadata on the queue card and detail header.

## Desired End State

Submitting without `ordered_by` → 422; a valid submit stores it; the Captain screen has a required "Kto zamawia / Who orders" field that blocks submit until filled; the Manager sees "Zamówił: {name}" on the queue card and in the detail header. Tests green, frontend build+lint green.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Field shape | Required on input (`min_length=1`), `Optional` on stored model | Mirrors `received_by`/`count_user`; legacy rows stay valid | Plan (spec) |
| Seed `orders.csv` edit | **Dropped** | No `orders.csv` exists; `seed_loader` has no orders path (seed is read-only) | Plan (research) |
| Supabase round-trip | Add `"ordered_by"` to `_ORDER_COLUMNS` only | Reads auto-pick via `SELECT *`; writes are gated by that list | Plan (research) |
| Sheets round-trip | No source edit; update write-test mock header | `_model_to_row` uses the live sheet header; optional field never trips header validation | Plan (research) |
| Prod migration | Create `0005_add_ordered_by.sql`, do NOT apply | Local run only; user applies before deploy (INSERT now writes the column) | Plan (spec) |
| Captain edit (PATCH) | Not required, not overwritten | Submit value persists; matches spec | Plan (spec) |

## Scope

**In scope:** required `ordered_by` on Captain submit; persistence round-trip (Supabase allowlist + sheets auto + migration file); Manager queue + detail display; PL+EN copy; mirrored TS types; backend tests.

**Out of scope:** applying the migration; any commit/push/deploy; per-person auth/identity; backfill of legacy orders; Manager filter/sort by orderer; `orders.csv`/`seed_loader` (don't exist).

## Architecture / Approach

`CaptainSubmitRequest.ordered_by` (required) → `captain_submit` writes `Order.ordered_by` → persisted via `_choose_backend()` (Supabase `_ORDER_COLUMNS`; Sheets auto) → `manager_queue` / `manager_order_detail` carry it onto their responses → `apiClient` → typed `ManagerQueueItem` / `ManagerOrderDetail` → rendered as "Zamówił: {value}". Copy via `i18n/strings.ts`; API via `apiClient.ts`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend | Models + `captain_submit`/manager passthrough + Supabase allowlist + migration file + tests | Prod INSERT needs the DB column → migration is a deploy prerequisite (created, not applied) |
| 2. FE Captain | Required field + send + type + i18n | Submit-gate must block on empty, like inventory/receiving |
| 3. FE Manager | "Zamówił: X" on queue + detail + types + i18n | Hide cleanly for legacy orders (no value) |

**Prerequisites:** none for local build/test (seed + mock backends). **Estimated effort:** ~1 session, 3 small phases.

## Open Risks & Assumptions

- **Deploy prerequisite:** `migrations/0005_add_ordered_by.sql` MUST be applied to prod Supabase before the backend deploys, else captain submit breaks (flagged in closeout; not done in this run).
- Sheets prod persistence also needs an `ordered_by` column on the `orders` tab (non-breaking if absent).
- Free-text only — no identity guarantee (consistent with the v0 Non-Goal).

## Success Criteria (Summary)

- Submit without/blank `ordered_by` → 422; valid submit stores it.
- Manager queue + detail show "Zamówił: {name}".
- `python3 -m pytest` green; frontend `build` + `lint` green; manual UI recorded in `preview-notes.md`.
