<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: bracka-rollout

- **Plan**: context/changes/bracka-rollout/plan.md
- **Scope**: Fazy 1–3 z 4 (Faza 4 = token na Railway, po stronie operatora)
- **Date**: 2026-08-07
- **Verdict**: NEEDS ATTENTION → **RESOLVED 2026-08-18** (wszystkie findings domknięte lub świadomie zaakceptowane)
- **Findings**: 0 critical · 2 warnings · 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated (powtórzone przy review): pytest 431 passed · ruff All checks passed ·
vite build OK · eslint czysty · vitest 89 passed. Manual: smoke GET w prod pozostaje
`[ ]` — poprawnie, bo token BRACKA nie jest jeszcze ustawiony.

Zweryfikowane i **odrzucone** jako findings:
- Bramka over-MAX przy pozycjach, gdzie 1 jednostka zakupu > MAX (Gyros, Pita, Florinis,
  Oliwki, Fasolka): sprawdzone w `_evaluate_submit_line` — over-MAX dotyczy wyłącznie gałęzi
  „stan nieuzupełniony". Przy policzonym stanie sugestia = 1 opakowanie i delta = 0. Bez wpływu.
- Nowa tabela backupu a bezpieczeństwo: advisor pokazuje ten sam INFO `rls_enabled_no_policy`
  co wszystkie pozostałe tabele (konwencja deny-all z migracji 0002). Brak nowej klasy ryzyka.
- Brak zamówień z innych lokali w bazie (tylko WOLA), więc zdjęcie filtra nie odsłania
  historii, której operator się nie spodziewa.

## Findings

