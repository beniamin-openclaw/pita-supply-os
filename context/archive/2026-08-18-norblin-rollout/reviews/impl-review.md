<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: norblin-rollout

- **Plan**: context/changes/norblin-rollout/plan.md
- **Scope**: Fazy 1–3 z 4 (Faza 4 = token na Railway + merge, po stronie operatora)
- **Date**: 2026-08-18
- **Reviewer**: Opus (sesja główna); implementacja: subagenci Sonnet, dane w prod: prowadzący
- **Verdict**: **PASS** — 0 critical, 1 warning (naprawiony w trakcie review), 5 observations
- **Findings**: 0 critical · 1 warning · 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS (poza krokiem operatora) |

Automated: pytest **438 passed** · ruff **All checks passed** · vite build OK ·
eslint czysty · vitest **89 passed**.

Kontrola danych (mocniejsza niż przy Bracce): seed i prod porównane **sumą md5**
kanonicznego zrzutu 142 wierszy — `5e7ff49f15d634b3ccd4852e87d049b0` po obu stronach.
To nie jest „wygląda tak samo", tylko dowód identyczności co do wartości.

Zweryfikowane i **odrzucone** jako findings:

- *Czy zdjęcie hardkodu lokalizacji wymaga pracy?* — nie. Sprawdzone w kodzie, nie założone:
  `manager_queue` ma `location_id` opcjonalny (`app/main.py:702-706`, `:732`),
  `location_name` joinowany z fallbackiem (`:785-786`), parser tokenów generyczny
  (`app/auth.py:37-46`). Dorobek `bracka-rollout` pokrył ten rollout w całości.
- *Czy nowe SKU P142 wycieknie do innych lokali?* — nie. Wiersz
  `location_product_settings` istnieje wyłącznie dla NORBLIN; WOLA/BRACKA/KEN nie mają
  P142, więc nie pojawi się w ich ekranach ani mailach. Potwierdzone testem
  `test_captain_orderable_wola_pago_returns_18_items`, który pozostał zielony bez zmian.
- *Czy `test_products == 142` to sztuczne naginanie testu?* — nie. Test liczy wiersze
  seeda, a seed faktycznie urósł o jeden produkt. Alternatywa (nie dodawać P142 do seeda)
  rozjechałaby seed z prod.

## Findings

### F1 — Norblin został w dokumentacji jako „przyszły rollout", choć jest na produkcji

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — dokument jest źródłem prawdy przy kolejnych rolloutach
- **Dimension**: Pattern Consistency
- **Location**: docs/pita-supply-os-v1/COMPANY_ENTITIES.md
- **Detail**: Subagent poprawnie zidentyfikował, że przynależność do tabeli jest w tym
  pliku jedynym znacznikiem statusu wdrożenia — i mimo to nie przeniósł wiersza, bo
  szukał *daty*, której w pliku nie ma. Skutek: po wdrożeniu Norblina plik nadal
  twierdził, że to lokal „na przyszłe rollouty", a sekcja nazywała się „Wolska + rollout
  Bracka/KEN". Instrukcja („jeśli znacznika nie ma — nic nie zmieniaj") była zbyt
  dosłownie odczytana; znacznik był, tylko innego rodzaju.
- **Fix**: NAPRAWIONE w trakcie review — Norblin przeniesiony do „Lokalizacje objęte
  systemem" (z `location_id` = `NORBLIN`, jak pozostałe wiersze tej tabeli), usunięty
  z „Pozostałe", nagłówek sekcji zaktualizowany na „Wolska + rollout Bracka/KEN/Norblin".
- **Decision**: FIXED 2026-08-18

### F2 — 35 pozycji z sugestią 0 wymusza kod powodu

