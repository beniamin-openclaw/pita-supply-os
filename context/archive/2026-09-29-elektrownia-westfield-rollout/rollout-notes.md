# elektrownia-westfield-rollout — dziennik operacji

Data: 2026-09-29 · Projekt Supabase: `lpzhphufjwrndfogkfub`
Źródła: zakładki „min/max” arkuszy Marka — Norblin i Westfield (CSV od operatora),
Elektrownia (arkusz na Dysku „Elektrownia - Inwentaryzacja”, zakładka `min/max`; załącznik
z czatu to inwentaryzacja z 27.09, bez progów).

## Stan przed zmianą (sprawdzony 2026-09-29, tylko odczyt)

| Lokal | active | wierszy progów | z max > 0 | adres / spółka |
|---|---|---|---|---|
| NORBLIN | true (od 18.08) | 145 | 112 | komplet |
| ELEKTROWNIA | **false** | 113 | 3 (nabiał z partii 1) | brak adresu i spółki |
| WESTFIELD | **false** | 107 | 3 (nabiał z partii 1) | brak adresu, spółki i e-maila |

Kod: bez zmian (lokal = dane + token). Reguły dostaw Pago/Mory dla obu nowych lokali już są
(`supplier_delivery_rules`, 28.09), Coca-Cola dla Westfield też.

## Reguły mapowania

- Arkusz → produkt po nazwie, jawna tabela aliasów (nazwy Marka z marką/gramaturą →
  nazwy w katalogu, np. „Helcom Papryka Grillowana” = P017 Florinis, „Tirokafteri 2kg” = P012
  Hot Feta, „Prymat Pieprz” = P050). 307 wierszy → 307 różnych par lokal/produkt, 0 kolizji.
- Wartość z arkusza przeliczona na jednostkę magazynową produktu, gdy arkusz liczy w
  opakowaniach: Gyros 15/25 w blokach ×15/×25, Pita w kartonach ×12, Souvlaki ×5 i Bifteki ×4,2
  w kartonach, Oliwki (bidon) ×2, Florinis ×3,6, Fasolka ×2,5, Gąbka (opak. 10 szt) ×10.
  Pozostałe różnice etykiet (Szt/Opak/Box przy przeliczniku 1) — 1:1.
- `target = max`; Feta `target = floor(max)` (decyzja 28.09).
- Zapisywane są tylko wiersze z arkusza. Wiersze spoza arkusza zostają bez zmian
  (Elektrownia/Westfield — 0/0/0; Norblin — dotychczasowe wartości).
- Coca Cola / Zero → puszki 0,33 (P068/P069), jak dotychczasowe wiersze tych lokali; ceny z
  inwentaryzacji Elektrowni (Zero 2,60 zł/szt) zgadzają się z puszką.

## Diff przed (STEP 0, zapisany przed zapisem)

| Lokal | wiersze arkusza | nowe | zmienione | bez zmian |
|---|---|---|---|---|
| ELEKTROWNIA | 102 | 9 | 89 (wszystkie z 0/0/0) | 4 (nabiał + Gyros 15 0/0) |
| WESTFIELD | 102 | 10 | 89 (wszystkie z 0/0/0) | 3 (nabiał) |
| NORBLIN | 103 | 1 | 59 | 43 |

Nowe wiersze — ELEKTROWNIA: P041, P045, P053, P057, P058, P109, P140, P141, P189 ·
WESTFIELD: P021, P022, P023, P025, P026, P045, P090, P140, P141, P189 · NORBLIN: P189.

NORBLIN, zmiany wartości (min/target/max, przed → po):

