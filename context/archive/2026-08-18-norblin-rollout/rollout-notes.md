# norblin-rollout — dziennik operacji

Data: 2026-08-18 · Projekt Supabase: `lpzhphufjwrndfogkfub` ·
Źródło: `Norblin - Inwentaryzacja  - Norblin Min Max.csv` (111 wierszy)

Różnica wobec `bracka-rollout`: **NORBLIN nie istniał w bazie**. Rollout to komplet
INSERT-ów (lokal + 142 progi + 1 nowy produkt), nie podmiana progów w kopii z WOLA.

## Wykonane w prod (Supabase, MCP)

| Krok | Operacja | Wynik |
|---|---|---|
| 0 | `_norblin_lps_backup_20260818` = snapshot `location_product_settings` WHERE `location_id='NORBLIN'` | **0 wierszy** (stan sprzed zmiany: lokal nie istniał) |
| 1 | Staging `_norblin_csv_import` (102 wiersze arkusza z min/max) | wgrany skryptem z CSV, po imporcie `DROP` |
| 2 | INSERT `locations.NORBLIN` | 1 wiersz |
| 3 | INSERT `products.P142` + `supplier_products.SP_PAGO_P142` | 1 + 1 |
| 4 | Grupa A — INSERT progów z arkusza | **98 wierszy** |
| 5 | Grupa B — INSERT produkcji własnej (WOLA ×1,25) | **9 wierszy** |
| 6 | Grupa D — INSERT `NORBLIN__P142` (5/40/40) | **1 wiersz** |
| 7 | Grupa C — INSERT reszty katalogu 0/0/0 | **34 wiersze** |
| — | Stan końcowy | **142 wiersze NORBLIN** |

Wpis lokalu (stopka maila do dostawcy jest kompletna):

```
NORBLIN | Pita Bros Norblin | ul. Żelazna 51/53 | 00-841 Warszawa | active=true
company_name: Pita Bros sp. z o.o. | company_nip: 9522100633
company_address: ul. W. Laskonogiego 9, 02-496 Warszawa
```

> Adres dostawy wpisano najpierw bez polskich znaków (`Zelazna`) i poprawiono jednym
> `UPDATE` przed jakąkolwiek dalszą pracą — `delivery_address` trafia wprost do maila
> do dostawcy (`gmail_url._format_delivery_address`).

### Kontrola po imporcie (wszystkie zero-błędowe)

| Sprawdzenie | Wynik |
|---|---|
| pozycje arkusza zapisane 1:1 (min, max, target=max) | 98 / 98 |
| rozbieżności vs arkusz | 0 |
| `target <> max` | 0 |
| `min > max` | 0 |
| sieroty FK (`product_id` spoza `products`) | 0 |
| duplikaty `product_id` w obrębie NORBLIN | 0 |
| wierszy 0/0 łącznie | 35 (34 z grupy C + `Gyros 15 KG`, który ma 0/0 wprost w arkuszu) |

### Mapowanie arkusz → produkty

Join po znormalizowanej nazwie (`lower` + zwinięcie białych znaków) + 2 aliasy:
`Rucola 100 gr`→P007 (jedyne SKU rukoli w katalogu), `Rolki do kasy 80/80`→P129.
102 wiersze arkusza → **98 dopasowanych do 98 różnych `product_id`**, bez kolizji.

Niedopasowane 4: `Tacki papierowe`, `Kubeczki papierowe`, `Bifteki burgers`
(brak w katalogu → follow-up) oraz `Rolki do kasy 57/50` (→ nowe SKU P142).

## Decyzje operatora (2026-08-18) i ich skutek w danych

1. **Produkcja własna** P029–P037: progi WOLA ×1,25, zaokrąglone do 0,1 —
   Spicy Mayo 1,3/6,3 · Musztarda Miodowa 1,3/6,3 · Musztarda 0,6/1,3 · Ketchup 0,6/1,3 ·
   Ladolimono 0,4/1,3 · Ogórek+papryka 0,3/1,9 · Masło czosnkowe 0,4/1,3 ·
   Kasza Pęczak 0,6/1,9 · Gyros ścięty 1,3/3,8 (kg).
   **To jedyna grupa liczona, a nie deklarowana — do weryfikacji po pierwszym tygodniu.**
