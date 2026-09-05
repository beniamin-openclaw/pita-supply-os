# Rolki per lokal + minima dostawców — prod master data

## Overview

Dwie porcje master data, oba wyłącznie dane (zero kodu, zero deployu, zero migracji):

- **Rolki**: dopasować `location_product_settings` do tabeli Sławka (2026-09-04) —
  dwa nowe rozmiary w katalogu (80/20, 57/80), nowe progi w 4 aktywnych lokalach,
  usunięcie rozmiarów, których lokal nie używa, zerowe wiersze „na zapas” w lokalach
  nieaktywnych.
- **Minima**: wpisać `suppliers.minimum_order_value_pln` dla 5 dostawców z arkusza
  Marka, tak żeby chip „poniżej minimum”
  na Managerze i Kapitanie przestał używać fallbacku 400 PLN dla tych dostawców.

## Current State Analysis

**Źródła** — patrz `change.md`. Tabela rolek (rozmiar rolki = `szer/średnica`):

| Lokal | Rolka POS | Rolka drukarka | Kasa fiskalna |
|---|---|---|---|
| Wolska | 57/30 | 80/80 | 57/20 |
| Norblin (Sunmi V3 Mix) | 80/20 | 80/80 | – |
| KEN | 57/20 | 80/80 | – |
| Browary | 57/20 | 80/80 | 57/80 |
| Elektrownia (Sunmi) | 80/20 | 80/80 | – |
| Bracka | 80/20 | 80/80 | 57/80 |
| Stary Browar | 80/20 | 80/80 | 57/30 |
| Słony Spichlerz | 57/30 | 80/80 | – |
| Kulinarna Kamienica | 57/30 | 80/80 | – |
| Forum | 57/30 | 80/80 | – |
| Supersam (Sunmi) | 80/20 | 80/80 | – |
| Westfield Mokotów (Sunmi) | 80/20 | 80/80 | – |

Minima (arkusz Marka, zakładka 2, Warszawa): Intermlecz 650 · Bukat „niby bez limitu,
ok. 500, za 300 też dowiozą” · Cola 500 · Kuchnie 600 · GoGastro 600 · BlueService
„bez sztywnego limitu, 500 można ustawić”.

**Prod (Supabase `lpzhphufjwrndfogkfub`, sprawdzone 2026-09-05):**

- `products` 175 (ostatnie id P175). Rolki: P128 57/20, P129 80/80, P130 57/30,
  P142 57/50 — wszystkie `Biurowe` / `szt`, aktywne, pod `SUP_MORY` (wiersze
  `SUP_PAGO` nieaktywne od 2026-09-03). **Brak rozmiarów 80/20 i 57/80.**
  Rozmiar 57/50 (P142, dodany przy norblin-rollout „do potwierdzenia”) nie występuje
  u Sławka.
- `suppliers.minimum_order_value_pln` = NULL dla wszystkich 14 wierszy. GoGastro nie
  istnieje jako dostawca.
- Progi rolek w aktywnych lokalach vs Sławek:

| Lokal | DB dziś (min/max) | Sławek | Rozjazd |
|---|---|---|---|
| WOLA | P128 10/40 · P129 6/60 · P130 10/80 | 57/30, 80/80, 57/20 | brak |
| KEN | P128 6/20 · P129 6/12 · P130 10/80 | 57/20, 80/80 | P130 zbędne |
| BROWARY | P128 10/30 · P129 6/12 | 57/20, 80/80, 57/80 | brak 57/80 |
| BRACKA | P128 1/4 · P129 1/2 · P130 1/2 | 80/20, 80/80, 57/80 | 2 nowe, 2 zbędne |
| NORBLIN | P142 5/40 · P129 3/20 · P128 0 · P130 0 | 80/20, 80/80 | 57/50 → 80/20 |

- Lokale nieaktywne mają wiersze 0/0/0 („threshold TBC”): ELEKTROWNIA (P129), FORUM
  (P128/129/130), KAMIENICA + KULINARNA (P129/130 — wygląda na duplikat jednego
  punktu, nie ruszamy), SLONY (P129/130), STARY_BROWAR (P129/130), SUPERSAM
  (P129/130), WESTFIELD (P129).
