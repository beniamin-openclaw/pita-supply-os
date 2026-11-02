<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Hide zero cells in the driver list PDF

- **Plan**: context/changes/driver-list-hide-zeros/plan.md
- **Date**: 2026-11-02
- **Reviewer**: independent subagent (Opus 5.5, xhigh), read-only
- **Verdict**: APPROVED — converged after round 1 fixes

## Round 1

No plan drift. `qty > 0` is the right test: the backend drops lines with qty <= 0 before it builds
`per_location` (`supply-os-v1/app/main.py:5057-5059`), and the input models enforce `ge=0`.
Both callers (download `TransportSendPanel.tsx:381`, Gmail attachment `:537`) get the fix. No other
driver render path prints the matrix.

### F1 — Zebra assertion too loose (OBSERVATION)
- `toBeTruthy()` on fillColor; the even-row case was not checked.
- **Fix**: assert `"#f1f5f9"` and `row1[3].fillColor` undefined. **Decision**: FIXED.

### F2 — Per-location sum not rounded (OBSERVATION, existing behaviour)
- `transport.ts` summed a location's qty without `roundQty`. Two orders of 0.1 + 0.2 kg would print
  `0.30000000000000004` in a driver cell. `TransportPage.tsx:963` already rounds the same sum.
- **Fix**: wrap the sum in `roundQty`, and add a test in `transport.test.ts`. **Decision**: FIXED.
  (This is a small widening of scope into `transport.ts`. It affects the same driver-PDF cells
  and leaves the data contract unchanged: zeros stay zeros.)

## Round 2

Re-check after fixes: frontend 1289/1289 tests, lint and build green. No new findings.
