# Implementation Plan: norblin-rollout

## Background

Etap „+2 lokalizacje" z PRD, po WOLA (pilot) i BRACKA (2026-08-07). Operator dostarczył
`Norblin - Inwentaryzacja  - Norblin Min Max.csv` (111 wierszy) i chce, żeby kapitan
Norblina logował się i składał zamówienia z pełną funkcjonalnością.

Wzorzec: `context/archive/2026-08-18-bracka-rollout/`. Procedura ta sama, **z jedną
zasadniczą różnicą**: Bracka istniała w bazie jako kopia progów z WOLA (rollout = UPDATE),
Norblina w bazie nie ma wcale (rollout = INSERT lokalu + INSERT kompletu wierszy).

## Goals

1. **Lokal NORBLIN istnieje** w `locations` z adresem dostawy (stopka maila do dostawcy).
2. **Dane master NORBLIN** odzwierciedlają arkusz operatora — nie kopię z innego lokalu.
3. **Kapitan Norblina się loguje** — token w `SUPPLY_OS_CAPTAIN_TOKENS` (krok operatora).
4. **Zamówienia z Norblina widoczne u Managera** — w kolejce i w filtrze lokalu.

## Non-Goals

- Zmiany w kodzie produkcyjnym — zweryfikowane, że nie są potrzebne (patrz *Current State*).
- Dodawanie produktów, których arkusz chce, a katalog nie ma: `Tacki papierowe`,
  `Kubeczki papierowe`, `Bifteki burgers` (decyzja operatora — follow-up; brak jednostki
  zakupu / szt. w opakowaniu / ceny, a te dane trafiają do maila do dostawcy).
- KEN — nadal kopia progów z WOLA, czeka na własny arkusz.
- Zmiana silnika sugestii, schematu danych, modelu dwóch tokenów.
- Naprawa zastanych drobiazgów: `DebugPage.tsx:29` (`location_id=WOLA` na stronie
  diagnostycznej), `CaptainMP.tsx:35` (`PILOT_SUPPLIER_ID = "SUP_BUKAT"` jako domyślny
  dostawca), rozjazd seed↔prod na WOLA (seed 134 wiersze, prod 141).

---

## Current State Analysis

### Prod (Supabase `lpzhphufjwrndfogkfub`, sprawdzone 2026-08-18)

| Fakt | Stan |
|---|---|
| `locations` | 6 wierszy; **NORBLIN nie istnieje** |
| `location_product_settings` | WOLA 141 · BRACKA 141 · KEN 138 · **NORBLIN 0** |
| katalog `products` | P001–P141, wszystkie `active` |
| `Falafel` | P020, dostawca `SUP_KUCHNIE` = „Kuchnie Świata" — zgodnie z arkuszem |
| konwencja `setting_id` | `<LOCATION>__<PRODUCT_ID>` |

Dane spółki (`COMPANY_ENTITIES.md:20`): `Pita Bros sp. z o.o.`, NIP `9522100633`,
`ul. Żelazna 51/53, 00-841 Warszawa`.

### Kod — zweryfikowany zapytaniami do repo, nie założony

| Pytanie | Odpowiedź | Dowód |
|---|---|---|
| Hardkod lokalizacji w ścieżce produkcyjnej FE? | Nie | jedyny to `DebugPage.tsx:29` (poza flow) |
| `manager_queue` filtruje po lokalu? | `location_id` opcjonalny | `app/main.py:702-706`, `:732` |
| Limit kolejki | `limit=50`, clamp 1..200 | `app/main.py:705`, `:726` |
| `location_name` w kolejce | joinowany, fallback na id | `app/main.py:756`, `:785-786` |
| Dodanie pary `NORBLIN:token` wymaga kodu? | Nie | `app/auth.py:37-46` — parser generyczny |
| Filtr lokalu w UI | opcje z pobranych zamówień | `ManagerPage.tsx:388-399` |

**Wniosek: zero zmian w kodzie produkcyjnym.** Do poprawy wyłącznie liczniki seeda
w testach.