### F1 — Rolki P128/P130 wyzerowane wbrew literalnej decyzji operatora

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — szybka decyzja, poprawka to jeden UPDATE
- **Dimension**: Scope Discipline
- **Location**: prod `location_product_settings` (BRACKA__P128, BRACKA__P130)
- **Detail**: Operator wybrał „ustaw tylko 80/80, **resztę zgłoś**". Implementacja objęła
  P128 („57 na 20") i P130 („57 na 30") regułą grupy B („spoza listy CSV → 0/0/0"), więc
  zamiast zostać nietknięte — zostały wyzerowane. Zgłoszenie było, ale zmiana też. CSV
  wyraźnie chce rolek na Brackiej (wiersze 57/80 i 80/20), a teraz sugestia dla obu = 0.
- **Fix**: Przywrócić P128/P130 z backupu (`_bracka_lps_backup_20260807`) do czasu ustalenia
  mapowania rozmiarów, albo wpisać wartości z CSV po potwierdzeniu, który wiersz to który.
- **Decision**: RESOLVED 2026-08-18 — operator potwierdził 3 rolki; P128→1/4/4, P130→1/2/2 (mapowanie po wspólnej liczbie w nazwie, do weryfikacji przy 1. dostawie Pago)

### F2 — Zamówienie wyzerowanej pozycji wymusza kod powodu

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — realny tradeoff, wpływa na codzienną pracę kapitana
- **Dimension**: Safety & Quality
- **Location**: supply-os-v1/app/main.py:_evaluate_submit_line (gałąź „policzony stan")
- **Detail**: Dla 21 wyzerowanych pozycji sugestia = 0. Przy **policzonym** stanie
  `delta_pct = |zamówione − 0| / max(0, rounding_step)`, a `rounding_step` dla `full_only`
  to 1.0 — więc zamówienie choćby 1 sztuki daje 100% odchylenia > 25% i backend **żąda kodu
  powodu** (400 bez niego). Dotyczy m.in. Monster, Lech Free, Kinley, Ocet, Cukier w
  saszetkach, Rosa Mydło, Worki 160 L oraz obu rolek z F1. Operatorowi przedstawiono
  zerowanie jako „pozycja widoczna, można zamówić ręcznie" — bez wzmianki o tym tarciu.
  (Przy stanie nieuzupełnionym bramka nie odpala — `max = 0` wyłącza też test over-MAX.)
- **Fix A ⭐ Recommended**: Zostawić jak jest i powiedzieć operatorowi wprost — kod powodu na
  pozycji nieskonfigurowanej dla lokalu to użyteczny sygnał do nauki master-daty (FR-011/012).
  - Strength: Zero zmian w prod; sygnał trafia do `suggestion-review`, czyli dokładnie tam,
    gdzie operator koryguje progi.
  - Tradeoff: Kapitan Bracki na starcie klika powód przy nietypowych pozycjach.
  - Confidence: HIGH — mechanizm sprawdzony w kodzie, nie z pamięci.
  - Blind spot: Nie wiem, ile z tych 21 pozycji Bracka realnie zamawia.
- **Fix B**: Dla pozycji, które Bracka faktycznie używa, wpisać realne min/max zamiast 0.
  - Strength: Zeruje tarcie tam, gdzie boli.
  - Tradeoff: Wymaga listy od operatora — czyli tego, czego CSV nie zawiera.
  - Confidence: MEDIUM — zależy od danych, których nie mam.
  - Blind spot: Ryzyko zgadywania progów „na oko".
- **Decision**: ACCEPTED 2026-08-18 — Fix A: mechanizm zostaje; lista 20 pozycji spisana w rollout-notes, sygnał idzie do suggestion-review

### F3 — Alias „Rucola 100 gr" → P007 „Rucola 125 gr"

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: prod `location_product_settings` (BRACKA__P007)
- **Detail**: Z trzech aliasów dwa są bezsporne (`Fuze Tea`→`Fuzetea`, `Rolki 80/80`→`80 na 80`).
  Trzeci łączy opakowanie 100 g z SKU 125 g — progi 3/10 opak trafiły na produkt o innej
  gramaturze. Prawdopodobnie stara nazwa w CSV, ale to moje założenie, nie potwierdzenie.
- **Fix**: Potwierdzić z operatorem, czy Bukat ma jedno opakowanie rukoli.
- **Decision**: RESOLVED 2026-08-18 — katalog ma dokładnie jedno SKU rukoli (P007), alias wymuszony konstrukcją

### F4 — Filtr lokalu pokazuje `location_id`, nie nazwę

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/ManagerPage.tsx:389
- **Detail**: `ManagerInventoryPage` filtruje po `location_name` („Pita Bros Bracka"), kolejka
  po surowym id („BRACKA"). Powód jest realny — `ManagerQueueItem` nie niesie `location_name`,
  a kafelek kolejki też pokazuje id, więc w obrębie ekranu jest spójnie. Rozjazd jest
  międzyekranowy.
- **Fix**: Dodać `location_name` do `ManagerQueueItem` w backendzie (join już istnieje dla
  `supplier_name` w `manager_queue`) i użyć go w obu miejscach.
- **Decision**: FIXED 2026-08-18 — location_name dołączony do ManagerQueueItem (BE+FE), filtr i kafelek pokazują nazwę

### F5 — Kolejka pobiera 4 nielimitowane pasy dla wszystkich lokali co 20 s

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM — do zaadresowania przed kolejnymi lokalami, nie dziś
- **Dimension**: Architecture
- **Location**: frontend/src/pages/ManagerPage.tsx:85 · supply-os-v1/app/main.py:manager_queue
- **Detail**: `manager_queue` nie ma limitu ani paginacji, a pasy `manager_sent` (32) i
  `closed` (10) rosną w nieskończoność. Dodatkowo oba te pasy robią po stronie serwera pełny
  `load_receipts()`. Dziś bez regresji (zamówienia ma tylko WOLA), ale zdjęcie filtra lokalu
  sprawia, że tempo narastania jest sumą wszystkich lokali. Przy 3–5 punktach to zauważalne.
- **Fix**: Limit + paginacja na `manager_queue` (albo domyślne okno czasowe na pasach
  `sent`/`closed`) zanim dojdzie trzeci lokal.
- **Decision**: FIXED 2026-08-18 — manager_queue: limit=50 (clamp 1..200) po sortowaniu newest-first, przed enrichmentem; celowany load_receipts_for_orders w obu backendach

### F6 — Seed: BRACKA aktywna, ale bez progów w seedzie

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: docs/pita-supply-os-v1/seed/locations.csv:9
- **Detail**: `locations.csv` ma teraz BRACKA `active=TRUE`, ale `location_product_settings.csv`
  zawiera wyłącznie 134 wiersze WOLA. W trybie seed (dev) kapitan BRACKA dostałby pusty ekran
  zamówienia. Prod nie dotyczy (Supabase), ale fixture jest wewnętrznie niespójny.
- **Fix**: Albo dosypać wiersze BRACKA do seeda, albo cofnąć `active` na FALSE i zostawić
  komentarz, że seed odwzorowuje tylko pilota WOLA.
- **Decision**: FIXED 2026-08-18 — 141 wierszy BRACKA w seedzie (z prod, z poprawionymi rolkami) + P135–P141 dosypane do products.csv i supplier_products.csv

### F7 — Tabela backupu zostaje w schemacie `public`

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: prod Supabase, `_bracka_lps_backup_20260807`
- **Detail**: Świadome (rollback), z RLS bez polityk — jak reszta tabel. Ale bez daty
  wygaśnięcia zostanie tam na zawsze, tak jak zostają wszystkie tabele „tymczasowe".
- **Fix**: Skasować po potwierdzeniu progów przez operatora; wpisane w rollout-notes.
- **Decision**: PARTIAL 2026-08-18 — _bracka_csv_import już usunięta; backup _bracka_lps_backup_20260807 do skasowania po merge (seed w gicie przejmuje rolę zapisu stanu)
