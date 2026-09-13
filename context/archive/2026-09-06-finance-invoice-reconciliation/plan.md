# Plan — MVP "Sprawdzenie dostawy z fakturą (Symfonia eBiuro)" — pilot KEN

Status: v2 HARDENED (2026-09-07) after independent review (Opus, READY-WITH-FIXES; see `plan-review.md`). Scope = working demo for finance on prod, KEN only, Manager token.
Principle: Pareto, no over-engineering. Suggest-only (never auto-books, never sends).

## 0. Grounding (verified 2026-09-07)
- eBiuro API (apps.symfonia.pl) reachable with `SYMFONIA_EBIURO_EMAIL` + `SYMFONIA_EBIURO_APIKEY_PBG`
  (JARVIS-CODEX `.env`). KEN = company_id 7189181, NIP 5223241275. 74 docs, all state=2.
  Document attrs: `NrFaktury`, `KsefNumer`, `DataWystawienia`, `DataSprzedazy`, `TerminPlatnosci`,
  `RazemNetto/Brutto/VAT`; `type_dict` ("Faktura zakupu"/"Korekta zakupu"/"Faktura sprzedaży");
  `contractor.nip` (sometimes "PL"-prefixed); `file_path` = PDF URL (needs `token` header);
  positions (Polish keys): `Nazwa`, `Ilosc`, `Jednostka`, `Netto`, `Brutto`, `Cena`, `StawkaVAT`.
- Lag: supplier invoice appears in eBiuro 0–2 days after issue (Bukat 08-29 delivery → 08-31 doc).
- Prod KEN receipts (Sept 1–5): Bukat ×4, Coca-Cola ×1, Intermlecz ×1, Blue Service ×1. Names on our
  side = `supplier_products.supplier_product_name` (e.g. "Coca Cola Zero", zgrzewka ×24) vs invoice
  "0.25 RGB X24 COCA-COLA ZERO" (Jednostka "CS") ⇒ token-overlap matching needed.
- No Railway CLI locally; Railway auto-deploys `main`. Supabase MCP `apply_migration` is the
  established way to apply DDL to prod (week1-feedback-targets). Droplet SSH = password only (not
  automatable); Mac mini `jarvis-mini` SSH works (user `agent`, python 3.9 — only curl needed).

## Current State Analysis
Receipts + WZ photos exist (Captain-only photo routes); no invoice entity, no server-side email,
no scheduler, no XLSX; eBiuro has verified purchase invoices with positions but nothing links them.

## Desired End State
`/manager/finance` shows KEN receipts of the last N days, each paired with the most likely eBiuro
purchase document, line-by-line quantity comparison, WZ photos next to the invoice PDF, and a
Manager verdict (Zgodne / Niezgodność) that is persisted. Finance sees within seconds whether what
arrived is what was invoiced. Suggest-only; nothing is booked or sent.

## Phase 1: Migration 0017 + supplier NIP seed
```sql
-- text columns (house style), house header + Rollback block, ADDITIVE ONLY
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS nip text;
finance_documents (doc_id bigint PK [eBiuro ids are global across companies — verified before
  apply], company_id, company_nip, contractor_nip, contractor_name, doc_type, invoice_number,
  ksef_number, issue_date, sell_date, payment_deadline, netto, brutto, vat, pdf_url, state,
  listing_fp, last_seen_at, synced_at) + index (contractor_nip, sell_date)
finance_document_lines (doc_id FK CASCADE, ordinal, name, quantity, unit, netto, brutto,
  unit_price_netto, vat_rate; PK (doc_id, ordinal))
finance_receipt_reviews (receipt_id text PK FK receipts, doc_id, status CHECK confirmed|mismatch,
  note, actor, reviewed_at) + UNIQUE partial index on (doc_id) WHERE status='confirmed'
  (one invoice can be confirmed against ONE receipt — prod already has two receipts for
  ORD-20260901-KEN-BUKA-60e316)
finance_line_aliases (contractor_nip, invoice_name_norm, product_id, invoice_name, actor,
  created_at; PK (contractor_nip, invoice_name_norm)) — learned "how Bukat spells Awokado"
```
`prod-sql.sql`: UPDATE suppliers.nip (8 rows) + assert/seed `locations.company_nip` for KEN
(5223241275). Success: migration applied on prod via Supabase MCP BEFORE the code merge.
Seed NIPs (prod-sql.sql, UPDATE suppliers): Bukat 1182242889, Coca-Cola 5242106963, Intermlecz
5240005293, Blue Service 1251685763, Eurofood 1182124486, Spec Food 8151799755, Kuchnie Świata
1180039859, Filber 5252855471. `contractor_nip` stored digits-only (strip "PL"/spaces).

## Phase 2: eBiuro client + parser · Phase 3: matching · Phase 4: seam + routes
- `app/config.py`: `ebiuro_email: str = ""`, `ebiuro_apikey: SecretStr`, `ebiuro_company_ids: str = ""`
  (comma list, e.g. "7189181"). `ebiuro.is_configured()` = all three non-empty.
