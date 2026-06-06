# Phase 2 — Manual Wola×Bukat sheet-mode smoke log

**Date:** 2026-06-06 · **Backend:** sheet mode (live sheet `11aJUc…YQ9Lo`) · **Frontend:** Vite (Homebrew node).

## Outcome: north-star proven end-to-end; no real Bukat order placed.

A real Wola×Bukat order flowed Captain-submit → Manager-claim → Manager-edit → **email dispatch → ready-to-send Gmail draft**, and was backed out without sending. FR-005/007/008/010/011 exercised on the live sheet.

## What was exercised

| Step | Result |
|---|---|
| 2.1 Captain submit → queue | ✅ `ORD-20260606-WOL-BUKA-8577a5` (Bukat, 2 lines, 157 zł) landed on the Manager queue |
| 2.2 Claim + edit + save | ✅ claimed → manager edited line qtys 5/5 → 6/7 (total 157 → 210.40) |
| 2.3 Send-back + resubmit | ⏭️ **not manually re-run** — operator went straight to dispatch. FR-009 is covered by `tests/test_manager_claim_release.py` + research; accepted as covered. |
| 2.4 Dispatch → Gmail draft | ✅ draft opened (operator-confirmed); content verified via backend reconstruction — see below |
| 2.5 Back out | ✅ order row + both order_lines rows deleted; verified order absent, 0 lines, no send |

## Dispatched draft content verified (FR-010)

```
to:      biuro@bukat.com                    ✅ correct Bukat recipient (F-01)
subject: Zamowienie ORD-…-BUKA-8577a5 - Bukat - dostawa 2026-06-08   (old format — content fix deferred, chip task_ffe7ae5f)
body:
  1. | Cytryna         | 6 kg              ✅ purchase units = manager_final
  2. | Papryka zielona | 7 kg              ✅
  Laczna wartosc szacunkowa: 210,40 zl     ✅ Polish decimal comma
  Adres dostawy: TBD                        ⚠️ WOLA delivery_address is blank/"TBD" in the live sheet (master-data gap, separate)
  Data dostawy: 2026-06-08                  ✅
```

**Safety:** operator confirmed the draft was **closed unsent** — no real order to Bukat. Hard rule held.

## Blocker found + resolved (live data ↔ main code drift)

The live `supplier_products` sheet had **8 Bukat rows with `rounding_rule = tenth_kg`** (an S-09 value); `main`'s `RoundingRule` enum rejects it, so every sheet read of `supplier_products` raised `ValidationError` → submit/queue/dispatch 500'd (surfaced in the UI as "Failed to fetch", because the 500 lacked CORS headers).

**Resolution (reversible temp-patch):** the 8 rows were set to `full_only` for the smoke (originals saved to `/tmp/s02_rounding_restore.json`), then **restored to `tenth_kg`** verbatim during back-out (verified: tenth_kg count back to 8). The live sheet ends exactly as it started.

**Follow-ups surfaced (out of S-02 scope):**
- **`tenth_kg` ↔ main mismatch** — production-on-`main` would similarly crash on `supplier_products` reads until S-09 lands `tenth_kg` in `RoundingRule` (or the sheet is aligned). Worth confirming the droplet's branch.
- **WOLA `delivery_address`** = blank/"TBD" in the live sheet → dispatch email shows "Adres dostawy: TBD" (master-data gap).
- **Dispatch email content** (subject `Zamówienie {location}`, supplier-facing product names) — deferred change, chip `task_ffe7ae5f`.
- **Frontend 422 rendering** — a rejected submit showed "[object Object]" instead of the validation detail (minor UI bug).

## Environment notes

- Frontend must be opened via **http://localhost:5173** (not `127.0.0.1`) — backend CORS allows `localhost:5173` only; `127.0.0.1:5173` → preflight 400 → "Failed to fetch".
- Dev tokens: `.env` has no tokens → auth disabled → any token works, captain defaults to WOLA.