Konsekwencja UX warta odnotowania (nie bloker): filtr „Lokal" buduje opcje z zamówień
w kolejce, więc NORBLIN pojawi się w rozwijanym filtrze dopiero z pierwszym zamówieniem.
Samo zamówienie widać w kolejce natychmiast — kolejka domyślnie ciągnie wszystkie lokale.

### Dopasowanie CSV → katalog

Staging `_norblin_csv_import` (102 wiersze z min/max), join po znormalizowanej nazwie
(`regexp_replace(btrim(lower(x)), '\s+', ' ', 'g')`) + 2 aliasy:

| Alias w arkuszu | Produkt w systemie | Podstawa |
|---|---|---|
| `Rucola 100 gr` | P007 `Rucola 125 gr` | jedyne SKU rukoli w katalogu (potwierdzone przy Bracce) |
| `Rolki do kasy 80/80` | P129 `Rolki do kasy 80 na 80` | zgodność 1:1 po liczbach |

Wynik: **98 wierszy → 98 różnych `product_id`**, zero kolizji. Niedopasowane 4:
`Tacki papierowe` (3/20), `Kubeczki papierowe` (1/2), `Bifteki burgers` (0,5/1,5),
`Rolki do kasy 57/50` (5/40).

### Kontrola skali (zdrowy rozsądek vs WOLA)

Wartości są w jednostce inwentaryzacyjnej produktu; ostatnia kolumna arkusza („jednostka
miary") bywa niespójna z systemem (np. `Halloumi` — arkusz „Szt", system `szt`, ale
kolumna „Jedn. Miary" mówi „Kg”). Liczby są w skali WOLA/Bracki: Pomidor 18/42 (WOLA
12/42), Halloumi 24/72 (WOLA 24/72), Tzatzyki 15/42. Żadna pozycja nie odstaje o rząd
wielkości. **Odwrotnie niż na Bracce**: `Gyros 15 KG` ma jawne 0/0, a `Gyros 25 KG` 2/8 —
Norblin używa dużego opakowania.

---

## Data Contract

`location_product_settings` dla NORBLIN — **142 wiersze INSERT** (lokal jest nowy,
nic nie nadpisujemy):

| Grupa | Liczba | Wartości |
|---|---|---|
| **A. Pozycje z arkusza** | 98 | `min` = arkusz, `max` = arkusz, **`target` = max** (reguła r4) |
| **B. Produkcja własna** (P029–P037) | 9 | progi WOLA **×1,25**, zaokrąglone do 0,1 (decyzja operatora) |
| **C. Spoza arkusza** | 34 | `min = max = target = 0` |
| **D. Nowa rolka** P142 | 1 | 5 / 40 / 40 (wprost z arkusza) |

98 + 9 + 34 + 1 = **142**.

### Grupa B — wyliczone wartości (WOLA ×1,25, zaokrąglenie do 0,1)

| Produkt | WOLA min/max | NORBLIN min/max/target |
|---|---|---|
| P029 Spicy Mayo | 1 / 5 | **1,3 / 6,3 / 6,3** |
| P030 Musztada Miodowa | 1 / 5 | **1,3 / 6,3 / 6,3** |
| P031 Musztada | 0,5 / 1 | **0,6 / 1,3 / 1,3** |
| P032 Ketchup | 0,5 / 1 | **0,6 / 1,3 / 1,3** |
| P033 Ladolimono | 0,3 / 1 | **0,4 / 1,3 / 1,3** |
| P034 Ogórek + papryka | 0,2 / 1,5 | **0,3 / 1,9 / 1,9** |
| P035 Masło czosnkowe | 0,3 / 1 | **0,4 / 1,3 / 1,3** |
| P036 Kasza Pęczak | 0,5 / 1,5 | **0,6 / 1,9 / 1,9** |
| P037 Gyros (ścięty + nieścięty) | 1 / 3 | **1,3 / 3,8 / 3,8** |

Wszystko w `kg`. Follow-up: zweryfikować po pierwszym tygodniu — to jedyna grupa
oparta na przeliczeniu, nie na deklaracji operatora.

### Grupa C — 34 pozycje na 0/0/0