```
P001 3/6/6→3/9/9; P002 0.5/2/2→0.5/1.5/1.5; P003 1/2/2→0.5/2/2; P005 1/2/2→0.5/2/2;
P006 18/42/42→10/48/48; P007 7/25/25→5/20/20; P008 10/40/40→7/30/30; P009 0.3/1/1→0.2/1/1;
P010 0.2/1/1→0.2/0.5/0.5; P013 0.5/1.5/1.5→1/3/3; P015 24/72/72→24/100/100;
P016 5/20/20→5/15/15; P017 0.5/1.5/1.5→1.8/5.4/5.4; P018 0.3/1/1→0.2/1/1;
P019 0.5/2/2→0.5/1.5/1.5; P021 20/48/48→20/60/60; P022 2/5/5→2/6/6;
P023 0.5/1.5/1.5→1.25/3.75/3.75; P025 50/200/200→50/225/225; P026 18/72/72→12/84/84;
P027 4/12/12→20/75/75; P028 10/20/20→10/25/25; P038 1/2/2→1/3/3; P040 2/6/6→2/7/7;
P042 2/4/4→2/5/5; P048 1.5/3/3→1/3/3; P053 1/3/3→2/10/10; P066 10/24/24→10/48/48;
P067 10/24/24→10/48/48; P069 70/144/144→70/150/150; P070 24/72/72→30/50/50;
P071 12/36/36→15/24/24; P082 2/12/12→2/10/10; P083 1/3/3→1/2/2; P086 5/20/20→5/15/15;
P087 2/5/5→2/7/7; P088 0.5/2/2→0.5/1.5/1.5; P091 2/6/6→2/8/8; P092 3/6/6→3/8/8;
P095 1/4/4→2/5/5; P100 3/15/15→5/20/20; P101 5/25/25→7/30/30; P103 0.5/1/1→0.5/1.5/1.5;
P104 0.5/2/2→1/2/2; P112 2/4/4→1/4/4; P116 3/5/5→2/5/5; P117 5/15/15→3/15/15;
P118 5/15/15→3/15/15; P119 2/4/4→1/3/3; P121 5/20/20→10/20/20; P127 1/10/10→1/3/3;
P131 10/100/100→10/50/50; P132 1/3/3→2/4/4; P133 1/3/3→2/4/4; P143 3/20/20→3/15/15;
P145 2/4.2/4.2→2.1/6.3/6.3
+ z 0/0/0: P113 Top Grill Tenzi → 1/2/2, P140 Kawa → 0.5/1.5/1.5, P141 Herbata → 0.5/1.5/1.5
```

NORBLIN — wiersze z progami, których nowy arkusz nie ma (zostają bez zmian): P122 Druciak 5/20,
produkcja własna P029–P036 i P176/P177 (WOLA ×1,25 z 18.08), P129 rolki 80/80 3/20,
P183 rolki 80/20 5/40.

## Wstrzymane (nie wpisane — do decyzji)

| Pozycja (arkusz) | Lokale | Dlaczego |
|---|---|---|
| Papier duży w Roli 1–4 szt | ELEKTROWNIA, WESTFIELD | brak w katalogu; nie wiadomo, czy to ręczniki w roli, czy papier toaletowy jumbo, ani od kogo |
| Rolki do kasy 57/50, 2–5 opak | wszystkie 3 | wg tabeli Sławka (05.09) te lokale mają rolki 80/20 + 80/80, nie 57/50; P142 57/50 jest wyłączony |
| Rolki do kasy 80/80, 2–4 opak | wszystkie 3 | arkusz liczy w opak., katalog w szt; brak liczby rolek w opakowaniu (otwarte u Marka od 05.09) |

## Wykonane w prod (2026-09-29, MCP Supabase, jeden blok `DO`)

| Krok | Operacja | Wynik |
|---|---|---|
| 0 | Guardy: P189 nie istnieje, ELEKTROWNIA/WESTFIELD `active=false` | OK |
| 1 | `products.P189` „Cukier w kostkach Diament 1kg” (opak) + `SP_INTERMLECZ_P189` (opak ×1, cena pusta) | 1 + 1 |
| 2 | `locations.ELEKTROWNIA`: „Pita Bros Elektrownia Powiśle”, ul. Dobra 42, 00-312 Warszawa, Pita Bros Centrum Sp. z o.o. / 5223314413 / ul. W. Laskonogiego 9, `active=true` | 1 |
| 3 | `locations.WESTFIELD`: „Pita Bros Westfield Mokotów”, ul. Wołoska 12, 02-675 Warszawa, `active=true`; spółka/NIP/e-mail puste | 1 |
| 4 | Upsert progów z arkuszy (tylko zmienione + brakujące wiersze) | **257** (oczekiwane 257) |

