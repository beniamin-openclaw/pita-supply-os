# WOLA — 9 nowych pozycji Blue Service + tacki papierowe (tor A) — Plan Brief

> Pełny plan: `context/changes/wolska-blueservice-master-data/plan.md`
> Tor B (zablokowane pozycje biurowe): `context/changes/supplier-per-location/change.md`

## What & Why

Tushar zgłosił 13 pozycji do dodania dla Wolskiej u Blue Service i 3 do usunięcia
z Pago. Weryfikacja pokazała, że listy się zazębiają: 3 „do usunięcia" to te same
produkty co 3 „do dodania" — czyli przepięcie dostawcy, zablokowane architekturą.
Ten plan realizuje **10 pozycji, które są od tamtej decyzji niezależne**, żeby
Tushar dostał 10 z 13 od razu, a decyzja architektoniczna nie zapadała pod presją.

## Starting Point

Prod (Supabase): 145 produktów, 145 wierszy `supplier_products` (reguła 1 produkt =
1 dostawca obowiązuje w praktyce), progi WOLA 141. Dziewięciu pozycji z arkusza
Wolskiej nie ma w katalogu wcale; dziesiąta (`Tacki papierowe`) istnieje jako P143,
ale WOLA nie ma dla niej progów, więc jest niewidoczna. Arkusz Tushara sprawdzony —
uzupełniony, wszystkie 13 pozycji z min/max w sekcji `Chemia`.

## Desired End State

Kapitan Wolskiej widzi 10 nowych pozycji w inwentaryzacji (grupa `Chemia`) i na
ekranie zamówienia u Blue Service, z policzoną sugestią. Bracka, Norblin i KEN bez
żadnej zmiany. Seed w repo zgadza się z prod co do wiersza dla WOLA.

## Key Decisions Made

| Decyzja | Wybór | Dlaczego | Źródło |
|---|---|---|---|
| Zakres | Podział na tor A / tor B | 10 pozycji odblokowanych od razu; architektura bez presji czasu | Operator |
| Wymiar dostawcy | Na lokalu, nie na mieście | Dwa lokale w jednym mieście mogą mieć różnych dostawców | Operator |
| Tacki papierowe | Użyć istniejącego P143 | Brak historii zamówień → rozdzielenie później kosztuje zero | Plan |
| Nazwa/kategoria/jednostka P143 | Bez zmian | Pola globalne, produkt używany przez Brackę i Norblin | Plan |
| Kategoria 9 nowych | `Chemia` (też dla zakreślacza) | Ekran ma się zgadzać z kartką, z której kapitan liczy | Plan |
| Ceny | Puste, nie zgadywane | Konwencja z piw Corfu i P143–P145 (`23dbb78`) | Plan |
| Progi dla innych lokali | Nie dodajemy | Pozycji nie ma w ich arkuszach; precedens P143–P145 | Plan |
| Dryf seed↔prod | Domknąć w osobnej fazie | Ten sam plik; nie domknięty rośnie przy każdym lane'ie | Plan |
| Bug `sp.active` | Odłożony do toru B | Naprawa ma sens dopiero z wymiarem dostawcy | Plan |

## Scope

**W zakresie:** 9 nowych produktów (P146–P154) · 9 powiązań z Blue Service ·
10 wierszy progów dla WOLA (9 nowych + P143) · aktualizacja 2 asercji w testach ·
domknięcie dryfu seed↔prod (7 wierszy) · idempotentny SQL na prod.

**Poza zakresem:** przepięcie zszywek/markerów/długopisów z Pago (tor B) ·
filtr `sp.active` w kodzie (tor B) · progi dla BRACKA/NORBLIN/KEN · zgadywanie cen ·
zmiany nazwy/kategorii/jednostki P143 · frontend · deploy backendu.

## Architecture / Approach

Zmiana wyłącznie danymi, w dwóch niezależnych zapisach: **seed CSV** (testy + dev)
i **SQL na Supabase** (prod). Kluczowa nieoczywistość: prod czyta Supabase, więc
**merge do main nie zmienia nic** dla kapitana — efekt produkcyjny daje wyłącznie SQL
z fazy 3. Kod backendu i frontendu nietknięty, więc **deploy nie jest potrzebny**.

## Phases at a Glance

| Faza | Co dostarcza | Główne ryzyko |
|---|---|---|
| 1. Katalog | 9 produktów + Blue Service + 10 progów WOLA w seedzie | Literówka w id rozjeżdża trzy pliki — łapie to test spójności |
| 2. Dryf seed↔prod | 7 brakujących wierszy WOLA (P135–P141) | Żadne — plik używany tylko przez testy i dev |
| 3. Prod | Idempotentny SQL + smoke | Jedyna faza z realnym efektem; wymaga wyraźnej zgody operatora |

**Prerequisites:** dostęp do Supabase prod (jest) · potwierdzony arkusz Tushara (jest).
**Estimated effort:** jedna sesja; fazy 1–2 mechaniczne, faza 3 to jedno uruchomienie SQL + smoke.

## Open Risks & Assumptions

- **Zakładam, że `Tacki papierowe 14x25 100 sztuk` z arkusza Wolskiej to ten sam
  produkt co P143 u Bracki i Norblina.** Arkusz Wolskiej podaje rozmiar, tamte nie.
  Do potwierdzenia z Tusharem po wdrożeniu — jeśli to inny rozmiar, rozdzielenie na
  osobny produkt kosztuje zero (brak historii zamówień).
- P143 ma jednostkę `opak` i kategorię `Opakowania`, a arkusz Wolskiej `szt` i `Chemia`.
  Zostawiam wartości globalne; kapitan znajdzie pozycję w innej grupie niż na papierze.
- Ceny wszystkich 9 pozycji nieznane — wycena zamówienia ich nie policzy do pierwszej faktury.

## Success Criteria (Summary)

- Kapitan Wolskiej widzi i może zamówić wszystkie 10 pozycji u Blue Service.
- Bracka i Norblin nie zauważają żadnej zmiany.
- Tushar dostaje odpowiedź, że 10 z 13 jest zrobione, a 3 pozostałe czekają na
  decyzję o wymiarze dostawcy — z konkretnym powodem, nie „w trakcie".
