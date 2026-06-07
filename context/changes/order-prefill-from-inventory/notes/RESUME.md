# RESUME ANCHOR — order-prefill-from-inventory (S-07)

> Max-persistence ledger for the autonomous run. If context was compacted, READ THIS FIRST, then `plan.md` → resume at the first unchecked `## Progress` box.

- **Change-id:** order-prefill-from-inventory (roadmap S-07, FR-017)
- **Goal:** opt-in pre-fill of order `current_stock` from the latest inventory snapshot; double safeguard (opt-in + named date/time); no regression to manual entry.
- **Flow:** full 10x — plan ✓ → implement → impl-review → archive. Test with SYNTHETIC data only (no real orders).
- **Scout/edge-case workflow:** `w0lafv5zc` (fold its edge-cases into `notes/edge-cases.md`).

## State log (update at each phase boundary)
- 2026-06-08 — change scaffolded (change.md + plan.md), status=implementing. Starting Phase 1 (backend endpoint).

## Commit log (this change)
- (none yet)

## Next action
- Phase 1: add InventoryLatestResponse model + GET /api/captain/inventory/latest + synthetic tests.
