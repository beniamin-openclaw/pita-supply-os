# bracka-rollout — dziennik operacji

Data: 2026-08-07 · Projekt Supabase: `lpzhphufjwrndfogkfub` · Źródło: `Bracka - Inwentaryzacja - Bracka Min Max.csv` (118 wierszy)

## Wykonane w prod (Supabase, MCP)

| Krok | Operacja | Wynik |
|---|---|---|
| 0 | `_bracka_lps_backup_20260807` = snapshot `location_product_settings` WHERE `location_id='BRACKA'` | **138 wierszy** |
| 1 | Staging `_bracka_csv_import` (110 wierszy CSV z min/max) | wgrany, po imporcie `DROP` |
| 2 | Grupa A — UPDATE min/max/target z CSV | **110 wierszy** |
| 3 | Grupa B — UPDATE 0/0/0 (spoza CSV, dostawca objęty CSV) | **18 wierszy** |
| 4 | Grupa C — INSERT `BRACKA__P139/P140/P141` z 0/0/0 | **3 wiersze** |
| — | Stan końcowy | **141 wierszy BRACKA** (tyle co WOLA) |

Zmienionych względem backupu: **97** wierszy (pozostałe miały już identyczne wartości
w kopii z WOLA).

### Kontrola po imporcie (wszystkie zero-błędowe)

| Sprawdzenie | Wynik |
|---|---|
| pozycje CSV zapisane 1:1 (min, max, target=max) | 110 / 110 |
| rozbieżności vs CSV | 0 |
| pozycje spoza CSV, które miały być 0, a nie są | 0 |
| ruszone wiersze produkcji własnej / Kamino | 0 |
| `target <> max` | 0 |
| `min > max` | 0 |
| wierszy 0/0 łącznie | 22 (21 wyzerowanych + `Gyros 25 KG`, który ma 0/0 w CSV) |

### Mapowanie CSV → produkty

Po znormalizowanej nazwie (`lower` + zwinięcie spacji) + 3 aliasy:
`Rucola 100 gr`→P007, `Fuze Tea`→P081, `Rolki do kasy 80/80`→P129.
110 wierszy → 110 różnych `product_id`, bez kolizji.

Nietknięte (brak w CSV, bo to nie zakupy od dostawcy): produkcja własna
P029–P037 (sosy, kasza, gyros ścięty) + P134 Butla gazowa (Kamino) — **10 pozycji**
zostaje z wartościami z WOLA.

## Rollback

```sql
update location_product_settings l
   set min_stock_qty_base    = b.min_stock_qty_base,
       max_stock_qty_base    = b.max_stock_qty_base,
       target_stock_qty_base = b.target_stock_qty_base
  from _bracka_lps_backup_20260807 b
 where l.location_id = 'BRACKA' and l.product_id = b.product_id;

delete from location_product_settings
 where location_id = 'BRACKA'
   and product_id not in (select product_id from _bracka_lps_backup_20260807);
```

Backup zostaje w bazie do czasu potwierdzenia poprawności przez operatora, potem
`drop table _bracka_lps_backup_20260807;`.

## Zmiana kodowa

`ManagerPage.tsx` — usunięty `const LOCATION_ID = "WOLA"`; kolejka pobiera **wszystkie
lokale** (`manager_queue` traktuje `location_id` jako filtr opcjonalny), zawężanie do
jednego lokalu to filtr kliencki. `ManagerFilterBar.tsx` — nowy `select` „Lokal"
(ukryty, gdy w kolejce jest tylko jedna lokalizacja). `strings.ts` — 2 klucze PL/EN.
`CaptainPage.tsx` — nagłówek „Orderable @ WOLA ×" → „Orderable ×" (kapitan Bracki
widziałby cudzy lokal).

`seed/locations.csv` — BRACKA: `active` FALSE→TRUE + adres (seed to fallback dev;
testy mockują `load_locations`).

## Deploy

Commit `7c3b646` wypchnięty na `main` 2026-08-07. Potwierdzone na produkcji:
bundle `assets/index-DSOiBeZz.js` (zgodny z buildem lokalnym) zawiera nowy klucz
„Wszystkie lokale"; `GET /api/locations` → 401 (backend żyje, wymaga tokena).

## Do zrobienia przez operatora

1. **Railway → Variables → `SUPPLY_OS_CAPTAIN_TOKENS`**: dopisać na końcu istniejącej
   wartości `,BRACKA:f79b3beaa6c9833fab417de12d08362f` (agent nie ustawia zmiennych
   na Railway — zasada z RAILWAY_DEPLOY_RUNBOOK).
2. Merge gałęzi do `main` → auto-deploy Railway + Vercel.
3. Przekazać token kapitanowi Bracki (w aplikacji wkleja samo `f79b…`, prefiks `BRACKA:`
   jest po stronie serwera — `sanitizeTokenInput` i tak go obetnie).

## Follow-up (świadomie poza zakresem dzisiaj)

- [ ] **6 pozycji z CSV bez odpowiednika w systemie** — do dodania jako produkty +
      `supplier_products` (potrzebne: jednostka zakupu, szt./opak., cena szacunkowa):
      `Tacki papierowe` (Blue Service), `Kubeczki papierowe` (w CSV bez min/max),
      `Odświeżacz powietrza Spray`, `Odświeżacz powietrza Patyczki` (Blue Service),
      `Corfu Pilsner` (Filber), `Bifteki burgers` (Pago).