Adresy: Elektrownia — elektrowniapowisle.com + karta Pita Bros na Wolt (ten sam telefon co w
`COMPANY_ENTITIES.md`); Westfield — westfield.com (adres centrum). Spółka Elektrowni —
`COMPANY_ENTITIES.md`.

Każdy zmieniony wiersz ma w `notes` dopisek `[2026-09-29 arkusz min/max, przed a/b/c; przeliczenie]`
— z niego korzysta `rollback.sql`. Nowe wiersze zaczynają się od `2026-09-29 arkusz min/max (nowy wiersz)`.

## Audyt po zmianie (STEP 2) — wszystko zgodne

| Sprawdzenie | Wynik |
|---|---|
| wiersze oznaczone rolloutem | ELEKTROWNIA 98 · NORBLIN 60 · WESTFIELD 99 |
| arkusz vs baza (307 wierszy) | 0 brakujących, 0 rozbieżności |
| `min > max`, `target > max`, `target < min` w 3 lokalach | 0 |
| progi na nieaktywnym produkcie / bez aktywnego dostawcy | 0 |
| lokale | obie aktywne, adres + kod pocztowy wpisane; ELEKTROWNIA ze spółką |
| stan końcowy | ELEKTROWNIA 122 wiersze / 101 z max · WESTFIELD 117 / 102 · NORBLIN 146 / 116 |

W bazie są 3 stare zamówienia tych lokali — szkielety Transportu Pago utworzone przez managera
(02.09, 25.09), wszystkie `cancelled`. Bez wpływu.

## Rollback

`rollback.sql` — przywraca wartości z dopisków „przed”, kasuje 20 nowych wierszy i P189,
wraca ELEKTROWNIA/WESTFIELD do stanu sprzed zmiany (literalnie, jak odczytane 2026-09-29).

## Do zrobienia przez operatora

- [ ] **Railway → Variables → `SUPPLY_OS_CAPTAIN_TOKENS`**: dopisać (po przecinku, bez usuwania
      istniejących par) `ELEKTROWNIA:<kod>` i `WESTFIELD:<kod>`. Kody tylko w odpowiedzi na czacie —
      świadomie nie ma ich w repo. Zmiana zmiennej = redeploy backendu (~1–2 min).
- [ ] Smoke po redeployu, wyłącznie GET, kodem każdego lokalu: `/api/captain/orderable?supplier_id=SUP_BUKAT`,
      `/api/captain/inventory/products`. Żadnego submitu.
- [x] WESTFIELD: spółka + NIP — wpisane w kroku 2 (Pita Bros sp. z o.o., jak NORBLIN).
- [ ] **WESTFIELD: e-mail lokalu** (DW) — operator: „mail swój”, adres jeszcze nie podany.
      Czy dostawy idą pod ul. Wołoska 12 bez dopisku (rampa / wejście dla dostaw)?
- [ ] Telefon Westfield (brak w `COMPANY_ENTITIES.md`).
- [ ] 3 wstrzymane pozycje (tabela wyżej): „Papier duży w Roli”, rolki 57/50 vs 80/20, liczba rolek w opakowaniu —
      operator: dopytać Marka (wiadomość przygotowana 2026-09-29).