2. **34 produkty spoza arkusza** → 0/0/0 (reguła z Bracki).
3. **Rolki `57/50`** → nowe SKU P142 wprost z arkusza („tak jak w arkuszu jest, nie kopiuj
   z Woli"): 5/40. P129 `80 na 80` = 3/20 z arkusza. P128 i P130 → 0/0/0.
4. **Tacki papierowe / Kubeczki papierowe / Bifteki burgers** → pominięte (follow-up).

### Świadomy koszt zerowania (znany z impl-review Bracki, F2)

35 pozycji ma sugestię 0. Kapitan **może** je zamówić, ale przy **policzonym** stanie
backend zażąda kodu powodu — `delta_pct = |zamówione − 0| / rounding_step` zawsze
przekracza próg 25% (`_evaluate_submit_line`). Sygnał ląduje w
`/api/manager/suggestion-review`, czyli tam, gdzie i tak korygujemy master-datę.
Przy stanie **nieuzupełnionym** bramka nie odpala (`max = 0` wyłącza też test over-MAX).

## Rollback

Wszystko to INSERT-y do nowego lokalu, więc cofnięcie jest czyste:

```sql
delete from location_product_settings where location_id = 'NORBLIN';
delete from locations                    where location_id = 'NORBLIN';

-- tylko jeśli cofamy też nowe SKU rolek:
delete from location_product_settings where product_id = 'P142';
delete from supplier_products         where product_id = 'P142';
delete from products                  where product_id = 'P142';
```

`_norblin_lps_backup_20260818` (0 wierszy) dokumentował, że przed zmianą nie było nic.
**Skasowany 2026-08-18** po wejściu progów NORBLIN do seeda: miał 0 wierszy, a rollback
powyżej i tak jest oparty na `DELETE`, nie na tej tabeli — nie dawał żadnego zabezpieczenia,
a zostawałby w `public` na zawsze (F7 z impl-review Bracki). Schemat `public` nie ma już
żadnych tabel roboczych poza `_meta`.

## Zmiany w repo

Kod produkcyjny **bez zmian** — frontend i backend są multi-lokalowe od `bracka-rollout`
(zweryfikowane, nie założone: brak hardkodu lokalizacji w ścieżce produkcyjnej,
`manager_queue` filtruje po lokalu opcjonalnie, parser `SUPPLY_OS_CAPTAIN_TOKENS`
przyjmuje dowolną liczbę par `LOCATION:token` — `supply-os-v1/app/auth.py:37`).

Zmienione: seed (`locations.csv` +NORBLIN, `location_product_settings.csv` +142 wiersze
wyeksportowane z prod, `products.csv` +P142, `supplier_products.csv` +SP_PAGO_P142)
oraz liczniki seeda w testach.

## Smoke w prod — 2026-08-18, po ustawieniu tokena (wyłącznie GET)

| Endpoint | Wynik |
|---|---|
| `/api/captain/orderable?supplier_id=SUP_BUKAT` | 200 · 15 pozycji (Pomidor 18/42, Cytryna 0,5/2 — zgodne z arkuszem) |
| `/api/captain/orderable?supplier_id=SUP_PAGO` | 200 · 19 pozycji · **P142 5/40** · Gyros 15 KG 0/0 vs 25 KG 2/8 · P128/P130 0/0 |
| `/api/captain/inventory/products` | 200 · 142 pozycje |
| `/api/captain/orders` · `/api/captain/receipts` | 200 · puste (nowy lokal) |
| `/api/captain/inventory/latest` | 200 · `null` (brak snapshotu) |

Żadnego submitu ani dispatchu — zgodnie z twardą zasadą repo.

Pierwsza próba smoke'a (przed deployem) zwracała `401 Invalid token`, nie
`Bearer token required` — czyli backend parsował mapę tokenów i wartości w niej nie było.
Diagnoza okazała się trafna: brakowało deployu, nie poprawności wartości.

## Do zrobienia przez operatora

1. ~~**Railway → Variables → `SUPPLY_OS_CAPTAIN_TOKENS`**: dopisać parę
   `NORBLIN:<token>`.~~ **ZROBIONE 2026-08-18** — smoke GET potwierdzony (patrz wyżej). Token przekazany **wyłącznie w odpowiedzi na czacie**
   — świadomie nie ma go w żadnym pliku repo (wniosek z Bracki: token wylądował
   w `rollout-notes.md`, czyli w gicie). Agent nie ustawia zmiennych na Railway.
2. ~~Merge gałęzi do `main` → auto-deploy Railway + Vercel.~~ **ZROBIONE** (PR #20/#21).
3. Przekazać token kapitanowi Norblina (w aplikacji wkleja samą wartość hex; prefiks
   `NORBLIN:` jest po stronie serwera, a `sanitizeTokenInput` i tak by go obciął).

## Follow-up

- [ ] **Progi produkcji własnej (P029–P037)** — jedyne wyliczone (WOLA ×1,25), nie
      zadeklarowane przez operatora. Zweryfikować po pierwszym tygodniu zamówień.
- [ ] **P142 „Rolki do kasy 57 na 50"** — potwierdzić przy pierwszej dostawie od Pago,
      czy to realnie osobny rozmiar, oraz cenę (wpisano 1,29 zł jako oszacowanie po P130).
      Jeśli okaże się duplikatem istniejącego rozmiaru: usunąć P142, przenieść progi 5/40
      na właściwe SKU. Wiersz `location_product_settings` istnieje tylko dla NORBLIN,
      więc pomyłka nie dotyka WOLA/Bracki.
- [ ] **3 pozycje z arkusza bez odpowiednika w katalogu** — `Tacki papierowe` (3/20),
      `Kubeczki papierowe` (1/2) u Blue Service, `Bifteki burgers` (0,5/1,5) u Pago.
      Do dodania jako produkty + `supplier_products` (potrzebne: jednostka zakupu,
      szt./opak., cena szacunkowa). **To ten sam otwarty punkt, co przy Bracce** — wraca
      drugi raz, więc warto go domknąć zamiast przepisywać dalej.
- [ ] **KEN** — nadal kopia progów z WOLA (138 wierszy), czeka na własny arkusz.
- [ ] **Rotacja tokenów** — otwarte od `feedback-r4`; przy trzecim lokalu warto wymienić
      komplet.
- [ ] **Rozjazd seed ↔ prod na WOLA** — seed ma 134 wiersze `location_product_settings`
      dla WOLA, prod 141. Zastane, niezwiązane z Norblinem.
- [x] `_norblin_lps_backup_20260818` — skasowana 2026-08-18 (0 wierszy, rollback i tak
      oparty na `DELETE`).
- [ ] **Pozycje spoza arkusza Norblina, które Wola i Bracka zamawiają** — papier toaletowy,
      worki 60 L, butla gazowa 10 L, Corona / Corona 0% / Fuzetea, wina Ionos 750 ml,
      Retsina, Mythos, piwa Corfu. Wygląda na lukę w arkuszu, nie na decyzję. Wysłane
      do menedżera do potwierdzenia; do czasu odpowiedzi zostają na 0/0/0.
