# Implementation notes — finance-invoice-reconciliation MVP (2026-09-07)

## What shipped
- Backend: `app/ebiuro.py` (read-only eBiuro client + parser), `app/finance_match.py` (pure matcher),
  Finance* models, Supabase finance functions, routes under `/api/manager/finance/*` + Manager
  photo listing, migration `0017_finance_documents.sql`, CLI `scripts/ebiuro_sync.py --emit-sql`.
- Frontend: `/manager/finance` ("Faktury vs dostawy"): lista przyjęć z chipami, sekcje "Faktury bez
  dostawy" i "Korekty", panel porównania Dostawa | Faktura, tabela pozycji (Odebrano / Na fakturze /
  Δ / Status), pozycje spoza dostawy z "Przypisz do produktu" (alias uczący), zdjęcia WZ, "Otwórz PDF",
  ocena "Zgodne ✓" / "Niezgodność ✗" z notatką, "Odśwież z eBiuro". Nav link "Faktury" w Managerze.
- Deploy artefacts: `deploy/mini/` (launchd plist + README) — NOT installed yet (see below).

## Independent post-implementation review (Opus) — SHIP-WITH-FIXES, resolution
| # | Finding | Resolution |
|---|---|---|
| 1 | cross-company pairing when our location has no company_nip | fixed: a doc that names a buyer must match ours; tests added |
| 2 | 0017 not wired into the Postgres integration harness | fixed: `_schema()` applies 0017; round-trip test (upsert, line replace, partial unique index → 409 path, aliases) — 22 integration tests green on local Postgres |
| 3 | eBiuro session token could go to a foreign `pdf_url` host | fixed: `download_pdf` allows only `https://*.symfonia.pl`; test |
| 4 | docs with NULL issue_date silently dropped | fixed: `COALESCE(issue_date, sell_date, synced_at)` |
| 5 | "confirmed" chip shown next to the auto-picked invoice | fixed: reviewed doc is always the shown `best` (`ignore_window` scoring); test |
| 6 | non-EbiuroError in sync → 500 | fixed: JSON decode → `EbiuroApiError`; any sync failure → 502 with type |
| 7 | alias with empty normalized name | fixed: 400 |
| 8 | sibling-receipt lookup unscoped | scoped to location; other perf items accepted at pilot volume |
| 9 | tautological alias assertion | fixed: asserts `via_alias` + remaining extras |
| 10 | unit family map inconsistencies | fixed (g≠kg, ml≠l, op→opak) |
| 11 | stale change artefacts / DATA_MODEL | this file, change.md, plan Progress, DATA_MODEL §7a |
| 12 | two lanes in one working tree | committed from a clean worktree with only this lane's hunks |
| 13 | prod-only claims unverifiable from repo | verified by the operator session: doc_id uniqueness (KEN vs PB ZOO, 0 overlap), 0017 applied via Supabase MCP, 8 NIPs + KEN company_nip set, 27 docs / 194 lines seeded |

## Verification
- `python -m pytest -q` → 738 passed; `-m integration` on local Postgres → 22 passed; `ruff check .` clean.
- `npm run lint` / `npm run build` green.
- E2E in the in-app browser against a local uvicorn with the test FakeBackend: list → detail →
  line comparison (Coca-Cola Zero/Cola ok, KAUCJA as extra line) → "Zgodne ✓" → chip "Zgodne ✓"
  on the card; Korekty section; sync-not-configured notice rendered inline (no crash).
- Prod data check (Supabase): KEN receipts Sept 1–5 (Bukat ×4, Coca-Cola, Intermlecz, Blue Service);
  eBiuro KEN docs incl. Coca-Cola 2424313581 (sell 2026-09-04) — the 04.09 KEN Coca-Cola receipt has
  a real candidate; Bukat/Intermlecz/Blue Service Sept invoices were not yet in eBiuro at seed time.

## Manual steps left for Ben (cannot be done from this session)
1. Railway → variables `SUPPLY_OS_EBIURO_EMAIL`, `SUPPLY_OS_EBIURO_APIKEY` (JARVIS-CODEX `.env`:
   `SYMFONIA_EBIURO_EMAIL` / `SYMFONIA_EBIURO_APIKEY_PBG`), `SUPPLY_OS_EBIURO_COMPANY_IDS=7189181`.
   Until then "Odśwież z eBiuro" and "Otwórz PDF" answer 503 with a clear message; the panel works
   on the seeded snapshot. Re-seed any time: `python -m scripts.ebiuro_sync --company 7189181
   --env-file <JARVIS-CODEX/.env> --emit-sql /tmp/x.sql` → run in Supabase SQL editor.
2. Optional daily refresh from the Mac mini: `deploy/mini/README.md` (needs the Manager token on
   the mini; do after step 1).

## Known limits (MVP)
Manager token (shared) guards finance data — Finance role is the follow-up. Collective invoices
(Blue Service/Coca-Cola per address) surface as `possible_collective`, not split by WZ. Name
matching learns via aliases; first Bukat invoices will need a few "Przypisz" clicks. Korekty are
listed, never matched. No email/Sheet export yet (discovery options 1/2).