- `order_lines` dla P128/129/130/142 od lipca: prawie wyłącznie zamówienia
  `cancelled` (treningowe 23–25.08, 31.08, 01.09) plus jedno `manager_sent` z 30.07
  (WOLA, P129). Historia trzyma FK na `products`, nie na `location_product_settings`,
  więc usunięcie wiersza progu niczego nie łamie.

**Jak dane wchodzą na ekran** (`supply-os-v1/app/main.py`):
- inventory count = `products.active` ∩ wiersz w `location_product_settings`
  (`captain_inventory_products`);
- order screen = `supplier_products.active` ∩ `products.active` ∩ wiersz w
  `location_product_settings` (`_build_orderable_items`).

**Konsekwencja:** wiersz 0/0/0 NIE ukrywa produktu — kapitan nadal widzi go na liście
inwentaryzacji i na ekranie zamówienia (z sugestią 0). Żeby lokal widział tylko swoje
rozmiary, wiersz trzeba **usunąć**, nie wyzerować. To jedyna decyzja projektowa w tej
zmianie — patrz „Critical Implementation Details”.

**Chip minimum** (`frontend/src/lib/minimumOrder.ts`): `minimum ?? 400`. Wpisanie
realnej wartości zmienia tylko próg chipu; nic serwerowego nie czyta tej kolumny,
nic nie blokuje submitu ani dispatchu.

## Desired End State

- Kapitan w każdym aktywnym lokalu widzi na inwentaryzacji i na ekranie zamówienia
  Mory dokładnie rozmiary rolek z tabeli Sławka, z progami skopiowanymi z dotychczasowych
  wierszy rolek tego lokalu.
- Lokale nieaktywne mają przygotowane wiersze 0/0/0 dla rozmiarów z tabeli, gotowe
  do wypełnienia przy rolloucie.
- Chip minimum dla Intermlecz / Bukat / Coca-Cola / Kuchnie Świata / Blue Service używa
  wartości z arkusza zamiast 400 PLN.
- `change.md` ma wpis wykonania z licznikami BEFORE/AFTER (lessons.md „Master-data ops”).

### Key Discoveries

- **Skrypt `training-feedback-0901/prod-sql-phase3.sql` nigdy nie poszedł na prod** i
  rezerwuje id **P176–P182** (gyros split, cieciorka, butle). Nowe rolki dostają
  **P183 / P184**, żeby przyszłe uruchomienie phase3 nie trafiło w `ON CONFLICT DO
  NOTHING` i nie pominęło cicho własnych wierszy.
- Seed CSV (`docs/pita-supply-os-v1/seed/`) ma 154 produkty vs 175 w prod — dryf
  z lanes r7/0901 istnieje już dziś. Seed nie zasila prod (`_choose_backend()`),
  więc **ta zmiana seeda nie dotyka**; domknięcie dryfu to osobna sprzątająca lane.
  Test `test_main.py:59,65` (154) zostaje zielony.
- `location_product_settings` ma `UNIQUE (location_id, product_id)` i `setting_id`
  w formacie `<LOC>__<PID>`; `supplier_products` — `SP_<SUP>_<PID>`.
- Konwencja `target = max` obowiązuje we wszystkich wierszach rolek.
- Cena nowych rolek nieznana → `price_estimate_pln` NULL (konwencja P143–P154).

## What We're NOT Doing

- **Nie dotykamy taśm** — brak źródła (ani mail, ani arkusz). Otwarte na Marka.
- **Nie zmieniamy `purchase_unit` rolek na `opak`** — pack size wciąż nie podany.
- **Nie wpisujemy minimów** dla Pago, Eurofood, Filber, Kamino, Allegro, Selgros,
  Spec Food, Mory, Internal — nie ma ich w arkuszu; zostają NULL (chip = fallback 400).
