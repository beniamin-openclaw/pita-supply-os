# Pita Supply OS — Constructive-Critic Review (2026-06-02)

Adversarial review of the 2026-06-02 work (backend deploy · Vercel API proxy · order-unit
data fix), run via two independent critic sub-agents + live verification. Records what was
**verified**, what was **applied**, and what is **deferred** (needs human/live confirmation).

## Verified live
- **Write path through the Vercel proxy:** `POST /api/captain/submit`, `PATCH /api/manager/order/{id}`,
  `POST /api/manager/dispatch`, `POST /api/manager/claim/{id}`, and `GET ...?supplier_id=` all return
  backend **`401 application/json`** through `pita-supply-os.vercel.app/api/*` → HTTP method, request
  body, and query-string are all proxied to the droplet. Auth-header forwarding was already proven by the
  real captain login. (Open item #4 below: a full authenticated **200-write** is not yet exercised e2e.)
- **Unit-defect full re-scan:** after the fix, exactly **1** remaining defect across all 134
  supplier_product rows — **P015** (below). The 11 fixed rows verified internally consistent.

## Applied (high-confidence) — done + deployed
- **Login copy** (`auth.captainHint`) reworded so "kod miejsca" isn't mistaken for a manager token
  (operator feedback). Deployed to prod (bundle `index-BPP4PHVp.js`).
- **`.env.example`** corrected: prod **ignores** `VITE_API_URL` (apiClient hardcodes `BASE_URL=""` + the
  `vercel.json` proxy). The backend host lives in **one** place — the `vercel.json` rewrite destination.
  Prevents a botched future domain migration.

## Deferred — needs Captain / human confirmation (NOT guessed while operator away)
1. **P015 Halloumi — REAL DEFECT the original audit missed.** `SP_INTERMLECZ_P015` = `szt`/**0.2**
   (sub-1 ratio) while `inventory_unit=kg`; `is_critical=TRUE`; WOLA target **72 kg** / min 24. Engine
   currently suggests ~**360 units** (deficit ÷ 0.2). Note: "1 szt = 0.2 kg (200g block) — verify with
   Captain". Two things need the Captain:
   - **(a) Unit:** if a genuine 200 g block → rename `purchase_unit` `szt`→`blok`, keep ratio 0.2
     (fix-shape (a), same as the other packs). Then `blok` ≠ `kg` and the row is consistent.
   - **(b) Target:** 72 kg vs note "17_05 actual ≈ 9.83 kg" → the Wzór target itself looks wrong; even a
     correct unit gives a huge order until the target is fixed.
   Reversible, but a **critical** row — left for the Captain rather than guessed.
2. **P023 Fasolka — kg was a judgment call** (audit: "verify with Captain"). Applied as kg (`opak`/2.5)
   per operator. If actually counted in pieces → revert to `szt` + ratio 1 (3 cells, reversible).
3. **Over-max packaging warnings (operator decision):** P024/P026/P057/P058/P050/P021 legitimately exceed
   `max` because one pack overshoots the target window, and `allow_over_max_due_to_packaging=FALSE` for all
   of them → suggestions will read "(exceeds max by N)". Correct engine math, but may alarm the manager.
   Decide whether to set that flag `TRUE` for single-pack-exceeds-max items.
4. **Full authenticated write smoke** — exercise one real order through the proxy on the first real captain
   submit, or when the TesterArmy free quota resets.
5. **Historical stock semantics:** stock counts/order lines captured **before** the szt→kg relabel could be
   mislabeled if a captain counted "szt" meaning blocks. New counts are fine; spot-check if pre-fix order
   history exists.

## Reviewed — NOT issues
- Manager "Otwórz w Gmail" link is built from `mail.google.com` (no backend host) → not carrier-blocked,
  not mis-pointed.
- Proxy rewrite ordering correct (`/api/*` before SPA catch-all → never falls through to `index.html`).
- No `nip.io` references anywhere in frontend `src/` except the apiClient comment + the single
  `vercel.json` rewrite destination.

## Operator-tradeoff notes (not bugs)
- The `/api/*` proxy is a public unauthenticated reverse-proxy to the droplet (backend still enforces
  Bearer → no auth hole). If the droplet had IP allow-listing on nip.io, Vercel's egress now bypasses it —
  confirm if relevant.
- `/debug` route bypasses AuthGate (pre-existing, unlinked token-tester); with the open proxy it's an
  anonymous endpoint-prober. Operator call.

## Note on an earlier metric
The "P050 suggests 9 (was 11)" in the deploy logs was a **demonstration** with a round target=10 / 9 kg
deficit (ratio 0.82 over-orders to 11; ratio 1 gives exactly 9). P050's **real** WOLA target is 1.5 kg, so
its real suggestion is ~2. The demo correctly shows the ratio-fix effect; the number isn't P050's live
suggestion.