Blue Service (10): P099 mini łyżeczki, P105 płyn do zmywarek, P108 Rosa mydło,
P110 Tytan 5L, P113 Top Grill Tenzi, P114 Top Glass Tenzi, P115 Tytan 500g,
P120 papier toaletowy, P124 worki 60 L, P126 worki 160 L ·
Coca-Cola (6): P063 Monster, P074 Corona, P078 Lech Free, P079 Kinley, P080 Corona 0%,
P081 Fuzetea · Eurofood (6): P059–P062 wina Ionos, P072 Retsina, P073 Mythos ·
Filber (3): P136–P138 piwa Corfu · Intermlecz (5): P039 ocet, P056 cukier w saszetkach,
P139 miód, P140 kawa Jacobs, P141 herbata Lipton · Bukat (1): P135 Bombilla ·
Kamino (1): P134 butla gazowa · Pago (2): P128 rolki 57/20, P130 rolki 57/30.

> Koszt świadomy (F2 z impl-review Bracki): pozycja z sugestią 0 przy **policzonym** stanie
> wymusza od kapitana kod powodu — `delta_pct = |zamówione − 0| / rounding_step` zawsze
> przekracza 25%. Sygnał ląduje w `/api/manager/suggestion-review`, czyli tam, gdzie
> i tak korygujemy master-datę.

### Nowy produkt P142