- **Nie modelujemy minimów per lokal** — kolumna jest globalna; arkusz opisuje
  Warszawę. Jeśli Kraków/Poznań/Gdańsk/Katowice mają inne progi, to osobna zmiana
  (schema).
- **Nie tworzymy lokali** Nocny Market ani MEZE.
- **Nie rozstrzygamy duplikatu** KAMIENICA / KULINARNA — oba nieaktywne, oba
  zostają jak są.
- **Nie ruszamy seeda ani testów** (patrz Key Discoveries).
- **Nie usuwamy produktów** — P142 tylko `active=false` (historia `order_lines`).

## Implementation Approach

Jeden skrypt SQL w jednej transakcji (`prod-sql.sql`), trzy bloki logiczne, każdy
z osobna odwracalny ze snapshotu BEFORE:

1. **Katalog** — P183 „Rolki do kasy 80 na 20”, P184 „Rolki do kasy 57 na 80”
   + `SP_MORY_P183/P184`; P142 → `active=false`.
2. **Progi** — INSERT nowych wierszy, DELETE zbędnych w aktywnych lokalach,
   INSERT 0/0/0 w nieaktywnych.
3. **Dostawcy** — UPDATE 5 minimów (GoGastro tylko w `change.md`).

Kolejność: BEFORE snapshot → APPLY (BEGIN…COMMIT) → AUDYT → wpis w `change.md`.
Brak deployu: prod czyta Supabase, kod nie zmienia się.

## Critical Implementation Details

**DELETE zamiast 0/0/0 dla zbędnych rozmiarów w aktywnych lokalach.** Precedens
norblin-rollout zostawiał wiersze 0/0/0 „brak na liście”, ale ekrany ich nie filtrują —
kapitan widzi produkt z sugestią 0. Skoro celem zmiany jest „który punkt ma jakie
rolki”, wiersz musi zniknąć. Dowód, że nie gubimy stanu (review, uwaga 4): ostatnie
remanenty — Bracka 2026-09-01 ma P128 = 0 i P130 = 0, KEN 2026-09-02 nie ma linii
P130, Norblin nie ma jeszcze żadnego remanentu. Usuwamy 6 wierszy: `KEN__P130`, `BRACKA__P128`,
`BRACKA__P130`, `NORBLIN__P142`, `NORBLIN__P128`, `NORBLIN__P130`. Snapshot BEFORE w
`prod-sql.sql` zawiera ich pełne wartości = rollback. Jeśli operator woli zostawić
wiersze (np. resztki starych rolek do wyliczenia), zamienić DELETE na UPDATE 0/0/0 —
wtedy produkt nadal będzie widoczny.

**Reguła kopiowania progów** (decyzja operatora „kopia z istniejących wierszy”):
nowy wiersz dziedziczy min/max/target po wierszu, którego **rolę** przejmuje
(rolka POS → po dotychczasowej rolce POS, kasa fiskalna → po dotychczasowej rolce
fiskalnej), a gdy roli nie było — po rolce POS tego lokalu. Każdy taki wiersz ma
w `notes` „ESTIM: kopia z <setting_id>”, żeby audyt FR-012 wiedział, że to
przybliżenie.

| Nowy wiersz | Rola | Kopia z | min/max/target |
|---|---|---|---|
| BRACKA__P183 (80/20) | POS | BRACKA__P128 | 1 / 4 / 4 |
| BRACKA__P184 (57/80) | kasa | BRACKA__P130 | 1 / 2 / 2 |
| BROWARY__P184 (57/80) | kasa | BROWARY__P128 (POS) | 10 / 30 / 30 |
| NORBLIN__P183 (80/20) | POS | NORBLIN__P142 | 5 / 40 / 40 |
| ELEKTROWNIA / STARY_BROWAR / SUPERSAM / WESTFIELD __P183 | POS | – (nieaktywne) | 0 / 0 / 0 |

**Minima „miękkie”.** Bukat i Blue Service nie mają sztywnego limitu. Wpisujemy 500
(liczba, którą Marek podał jako roboczą) i zapisujemy kontekst w `suppliers.notes`;
chip jest informacyjny, więc niższe zamówienie nadal przechodzi.

