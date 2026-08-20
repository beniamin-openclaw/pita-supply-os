# WOLA — 9 nowych pozycji Blue Service + progi dla tacek papierowych (tor A)

## Overview

Tushar zgłosił 13 pozycji do dodania dla Wolskiej u Blue Service oraz 3 do usunięcia
z Pago. Po weryfikacji okazało się, że te dwie listy się zazębiają: 3 „do usunięcia"
to te same produkty co 3 „do dodania" — czyli przepięcie dostawcy, nie usuń+dodaj.
Przepięcie jest zablokowane architekturą (`supplier_products` nie ma wymiaru
lokalizacji) i trafiło do osobnego lane'a `supplier-per-location`.

Ten plan realizuje **pozostałe 10 pozycji**, które są od tamtej decyzji całkowicie
niezależne: 9 nowych produktów w katalogu + próg dla WOLA przy istniejącym P143.
Zmiana jest czysto addytywna — nie rusza żadnego istniejącego wiersza, nie zmienia
schematu, nie dotyka Bracki, Norblina ani KEN-a.

## Current State Analysis

**Model danych.** Widoczność pozycji na ekranie zamówienia to przecięcie dwóch
warstw: `supplier_products` (globalna — kto sprzedaje, w jakim opakowaniu, za ile)
oraz `location_product_settings` (per lokal — min/max/target). Ekran inwentaryzacji
to `products` ∩ progi lokalu, niezależnie od dostawcy.

**Stan w prod (Supabase, sprawdzony 2026-08-20):**

| Tabela | Wierszy |
|---|---|
| `products` | 145 (ostatni id: P145) |
| `supplier_products` | 145 — 0 produktów u dwóch dostawców, 0 bez dostawcy |
| `location_product_settings` | 568 — WOLA 141 · BRACKA 144 · NORBLIN 145 · KEN 138 |

**Czego brakuje.** Dziewięciu pozycji z arkusza Wolskiej nie ma w katalogu w ogóle.
Dziesiąta (`Tacki papierowe 14x25 100 sztuk`) istnieje jako **P143** u Blue Service —
dodana przy rolloucie Norblina — ale WOLA nie ma dla niej wiersza progów, więc nie
pojawia się ani w inwentaryzacji, ani w zamówieniu.

**Zastany dryf.** Seed dla WOLA ma 134 wiersze, prod 141. Brakuje P135–P141
(Bombilla/Bukat, Corfu Lager/Weiss/Free/Filber, AGROS/KAWA/LIPTON/Intermlecz),
dołożonych w prod przy lane'ach feedback-r6 i r7 bez odzwierciedlenia w seedzie.

## Desired End State

Kapitan Wolskiej widzi na ekranie inwentaryzacji 10 nowych pozycji (9 nowych + tacki
papierowe), a na ekranie zamówienia u Blue Service — te same 10 pozycji z progami
z arkusza Tushara i policzoną sugestią. Bracka, Norblin i KEN nie widzą żadnej zmiany.
Seed w repo zgadza się z prod co do wiersza dla WOLA (141 + 10 = 151).

### Key Discoveries:

- **`order_lines` w prod nie ma ani jednego wiersza dla P143** — decyzja o użyciu
  istniejącego produktu zamiast tworzenia nowego jest odwracalna bez kosztu.
- **Seed nie działa na prod.** `_choose_backend()` (`supply-os-v1/app/main.py:399`)
  wybiera Supabase, gdy skonfigurowany; `seed_loader` to fallback dla testów i dev.
  Skutek: **efekt produkcyjny daje wyłącznie SQL**, a nie merge do main.
- **Tor A nie zmienia kodu**, więc **deploy backendu nie jest potrzebny** — inaczej
  niż przy `product-order-note-and-min-flag`, gdzie SQL musiał wyprzedzić deploy.
- Konwencja `target_stock_qty_base = max_stock_qty_base` obowiązuje we wszystkich
  141 wierszach WOLA w prod — bez wyjątku.
- Konwencja pustej ceny przy nieznanym cenniku (piwa Corfu, P143–P145, commit
  `23dbb78`): `price_estimate_pln` zostaje **puste**, nie zgadywane. Wycena
  zamówienia po prostu tych pozycji nie liczy.
