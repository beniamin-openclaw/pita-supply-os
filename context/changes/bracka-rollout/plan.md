# Implementation Plan: bracka-rollout

## Background

Etap „+2 lokalizacje" z PRD (*Rollout plan*: Week 1 Wola × Bukat → Week 2 więcej dostawców →
**Next: +2 lokalizacje**). Operator dostarczył `Bracka - Inwentaryzacja - Bracka Min Max.csv`
(118 wierszy) i chce, żeby **Bracka składała zamówienia jeszcze dziś, z pełną funkcjonalnością**.

Zadanie było już zapisane jako otwarte w `feedback-r4-suppliers-master-data`:
„Rollout BRACKA + KEN: adresy dostawy, tokeny Captain (Railway env), kopia
location_product_settings z WOLA + korekta per lokal".

## Goals

1. **Dane master BRACKA** odzwierciedlają CSV operatora, nie kopię z WOLA.
2. **Kapitan Bracki się loguje** — token w `SUPPLY_OS_CAPTAIN_TOKENS` (krok operatora, Railway).
3. **Zamówienia z Bracki widoczne u Managera** — dziś kolejka jest zahardkodowana na WOLA.

## Non-Goals (potwierdzone z operatorem 2026-08-07)

- Dodawanie nowych produktów z CSV, których nie ma w systemie (6 pozycji — brak danych
  o jednostce zakupu / szt. w opakowaniu / cenie). Trafiają na listę follow-up; Manager może
  je doraźnie dorzucić do zamówienia (`add-product-to-order`).
