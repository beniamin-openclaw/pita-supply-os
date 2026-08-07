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