- `supplier_products.csv` w seedzie **nie ma kolumny `order_note`** — istnieje tylko
  w Supabase (migracja 0006). Model ma default `None`, więc brak kolumny jest OK.
- Testy inwentaryzacji używają `len(items) > 0`, nie liczb dokładnych
  (`tests/test_inventory_submit.py:32`). Jedyna twarda liczba produktów to
  `tests/test_main.py:59,65`.
- Jedyny test z dokładną liczbą pozycji orderable dotyczy **Pago × WOLA = 18**
  (`tests/test_main.py:119`). Tor A nie rusza Pago, więc zostaje zielony.

## What We're NOT Doing

- **Nie przepinamy zszywek, markerów ani długopisów** z Pago na Blue Service —
  to lane `supplier-per-location`.
- **Nie dodajemy filtra `sp.active`** do `_build_orderable_items`. Bug jest realny
  (kolumna istnieje, kod jej nie czyta), ale jego naprawa ma sens dopiero razem
  z wymiarem dostawcy — udokumentowany w lane B.
- **Nie dodajemy progów dla BRACKA, NORBLIN ani KEN.** Tych pozycji nie ma w ich
  arkuszach. Precedens: P143–P145 dostały wiersze tylko tam, gdzie były w arkuszu.
- **Nie zmieniamy nazwy, kategorii ani jednostki P143.** Pola są globalne, a produkt
  jest już używany przez dwa lokale.
- **Nie zgadujemy cen.** Wszystkie nowe pozycje wchodzą z pustym `price_estimate_pln`.
- **Nie ruszamy frontendu.** Ekrany czytają katalog z API; nowe pozycje pojawią się same.

## Implementation Approach

Trzy fazy, każda samodzielnie odwracalna i możliwa do porzucenia bez blokowania
pozostałych:

1. **Katalog** — wiersze w trzech plikach seed + aktualizacja dwóch asercji w testach.
2. **Domknięcie dryfu** — 7 brakujących wierszy WOLA w seedzie (osobno, bo to
   sprzątanie po cudzym lane'ie, nie zgłoszenie Tushara).
3. **Prod** — przygotowany, idempotentny SQL + smoke. Uruchomienie za Twoją zgodą.

Kolejność faz 1→2 jest dowolna; faza 3 musi być ostatnia, bo jej weryfikacja liczy
wiersze dołożone w obu poprzednich.

## Critical Implementation Details

**Seed a prod to dwa niezależne zapisy tej samej zmiany.** Prod czyta Supabase, seed
obsługuje testy i dev. Merge do main **nie zmieni nic** dla kapitana Wolskiej —
zmianę produkcyjną robi wyłącznie SQL z fazy 3. To odwrotność intuicji z większości
lane'ów w tym repo i najłatwiejszy błąd do popełnienia przy tym planie.

**Literówki w arkuszu prostujemy w katalogu.** Arkusz ma `Szczotlka` i `stolikow`.
W katalogu wchodzą poprawne `Szczotka` i `stolików` — nazwa zostaje rozpoznawalna,
a kapitan i tak liczy z papieru, nie porównuje znak po znaku.

**Kategoria `Chemia` dla wszystkich dziewięciu, łącznie z `Marker podświetlacz`.**
Zakreślacz „należy" do `Biurowe`, ale arkusz Tushara ma go w `Chemia`, a kategoria
steruje grupowaniem na ekranie inwentaryzacji. Ekran ma się zgadzać z kartką, z której
kapitan liczy — spójność z arkuszem wygrywa nad czystością taksonomii.

## Phase 1: Katalog — 9 nowych produktów + Blue Service + progi WOLA

### Overview

Dodaje dziewięć produktów do katalogu, wiąże je z Blue Service i nadaje im progi
Wolskiej z arkusza. Przy okazji dokłada brakujący próg WOLA dla istniejącego P143.

### Changes Required:

#### 1. Katalog produktów

**File**: `docs/pita-supply-os-v1/seed/products.csv`

**Intent**: Dziewięć nowych pozycji z arkusza Wolskiej, których nie ma w katalogu.
Numeracja ciągła od ostatniego wolnego id.

**Contract**: Dziewięć wierszy P146–P154, kolumny
`product_id,gostock_id,product_name_pl,product_category,inventory_unit,is_critical,active,notes`.
`gostock_id` puste (pozycje spoza GoStocka), `product_category` = `Chemia`,
`inventory_unit` = `szt`, `is_critical` = `FALSE`, `active` = `TRUE`.

| id | nazwa |
|---|---|
| P146 | Aroma Patyczki zapachowe |
| P147 | Attis odświeżacz powietrza 300 ml |
| P148 | Szczotka do zamiatania na kiju Vileda |
| P149 | Szufelka ze zmiotką |
| P150 | Marker podświetlacz |
| P151 | Płyn do podłogi 5L |
| P152 | Cleaner w sprayu do stolików drewnianych lakierowanych |
| P153 | Zapas do mopa płaskiego Vileda Ultra Max |
| P154 | Tetra |

#### 2. Powiązanie z dostawcą

**File**: `docs/pita-supply-os-v1/seed/supplier_products.csv`

**Intent**: Każdy z dziewięciu produktów kupowany jest w Blue Service, na sztuki,
bez przeliczania opakowań. Cena nieznana — zostaje pusta zgodnie z konwencją.

**Contract**: Dziewięć wierszy `SP_BLUESERV_P146` … `SP_BLUESERV_P154`,
`supplier_id` = `SUP_BLUESERV`, `supplier_product_name` = nazwa jak w `products.csv`,
`purchase_unit` = `szt`, `units_per_purchase_unit` = `1`, `rounding_rule` = `full_only`,
`price_estimate_pln` **puste**, `active` = `TRUE`,
`notes` = `cena do uzupelnienia po pierwszej fakturze`.

#### 3. Progi Wolskiej

**File**: `docs/pita-supply-os-v1/seed/location_product_settings.csv`

**Intent**: Dziesięć wierszy dla WOLA — dziewięć nowych plus brakujący P143 —
z min/max przepisanymi z arkusza. `target` = `max` zgodnie z konwencją repo.

**Contract**: `setting_id` w formacie `WOLA__P1NN`, `location_id` = `WOLA`,
`is_critical_for_location` = `FALSE`, `allow_over_max_due_to_packaging` = `FALSE`,
`notes` = `wolska-blueservice-master-data 2026-08-20: arkusz min/max`.

| product_id | min | max | target | pozycja w arkuszu |
|---|---|---|---|---|
| P143 | 1 | 3 | 3 | Tacki papierowe 14x25 100 sztuk |
| P146 | 1 | 2 | 2 | Aroma Patyczki zapachowe |
| P147 | 1 | 3 | 3 | Attis odświeżacz powietrza 300 ml |
| P148 | 1 | 2 | 2 | Szczotlka do zamiatania na kiju Vileda |
| P149 | 1 | 2 | 2 | Szufelka ze zmiotką |
| P150 | 1 | 3 | 3 | Marker podświetlacz |
| P151 | 1 | 2 | 2 | Płyn do podłogi 5L |
| P152 | 1 | 2 | 2 | Cleaner w sprayu do stolikow drewnianych lakierowanych |
| P153 | 1 | 2 | 2 | Zapas do mop płaski vileda Ultra Max |
| P154 | 2 | 5 | 5 | Tetra |

#### 4. Asercje liczby produktów

**File**: `supply-os-v1/tests/test_main.py`

**Intent**: Dwa testy pilnują dokładnej liczby produktów w katalogu; dziewięć nowych
pozycji je zmienia. To celowa aktualizacja oczekiwania, nie obejście.

**Contract**: `test_products_with_captain_token` (linia 59) i
`test_products_with_manager_token` (linia 65): `145` → `154`.

### Success Criteria:

#### Automated Verification:

- Backend testy przechodzą: `cd supply-os-v1 && python -m pytest`
- Lint czysty: `cd supply-os-v1 && ruff check .`
- Wszystkie trzy pliki seed parsują się i mają spójne id: `python3 -c` sprawdzający,
  że każdy `product_id` z P146–P154 ma dokładnie jeden wiersz w `products.csv`,
  jeden w `supplier_products.csv` i jeden w `location_product_settings.csv` dla WOLA
- `test_captain_orderable_wola_pago_returns_18_items` nadal zielony (dowód, że Pago
  nie został tknięty)

#### Manual Verification:

- Przegląd diffa: żaden istniejący wiersz nie został zmieniony — same dopiski na końcu plików

---

## Phase 2: Domknięcie dryfu seed↔prod dla WOLA

### Overview

Seed dla WOLA jest o 7 wierszy uboższy niż prod. Faza domyka różnicę, żeby seed
znów był wiernym lustrem prod — inaczej dryf narasta przy każdym kolejnym lane'ie.

### Changes Required:

#### 1. Brakujące progi WOLA

**File**: `docs/pita-supply-os-v1/seed/location_product_settings.csv`

**Intent**: Odtworzyć w seedzie siedem wierszy dołożonych w prod przy feedback-r6/r7.
Wartości przepisane z prod, nie wymyślone.

**Contract**: Siedem wierszy `WOLA__P135` … `WOLA__P141` z min/max/target odczytanymi
z prod: P135 Bombilla 2/10, P136 Corfu Lager 6/6, P137 Corfu Weiss 6/6,
P138 Corfu Free 6/6, P139 AGROS 0.5/1.5, P140 KAWA 0.5/1.5, P141 LIPTON 0.5/1.5.
`notes` = `domkniecie dryfu seed<->prod 2026-08-20 (feedback-r6/r7)`.

### Success Criteria:

#### Automated Verification:

- Backend testy przechodzą: `cd supply-os-v1 && python -m pytest`
- Liczba wierszy WOLA w seedzie = 151 (134 + 10 z fazy 1 + 7 z fazy 2)
- Zbiór `product_id` dla WOLA w seedzie jest identyczny ze zbiorem w prod
  (po zastosowaniu SQL z fazy 3)

#### Manual Verification:

- Brak — faza dotyczy wyłącznie pliku używanego przez testy i dev

---

## Phase 3: Wdrożenie na prod (Supabase)

### Overview

Jedyna faza z realnym efektem dla kapitana. Przygotowuje idempotentny SQL i weryfikuje
wynik zapytaniem kontrolnym. **Uruchomienie wymaga Twojej wyraźnej zgody.**

### Changes Required:

#### 1. Skrypt SQL

**File**: `context/changes/wolska-blueservice-master-data/prod-sql.sql`

**Intent**: Wprowadzić do prod dokładnie te same wiersze co faza 1. Idempotentny, żeby
dwukrotne uruchomienie nie zdublowało danych i nie nadpisało ręcznych korekt operatora.

**Contract**: Trzy bloki `INSERT … ON CONFLICT DO NOTHING` — `products` (P146–P154),
`supplier_products` (SP_BLUESERV_P146–P154), `location_product_settings`
(WOLA__P143 + WOLA__P146–P154). Bez `ALTER`, bez `UPDATE`, bez `DELETE` — wyłącznie
dopiski. Faza 2 **nie** ma odpowiednika w SQL: te wiersze w prod już są.

#### 2. Zapytanie weryfikacyjne

**File**: `context/changes/wolska-blueservice-master-data/prod-sql.sql` (sekcja na końcu, zakomentowana)

**Intent**: Potwierdzić wynik liczbami, a nie „wygląda dobrze".

**Contract**: `SELECT` zwracający: `products` = 154, `supplier_products` = 154,
progi WOLA = 151, oraz listę 10 pozycji Blue Service widocznych dla WOLA.

### Success Criteria:

#### Automated Verification:

- Zapytanie kontrolne zwraca: `products` = 154, `supplier_products` = 154,
  `location_product_settings` dla WOLA = 151
- `GET /api/captain/orderable?supplier_id=SUP_BLUESERV` z tokenem WOLA zwraca
  10 nowych pozycji więcej niż przed zmianą
- Powtórne uruchomienie SQL nie zmienia żadnej z powyższych liczb (dowód idempotencji)

#### Manual Verification:

- Kapitan Wolskiej widzi 10 nowych pozycji na ekranie inwentaryzacji, w grupie `Chemia`
- Na ekranie zamówienia u Blue Service pozycje mają policzoną sugestię i widoczną matematykę
- Bracka i Norblin: liczba pozycji u Blue Service **bez zmian**
- Wycena zamówienia nie pokazuje 0 zł ani błędu przy pozycjach z pustą ceną

**Implementation Note**: Po fazie 3 zatrzymaj się i poczekaj na potwierdzenie od
operatora, że kapitan faktycznie widzi pozycje, zanim lane zostanie zamknięty.

---

## Testing Strategy

### Unit Tests:

- Bez nowych testów. Zmiana jest wyłącznie danymi; istniejący zestaw (438 testów)
  pokrywa ścieżki, które te dane przechodzą.
- Dwie asercje liczby produktów wymagają aktualizacji (faza 1, zmiana nr 4).

### Integration Tests:

- `test_captain_orderable_wola_pago_returns_18_items` pełni tu rolę testu regresji:
  jeśli zzielenieje na innej liczbie, znaczy że tor A dotknął Pago i wszedł w zakres toru B.

### Manual Testing Steps:

1. Zaloguj się tokenem kapitana Wolskiej, otwórz inwentaryzację, odszukaj grupę `Chemia`.
2. Sprawdź obecność wszystkich 10 pozycji i poprawność polskich znaków w nazwach.
3. Wpisz stan poniżej minimum przy `Tetra` (min 2) i potwierdź, że sugestia się liczy.
4. Otwórz zamówienie u Blue Service i sprawdź, że pozycje mają widoczną matematykę sugestii.
5. Przełącz się na Brackę i Norblin — potwierdź brak zmian w liczbie pozycji.

## Migration Notes

Zmiana jest addytywna i nie wymaga backfillu. Rollback: usunięcie wierszy P146–P154
z trzech tabel prod (`DELETE FROM location_product_settings WHERE product_id BETWEEN
'P146' AND 'P154' AND location_id='WOLA'`, analogicznie `supplier_products` i
`products`, w tej kolejności ze względu na klucze obce) plus revert commita. Wiersz
`WOLA__P143` przy rollbacku również do usunięcia. Ryzyko utraty danych zerowe —
w prod nie ma historii zamówień dla żadnej z tych pozycji.

**Deploy nie jest potrzebny** — tor A nie zmienia kodu backendu ani frontendu.

## References

- Lane B (zablokowane 3 pozycje biurowe): `context/changes/supplier-per-location/change.md`
- Precedens dodania produktów spoza katalogu: commit `23dbb78` (P143–P145, norblin-rollout)
- Precedens SQL uruchamianego przez operatora: `context/changes/product-order-note-and-min-flag/prod-sql.sql`
- Arkusz źródłowy „Wolska stock" (gid=0), zweryfikowany 2026-08-20

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Katalog — 9 nowych produktów + Blue Service + progi WOLA

#### Automated

- [x] 1.1 Backend testy przechodzą (`python -m pytest`)
- [x] 1.2 Lint czysty (`ruff check .`)
- [x] 1.3 Spójność id P146–P154 w trzech plikach seed
- [x] 1.4 `test_captain_orderable_wola_pago_returns_18_items` nadal zielony

#### Manual

- [ ] 1.5 Przegląd diffa — żaden istniejący wiersz nie zmieniony

### Phase 2: Domknięcie dryfu seed↔prod dla WOLA

#### Automated

- [ ] 2.1 Backend testy przechodzą
- [ ] 2.2 Liczba wierszy WOLA w seedzie = 151
- [ ] 2.3 Zbiór product_id dla WOLA zgodny z prod

### Phase 3: Wdrożenie na prod (Supabase)

#### Automated

- [ ] 3.1 Zapytanie kontrolne: products=154, supplier_products=154, progi WOLA=151
- [ ] 3.2 `/api/captain/orderable` dla Blue Service zwraca 10 nowych pozycji
- [ ] 3.3 Powtórne uruchomienie SQL nie zmienia liczb (idempotencja)

#### Manual

- [ ] 3.4 Kapitan Wolskiej widzi 10 pozycji w grupie `Chemia`
- [ ] 3.5 Sugestia i matematyka liczą się na ekranie zamówienia
- [ ] 3.6 Bracka i Norblin bez zmian
- [ ] 3.7 Wycena nie błęduje przy pustych cenach