- [ ] Cena P189 (cukier w kostkach) — z faktury Intermleczu.
- [ ] Produkcja własna w ELEKTROWNIA/WESTFIELD (sosy, kasza, gyros ścięty) — progi 0/0/0, arkusz min/max ich nie ma.
- [x] Coca-Cola: WESTFIELD szkło 0,25 (krok 2); ELEKTROWNIA i NORBLIN puszki 0,33 bez zmian (operator 2026-09-29).
- [ ] Coca-Cola: dni dostaw dla ELEKTROWNIA i NORBLIN (reguła jest tylko dla WESTFIELD).
- [x] NORBLIN: Druciak (5/20) i progi produkcji zostają bez zmian (operator 2026-09-29).
- [ ] Przegląd progów po ~2 tygodniach (≈ 12.10, decyzja z 28.09), szczególnie przeliczenia w opakowaniach
      (Oliwki ×2, Florinis ×3,6, Fasolka ×2,5, Gąbka ×10, Souvlaki/Pita/Gyros).
- [ ] Seed CSV (`docs/pita-supply-os-v1/seed/`) nie zawiera tych progów — rozjazd seed ↔ prod rośnie (jak po KEN/Browarach).

## Krok 2 — odpowiedzi operatora (2026-09-29), `prod-sql-2-westfield.sql`

- WESTFIELD: spółka Pita Bros sp. z o.o., NIP 9522100633, adres firmy ul. W. Laskonogiego 9 (jak NORBLIN);
  adres dostawy i e-mail lokalu własne — e-mail jeszcze nie podany, zostaje pusty.
- WESTFIELD bierze Coca-Colę w szkle: progi przeniesione z puszek P068 (50/100) i P069 (70/130) na
  szkło P186 / P187 (skrzynka ×24), wiersze puszek usunięte — tak jak w WOLA/BRACKA/KEN.
  Fanta, Sprite i Cappy nie mają w katalogu osobnej wersji szklanej, zostają bez zmian.
- ELEKTROWNIA, NORBLIN: puszki bez zmian. NORBLIN: Druciak i produkcja bez zmian.

Audyt: WESTFIELD ma spółkę i NIP; P186 50/100/100, P187 70/130/130; brak P068/P069; na ekranie
zamówienia Coca-Cola Westfield widzi szkło 0,25 zamiast puszek. Rollback kroku 2 — na końcu
`prod-sql-2-westfield.sql` (uruchomić przed `rollback.sql`).

Uwaga: P186/P187 nie mają ceny (`price_estimate_pln` puste, jak we WOLA/BRACKA/KEN), więc szacowana
wartość zamówienia Coca-Coli w Westfield będzie zaniżona. Faktury KEN z eBiuro pokazują skrzynkę
0,25 × 24 w cenach od 84 do 155 zł netto — za duży rozrzut, żeby wpisać jedną wartość bez decyzji.

## 2026-09-30 — kody kapitanów

Na prośbę operatora kody ELEKTROWNIA i WESTFIELD zmienione z losowych (hex) na krótkie, wybrane
przez operatora (wartości tylko w czacie, nie w repo). Parser tokenów (`auth._parse_captain_tokens`)
trzyma jeden kod na lokal — przy dwóch parach dla tego samego lokalu działa tylko ostatnia.

## 2026-09-30 — zamówienia testowe z wdrożenia

Na prośbę operatora dwa zamówienia Bukat z 30.09 (test przy wdrożeniu) oznaczone jako anulowane
(soft-delete, bez kasowania): `ORD-20260930-ELE-BUKA-ad673a` (Elektrownia, 1765,00 PLN) i
`ORD-20260930-NOR-BUKA-6f58ed` (Norblin, 675,75 PLN). Przed zmianą: status `closed`, wysłane e-mailem
07:51 UTC, po jednym przyjęciu z 1 zdjęciem WZ (`RCP-20260930-ELE-1217cc`, `RCP-20260930-NOR-ada517`).
Linie, przyjęcia i zdjęcia zostały w bazie. Cofnięcie:
`UPDATE orders SET status='closed', cancelled_at=NULL, cancelled_by=NULL, cancel_reason='' WHERE order_id IN (...)`.