| Pole | Wartość | Skąd |
|---|---|---|
| `product_id` | `P142` | następny wolny |
| `product_name_pl` | `Rolki do kasy 57 na 50` | arkusz („57/50"), nazewnictwo jak P128/P129/P130 |
| `product_category` | `Biurowe` | kategoria z arkusza, jak pozostałe rolki |
| `inventory_unit` | `szt` | jak P128/P129/P130 |
| `supplier_id` | `SUP_PAGO` | arkusz |
| `purchase_unit` / `units_per_purchase_unit` | `szt` / 1 | jak trzy istniejące rolki |
| `rounding_rule` | `full_only` | jak trzy istniejące rolki |
| `price_estimate_pln` | `1.29` | **oszacowanie** po P130 (najbliższy rozmiar); do potwierdzenia |

Wiersz `location_product_settings` **tylko dla NORBLIN** — WOLA/BRACKA/KEN nie dostają
P142, więc nowe SKU nie pojawi się w ich zamówieniach.

Kolumny nietykane w całym imporcie: `is_critical_for_location` (FALSE),
`allow_over_max_due_to_packaging` (FALSE) — dla nowego lokalu wartości domyślne.

---

## Implementation Phases

### Faza 1 — Dane w prod (wykonuję sam, MCP Supabase)

Kolejność ma znaczenie — backup przed jakimkolwiek zapisem:

1. `_norblin_lps_backup_20260818` = snapshot `location_product_settings` WHERE
   `location_id='NORBLIN'` → **0 wierszy** (symetria runbooka: rollback = „usuń wszystko,
   co dodaliśmy"; pusty snapshot dokumentuje, że przed zmianą nie było nic).
2. INSERT `locations` NORBLIN.
3. INSERT `products` P142 + `supplier_products` `SP_PAGO_P142`.
4. INSERT grupy A (98) — z joina po znormalizowanej nazwie ze stagingu, **nie z ręki**.
5. INSERT grupy B (9) — wyliczone z WOLA ×1,25.
6. INSERT grupy C (34) — 0/0/0.
7. INSERT grupy D (1) — P142 5/40/40.
8. `drop table _norblin_csv_import` (staging sprząta po sobie).

### Faza 2 — Seed + testy (subagenci Sonnet, równolegle)

Seed to fallback dev/testów; prod jest źródłem prawdy, więc wiersze seeda **eksportuję
z prod** po Fazie 1 i przekazuję subagentowi jako gotowy plik.

- `docs/pita-supply-os-v1/seed/locations.csv` — +NORBLIN (`active=TRUE`).
- `docs/pita-supply-os-v1/seed/location_product_settings.csv` — +142 wiersze NORBLIN.
- `docs/pita-supply-os-v1/seed/products.csv` — +P142.
- `docs/pita-supply-os-v1/seed/supplier_products.csv` — +`SP_PAGO_P142`.
- `supply-os-v1/tests/test_main.py` — liczniki: lokalizacje `6`→`7` (:92),
  produkty `141`→`142` (:59, :65).

### Faza 3 — Dokumentacja

- `docs/pita-supply-os-v1/COMPANY_ENTITIES.md` — odhaczyć Norblin jako wdrożony.
- `context/changes/norblin-rollout/rollout-notes.md` — dziennik operacji, rollback,
  follow-up (piszę sam — to zapis operacji na prod, które wykonuję).

### Faza 4 — Token kapitana (krok operatora)

Agent **nie ustawia zmiennych na Railway**. Generuję kandydata na token i podaję
gotową linijkę do dopisania w `SUPPLY_OS_CAPTAIN_TOKENS`. **Token trafia wyłącznie
do odpowiedzi na czacie — nie do plików repo** (wniosek z Bracki: token wylądował
w `rollout-notes.md`, czyli w gicie).

---

## Verification

1. `/verify` przed commitem: `pytest`, `ruff check`, `npm run build | lint | test`.
2. SQL post-check: 142 wiersze NORBLIN; 98 zgodnych z arkuszem co do grosza;
   9 wierszy produkcji = WOLA ×1,25; 34 wiersze 0/0/0; `target = max` wszędzie;
   brak `min > max`; brak sierot FK.
3. Spójność seed ↔ prod dla NORBLIN (te same 142 wiersze).
4. Po merge do `main`: potwierdzić nowy bundle na https://pita-supply-os.vercel.app,
   dopiero potem checklist dla ludzi (zasada: weryfikacja po deployu, nie przed).
5. Smoke w prod **wyłącznie GET** — `/api/captain/orderable`,
   `/api/captain/inventory/products` tokenem Norblina, `/api/manager/queue`.
   **Żadnego submitu ani dispatchu** — nigdy prawdziwe zamówienie z testu.

## Risks

| Ryzyko | Mitygacja |
|---|---|
| Błąd transkrypcji arkusz → SQL | CSV parsowany skryptem do stagingu, join po nazwie; literówka = brak dopasowania. Dry-run przed zapisem: 98/98, 4 niedopasowane to dokładnie te znane. |
| P142 to duplikat istniejącego rozmiaru | Wiersz `location_product_settings` tylko dla NORBLIN, więc pomyłka nie dotyka WOLA/Bracki. Follow-up: potwierdzić rozmiar i cenę przy pierwszej dostawie Pago. Koszt pomyłki ≈ jedno zamówienie rolek. |
| Progi produkcji własnej (×1,25) rozminą się z realnym zużyciem | Jedyna grupa liczona, nie deklarowana. Follow-up po pierwszym tygodniu; poprawka to jeden UPDATE. |
| 34 pozycje z sugestią 0 → kod powodu | Świadome (decyzja operatora); mechanizm opisany operatorowi wprost przy pytaniu. |
| Cofnięcie zmiany | Wszystko to INSERT-y do nowego lokalu → rollback = DELETE po `location_id='NORBLIN'` + DELETE P142. Skrypt w rollout-notes. |
| Rozjazd seed ↔ prod | Seed generowany eksportem z prod, nie przepisywany. |

## Progress

- [x] Faza 1 — dane w prod (backup 0 → lokal → P142 → A 98 → B 9 → C 34 → D 1 = 142 wiersze)
- [x] Faza 2 — seed + testy (4 pliki seeda +145 wierszy, 3 liczniki w test_main.py)
- [x] Faza 3 — dokumentacja + rollout-notes (COMPANY_ENTITIES: Norblin → lokale objęte systemem)
- [x] Faza 4 — token ustawiony przez operatora (Railway) + merge do `main` (PR #20/#21)
- [x] Weryfikacja lokalna: pytest 438 ✓, ruff ✓, vite build ✓, eslint ✓, vitest 89 ✓
- [x] SQL post-check: 98/98 zgodnych z arkuszem, 0 rozbieżności; seed↔prod md5 identyczne
- [x] Smoke GET w prod 2026-08-18: orderable Bukat 15 / Pago 19, inventory/products 142, P142 5/40, Gyros 15 KG 0/0 vs 25 KG 2/8 — zgodnie z arkuszem. Zero submitów.