- KEN — poza zakresem (brak CSV min/max; `location_product_settings` KEN zostaje kopią WOLA).
- Zmiana silnika sugestii, schematu danych, uprawnień. Model dwóch tokenów bez zmian.
- Per-manager identity / filtrowanie kolejki po lokalizacji z tokena — Manager nadal widzi
  wszystkie lokale (zgodnie z PRD: „the Manager spans locations").

---

## Current State Analysis

### Dane w prod (Supabase `lpzhphufjwrndfogkfub`, sprawdzone 2026-08-07)

| Fakt | Stan |
|---|---|
| `locations.BRACKA` | istnieje, `active=true`, `ul. Bracka 20` / `00-028 Warszawa` |
| stopka spółki | `Pita Bros Centrum Sp. z o.o.` / NIP `5223314413` / `ul. W. Laskonogiego 9` — komplet |
| `location_product_settings` BRACKA | **138 wierszy, kopia 1:1 z WOLA** (`notes = 'baza: kopia WOLA 2026-07-16'`, 0 różnic min/max/target) |
| braki vs WOLA (141) | P139, P140, P141 (miód saszetki, kawa Jacobs, herbata Lipton) — brak wiersza dla BRACKA |
| `setting_id` | konwencja `<LOCATION>__<PRODUCT_ID>` |

Wniosek: **nie trzeba tworzyć lokalu ani nowych produktów — trzeba podmienić progi min/max.**

### Kod

`frontend/src/pages/ManagerPage.tsx:38`:

```ts
const LOCATION_ID = "WOLA"; // single-location queue today (matches F3 + spec §1 non-goals)
```

Używane w 4 wywołaniach `api.managerQueue(LOCATION_ID, <status>)` (linie 81–84). Backend
(`manager_queue`) traktuje `location_id` jako **opcjonalny** filtr — `None` = wszystkie lokale.
Czyli backend jest gotowy; blokuje wyłącznie frontend.

Co już działa i **nie wymaga zmian**:

- `ManagerQueue.tsx:147` renderuje `{item.location_id} → {item.supplier_name}` — lokal jest
  widoczny na kafelku kolejki.
- `ManagerInventoryPage.tsx` ma już własny filtr lokalizacji (wzorzec do naśladowania).
- `ManagerFilterBar.tsx` ma filtr dostawcy (`select`) + statusu (chipy) — brakuje lokalizacji,
  co PRD FR-014 wymienia wprost („supplier, location, status").
- Kapitan: lokalizacja pochodzi z tokena (`require_captain`), brak hardkodów w UI kapitana.
- Inwentaryzacja, przyjęcia (WZ), edycja zamówienia — per-lokal z tokena, bez zmian.

### Mapowanie CSV → produkty (zweryfikowane zapytaniem, nie założeniem)

118 wierszy CSV = 1 wiersz bez min/max (Kubeczki papierowe, pomijamy) + **110 dopasowanych
1:1 do istniejących produktów** + **7 niedopasowanych**.

Dopasowanie po znormalizowanej nazwie (`lower` + zwinięcie białych znaków) plus 3 aliasy:

| CSV | Produkt w systemie |
|---|---|
| `Rucola 100 gr` | P007 `Rucola 125 gr` |
| `Fuze Tea` | P081 `Fuzetea` |
| `Rolki do kasy 80/80` | P129 `Rolki do kasy 80 na 80` |

110 wierszy → 110 **różnych** `product_id` (brak kolizji i duplikatów — sprawdzone).

Niedopasowane 7 (→ follow-up, decyzja operatora: pomijamy dziś):
`Tacki papierowe` (Blue Service), `Odświeżacz powietrza Spray`, `Odświeżacz powietrza Patyczki`,
`Corfu Pilsner`, `Bifteki burgers` (Pago), `Rolki do kasy 57/80`, `Rolki do kasy 80/20`.

### Skala vs WOLA (kontrola zdrowego rozsądku)

Wartości CSV są w **jednostce inwentaryzacyjnej produktu** (jak przy imporcie WOLA w r4) —
ostatnia kolumna CSV („jednostka miary") bywa niespójna z systemem (np. Gyros 15 KG: CSV „Szt",
system `kg`), ale liczby są w tej samej skali co WOLA (Gyros 4/8 vs WOLA 2/10; Pomidor 6/24
vs 12/42; Halloumi 12/48 vs 24/72). Żadna pozycja nie odstaje o rząd wielkości.

---

## Data Contract

`location_product_settings` (BRACKA):

| Grupa | Liczba | Akcja |
|---|---|---|
| A. Pozycje z CSV | 110 | `min` = CSV min, `max` = CSV max, **`target` = max** (reguła z r4: sugestia dobija do MAX) |
| B. Spoza CSV, dostawca objęty CSV | 18 | `min = max = target = 0` (pozycja widoczna, sugestia 0, można zamówić ręcznie) |
| C. Spoza CSV, brak wiersza BRACKA | 3 | INSERT `P139/P140/P141` z 0/0/0, `setting_id = BRACKA__<PID>` |
| D. Produkcja własna (SUP_INTERNAL, 9) + butla gazowa (SUP_KAMINO, 1) | 10 | **bez zmian** — nie ma ich w CSV, bo to nie zakupy od dostawcy |

Razem po zmianie: 141 wierszy BRACKA (tyle samo co WOLA).

Grupa B (18): P099, P105, P108, P110, P113, P114, P115, P126 (Blue Service), P135 Bombilla
(Bukat), P063 Monster, P078 Lech Free, P079 Kinley (Coca Cola), P060, P062 Ionos 2l (Eurofood),
P039 Ocet, P056 Cukier w saszetkach (Intermlecz), **P128 „Rolki do kasy 57 na 20", P130 „Rolki
do kasy 57 na 30"** (Pago).

> P128/P130 zerujemy świadomie: CSV chce rolek (wiersze 57/80 i 80/20), ale nazwy nie mapują się
> jednoznacznie na rozmiary w systemie. Zero = brak sugestii (kapitan i tak wpisze ręcznie),
> a nie zawyżona sugestia ze skali Wolskiej (10/40 i 10/80). Pozycja jest na liście follow-up.

Kolumny **nietykane**: `is_critical_for_location`, `allow_over_max_due_to_packaging`, `notes`
(zostają z kopii WOLA — to charakterystyki produktu, nie progi lokalu).

---

## Implementation Phases

### Faza 1 — Kod: filtr lokalizacji w kolejce Managera

**`frontend/src/pages/manager/ManagerFilterBar.tsx`**
- Nowe propsy: `locationOptions: LocationOption[]`, `selectedLocationId: string | null`,
  `onLocationChange`. Renderuj `select` nad filtrem dostawcy, wzorowany 1:1 na istniejącym
  (te same klasy, ten sam kształt „wszystkie / lista").
- Eksportuj `LocationOption { id, name }` obok `SupplierOption`.

**`frontend/src/pages/ManagerPage.tsx`**
- Usuń `const LOCATION_ID = "WOLA"`.
- `api.managerQueue(undefined, status)` — pobieramy **wszystkie lokale**; filtrowanie po lokalu
  odbywa się po stronie klienta, tak jak istniejący filtr dostawcy (spójność + brak dodatkowych
  round-tripów przy przełączaniu).
- Stan `selectedLocationId` (domyślnie `null` = wszystkie), opcje budowane z pobranych zamówień
  (`location_id`) wzbogacone nazwą z `api.locations()` — jak `ManagerInventoryPage` buduje swoje.
- Filtr lokalizacji wchodzi do `anyActive` / `onClear`.

**`frontend/src/i18n/strings.ts` (PL + EN)**
- `manager.filter.locationLabel`, `manager.filter.allLocations`.

**`frontend/src/pages/CaptainPage.tsx:92`** — nagłówek „Orderable @ WOLA × …" to zaszłość
z ekranu diagnostycznego; podmiana na neutralne „Orderable × {supplier}" (nie ma dostępu do
`location_id` kapitana w tym widoku, a wyświetlanie „WOLA" kapitanowi Bracki to fałsz).

### Faza 2 — Dane: import min/max BRACKA (prod Supabase)

Wykonanie przez MCP Supabase, w jednym batchu, w kolejności:

1. Tabela stagingowa `_bracka_csv_import` (110 wierszy) — **już wgrana** podczas weryfikacji.
2. **Snapshot rollbacku**: `create table _bracka_lps_backup_20260807 as select * from
   location_product_settings where location_id='BRACKA'` — pełny stan sprzed zmiany.
3. UPDATE grupy A (110) z joinem po znormalizowanej nazwie + aliasach.
4. UPDATE grupy B (18) → 0/0/0.
5. INSERT grupy C (3).
6. `drop table _bracka_csv_import` (staging sprząta po sobie; backup zostaje).

### Faza 3 — Seed + dokumentacja

- `docs/pita-supply-os-v1/seed/locations.csv` — BRACKA: `active` FALSE→TRUE, adres i miasto
  jak w prod (seed to fallback dev/testów; testy mockują `load_locations`, więc bez ryzyka).
- `docs/pita-supply-os-v1/COMPANY_ENTITIES.md` — odhaczyć Brackę jako wdrożoną.
- `context/changes/bracka-rollout/rollout-notes.md` — dziennik operacji + rollback + follow-up.

### Faza 4 — Token kapitana (krok operatora)

Agent **nie ustawia zmiennych na Railway** (zasada z RAILWAY_DEPLOY_RUNBOOK). Wygeneruję
kandydata na token i podam gotową wartość `SUPPLY_OS_CAPTAIN_TOKENS` (WOLA + BRACKA), operator
wkleja w Railway → Variables. Restart usługi następuje automatycznie.

---

## Verification

1. `python -m pytest` (backend) + `npm run build | lint | test` (frontend) — przez `/verify`.
2. SQL post-check: 141 wierszy BRACKA, 110 zgodnych z CSV, 21 wyzerowanych, 10 nietkniętych,
   `target = max` wszędzie, brak `min > max`.
3. Smoke w prod po deployu — **wyłącznie GET** (żadnego submitu; zasada: nigdy prawdziwe
   zamówienie z testu): `/api/captain/orderable` i `/api/captain/inventory/products`
   tokenem Bracki, `/api/manager/queue` bez `location_id`.
4. UI: kolejka Managera z filtrem lokalizacji (Vercel po merge do `main`).

## Risks

| Ryzyko | Mitygacja |
|---|---|
| Błąd transkrypcji CSV → SQL | Join po nazwie: literówka = brak dopasowania. Zweryfikowane: 110/110 dopasowanych, 7 niedopasowanych to dokładnie te znane spoza systemu. |
| Zła interpretacja jednostek (np. Gyros „Szt" vs `kg`) | Wartości w skali WOLA; silnik tylko sugeruje, Manager zatwierdza przed wysyłką. |
| Cofnięcie zmiany | `_bracka_lps_backup_20260807` — pełny snapshot 138 wierszy. |
| Kolejka Managera pokaże wszystkie lokale (zmiana zachowania dla WOLA) | Zamierzone (FR-014); lokal jest na kafelku, filtr pozwala wrócić do widoku jednego lokalu. |
| Kapitan Bracki widzi pozycje z sugestią 0 | Świadome (decyzja operatora) — lepiej widoczne z zerem niż niewidoczne. |

## Progress

- [x] Faza 1 — kod (filtr lokalizacji + i18n + nagłówek CaptainPage)
- [x] Faza 2 — dane w prod (backup 138 → A 110 → B 18 → C 3 → staging usunięty; 141 wierszy)
- [x] Faza 3 — seed + rollout-notes
- [ ] Faza 4 — token (operator, Railway) + merge do `main`
- [x] Weryfikacja lokalna: pytest 431 ✓, ruff ✓, vite build ✓, eslint ✓, vitest 89 ✓
- [x] SQL post-check: 110/110 zgodnych z CSV, 0 rozbieżności, 0 naruszeń target/min-max
- [ ] Smoke GET w prod (po ustawieniu tokena i deployu)