**Ryzyko do zgłoszenia Sławkowi/Markowi, nie blokujące:** KEN złożył 2026-09-01
(treningowo, anulowane) 80 szt rolek 57/30, które według tabeli w KEN nie występują.
Marek w 2025 pisał dla KEN „57/30 fiskal, chyba 57/80 pasują”. Decyzja operatora:
tabela Sławka wygrywa — KEN traci 57/30.

## Phase 1: Katalog (P183, P184, P142)

**File**: `context/changes/rolki-minima-master-data/prod-sql.sql` (blok 2.1)

- `products`: P183 „Rolki do kasy 80 na 20”, P184 „Rolki do kasy 57 na 80” —
  `Biurowe`, `szt`, `is_critical=false`, `active=true`, notes ze źródłem.
- `supplier_products`: `SP_MORY_P183`, `SP_MORY_P184` — `SUP_MORY`, `szt`, 1,
  `full_only`, `price_estimate_pln` NULL, notes jak pozostałe rolki Mory.
- `products` P142 → `active=false` **razem z** `supplier_products.SP_MORY_P142`
  → `active=false` (review, uwaga 2: produkt i wiersz dostawcy wyłączane parą,
  żeby żaden raport po `supplier_products.active` nie widział martwego SKU).
  Rozmiar 57/50 nie występuje w tabeli Sławka; jedyny order_line jest anulowany.

## Phase 2: Progi per lokal

**File**: `prod-sql.sql` (blok 2.2)

- INSERT (tabela wyżej) dla BRACKA, BROWARY, NORBLIN + 4 lokale nieaktywne.
- DELETE 6 wierszy (lista wyżej).
- WOLA i KEN (poza usunięciem `KEN__P130`) bez zmian.

## Phase 3: Minima dostawców

**File**: `prod-sql.sql` (blok 2.3)

| supplier_id | minimum_order_value_pln | notes (dopisek) |
|---|---|---|
| SUP_INTERMLECZ | 650 | arkusz Marka 2026-09 (Warszawa) |
| SUP_BUKAT | 500 | miękkie: „niby bez limitu, ok. 500, za 300 też dowiozą” |
| SUP_COCACOLA | 500 | arkusz Marka 2026-09 (Warszawa) |
| SUP_KUCHNIE | 600 | arkusz Marka 2026-09 (Warszawa) |
| SUP_BLUESERV | 500 | miękkie: „bez sztywnego limitu, 500 można ustawić” |

GoGastro (600) **nie wchodzi do bazy**: nie ma katalogu ani metody zamawiania w
systemie, a wiersz-zaślepka tylko zaśmieca `suppliers` (review, uwaga 5). Wartość
zapisana w `change.md` do czasu onboardingu dostawcy.

## Success Criteria

### Automated Verification (audyt w `prod-sql.sql`, sekcja 3)

- `products` = 177; P183/P184 aktywne, P142 nieaktywne.
- `supplier_products` = BEFORE + 2; każdy z P183/P184 ma dokładnie 1 wiersz.
- `location_product_settings` = BEFORE + 8 − 6; zero wierszy z `target ≠ max`
  lub `min > max`; zero wierszy P128/P130 w BRACKA, P130 w KEN, P142/P128/P130 w NORBLIN.
- `suppliers`: dokładnie 5 wierszy z `minimum_order_value_pln` NOT NULL; liczba
  dostawców bez zmian (14).
- Ponowne uruchomienie skryptu nie zmienia liczników (idempotencja: `ON CONFLICT DO
  NOTHING`, DELETE/UPDATE bez efektu przy drugim przebiegu).
- `GET /api/captain/orderable?supplier_id=SUP_MORY`: **wśród pozycji „Rolki do
  kasy…”** (Mory serwuje też opakowania, więc lista jest dłuższa niż 3) BRACKA ma
  tylko 80/20, 80/80, 57/80; NORBLIN 80/20, 80/80; KEN 57/20, 80/80; BROWARY 57/20,
  80/80, 57/80; WOLA bez zmian.