- **Severity**: 🔍 OBSERVATION (świadomie zaakceptowane)
- **Impact**: 🔎 MEDIUM — dotyka codziennej pracy kapitana
- **Dimension**: Safety & Quality
- **Location**: supply-os-v1/app/main.py — `_evaluate_submit_line` (gałąź „policzony stan")
- **Detail**: To samo tarcie, co F2 z impl-review Bracki, tu na 35 pozycjach (34 z grupy C
  + `Gyros 15 KG`, który ma 0/0 wprost w arkuszu). Przy policzonym stanie
  `delta_pct = |zamówione − 0| / rounding_step` zawsze przekracza 25%, więc backend
  odrzuca zamówienie bez `reason_code`. Różnica wobec Bracki: operatorowi **powiedziano
  o tym wprost** w pytaniu decyzyjnym, zanim wybrał zerowanie — nie jest to niespodzianka.
- **Fix**: Bez zmian. Sygnał ląduje w `/api/manager/suggestion-review`, czyli tam, gdzie
  korygujemy master-datę. Gdy okaże się, że Norblin realnie zamawia którąś z tych pozycji,
  poprawka to jeden UPDATE.
- **Decision**: ACCEPTED 2026-08-18 — decyzja operatora, koszt zakomunikowany przed wyborem

### F3 — Progi produkcji własnej są wyliczone, nie zadeklarowane

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: prod `location_product_settings` (NORBLIN__P029…P037)
- **Detail**: 9 wierszy powstało z przemnożenia progów WOLA przez 1,25 i zaokrąglenia do
  0,1 — to jedyna grupa w całym imporcie, która nie pochodzi z arkusza operatora. Reguła
  jest jednolita i udokumentowana, ale „+25% od Woli" to przybliżenie skali lokalu, nie
  pomiar. Wartości ×1,25 są zapisane w `notes` każdego wiersza, więc źródło jest widoczne
  w bazie, nie tylko w dokumencie.
- **Fix**: Follow-up w rollout-notes — zweryfikować po pierwszym tygodniu zamówień.
- **Decision**: ACCEPTED 2026-08-18 — jawna decyzja operatora, z notką do weryfikacji

### F4 — P142 opiera się na jednej przesłance: literalnym zapisie w arkuszu

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Scope Discipline
- **Location**: prod `products.P142`, `supplier_products.SP_PAGO_P142`
- **Detail**: Arkusz mówi „Rolki do kasy 57/50", a katalog ma 57/20, 57/30 i 80/80.
  Operator rozstrzygnął: „tak jak w arkuszu jest, nie kopiuj z Woli" — więc powstało nowe
  SKU zamiast domysłu, który z istniejących rozmiarów to jest. Cena `1,29 zł` to
  **oszacowanie** po P130, jedyne pole, którego arkusz nie zawierał; jest oznaczone jako
  szacunek w `notes` wiersza `supplier_products`. Jeśli „57/50" okaże się literówką,
  Pago dostanie mail na rozmiar, którego nie ma w ofercie.
- **Fix**: Follow-up — potwierdzić rozmiar i cenę przy pierwszej dostawie od Pago.
  Zasięg pomyłki jest ograniczony: P142 istnieje tylko dla NORBLIN.
- **Decision**: ACCEPTED 2026-08-18 — wprost wybrane przez operatora, z zapisanym follow-upem

### F5 — Filtr „Lokal" pokaże NORBLIN dopiero po pierwszym zamówieniu

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Architecture
- **Location**: frontend/src/pages/ManagerPage.tsx:388-399
- **Detail**: Opcje filtra budowane są z zamówień w czterech pasach kolejki, nie z
  `api.locations()`. Nowy lokal bez zamówień nie pojawi się na liście rozwijanej. To
  **nie jest bloker** — kolejka domyślnie ciąga wszystkie lokale, więc pierwsze zamówienie
  z Norblina będzie widoczne natychmiast, a opcja filtra doładuje się w tym samym momencie
  (zachowanie identyczne z filtrem dostawcy).
- **Fix**: Brak. Gdyby kiedyś przeszkadzało — źródłem opcji byłoby `api.locations()`.
- **Decision**: ACCEPTED 2026-08-18 — zachowanie zamierzone, spójne z filtrem dostawcy

### F6 — Kosmetyczny rozjazd konwencji `notes` w seedzie

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: docs/pita-supply-os-v1/seed/location_product_settings.csv
- **Detail**: Wiersze BRACKA mają w `notes` nazwę produktu, wiersze NORBLIN — string
  proweniencji (`norblin-rollout 2026-08-18: …`). Wynika to z tego, że blok NORBLIN
  wyeksportowano z prod (gdzie proweniencja jest konwencją, także dla Bracki), a blok
  BRACKA wpisano kiedyś inaczej. Kolumna nie jest odczytywana przez żadną logikę.
  Wersja z prod jest tą użyteczniejszą — mówi, skąd wzięła się liczba.
- **Fix**: Brak. Ujednolicenie przy okazji następnego eksportu seeda z prod.
- **Decision**: ACCEPTED 2026-08-18

### F7 — Zastane: 7 wierszy `supplier_products.csv` ma nieocytowany przecinek

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: docs/pita-supply-os-v1/seed/supplier_products.csv (m.in. linie 51, 108, 110–114)
- **Detail**: Znalezione przy kontroli spójności kolumn, **nie wprowadzone przez tę zmianę**
  (diff ma 0 usunięć w tym pliku). Przecinek siedzi w ostatniej kolumnie (`notes`), więc
  `csv.DictReader` przypisuje nadmiarowy fragment do klucza `None`, a `_normalize` go
  pomija — kolumny znaczące (cena, jednostka, rounding) są nietknięte. Efekt: obcięta
  notatka w trybie seed, zero wpływu na prod i na zamówienia.
- **Fix**: Docytować te 7 wierszy przy najbliższej pracy nad seedem.
- **Decision**: OPEN — zapisane w follow-up (zastane, poza zakresem tego rolloutu)

## Uwaga procesowa

Eksport, który przekazałem subagentowi, miał nieocytowane przecinki w `notes` 9 wierszy
produkcji własnej (`produkcja wlasna, WOLA x1.25`). Naiwne dopisanie linia po linii
rozjechałoby te wiersze na 10 pól. Subagent to wykrył, sparsował eksport modułem `csv`
i zapisał z `QUOTE_MINIMAL` — poprawnie. Wniosek na przyszłość: eksport z bazy do pliku
pośredniego generować od razu jako poprawny CSV (cytowanie po stronie SQL), a nie
zostawiać cytowanie konsumentowi.
