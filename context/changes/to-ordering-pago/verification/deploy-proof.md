# Deploy proof — Manager Transport (2026-08-22)

**Commit on main:** `17f4d20` feat(to-ordering-pago): Manager Transport — combine location orders into one supplier pickup
**Push:** `5d04f58..17f4d20  HEAD -> main` (fast-forward from origin/main)

## Why a dedicated branch (production-safety finding at deploy time)

The working branch `claude/multi-location-master-data` was 10 commits ahead of main and those commits touch DEPLOYED code (`app/main.py`, `sheets.py`, `supabase_backend.py`, `auth.py`, `gmail_url.py`, `frontend/src/*`, CI, requirements.lock) — including the supplier-per-location lane, whose `supabase_backend.py` column list selects `location_product_settings.source_supplier_id`.

**Verified against prod Supabase (project lpzhphufjwrndfogkfub, read-only query):**
`select column_name from information_schema.columns where table_name='location_product_settings' and column_name='source_supplier_id'` → **[] (column DOES NOT EXIST — migration 0008 is NOT applied)**.

Pushing that branch to main would have made every `location_product_settings` read fail in production (Captain order screen, orderable, inventory, manager detail). `origin/main` and the prod schema are mutually consistent today, and the Transport code references `source_supplier_id` zero times — so the Transport commit was cherry-picked onto a clean branch off `origin/main` (`claude/to-ordering-pago`) and pushed alone. No conflicts; verified green on that base before push.

## Verification on the pushed base

- Backend: `ruff check .` clean; `pytest` → 483 passed, 16 deselected (fewer than the working branch's 567 because the other lane's tests are not on main — expected).
- Frontend: 101 tests passed, `npm run build` green (TS strict), `npm run lint` clean.
- `grep -rn source_supplier_id supply-os-v1/app/` → no hits (schema-safe against prod).

## CI on main (run 32559473216)

- Backend (ruff + pytest): success
- Frontend (build + lint): success
- Backend integration (real Postgres): success
- Overall conclusion: **success**

## Live production checks (not inferred from "pushed")

- Railway health: `{"status":"ok", ...}`
- Route-existence discriminator: bogus route → **404**, while `/api/manager/transport/eligible`, `/batches`, `/batch/{id}` → **401** (auth required ⇒ routes exist ⇒ new backend code is live).
- Vercel bundle `/assets/index-BM-6G1In.js` (505 KB) contains `manager/transport`, `Transport zbiorczy`, `transport/eligible`, `TRN-` ⇒ new frontend build is live.
- `https://pita-supply-os.vercel.app/manager/transport` resolves and renders the manager auth gate (screenshot taken in session).

## Outstanding (operator)

1. Live test with the real Manager token on `/manager/transport`.
2. Pago email master-data batch (distribution list from the legacy sheet → `suppliers.email`, comma-separated) — until then the Pago email button stays disabled by design; Bukat already works.
3. **Do NOT push `claude/multi-location-master-data` to main until migration 0008 is applied to prod Supabase** (see above) — that lane also still carries the open Wolska/Blue Service master-data question.