- [ ] **Rolki do kasy** — CSV ma `57/80`, `80/80`, `80/20`; system ma `57 na 20`,
      `80 na 80`, `57 na 30`. Zastosowano tylko `80 na 80` (1/2). **P128 („57 na 20")
      i P130 („57 na 30") zostały wyzerowane** regułą „spoza listy → 0" — do korekty,
      gdy potwierdzimy, który rozmiar to który.
- [ ] **KEN** — nadal kopia min/max z WOLA; czeka na własny CSV.
- [ ] `handleClearFilters` w `ManagerPage` resetuje pasy do 3 z 4 (bez `closed`), więc
      po „Wyczyść filtry" chip statusu zostaje aktywny. Zastane, niezwiązane z Bracką.
- [ ] Rotacja tokenów (otwarte od `feedback-r4`) — przy okazji dodawania BRACKA warto
      rozważyć wymianę pozostałych.

---

## Aktualizacja 2026-08-18 — domknięcie findings z impl-review

### F1 — rolki do kasy (ROZWIĄZANE)

Operator potwierdził: Bracka używa **trzech** rolek i wszystkie trzy były w arkuszu
(`57/80`, `80/80`, `80/20`). Katalog ma dokładnie trzy SKU rolek, WOLA ma
skonfigurowane wszystkie trzy — to te same rolki, z rozjechanym nazewnictwem.

Mapowanie po wspólnej liczbie w nazwie (jedyna dostępna przesłanka):

| Arkusz | SKU | min / max | Podstawa |
|---|---|---|---|
| `80/80` | P129 „Rolki do kasy 80 na 80" | 1 / 2 | zgodność 1:1 |
| `80/**20**` | P128 „Rolki do kasy 57 na **20**" | 1 / 4 | wspólne „20" |
| `**57**/80` | P130 „Rolki do kasy **57** na 30" | 1 / 2 | wspólne „57", przez eliminację |

`UPDATE` na `BRACKA__P128` (1/4/4) i `BRACKA__P130` (1/2/2); P129 bez zmian.
**Założenie do weryfikacji przy pierwszej dostawie od Pago** — jeśli P128 i P130 są
odwrotnie, to jeden `UPDATE`; koszt pomyłki ≈ 2 rolki papieru.

### F3 — „Rucola 100 gr" → P007 (ROZWIĄZANE, wymuszone)

W katalogu istnieje **dokładnie jedno** SKU rukoli (P007 „Rucola 125 gr", Bukat) —
sprawdzone zapytaniem po `%ruko%`/`%ruco%`. Alias nie ma alternatywy, więc mapowanie
jest wymuszone konstrukcją, nie zgadywane. Zostaje jedynie kosmetyczna różnica:
progi 3/10 są w opakowaniach 125 g, a arkusz pisał o 100 g.

### F2 — 20 pozycji z sugestią 0 wymaga kodu powodu

Po naprawie rolek lista skurczyła się z 21 do **20** pozycji. Kapitan **może** je
zamówić, ale przy policzonym stanie backend zażąda kodu powodu (odchylenie od
sugestii 0 zawsze przekracza 25%). Świadomie zostawione — sygnał ląduje w
`/api/manager/suggestion-review`, czyli tam, gdzie i tak korygujemy master-datę.

Blue Service (8): mini łyżeczki, płyn do zmywarek, Rosa mydło, płyn Tytan 5L,
Top Grill Tenzi, Top Glass Tenzi, Tytan 500g, worki 160 L ·
Coca-Cola (3): Monster, Lech Free, Kinley · Eurofood (2): Ionos 2l białe i czerwone ·
Intermlecz (5): ocet, cukier w saszetkach, miód, kawa Jacobs, herbata Lipton ·
Bukat (1): Bombilla · Pago (1): Gyros 25 KG (0/0 już w CSV).

### F7 — tabele robocze

`_bracka_csv_import` — już usunięta po imporcie. `_bracka_lps_backup_20260807`
(138 wierszy) — do skasowania po wejściu progów BRACKA do seeda (`git` staje się
trwalszym zapisem stanu niż nieśledzona tabela w `public`).

### F4+F5+F6 — wykonane 2026-08-18 (implementacja: subagenci Sonnet, review: Opus)

- **F4**: `ManagerQueueItem.location_name` (join z `locations`, fallback na id) —
  BE + FE; filtr „Lokal" i kafelek kolejki pokazują „Pita Bros Bracka" zamiast „BRACKA".
- **F5**: `manager_queue` ma `limit=50` (clamp 1..200), cięcie po sortowaniu
  newest-first a PRZED ładowaniem linii i skanem przyjęć; nowy celowany
  `load_receipts_for_orders(order_ids)` w `sheets.py` (filtr po cache) i
  `supabase_backend.py` (`WHERE order_id = ANY(...)`). +8 testów.
- **F6**: seed `location_product_settings.csv` +141 wierszy BRACKA (eksport z prod,
  rolki poprawione po decyzji F1); `products.csv` +P135–P141 i
  `supplier_products.csv` +7 wierszy (Bombilla/Corfu/Intermlecz) — luka odkryta
  przy F6: seed kończył się na P134. Test `test_main.py` zaktualizowany 134→141.
- Weryfikacja końcowa: pytest **438 passed**, ruff czysty, eslint czysty,
  vite build OK, vitest **89 passed**. Spójność seeda: 0 sierot FK,
  0 duplikatów, BRACKA bez naruszeń min≤max/target=max.