- `app/ebiuro.py` (stdlib urllib, no new dep): `auth()`, `get_companies()`, `iter_documents(company_id)`,
  `get_document(company_id, doc_id)`, `download_pdf(url)`; `parse_document(raw, company_nip) ->
  (FinanceDocument, [FinanceDocumentLine])` — pure, unit-tested on a saved fixture (anonymised copy of
  the real Coca-Cola doc 76091157). Only `app_document_type == DOCUMENT_TYPE_PURCHASE` is stored.
  Both "Faktura zakupu" AND "Korekta zakupu" are stored (`app_document_type == PURCHASE`).
  Sync = full listing per company, fetch one-xt only for doc_ids not yet stored or whose listing
  fingerprint (state|brutto|issue_date|invoice_number) changed; upsert docs (ON CONFLICT DO UPDATE)
  + replace lines in ONE transaction; stamp `last_seen_at` for every listed doc. HTTP timeout 20 s,
  per-doc try/except → skipped, cap 200 fetches/run, 60 s re-entry guard on the route.
  `tests/conftest.py` blanks `SUPPLY_OS_EBIURO_*` so the suite can never touch the live key.
- `app/finance_match.py` (pure, unit-tested):
  - `normalize_nip`, `normalize_name` (lowercase, strip PL diacritics + punctuation, tokens).
  - `candidate_documents(receipt, supplier_nip, company_nip, docs)`: purchase docs with same
    contractor_nip (+ same company_nip when both known), `sell_date` in [receipt_date−4, +1] or
    `issue_date` in [receipt_date−1, +14]. Score = 10 − |sell_date − receipt_date| days
    + 3 if |netto − receipt_estimate|/max(...) < 0.15 + 0.5 × matched-line ratio. Best first.
  - `compare_lines(receipt_lines, doc_lines, aliases)`: learned aliases pair first; else greedy
    best token coverage ≥ 0.5 (+ tiny synonym bridge awokado/avocado). Qty compare in purchase
    units: `ok` (|Δ| ≤ 0.05 abs or ≤ 2 %), `qty_diff`, `not_on_invoice`; invoice-only lines →
    `extra_on_invoice`. The ×units_per_purchase_unit conversion is tried ONLY when the invoice
    unit token differs from our purchase unit and yields `ok_converted` (amber), never `ok`.
  - `candidate_documents`: purchase docs only (korekty excluded: doc_type contains "korekt" or
    netto < 0 — they get their own overview section), same contractor NIP, same company NIP when
    both known, sell_date in [rd−4, rd+1] or issue_date in [rd−1, rd+14]. Ranked by
    (−matched-line ratio, |Δdays|, |netto − estimate|) — no tuned constants.
    `estimate = Σ received_qty × supplier_products.price_estimate_pln`, None if any price missing.
  - Receipt roll-up (`receipt_status`): `no_invoice`; `unsure` (matched ratio < 0.3 and, when an
    estimate exists, |Δnetto| > 25 %); `possible_collective` (extra lines AND doc netto > 1.5 ×
    estimate); `ok` (all lines ok, no extras, |Δnetto| ≤ 10 % when estimate known); else `diff`
    (any qty_diff / not_on_invoice / ok_converted / extras). Review overrides: `confirmed` |
    `mismatch`. UI: green "Zgodne" ONLY for confirmed; auto `ok` reads "Prawdopodobnie zgodne".
  - Overview flags `duplicate_receipt` when another receipt exists for the same order_id.
- Backend seam: `supabase_backend` gets `SUPPORTS_FINANCE = True` + `load_finance_documents(since)`,
  `load_finance_document_lines(doc_ids)`, `upsert_finance_documents(docs, lines)`,
  `load_finance_reviews(receipt_ids)`, `upsert_finance_review(review)`, `load_receipts_since(date)`.
  `seed_loader`/`sheets`: no impl; routes gate with `_supports_finance(backend)` → 503 otherwise
  (mirrors `_is_persistent`).
- Routes (Manager token, `/api/manager/finance/...`):
  - `GET  .../overview?location_id=KEN&days=30` → `FinanceOverview{ receipts: [FinanceReceiptItem],
    unmatched_documents: [FinanceDocumentItem], synced_at }` — one item per receipt with best
    candidate summary + status + counts (ok/diff/missing lines).
  - `GET  .../receipt/{receipt_id}` → `FinanceReceiptDetail{ receipt header, lines compared,
    candidates[≤5], selected doc, review, photos: [signed URLs] }`. Optional `?doc_id=` to compare
    against a chosen candidate.
  - `POST .../receipt/{receipt_id}/review` body `{doc_id?, status, note}` → upsert.
  - `POST .../sync` → runs eBiuro sync for configured companies; 503 when not configured. Returns
    counts. Idempotent; safe to call daily.
  - `POST .../receipt/{receipt_id}/alias` body `{doc_id, invoice_ordinal, product_id}` → stores a
    supplier alias (contractor_nip + normalized invoice name → product_id); the pane re-compares.
  - `GET  .../document/{doc_id}/pdf` → `doc_id` only; pdf_url + company_id looked up in DB; 403 when
    company_id not in `ebiuro_company_ids` (KEN-only = blast-radius control); `application/pdf`,
    `Cache-Control: no-store`; 503 when eBiuro not configured. The eBiuro URL never reaches the SPA.
  - `GET  /api/manager/receipt/{receipt_id}/photos` → signed URLs (Manager twin of the Captain route).