### Manual Verification

- Kapitan Bracka: inwentaryzacja pokazuje 3 rolki (80/20, 80/80, 57/80), sugestia
  liczy się.
- Manager: kolejka i szczegół zamówienia Intermlecz pokazują chip względem 650, nie 400.

## Testing Strategy

Zmiana wyłącznie danych — suita backendu (seed) nie widzi prodowych wierszy i zostaje
bez zmian. Weryfikacja = audyt SQL + 2 zapytania API + oko operatora na prodzie
(pamięć: użytkownik testuje tylko na deployu).

## Migration Notes

Brak migracji schematu. Rollback = sekcja ROLLBACK w `prod-sql.sql`: przywraca 6
usuniętych wierszy z wartościami ze snapshotu, przywraca **literalne** `notes`
(bez `split_part`, review uwaga 3), zeruje minima, reaktywuje P142 + SP_MORY_P142.
Nowe P183/P184 są usuwane tylko gdy nic ich nie referuje; jeśli w międzyczasie
trafiły do `order_lines` / `inventory_count_lines` / `receipt_lines` (wszystkie
mają FK na `products`), rollback je dezaktywuje zamiast łamać FK (review uwaga 1).

## References

- Źródła: `change.md` (mail Sławka, arkusz Marka).
- Precedens: `context/changes/wolska-blueservice-master-data/prod-sql.sql`.
- Reguła: `context/foundation/lessons.md` „Master-data ops: diff before, audit after”.
- Zablokowane inputy: `context/archive/2026-09-01-training-feedback-0901/change.md`
  (sekcja „Handover flags”, pkt 3).
- Zarezerwowane id: `context/archive/2026-09-01-training-feedback-0901/prod-sql-phase3.sql`.

## Review (Gemini 3.8 Flash, 2026-09-05, plan-harden)

Werdykt: APPROVE_WITH_FIXES. Przyjęte i naniesione: (1) rollback P183/P184 z guardem
FK — potwierdzone na prodzie, że `order_lines`, `inventory_count_lines` i
`receipt_lines` mają FK na `products`; (2) `SP_MORY_P142` wyłączany razem z P142;
(3) snapshot literalnych `notes` w BEFORE i literalne przywrócenie w ROLLBACK zamiast
`split_part`; (4) DELETE progów tylko po sprawdzeniu remanentów — sprawdzone, brak
stanu; (5) GoGastro poza bazą (nullability kolumn była OK, ale zaślepka bez katalogu
nie ma wartości); (6) kryterium API doprecyzowane do pozycji „Rolki do kasy”;
(7) audyt per lokal zawężony do lokali w zmianie. Odrzucone: nic.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 0: Approval
- [x] 0.1 Niezależny review planu (Gemini 3.8 Flash) — 7 uwag naniesionych
- [x] 0.2 Operator zatwierdza plan (2026-09-05, „idziemy z twoją rekomendacją”) (w tym DELETE vs 0/0/0 i Bukat/BlueService = 500)

### Phase 1–3: Apply to prod
- [x] 1.1 BEFORE snapshot uruchomiony, liczniki wpisane do `prod-sql.sql` (175/243/1514/14)
- [x] 1.2 APPLY (jedna transakcja) wykonany 2026-09-05
- [x] 1.3 Audyt: liczniki 177/245/1516/14 + asercje a–c = 0 wierszy
- [x] 1.4 Idempotencja: drugi przebieg z zatrutymi sondami — liczniki bez zmian, 0 wycieków
- [x] 1.5 Orderable Mory (symulacja SQL joinu `_build_orderable_items`) dla WOLA/KEN/BROWARY/BRACKA/NORBLIN zgodne z tabelą

### Manual
- [ ] 2.1 Operator widzi rolki na Bracce i chip 650 dla Intermlecz
- [x] 2.2 Wpis wykonania w `change.md`, status → implemented