- Tests (pytest, seed mode + mocks): parse fixture; matching cases (exact, token, upp-conversion,
  qty diff, no candidate, korekta excluded from "ok"); routes (503 unconfigured, 404, overview shape
  via monkeypatched backend); photos manager route.

## Phase 5: Manager finance screen — `/manager/finance` ("Faktury vs dostawy")
- `pages/manager/ManagerFinancePage.tsx` (+ `finance/ReceiptComparePane.tsx`): header like
  SuggestionReview page; filter: location (default KEN), days (30). Left list = receipts, chips:
  Zgodne / Różnice / Brak faktury / Potwierdzone / Niezgodność; second section "Faktury bez dostawy".
  Right pane: two cards (Dostawa: data, kto, zamówienie | Faktura: nr, KSeF, daty, netto/brutto,
  link PDF), line table `Produkt | Odebrano | Na fakturze | Δ | status`, candidate switcher when >1,
  photo thumbnails (signed URLs, open full), buttons "Zgodne ✓" / "Niezgodność ✗" + note.
  "Odśwież z eBiuro" button → POST sync (shows counts / 503 message).
- `apiClient.ts` typed methods + `apiGetBlob(path, role)` (Bearer + 401 handling; component revokes
  the object URL on unmount); `types.ts`; i18n keys `manager.finance.*` (PL+EN); nav link in
  ManagerPage header. Sections: Przyjęcia · Faktury bez dostawy · Korekty. No new deps.
- Extra invoice lines get a "Przypisz do produktu" select → POST alias → re-compare (learning loop).

## Phase 6: Deploy (prod)
1. `apply_migration` 0017 via Supabase MCP BEFORE merging code (additive; harmless to old code).
2. `prod-sql.sql`: UPDATE suppliers.nip (8 rows).
3. Merge → Railway + Vercel auto-deploy; verify `/openapi.json` has finance routes, bundle hash.
4. Seed data: `python -m scripts.ebiuro_sync --company 7189181 --emit-sql /tmp/...sql` locally
   (creds from JARVIS-CODEX .env, never committed; output holds real financial data → scratch only)
   → execute via Supabase MCP. Overview on prod then shows KEN receipts vs invoices.
5. Automation DEFERRED (review Pareto cut): the `POST .../sync` route ships; the Mac mini launchd
   plist + install notes live in `deploy/mini/` but are NOT installed until Ben sets
   `SUPPLY_OS_EBIURO_EMAIL/APIKEY/COMPANY_IDS=7189181` on Railway (no CLI here). Until then the
   "Odśwież z eBiuro" button returns a clear 503 and the demo runs on the seeded snapshot.

## What We're NOT Doing
KSeF direct pull; email reports; Sheet ledger; per-supplier invoice profiles; multi-location split
of collective invoices (Blue Service by WZ); price-vs-cennik check (shown as info only: invoice
unit price displayed, no status); GoStock; Finance role/token (Manager token for MVP).

## Risks / decisions
- eBiuro key = accountant's connector key; READ-ONLY use, never regenerate; requests ~80/day.
- Contractor NIP with "PL" prefix / missing → fallback candidate by name similarity NOT built; such
  docs appear only in "Faktury bez dostawy" (visible, not silently lost).
- Korekty (negative) never become "ok" matches; listed as documents.
- PDF proxy streams through Railway (small files, manager-only).
- Manager token is shared and rotation is still pending — anyone holding it can read KEN's purchase
  invoices and PDFs. Accepted for the pilot; mitigated by scoping `EBIURO_COMPANY_IDS` to KEN.
  A Finance role/token is the follow-up.
- Review cut NOT taken: `?doc_id=` on the detail route stays (comparing against another candidate
  before confirming is cheaper than persisting a selection).

## Progress
### Phase 1
- [x] 1.1 migration 0017 written (house header, text columns, rollback) and applied on prod
- [x] 1.2 prod-sql.sql: 8 supplier NIPs + KEN company_nip verified
### Phase 2
- [x] 2.1 app/ebiuro.py client + parser, fixture test green; conftest blanks EBIURO env
### Phase 3
- [x] 3.1 finance_match.py: aliases, unit gating (ok_converted), korekty excluded, ranking, roll-up
### Phase 4
- [x] 4.1 supabase_backend finance functions (upsert in one tx, aliases, reviews)
- [x] 4.2 routes: overview, detail, review, alias, sync (guarded), pdf (scoped), manager photos
- [x] 4.3 route tests green; `ruff check .` clean; full suite green
### Phase 5
- [x] 5.1 ManagerFinancePage + compare pane + i18n + apiClient + nav; `npm run build && lint` green
### Phase 6
- [x] 6.1 merged to main, Railway/Vercel deployed, openapi has finance routes
- [x] 6.2 prod seeded from local sync; overview shows KEN receipts vs invoices
- [x] 6.3 post-implementation review + docs + archive note
