# krakow-katowice-rollout — dane prod (Forum Kraków, Supersam Katowice)

Data: 2026-10-08 · Projekt Supabase: `lpzhphufjwrndfogkfub` · Start lokali: liczenie w niedzielę 11.10, zamówienia od poniedziałku 12.10.
Źródła: arkusz Marka „Miasta poza Warszawą” (Dysk `1i-sXUd5zQUyA4YASKkb9SBl61r3sV5M5fazagnsJnpg`, zakładki Katowice i Kraków), progi Forum z sierpnia (prod), decyzje operatora z 2026-10-08 (1–10), dane lokali od operatora (adres, spółka, NIP, telefon).
Pliki: `prod-sql-A-locations-settings.sql` → `prod-sql-C-delete-template.sql` → deploy kodu → `prod-sql-B-suppliers-catalog.sql`; `rollback.sql`. Pliki SQL generuje skrypt z odczytów prod (tylko SELECT); nic nie zostało zapisane w prod.

## Stan przed zmianą (sprawdzony 2026-10-08, tylko odczyt)

| Lokal | active | own_catalog | wierszy progów | z max > 0 | zamówienia | liczenia | adres / spółka |
|---|---|---|---|---|---|---|---|
| FORUM | false | brak kolumny (0029 niewgrana) | 114 | 24 | 0 | 0 | brak adresu, spółki, NIP, telefonu; e-mail pitabrosforum@gmail.com, nadawca forum@pitabros.pl |
| SUPERSAM | false | brak kolumny (0029 niewgrana) | 116 | 0 | 0 | 0 | brak adresu, spółki, NIP, telefonu i e-maila lokalu; nadawca supersam@pitabros.pl |

- Katalog wspólny `supplier_products`: 260 wierszy, 172 aktywne. Sumy kontrolne (2026-10-08): `md5(supplier_product_id:active)` = `c6389820fb87c3e57ad862cb70b82a52`, aktywne wiersze na produkt = `c7fa486d3ab4f85dc1030996edd444ce`; progi FORUM+SUPERSAM (`setting_id:min/target/max:notes`) = `351e94f233dbf23a710da125251708af`.
- Dostawców `*_KRK` / `*_KAT` brak; wierszy `SP_(DISPACK|KUCHNIE|SELGROS|BUKAT)_(KRK|KAT)_*` brak.
- Migracja 0029 (`locations.own_catalog`, `supplier_products.location_id`, `is_backup`) — jeszcze nie na prod (0 z 3 kolumn).

FORUM — 24 wiersze z progiem (reszta 0/0/0); SUPERSAM — wszystkie 0/0/0:

| Produkt | Nazwa | j.m. | min/target/max | notes |
|---|---|---|---|---|
| P001 | Masło MR 500g | szt | 3/9/9 | — |
| P002 | Cytryna | kg | 0,5/2/2 | — |
| P003 | Papryka zielona | kg | 1/2,5/2,5 | — |
| P004 | Awokado | szt | 2/6/6 | — |
| P005 | Ogórek | kg | 1/2,5/2,5 | — |
| P006 | Pomidor | kg | 12/54/54 | — |
| P007 | Rucola 100 gr | opak | 10/35/35 | — |
| P008 | Sałata bolero mix 150gr | opak | 8/25/25 | — |
| P009 | Natka Pietruszki | kg | 0,3/1/1 | — |
| P010 | Czosnek | kg | 0,2/1/1 | — |
| P011 | Tzatzyki 3kg | pojemnik | 5/14/14 | [2026-09-28 kg->pojemnik] |
| P012 | Tirokafteri 2kg | pojemnik | 1,5/4/4,5 | [2026-09-28 kg->pojemnik] |
| P013 | Oliwki kalamata 2kg Bidon | kg | 0,5/1,5/1,5 | — |
| P014 | Feta blok 2kg | pojemnik | 0,5/2/2 | [2026-09-28 kg->pojemnik] |
| P015 | Halloumi Reha 200gr | szt | 24/100/100 | — |
| P016 | Cebula czerwona | kg | 5/20/20 | — |
| P017 | Papryka grillowana grecka Florina (Florinis) | kg | 0,5/1,5/1,5 | — |
| P018 | Cebula Biała | kg | 0,5/2/2 | — |
| P019 | Przyprawa do souvlakow | kg | 0,5/2/2 | — |
| P020 | Falafel | kg | 5/20/20 | — |
| P021 | Frytki Aviko Super Crunch 9,5mm 2,5kg | szt | 20/60/60 | — |
| P022 | Frytki z batatów Aviko 2,27kg | szt | 2/6/6 | — |
| P024 | Gyros 15 KG | kg | 4/15/15 | — |
| P026 | Pita (opakowania) szt 10 | opak | 2/11/11 | — |

## Kolejność wdrożenia

1. **Kontrola przed deployem** (sekcja niżej, tylko odczyt) — 0 wierszy.
2. **Migracja 0029** (operator) — przed wszystkim innym; A/B sprawdzają jej kolumny i bez niej przerywają.
3. **A** — lokale (adres, spółka, NIP, telefon, `own_catalog=true`, `active=true`) + progi (upsert 101 wierszy).
4. **C** — osobne wywołanie, operator przy ekranie: DELETE 26 wierszy szablonu (kopia literalna w pliku i w `rollback.sql`).
5. **Deploy kodu** (Railway + Vercel) i sprawdzenie: `/health` na nowym commicie + nowy hash bundla (lessons: merged ≠ live).
6. **B** — 7 dostawców + 181 wierszy katalogu z `location_id`. **Nigdy przed deployem**: stary backend ignoruje `location_id`, więc katalog miejski pokazałby się we wszystkich lokalach warszawskich.
7. Dopiero po B: kody kapitanów FORUM / SUPERSAM w Railway (`SUPPLY_OS_CAPTAIN_TOKENS`). Między A a B stary kod pokazałby tym lokalom katalog warszawski — kodów nie wydawać wcześniej.

## Kontrola przed deployem (tylko odczyt, przed merge) — oczekiwane 0 wierszy

Po deployu karta produktu pokazuje „Też u: X” i podpowiedź o otwartym zamówieniu dla każdego produktu, który w danym katalogu ma ≥ 2 zamawialnych dostawców. Ten SELECT sprawdza, czy w katalogu wspólnym (Warszawa) jest taki produkt — wtedy warszawskie karty zmieniłyby się po deployu.

```sql
-- po migracji 0029 (katalog wspólny = location_id IS NULL)
SELECT sp.product_id, p.product_name_pl, count(DISTINCT sp.supplier_id) AS n_suppliers,
       string_agg(DISTINCT sp.supplier_id, ', ') AS suppliers
  FROM supplier_products sp
  JOIN suppliers s ON s.supplier_id = sp.supplier_id AND s.active AND s.supplier_id <> 'SUP_INTERNAL'
  JOIN products p ON p.product_id = sp.product_id AND p.active
 WHERE sp.location_id IS NULL AND sp.active
   AND EXISTS (SELECT 1 FROM location_product_settings lps WHERE lps.product_id = sp.product_id)
 GROUP BY sp.product_id, p.product_name_pl
HAVING count(DISTINCT sp.supplier_id) > 1
 ORDER BY 1;
-- przed migracją 0029 ta sama kwerenda bez warunku `sp.location_id IS NULL` (wszystkie wiersze są wspólne)
```

Wynik 2026-10-08 na prod (wariant sprzed 0029, MCP Supabase, tylko odczyt): **0 wierszy**. Powtórzyć tuż przed merge, jeśli katalog warszawski się zmienił.

## Reguły mapowania (decyzje operatora 2026-10-08)

- **Dostawcy miejscy** (decyzja 1): 7 nowych `supplier_id`, `ordering_method='manual'` (zamówienie trafia do managera, składane poza aplikacją), e-mail / minimum / dni dostaw / godzina graniczna puste, sugestie włączone, pytanie o pokrycie wyłączone. Notatka: „kontakt do potwierdzenia — Marek (mail 2026-10-08)” + dane publiczne tylko z 2 niezależnych źródeł, oznaczone „publiczne, niepotwierdzone”. NIP tylko dla Kuchni Świata (1180039859, jak SUP_KUCHNIE).
- **Progi** (decyzja 2): wartość z arkusza Marka wygrywa, `target = max`. Przeliczenia na jednostkę magazynową: P121 gąbka opak. 5 szt ×5, P020 falafel karton 5 kg ×5, P013 oliwki bidon 2 kg ×2, P023 fasolka 2,5 kg ×2,5. Pozostałe różnice etykiet (Rolka/Karton/Sztuka vs szt/box/opak) — 1:1. Bez wartości w arkuszu: istniejąca niezerowa wartość Forum, inaczej 0/0/0.
- **Katowice, frytki** (decyzja 3): Kuchnie Świata KAT główny (P021 10/36, P022 2/4), Selgros KAT zapasowy.
- **Bukat Kraków** (decyzja 4): P002–P012 bez P013, P014, P016, P018; progi Forum z sierpnia bez zmian; jednostki, opakowania zbiorcze, nazwy i kolejność z warszawskich wierszy SUP_BUKAT.
- **Selgros Kraków** (decyzja 5): pozycje bez innego dostawcy w Krakowie → główny (wartość Forum lub 0/0/0); warzywa, frytki, rękawiczki itd. z głównym dostawcą w Krakowie → zapasowy.
- **Szare pozycje** (decyzja 6): tylko jednoznaczne dopasowania; jest główny w lokalu → zapasowy, brak → główny 0/0/0; niejednoznaczne → „Wstrzymane”. Kuchnie Świata: Feta Hotos → P014 (KAT główny 0/0/0, KRK zapasowy), Olej TopQ → P041 zapasowy, Majonez dekoracyjny → pominięty.
- **Pominięte** (decyzja 7): JAX-GRILL, DIX, Ręcznik 100 mb, Papryka Red Sweet i wszystko, co wymagałoby nowego produktu.
- **Tylko liczenie** (decyzja 8): próg 0/0/0, bez wiersza katalogu — Pago, Mory, napoje (Coca-Cola, Filber, Pepsi), produkcja własna; w Katowicach też tzatziki i tirokafteri. Niezerowe wartości Forum (P024 4/15, P026 2/11, P019 0,5/2) → 0/0/0 z dopiskiem.
- **Usunięcie** (decyzja 9): każdy wiersz progów FORUM/SUPERSAM spoza zestawu końcowego — krok C.
- **Wiersze katalogu** (decyzja 10): id `SP_<dostawca bez SUP_>_<produkt>`, `location_id` = lokal, `is_backup` wg decyzji, jednostki / zaokrąglanie / order_note / opakowanie zbiorcze z najbliższego wiersza warszawskiego (źródło w `notes` każdego wiersza), nazwa z arkusza, cena z Warszawy („cena z Warszawy”) albo pusta („cena do uzupełnienia”) gdy opakowanie się różni, `display_order` = pozycja w sekcji dostawcy w arkuszu danego miasta. Selgros: bez opakowania zbiorczego i bez order_note (poza frytkami).

## Diff przed (STEP 0 pliku A, policzony z odczytu 2026-10-08)

| Lokal | zestaw końcowy | nowe (INSERT) | zmienione (UPDATE) | bez zmian | do usunięcia (C) | po A | po C |
|---|---|---|---|---|---|---|---|
| FORUM | 104 | 4 | 35 | 65 | 14 | 118 | 104 |
| SUPERSAM | 107 | 3 | 59 | 45 | 12 | 119 | 107 |

Upsert w A dotyka 101 wierszy (FORUM 35 + 4, SUPERSAM 59 + 3); A sprawdza tę liczbę i przerywa przy rozbieżności. Wiersze „bez zmian” nie są dotykane i nie dostają dopisku.

## Tabela decyzji — FORUM (Kraków), produkty zamawiane

| Produkt | Nazwa (katalog) | j.m. | Główny | Arkusz (główny) | Zapasowi | Przed | Po | Źródło progu | Akcja |
|---|---|---|---|---|---|---|---|---|---|
| P001 | Masło MR 500g | szt | Selgros Kraków | szary | — | 3/9/9 | 3/9/9 | Forum, sierpień | bez zmian |
| P002 | Cytryna | kg | Bukat Kraków | brak sekcji Bukat (decyzja 4) | Selgros Kraków (szary) | 0,5/2/2 | 0,5/2/2 | Forum, sierpień | bez zmian |
| P003 | Papryka zielona | kg | Bukat Kraków | brak sekcji Bukat (decyzja 4) | Selgros Kraków (szary) | 1/2,5/2,5 | 1/2,5/2,5 | Forum, sierpień | bez zmian |
| P004 | Awokado | szt | Bukat Kraków | brak sekcji Bukat (decyzja 4) | Selgros Kraków (szary) | 2/6/6 | 2/6/6 | Forum, sierpień | bez zmian |
| P005 | Ogórek | kg | Bukat Kraków | brak sekcji Bukat (decyzja 4) | Selgros Kraków (szary) | 1/2,5/2,5 | 1/2,5/2,5 | Forum, sierpień | bez zmian |
| P006 | Pomidor | kg | Bukat Kraków | brak sekcji Bukat (decyzja 4) | Selgros Kraków (szary) | 12/54/54 | 12/54/54 | Forum, sierpień | bez zmian |
| P007 | Rucola 100 gr | opak | Bukat Kraków | brak sekcji Bukat (decyzja 4) | Selgros Kraków (szary) | 10/35/35 | 10/35/35 | Forum, sierpień | bez zmian |
| P008 | Sałata bolero mix 150gr | opak | Bukat Kraków | brak sekcji Bukat (decyzja 4) | Selgros Kraków (szary) | 8/25/25 | 8/25/25 | Forum, sierpień | bez zmian |
| P009 | Natka Pietruszki | kg | Bukat Kraków | brak sekcji Bukat (decyzja 4) | Selgros Kraków (szary) | 0,3/1/1 | 0,3/1/1 | Forum, sierpień | bez zmian |
| P010 | Czosnek | kg | Bukat Kraków | brak sekcji Bukat (decyzja 4) | Selgros Kraków (szary) | 0,2/1/1 | 0,2/1/1 | Forum, sierpień | bez zmian |
| P011 | Tzatzyki 3kg | pojemnik | Bukat Kraków | brak sekcji Bukat (decyzja 4) | — | 5/14/14 | 5/14/14 | Forum, sierpień | bez zmian |
| P012 | Tirokafteri 2kg | pojemnik | Bukat Kraków | brak sekcji Bukat (decyzja 4) | — | 1,5/4/4,5 | 1,5/4/4,5 | Forum, sierpień | bez zmian |
| P013 | Oliwki kalamata 2kg Bidon | kg | Kuchnie Świata Kraków | 0,5/1,5 bidon | — | 0,5/1,5/1,5 | 1/3/3 | arkusz ×2 | UPDATE |
| P014 | Feta blok 2kg | pojemnik | Bukat Kraków | brak sekcji Bukat (decyzja 4) | Kuchnie Świata Kraków (szary) | 0,5/2/2 | 0,5/2/2 | Forum, sierpień | bez zmian |
| P015 | Halloumi Reha 200gr | szt | Kuchnie Świata Kraków | 24/72 sztuka | — | 24/100/100 | 24/72/72 | arkusz | UPDATE |
| P016 | Cebula czerwona | kg | Bukat Kraków | brak sekcji Bukat (decyzja 4) | Selgros Kraków (szary) | 5/20/20 | 5/20/20 | Forum, sierpień | bez zmian |
| P018 | Cebula Biała | kg | Bukat Kraków | brak sekcji Bukat (decyzja 4) | Selgros Kraków (szary) | 0,5/2/2 | 0,5/2/2 | Forum, sierpień | bez zmian |
| P020 | Falafel | kg | Kuchnie Świata Kraków | 0,5/1,5 karton | — | 5/20/20 | 2,5/7,5/7,5 | arkusz ×5 | UPDATE |
| P021 | Frytki Aviko Super Crunch 9,5mm 2,5kg | szt | Kuchnie Świata Kraków | 10/44 sztuka | Selgros Kraków (szary) | 20/60/60 | 10/44/44 | arkusz | UPDATE |
| P022 | Frytki z batatów Aviko 2,27kg | szt | Kuchnie Świata Kraków | 2/5 sztuka | Selgros Kraków (szary) | 2/6/6 | 2/5/5 | arkusz | UPDATE |
| P023 | Fasolka Szparagowa mrożona 2,5kg | kg | Selgros Kraków | szary | — | brak wiersza | 0/0/0 | 0/0/0 (brak progu) | INSERT |
| P038 | Frytura Effo 15L | szt | Kuchnie Świata Kraków | 1/3 sztuka | — | 0/0/0 | 1/3/3 | arkusz | UPDATE |
| P040 | Woda 5L | szt | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P041 | Olej Rzepakowy 5 L | szt | Selgros Kraków | szary | Kuchnie Świata Kraków (szary) | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P042 | Ketchup Fanex VII 1,1 kg | szt | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P043 | Develey Musztarda 3 kg | szt | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P044 | Fanex Majonez 4kg | szt | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P045 | Oliwa z Oliwek 1L | szt | Selgros Kraków | szary | — | brak wiersza | 0/0/0 | 0/0/0 (brak progu) | INSERT |
| P046 | Cieciorka w zalewie 400g/240g | szt | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P047 | Kasza Pęczak Melvit 900g | szt | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P048 | Sriracha chili 730 ml | szt | Kuchnie Świata Kraków | 2/4 sztuka | — | 0/0/0 | 2/4/4 | arkusz | UPDATE |
| P049 | Miód 1 kg | kg | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P050 | Pieprz | kg | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P051 | Oregano | kg | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P052 | Papryka słodka - mielona | kg | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P053 | Sól kamienna 1kg | kg | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P054 | Prymat Liść Laurowy 80g | opak | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P055 | Ziele Angielskie | opak | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P057 | Sól w saszetkach 5g | opak | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P058 | Pieprz w saszetkach 5g | opak | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P082 | Bowl opakowanie papierowe miska 1300 ml | opak | Dis-Pack Kraków | 2/6 opakowanie | — | 0/0/0 | 2/6/6 | arkusz | UPDATE |
| P083 | Bowl opakowanie pokrywka plastik 1300 ml | opak | Dis-Pack Kraków | 1/4 opakowanie | — | 0/0/0 | 1/4/4 | arkusz | UPDATE |
| P084 | Opakowanie sałatki duże jednoczęściowe 750ml | opak | Dis-Pack Kraków | 1/2 opakowanie | — | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P085 | Opakowanie sałatki małe jednoczęściowe 250ml | opak | Dis-Pack Kraków | 1/2 opakowanie | — | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P086 | Sos opakowanie pojemnik | opak | Dis-Pack Kraków | 5/20 opakowanie | — | 0/0/0 | 5/20/20 | arkusz | UPDATE |
| P087 | Sos opakowanie pokrywka | opak | Dis-Pack Kraków | 3/8 opakowanie | — | 0/0/0 | 3/8/8 | arkusz | UPDATE |
| P088 | Opakowanie Frytki | opak | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P093 | Torba na wynos z uszami | box | Dis-Pack Kraków | 1/3 karton | — | 0/0/0 | 1/3/3 | arkusz | UPDATE |
| P094 | Torby fałdowane pojedyncze do pity | opak | Dis-Pack Kraków | 2/5 opakowanie | — | 0/0/0 | 2/5/5 | arkusz | UPDATE |
| P095 | Folia Aluminiowa | szt | Dis-Pack Kraków | 1/5 rolka | Selgros Kraków (szary) | 0/0/0 | 1/5/5 | arkusz | UPDATE |
| P096 | Folia spożywcza | szt | Dis-Pack Kraków | 1/4 rolka | Selgros Kraków (szary) | 0/0/0 | 1/4/4 | arkusz | UPDATE |
| P097 | Papier Pergamin do pieczenia | szt | Dis-Pack Kraków | 1/3 rolka | — | 0/0/0 | 1/3/3 | arkusz | UPDATE |
| P100 | Jednorazowe Noże | opak | Dis-Pack Kraków | 3/10 opakowanie | — | 0/0/0 | 3/10/10 | arkusz | UPDATE |
| P101 | Jednorazowe Widelce | opak | Dis-Pack Kraków | 5/20 opakowanie | — | 0/0/0 | 5/20/20 | arkusz | UPDATE |
| P102 | Słomki 250szt | opak | Dis-Pack Kraków | 0,5/1,5 opakowanie | — | 0/0/0 | 0,5/1,5/1,5 | arkusz | UPDATE |
| P104 | Ręczniki papierowe ZZ | opak | Dis-Pack Kraków | 1/2 karton | Selgros Kraków (szary) | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P106 | Domestos 5L | szt | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P107 | Ludwik do naczyń 5l | szt | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P116 | Rękawiczki jednorazowe XL | opak | Dis-Pack Kraków | 2/7 opakowanie | Selgros Kraków (szary) | 0/0/0 | 2/7/7 | arkusz | UPDATE |
| P117 | Rękawiczki jednorazowe L | opak | Dis-Pack Kraków | 4/15 opakowanie | Selgros Kraków (szary) | 0/0/0 | 4/15/15 | arkusz | UPDATE |
| P118 | Rękawiczki jednorazowe M | opak | Dis-Pack Kraków | 4/15 opakowanie | Selgros Kraków (szary) | 0/0/0 | 4/15/15 | arkusz | UPDATE |
| P119 | Rękawiczki jednorazowe S | opak | Dis-Pack Kraków | 1/3 opakowanie | Selgros Kraków (szary) | 0/0/0 | 1/3/3 | arkusz | UPDATE |
| P121 | Gąbka do naczyń 10szt | szt | Dis-Pack Kraków | 2/5 opakowanie | — | 0/0/0 | 10/25/25 | arkusz ×5 | UPDATE |
| P122 | Druciak do mycia | szt | Dis-Pack Kraków | 3/10 sztuka | Selgros Kraków (szary) | 0/0/0 | 3/10/10 | arkusz | UPDATE |
| P123 | Ścierka z mikrofibry | szt | Dis-Pack Kraków | 3/10 sztuka | Selgros Kraków (szary) | 0/0/0 | 3/10/10 | arkusz | UPDATE |
| P126 | Worki na śmiecie 160 L | szt | Dis-Pack Kraków | 3/7 rolka | Selgros Kraków (szary) | brak wiersza | 3/7/7 | arkusz | INSERT |
| P127 | Zszywki do zszywacza | opak | Selgros Kraków | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P131 | Koperty | box | Dis-Pack Kraków | 1/2 opakowanie | — | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P143 | Tacki papierowe | opak | Dis-Pack Kraków | 2/8 opakowanie | — | 0/0/0 | 2/8/8 | arkusz | UPDATE |
| P144 | Kubeczki papierowe | opak | Dis-Pack Kraków | 1/2 opakowanie | — | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P172 | SER GOUDA - POLMLEK | kg | Selgros Kraków | szary | — | brak wiersza | 0/0/0 | 0/0/0 (brak progu) | INSERT |

## Tabela decyzji — SUPERSAM (Katowice), produkty zamawiane

| Produkt | Nazwa (katalog) | j.m. | Główny | Arkusz (główny) | Zapasowi | Przed | Po | Źródło progu | Akcja |
|---|---|---|---|---|---|---|---|---|---|
| P001 | Masło MR 500g | szt | Selgros Katowice | 3/8 szt | — | 0/0/0 | 3/8/8 | arkusz | UPDATE |
| P002 | Cytryna | kg | Selgros Katowice | 0,5/2 kg | — | 0/0/0 | 0,5/2/2 | arkusz | UPDATE |
| P003 | Papryka zielona | kg | Selgros Katowice | 0,5/2 kg | — | 0/0/0 | 0,5/2/2 | arkusz | UPDATE |
| P004 | Awokado | szt | Selgros Katowice | 2/5 szt | — | 0/0/0 | 2/5/5 | arkusz | UPDATE |
| P005 | Ogórek | kg | Selgros Katowice | 0,5/2 kg | — | 0/0/0 | 0,5/2/2 | arkusz | UPDATE |
| P006 | Pomidor | kg | Selgros Katowice | 12/48 kg | — | 0/0/0 | 12/48/48 | arkusz | UPDATE |
| P007 | Rucola 100 gr | opak | Selgros Katowice | 3/20 op | — | 0/0/0 | 3/20/20 | arkusz | UPDATE |
| P008 | Sałata bolero mix 150gr | opak | Selgros Katowice | 5/25 op | — | 0/0/0 | 5/25/25 | arkusz | UPDATE |
| P009 | Natka Pietruszki | kg | Selgros Katowice | 0,2/1 kg | — | 0/0/0 | 0,2/1/1 | arkusz | UPDATE |
| P010 | Czosnek | kg | Selgros Katowice | 0,2/0,5 kg | — | 0/0/0 | 0,2/0,5/0,5 | arkusz | UPDATE |
| P013 | Oliwki kalamata 2kg Bidon | kg | Kuchnie Świata Katowice | 0,5/1,5 bidon | — | 0/0/0 | 1/3/3 | arkusz ×2 | UPDATE |
| P014 | Feta blok 2kg | pojemnik | Kuchnie Świata Katowice | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P015 | Halloumi Reha 200gr | szt | Kuchnie Świata Katowice | 24/72 sztuka | — | 0/0/0 | 24/72/72 | arkusz | UPDATE |
| P016 | Cebula czerwona | kg | Selgros Katowice | 5/20 kg | — | 0/0/0 | 5/20/20 | arkusz | UPDATE |
| P018 | Cebula Biała | kg | Selgros Katowice | 0,2/1 kg | — | 0/0/0 | 0,2/1/1 | arkusz | UPDATE |
| P020 | Falafel | kg | Kuchnie Świata Katowice | 0,5/1,5 karton | — | 0/0/0 | 2,5/7,5/7,5 | arkusz ×5 | UPDATE |
| P021 | Frytki Aviko Super Crunch 9,5mm 2,5kg | szt | Kuchnie Świata Katowice | 10/36 sztuka | Selgros Katowice (16/44 szt) | 0/0/0 | 10/36/36 | arkusz | UPDATE |
| P022 | Frytki z batatów Aviko 2,27kg | szt | Kuchnie Świata Katowice | 2/4 sztuka | Selgros Katowice (2/5 szt) | 0/0/0 | 2/4/4 | arkusz | UPDATE |
| P023 | Fasolka Szparagowa mrożona 2,5kg | kg | Selgros Katowice | 0,5/1,5 szt | — | 0/0/0 | 1,25/3,75/3,75 | arkusz ×2,5 | UPDATE |
| P038 | Frytura Effo 15L | szt | Kuchnie Świata Katowice | 1/2 sztuka | — | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P040 | Woda 5L | szt | Selgros Katowice | 3/8 szt | — | 0/0/0 | 3/8/8 | arkusz | UPDATE |
| P041 | Olej Rzepakowy 5 L | szt | Selgros Katowice | 0,5/1,5 szt | Kuchnie Świata Katowice (szary) | 0/0/0 | 0,5/1,5/1,5 | arkusz | UPDATE |
| P042 | Ketchup Fanex VII 1,1 kg | szt | Selgros Katowice | 2/5 szt | — | 0/0/0 | 2/5/5 | arkusz | UPDATE |
| P043 | Develey Musztarda 3 kg | szt | Selgros Katowice | 1/2 szt | — | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P044 | Fanex Majonez 4kg | szt | Selgros Katowice | 1/2 szt | — | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P045 | Oliwa z Oliwek 1L | szt | Selgros Katowice | 2/7 szt | — | brak wiersza | 2/7/7 | arkusz | INSERT |
| P046 | Cieciorka w zalewie 400g/240g | szt | Selgros Katowice | 6/16 szt | — | 0/0/0 | 6/16/16 | arkusz | UPDATE |
| P047 | Kasza Pęczak Melvit 900g | szt | Selgros Katowice | 2/6 szt | — | 0/0/0 | 2/6/6 | arkusz | UPDATE |
| P048 | Sriracha chili 730 ml | szt | Kuchnie Świata Katowice | 2/4 sztuka | — | 0/0/0 | 2/4/4 | arkusz | UPDATE |
| P049 | Miód 1 kg | kg | Selgros Katowice | 1/2 szt | — | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P050 | Pieprz | kg | Selgros Katowice | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P051 | Oregano | kg | Selgros Katowice | 1/2 szt | — | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P052 | Papryka słodka - mielona | kg | Selgros Katowice | 1/2 szt | — | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P053 | Sól kamienna 1kg | kg | Selgros Katowice | 1/3 szt | — | 0/0/0 | 1/3/3 | arkusz | UPDATE |
| P054 | Prymat Liść Laurowy 80g | opak | Selgros Katowice | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P055 | Ziele Angielskie | opak | Selgros Katowice | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P057 | Sól w saszetkach 5g | opak | Selgros Katowice | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P058 | Pieprz w saszetkach 5g | opak | Selgros Katowice | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P082 | Bowl opakowanie papierowe miska 1300 ml | opak | Dis-Pack Katowice | 1/4 opakowanie | — | 0/0/0 | 1/4/4 | arkusz | UPDATE |
| P083 | Bowl opakowanie pokrywka plastik 1300 ml | opak | Dis-Pack Katowice | 1/3 opakowanie | — | 0/0/0 | 1/3/3 | arkusz | UPDATE |
| P084 | Opakowanie sałatki duże jednoczęściowe 750ml | opak | Dis-Pack Katowice | 1/2 opakowanie | — | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P085 | Opakowanie sałatki małe jednoczęściowe 250ml | opak | Dis-Pack Katowice | 1/2 opakowanie | — | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P086 | Sos opakowanie pojemnik | opak | Dis-Pack Katowice | 5/15 opakowanie | — | 0/0/0 | 5/15/15 | arkusz | UPDATE |
| P087 | Sos opakowanie pokrywka | opak | Dis-Pack Katowice | 3/7 opakowanie | — | 0/0/0 | 3/7/7 | arkusz | UPDATE |
| P088 | Opakowanie Frytki | opak | Selgros Katowice | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P093 | Torba na wynos z uszami | box | Dis-Pack Katowice | 1/3 karton | — | 0/0/0 | 1/3/3 | arkusz | UPDATE |
| P094 | Torby fałdowane pojedyncze do pity | opak | Dis-Pack Katowice | 2/5 opakowanie | — | 0/0/0 | 2/5/5 | arkusz | UPDATE |
| P095 | Folia Aluminiowa | szt | Dis-Pack Katowice | 1/5 rolka | Selgros Katowice (szary) | 0/0/0 | 1/5/5 | arkusz | UPDATE |
| P096 | Folia spożywcza | szt | Dis-Pack Katowice | 1/4 rolka | Selgros Katowice (szary) | 0/0/0 | 1/4/4 | arkusz | UPDATE |
| P097 | Papier Pergamin do pieczenia | szt | Dis-Pack Katowice | 1/3 rolka | — | 0/0/0 | 1/3/3 | arkusz | UPDATE |
| P100 | Jednorazowe Noże | opak | Dis-Pack Katowice | 3/10 opakowanie | — | 0/0/0 | 3/10/10 | arkusz | UPDATE |
| P101 | Jednorazowe Widelce | opak | Dis-Pack Katowice | 5/20 opakowanie | — | 0/0/0 | 5/20/20 | arkusz | UPDATE |
| P102 | Słomki 250szt | opak | Dis-Pack Katowice | 0,5/1,5 opakowanie | — | 0/0/0 | 0,5/1,5/1,5 | arkusz | UPDATE |
| P104 | Ręczniki papierowe ZZ | opak | Dis-Pack Katowice | 1/2 karton | Selgros Katowice (szary) | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P106 | Domestos 5L | szt | Selgros Katowice | 1/2 szt | — | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P107 | Ludwik do naczyń 5l | szt | Selgros Katowice | 1/2 szt | — | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P116 | Rękawiczki jednorazowe XL | opak | Dis-Pack Katowice | 2/5 opakowanie | Selgros Katowice (szary) | 0/0/0 | 2/5/5 | arkusz | UPDATE |
| P117 | Rękawiczki jednorazowe L | opak | Dis-Pack Katowice | 4/15 opakowanie | Selgros Katowice (szary) | 0/0/0 | 4/15/15 | arkusz | UPDATE |
| P118 | Rękawiczki jednorazowe M | opak | Dis-Pack Katowice | 4/15 opakowanie | Selgros Katowice (szary) | 0/0/0 | 4/15/15 | arkusz | UPDATE |
| P119 | Rękawiczki jednorazowe S | opak | Dis-Pack Katowice | 1/3 opakowanie | Selgros Katowice (szary) | 0/0/0 | 1/3/3 | arkusz | UPDATE |
| P121 | Gąbka do naczyń 10szt | szt | Dis-Pack Katowice | 2/5 opakowanie | — | 0/0/0 | 10/25/25 | arkusz ×5 | UPDATE |
| P122 | Druciak do mycia | szt | Dis-Pack Katowice | 3/10 sztuka | Selgros Katowice (szary) | 0/0/0 | 3/10/10 | arkusz | UPDATE |
| P123 | Ścierka z mikrofibry | szt | Dis-Pack Katowice | 3/10 sztuka | Selgros Katowice (szary) | 0/0/0 | 3/10/10 | arkusz | UPDATE |
| P124 | Worki na śmiecie 60 L | szt | Dis-Pack Katowice | 2/5 rolka | — | brak wiersza | 2/5/5 | arkusz | INSERT |
| P125 | Worki na śmiecie 120 L | szt | Dis-Pack Katowice | 3/7 rolka | Selgros Katowice (szary) | 0/0/0 | 3/7/7 | arkusz | UPDATE |
| P126 | Worki na śmiecie 160 L | szt | Dis-Pack Katowice | 2/5 rolka | Selgros Katowice (szary) | brak wiersza | 2/5/5 | arkusz | INSERT |
| P127 | Zszywki do zszywacza | opak | Selgros Katowice | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P131 | Koperty | box | Dis-Pack Katowice | 1/2 opakowanie | — | 0/0/0 | 1/2/2 | arkusz | UPDATE |
| P132 | Markery | szt | Selgros Katowice | szary | — | 0/0/0 | 0/0/0 | 0/0/0 (brak progu) | bez zmian |
| P143 | Tacki papierowe | opak | Dis-Pack Katowice | 2/8 opakowanie | — | 0/0/0 | 2/8/8 | arkusz | UPDATE |
| P144 | Kubeczki papierowe | opak | Dis-Pack Katowice | 1/2 opakowanie | — | 0/0/0 | 1/2/2 | arkusz | UPDATE |

## Tylko liczenie (próg 0/0/0, bez wiersza katalogu)

Produkt jest na liście inwentaryzacji, ale żaden dostawca miejski go nie ma, więc nie da się go zamówić w aplikacji. Audyt B (e) liczy te wiersze: FORUM 33, SUPERSAM 36.

| Lokal | Produkty | Powód |
|---|---|---|
| FORUM | P019 Przyprawa do souvlakow (było 0,5/2/2), P089 Boxy PB, P090 Papier do Pita (PB), P091 Serwetki PB, P092 Tacki bez logo, P098 Papier termiczny - aluminiowy, P132 Markery, P133 Długopisy | Mory |
| FORUM | P024 Gyros 15 KG (było 4/15/15), P026 Pita (opakowania) szt 10 (było 2/11/11), P027 Souvlaki Kurczak, P028 Souvlaki Wieprz | Pago |
| FORUM | P029 Spicy Mayo, P030 Musztada Miodowa, P031 Musztada, P032 Ketchup, P033 Ladolimono, P034 Ogórek + papryka, P035 Masło czosnkowe, P036 Kasza Pęczak ugotowana, P176 Gyros wieprzowy ścięty, P177 Gyros wieprzowy nieścięty | produkcja własna |
| FORUM | P075 Lemoniada Lemon, P076 Lemoniada Orange, P077 Lemoniada Grapefruit | napoje Filber |
| FORUM | P129 Rolki do kasy 80 na 80, P130 Rolki do kasy 57 na 30 | Mory, rolki |
| FORUM | P155 7Up, P163 Krystaliczne Źródło Gazowana, P164 Krystaliczne Źródło Niegazowana, P165 Mirinda, P166 Pepsi, P167 Pepsi Zero | napoje Pepsi |
| SUPERSAM | P011 Tzatzyki 3kg, P012 Tirokafteri 2kg | nabiał Katowice |
| SUPERSAM | P019 Przyprawa do souvlakow, P089 Boxy PB, P090 Papier do Pita (PB), P091 Serwetki PB, P092 Tacki bez logo, P098 Papier termiczny - aluminiowy, P133 Długopisy | Mory |
| SUPERSAM | P024 Gyros 15 KG, P026 Pita (opakowania) szt 10, P027 Souvlaki Kurczak, P028 Souvlaki Wieprz | Pago |
| SUPERSAM | P029 Spicy Mayo, P030 Musztada Miodowa, P031 Musztada, P032 Ketchup, P033 Ladolimono, P034 Ogórek + papryka, P035 Masło czosnkowe, P036 Kasza Pęczak ugotowana, P176 Gyros wieprzowy ścięty, P177 Gyros wieprzowy nieścięty | produkcja własna |
| SUPERSAM | P064 Cappy Jabłko, P065 Cappy Pomarańcza, P066 Fanta, P067 Sprite, P068 Coca-Cola 0,33 l puszka, P069 Coca-Cola Zero 0,33 l puszka, P070 Kropla Beskidu Niegazowana, P071 Kropla Beskidu Gazowana | Coca-Cola |
| SUPERSAM | P075 Lemoniada Lemon, P076 Lemoniada Orange, P077 Lemoniada Grapefruit | napoje Filber |
| SUPERSAM | P129 Rolki do kasy 80 na 80, P183 Rolki do kasy 80 na 20 | Mory, rolki |

## Usunięte w kroku C (26 wierszy; kopia literalna w pliku C i w `rollback.sql` R-C)

| Lokal | Produkt | Nazwa | Było | Dlaczego |
|---|---|---|---|---|
| FORUM | P017 | Papryka grillowana grecka Florina (Florinis) | 0,5/1,5/1,5 | brak dostawcy w arkuszu (Papryka Red Sweet wstrzymana) |
| FORUM | P037 | Gyros (ścięty + nieścięty) | 0/0/0 | produkt nieaktywny (zastąpiony P176/P177) |
| FORUM | P039 | Ocet spirytusowy | 0/0/0 | brak dostawcy w arkuszu (ocet) |
| FORUM | P056 | Cukier w saszetkach 5g | 0/0/0 | brak dostawcy w arkuszu (cukier w saszetkach) |
| FORUM | P099 | Jednorazowe mini łyżeczki | 0/0/0 | brak dostawcy w arkuszu (łyżeczki) |
| FORUM | P103 | Serwetki białe bez logo | 0/0/0 | brak dostawcy w arkuszu (serwetki białe) |
| FORUM | P109 | Płyn do mycia szyb Tenzi | 0/0/0 | brak dostawcy w arkuszu (płyn do szyb) |
| FORUM | P111 | Fenix grill cleaner 1L | 0/0/0 | brak dostawcy (JAX-GRILL wstrzymany) |
| FORUM | P112 | Fenix degreaser 1L | 0/0/0 | brak dostawcy (DIX wstrzymany) |
| FORUM | P113 | Top Grill Tenzi 1L | 0/0/0 | brak dostawcy (JAX-GRILL wstrzymany) |
| FORUM | P114 | Top Glass Tenzi | 0/0/0 | brak dostawcy w arkuszu (Top Glass) |
| FORUM | P125 | Worki na śmiecie 120 L | 0/0/0 | Kraków: brak worków 120 L w arkuszu |
| FORUM | P128 | Rolki do kasy 57 na 20 | 0/0/0 | rolka 57/20 nie pasuje do sprzętu Forum (57/30 + 80/80) |
| FORUM | P170 | Sałata bolero mix- 500 grm | 0/0/0 | produkt bez jednostki, bez dostawcy; arkusz zamawia P008 (bolero 150 g) |
| SUPERSAM | P017 | Papryka grillowana grecka Florina (Florinis) | 0/0/0 | brak dostawcy w arkuszu (Papryka Red Sweet wstrzymana) |
| SUPERSAM | P037 | Gyros (ścięty + nieścięty) | 0/0/0 | produkt nieaktywny (zastąpiony P176/P177) |
| SUPERSAM | P039 | Ocet spirytusowy | 0/0/0 | brak dostawcy w arkuszu (ocet) |
| SUPERSAM | P056 | Cukier w saszetkach 5g | 0/0/0 | brak dostawcy w arkuszu (cukier w saszetkach) |
| SUPERSAM | P099 | Jednorazowe mini łyżeczki | 0/0/0 | brak dostawcy w arkuszu (łyżeczki) |
| SUPERSAM | P103 | Serwetki białe bez logo | 0/0/0 | brak dostawcy w arkuszu (serwetki białe) |
| SUPERSAM | P109 | Płyn do mycia szyb Tenzi | 0/0/0 | brak dostawcy w arkuszu (płyn do szyb) |
| SUPERSAM | P111 | Fenix grill cleaner 1L | 0/0/0 | brak dostawcy (JAX-GRILL wstrzymany) |
| SUPERSAM | P112 | Fenix degreaser 1L | 0/0/0 | brak dostawcy (DIX wstrzymany) |
| SUPERSAM | P113 | Top Grill Tenzi 1L | 0/0/0 | brak dostawcy (JAX-GRILL wstrzymany) |
| SUPERSAM | P114 | Top Glass Tenzi | 0/0/0 | brak dostawcy w arkuszu (Top Glass) |
| SUPERSAM | P130 | Rolki do kasy 57 na 30 | 0/0/0 | rolka 57/30 nie pasuje do sprzętu Supersamu (80/20 + 80/80) |

## Wstrzymane (nie wpisane — do decyzji)

| Pozycja (arkusz) | Dostawca | Lokale | Arkusz min/max | Dlaczego |
|---|---|---|---|---|
| Preparat zasadowy do mycia grilla i piekarnika - 750 ml JAX-GRILL | Dis-Pack | SUPERSAM, FORUM | SUPERSAM 1/4; FORUM 1/4 | decyzja 7: JAX-GRILL wstrzymany (P111/P113 czy nowy produkt?) |
| Odtłuszczacz DIX uniwersalny 750 ml 9783657613 | Dis-Pack | SUPERSAM, FORUM | SUPERSAM 1/3; FORUM 1/3 | decyzja 7: DIX wstrzymany (P112 czy nowy produkt?) |
| Ręcznik 2 warstwowy celuloza, biały 100 mb - 6 rolek/opak. RC100 | Dis-Pack | SUPERSAM, FORUM | SUPERSAM 1/3; FORUM 1/3 | decyzja 7: brak produktu w katalogu (= 'papier w roli duży'?) |
| Papryka Red Sweet czerwona grillowana 450g/12 Zanae e | Kuchnie Świata | SUPERSAM, FORUM | SUPERSAM 1/2; FORUM 1/2 | decyzja 7: brak produktu (P017 Florinis to 3,6 kg) - nowy produkt czy zamiennik? |
| Majonez dekoracyjny 2,8kg Fanex | Kuchnie Świata | SUPERSAM, FORUM | szary | decyzja 6: pominięty (zamiennik P044 czy nowy produkt?) |
| Tacki papierowe 23cm/12cm 250szt | Selgros | SUPERSAM, FORUM | szary | decyzja 6: inny rozmiar niż P143 (14x25 cm, opak. 100) |
| Papier w roli duży | Selgros | SUPERSAM, FORUM | szary | decyzja 6/7: brak produktu w katalogu |
| Grill Cleaner Spray Tytan 750 ml | Selgros | SUPERSAM, FORUM | szary | decyzja 6: niejednoznaczne (P111 / P113 / P115) |
| Zmywaki kuchenne Jan Niezbedny | Selgros | SUPERSAM, FORUM | szary | decyzja 6: nieznana liczba sztuk w opak. (P121 liczony w szt) |
| Słomki papierowe niebieskie 25szt | Selgros | SUPERSAM, FORUM | szary | decyzja 6: inna paczka (25 szt vs opak. 100/250 dla P102) |
| Kawa Nescafe 500gr | Selgros | SUPERSAM, FORUM | szary | decyzja 6/7: inny produkt (P140 to Jacobs 200 g) |
| Mleko 1L 3,2 | Selgros | SUPERSAM, FORUM | szary | decyzja 6/7: brak produktu w katalogu |
| Sosjerka 80ml x50szt plastikowa | Selgros | SUPERSAM, FORUM | szary | decyzja 6: inna paczka (50 szt vs P086 liczony w opak. 100) |
| Wieczko do sosjerki x50szt plastikowe | Selgros | SUPERSAM, FORUM | szary | decyzja 6: inna paczka (50 szt vs P087 liczony w opak. 100) |
| Torby papierowe na wynos duże 50szt | Selgros | SUPERSAM, FORUM | szary | decyzja 6: inna paczka (50 szt vs P093 karton 250) |
| Frytki Aviko Super Crunch 9,5 | Selgros | SUPERSAM, FORUM | szary | duplikat P021 (jeden wiersz Selgros P021 wyżej) |
| Butelka przezroczysta na sos 1L | Selgros | SUPERSAM, FORUM | szary | decyzja 6/7: brak produktu w katalogu |
| Torebki papierowe fałdowane 50szt | Selgros | SUPERSAM, FORUM | szary | decyzja 6: inna paczka (50 szt vs P094 opak. 1000) |
| Zapalniczka długa | Selgros | SUPERSAM, FORUM | szary | decyzja 6/7: brak produktu w katalogu |
| Końcówka szczotki do zamiatania (bez kija) | Selgros | SUPERSAM, FORUM | szary | decyzja 6: niejednoznaczne (P148 to szczotka na kiju) |
| Zapas (Vileda mop płaski Ultra, ten mniejszy) | Selgros | SUPERSAM | szary | decyzja 6: niejednoznaczne (P153 to Ultra Max; 'ten mniejszy') |
| Jogurt Grecki 400gr | Selgros | FORUM | szary | decyzja 6: niejednoznaczne (P162 Bakoma 370 g kg / P161 bez jednostki) |

## Katalog miejski (krok B)

| Dostawca | Lokal | wierszy | główne | zapasowe |
|---|---|---|---|---|
| Bukat Kraków (`SUP_BUKAT_KRK`) | FORUM | 14 | 14 | 0 |
| Dis-Pack Kraków (`SUP_DISPACK_KRK`) | FORUM | 26 | 26 | 0 |
| Dis-Pack Katowice (`SUP_DISPACK_KAT`) | SUPERSAM | 28 | 28 | 0 |
| Kuchnie Świata Kraków (`SUP_KUCHNIE_KRK`) | FORUM | 9 | 7 | 2 |
| Kuchnie Świata Katowice (`SUP_KUCHNIE_KAT`) | SUPERSAM | 9 | 8 | 1 |
| Selgros Kraków (`SUP_SELGROS_KRK`) | FORUM | 47 | 24 | 23 |
| Selgros Katowice (`SUP_SELGROS_KAT`) | SUPERSAM | 48 | 35 | 13 |
| **razem** | | **181** | **142** | **39** |

Odstępstwa od wiersza warszawskiego (pełna lista pól w VALUES pliku B, źródło w `notes` wiersza):

| Wiersz | Jednostka zakupu | Cena | Uwagi |
|---|---|---|---|
| SP_DISPACK_KRK_P083 | opak ×1 | 13,27 | pokrywka do miski papierowej - w katalogu P083 to pokrywka plastik, do potw. |
| SP_DISPACK_KRK_P093 | box ×1 | 105 | arkusz: karton 250 szt = 1 box |
| SP_DISPACK_KRK_P097 | szt ×1 | 12,6 | nazwa w arkuszu ucięta po kodzie PAPBAKE3 |
| SP_DISPACK_KRK_P104 | opak ×1 | 48 | karton 4000 list. vs opak. ZZ w Warszawie - do potw. |
| SP_DISPACK_KRK_P121 | opak ×5 | pusta | bez opakowania zbiorczego (Warszawa: opak 10); opak. 5 szt (Warszawa: szt); cena Warszawy była za sztukę |
| SP_DISPACK_KRK_P122 | szt ×1 | pusta | brak ceny także w Warszawie |
| SP_DISPACK_KRK_P102 | opak ×1 | pusta | opak. 100 szt (katalog: Słomki 250szt) - do potw. |
| SP_DISPACK_KRK_P131 | box ×1 | pusta | opak. 50 szt = 1 box; cena Warszawy była za sztukę |
| SP_DISPACK_KRK_P144 | opak ×1 | pusta | brak ceny także w Warszawie |
| SP_DISPACK_KRK_P143 | opak ×1 | pusta | brak ceny także w Warszawie |
| SP_DISPACK_KAT_P083 | opak ×1 | 13,27 | pokrywka do miski papierowej - w katalogu P083 to pokrywka plastik, do potw. |
| SP_DISPACK_KAT_P093 | box ×1 | 105 | arkusz: karton 250 szt = 1 box |
| SP_DISPACK_KAT_P097 | szt ×1 | 12,6 | nazwa w arkuszu ucięta po kodzie PAPBAKE3 |
| SP_DISPACK_KAT_P104 | opak ×1 | 48 | karton 4000 list. vs opak. ZZ w Warszawie - do potw. |
| SP_DISPACK_KAT_P121 | opak ×5 | pusta | bez opakowania zbiorczego (Warszawa: opak 10); opak. 5 szt (Warszawa: szt); cena Warszawy była za sztukę |
| SP_DISPACK_KAT_P122 | szt ×1 | pusta | brak ceny także w Warszawie |
| SP_DISPACK_KAT_P102 | opak ×1 | pusta | opak. 100 szt (katalog: Słomki 250szt) - do potw. |
| SP_DISPACK_KAT_P131 | box ×1 | pusta | opak. 50 szt = 1 box; cena Warszawy była za sztukę |
| SP_DISPACK_KAT_P144 | opak ×1 | pusta | brak ceny także w Warszawie |
| SP_DISPACK_KAT_P143 | opak ×1 | pusta | brak ceny także w Warszawie |
| SP_KUCHNIE_KRK_P013 | opak ×2 | 45,31 | 1 opak = bidon 2 kg |
| SP_KUCHNIE_KAT_P013 | opak ×2 | 45,31 | 1 opak = bidon 2 kg |
| SP_SELGROS_KRK_P016 | kg ×1 | 2,2 | bez opakowania zbiorczego (Warszawa: worek 5) |
| SP_SELGROS_KRK_P006 | kg ×1 | 10,5 | bez opakowania zbiorczego (Warszawa: skrzynka 6) |
| SP_SELGROS_KRK_P018 | kg ×1 | 1,5 | bez opakowania zbiorczego (Warszawa: worek 5) |
| SP_SELGROS_KRK_P021 | paczka ×1 | 18,86 | bez opakowania zbiorczego (Warszawa: karton 4); w arkuszu drugi raz jako 'Frytki Aviko Super Crunch 9,5' (op) - jeden wiersz |
| SP_SELGROS_KRK_P051 | kg ×1 | pusta | waga opakowania 'duże' do potw. |
| SP_SELGROS_KRK_P052 | kg ×1 | pusta | waga opakowania 'duża' do potw. |
| SP_SELGROS_KRK_P172 | szt ×3 | pusta | arkusz: blok 3 kg = szt (x3 kg); Warszawa: kg |
| SP_SELGROS_KRK_P054 | opak ×1 | pusta | wielkość opakowania w Selgrosie nieznana |
| SP_SELGROS_KRK_P055 | opak ×1 | pusta | wielkość opakowania w Selgrosie nieznana |
| SP_SELGROS_KRK_P057 | opak ×1 | pusta | saszetki 2 g (katalog: 5 g) - do potw. |
| SP_SELGROS_KRK_P058 | opak ×1 | pusta | saszetki 2 g (katalog: 5 g) - do potw. |
| SP_SELGROS_KRK_P050 | kg ×1 | pusta | arkusz 'op', katalog 'kg' - 1:1, waga do potw. |
| SP_SELGROS_KRK_P118 | opak ×1 | 9,75 | arkusz 'szt', przyjęto 1 opak. |
| SP_SELGROS_KRK_P117 | opak ×1 | 9,75 | arkusz 'szt', przyjęto 1 opak. |
| SP_SELGROS_KRK_P119 | opak ×1 | 9,75 | arkusz 'szt', przyjęto 1 opak. |
| SP_SELGROS_KRK_P116 | opak ×1 | 9,75 | arkusz 'szt', przyjęto 1 opak. |
| SP_SELGROS_KRK_P104 | opak ×1 | 48 | arkusz: karton |
| SP_SELGROS_KRK_P122 | opak ×5 | pusta | op. 5 szt |
| SP_SELGROS_KRK_P088 | opak ×1 | 5,04 | = P088 Opakowanie Frytki? do potw. |
| SP_SELGROS_KRK_P123 | opak ×5 | pusta | op. 5 szt |
| SP_SELGROS_KAT_P016 | kg ×1 | 2,2 | bez opakowania zbiorczego (Warszawa: worek 5) |
| SP_SELGROS_KAT_P006 | kg ×1 | 10,5 | bez opakowania zbiorczego (Warszawa: skrzynka 6) |
| SP_SELGROS_KAT_P018 | kg ×1 | 1,5 | bez opakowania zbiorczego (Warszawa: worek 5) |
| SP_SELGROS_KAT_P021 | paczka ×1 | 18,86 | bez opakowania zbiorczego (Warszawa: karton 4); w arkuszu drugi raz jako 'Frytki Aviko Super Crunch 9,5' (op) - jeden wiersz |
| SP_SELGROS_KAT_P051 | kg ×1 | pusta | waga opakowania 'duże' do potw. |
| SP_SELGROS_KAT_P052 | kg ×1 | pusta | waga opakowania 'duża' do potw. |
| SP_SELGROS_KAT_P054 | opak ×1 | pusta | wielkość opakowania w Selgrosie nieznana |
| SP_SELGROS_KAT_P055 | opak ×1 | pusta | wielkość opakowania w Selgrosie nieznana |
| SP_SELGROS_KAT_P057 | opak ×1 | pusta | saszetki 2 g (katalog: 5 g) - do potw. |
| SP_SELGROS_KAT_P058 | opak ×1 | pusta | saszetki 2 g (katalog: 5 g) - do potw. |
| SP_SELGROS_KAT_P050 | kg ×1 | pusta | arkusz 'op', katalog 'kg' - 1:1, waga do potw. |
| SP_SELGROS_KAT_P118 | opak ×1 | 9,75 | arkusz 'szt', przyjęto 1 opak. |
| SP_SELGROS_KAT_P117 | opak ×1 | 9,75 | arkusz 'szt', przyjęto 1 opak. |
| SP_SELGROS_KAT_P119 | opak ×1 | 9,75 | arkusz 'szt', przyjęto 1 opak. |
| SP_SELGROS_KAT_P116 | opak ×1 | 9,75 | arkusz 'szt', przyjęto 1 opak. |
| SP_SELGROS_KAT_P104 | opak ×1 | 48 | arkusz: karton |
| SP_SELGROS_KAT_P122 | opak ×5 | pusta | op. 5 szt |
| SP_SELGROS_KAT_P088 | opak ×1 | 5,04 | = P088 Opakowanie Frytki? do potw. |
| SP_SELGROS_KAT_P123 | opak ×5 | pusta | op. 5 szt |

## Audyt — oczekiwane wyniki

| Plik | Sprawdzenie | Oczekiwane |
|---|---|---|
| A (a) | wiersze z dopiskiem / nowe / wszystkie | FORUM 35 / 4 / 118 · SUPERSAM 59 / 3 / 119 |
| A (b) | min ≤ target ≤ max w obu lokalach | 0 wierszy |
| A (c) | wiersz rolloutu na nieaktywnym produkcie | 0 wierszy |
| A (d) | lokale | oba `active`, `own_catalog`, adres + kod pocztowy, spółka, NIP, telefon; SUPERSAM bez e-maila |
| A (e) | dopisek rolloutu w innym lokalu | 0 wierszy |
| C (a) | wierszy progów | FORUM 104 · SUPERSAM 107 |
| C (b), (c) | usunięte wiersze / progi na nieaktywnym produkcie | 0 / 0 |
| B (a) | główne / zapasowe per dostawca | jak tabela „Katalog miejski” |
| B (b) | nowy dostawca bez aktywnego wiersza | 0 wierszy |
| B (c) | zapasowy bez aktywnego głównego w tym lokalu | 0 wierszy |
| B (d) | wiersz miejski bez progu w lokalu | 0 wierszy |
| B (e) | progi bez wiersza miejskiego (= tylko liczenie) | FORUM 33 · SUPERSAM 36, wszystkie 0/0/0 |
| B (f) | katalog wspólny | 260 / 172 / md5 jak STEP 0c (2026-10-08: `c6389820fb87c3e57ad862cb70b82a52`), 0 wspólnych `is_backup` |
| B (g) | aktywne wspólne wiersze na produkt | `c7fa486d3ab4f85dc1030996edd444ce` |
| B (h) | wiersz miejski w lokalu bez `own_catalog` | 0 wierszy |
| B (i) | duplikat aktywnego wiersza (lokal, dostawca, produkt) | 0 wierszy |

Blok DO w B dodatkowo przerywa (RAISE), gdy: liczba dostawców ≠ 7, wierszy ≠ 181, liczba głównych/zapasowych dowolnego dostawcy różni się od tabeli, zapasowy nie ma głównego, wiersz miejski nie ma progu, produkt jest nieaktywny, wiersz miejski stoi w lokalu bez `own_catalog`, produkt ma dwa główne w jednym lokalu, jest duplikat (lokal, dostawca, produkt) albo zmienił się katalog wspólny (liczba, aktywne, md5 — przed vs po w tej samej transakcji).

## Próba na lokalnym Postgresie (2026-10-08)

Jednorazowa baza na Postgres 16.14 (Homebrew, `127.0.0.1`, poza prod): wszystkie migracje z `supply-os-v1/migrations/` po kolei (z 0029), potem dane przepisane z odczytu prod: 14 dostawców, 191 produktów, FORUM/SUPERSAM w stanie sprzed zmiany (+ jeden lokal warszawski), 218 wierszy katalogu (wszystkie 172 aktywne; bez 42 nieaktywnych), 230 wierszy progów. Suma kontrolna progów FORUM+SUPERSAM i aktywnych wierszy na produkt — identyczne z prod (`351e94f2…`, `c7fa486d…`).

| Test | Wynik |
|---|---|
| A → C → B w jednej transakcji `BEGIN … ROLLBACK` | wszystkie bloki przeszły; audyty: A (a) FORUM 35/4/118, SUPERSAM 59/3/119, (b)(c)(e) 0 wierszy; C: 26 × `match`, po C 104/107, (b)(c) 0; B: 7 dostawców, 181 wierszy, podział główne/zapasowe jak w tabeli, (b)(c)(d)(h)(i) 0 wierszy, (e) 33/36 wszystkie 0/0/0, (f)(g) katalog wspólny bez zmian; po ROLLBACK baza identyczna (md5 4 tabel) |
| A drugi raz | przerywa: „FORUM/SUPERSAM missing or not in the expected pre-rollout state”, nic nie zapisane |
| C przed A | przerywa: „step A not applied” |
| B po A, przed C | przerywa: „step C not applied (… 104/107 …)” |
| B jako pierwszy | przerywa: „step A not applied” |
| B drugi raz / C drugi raz po A+C+B | przerywają: „a city supplier already exists” / „… should have 118/119 rows after step A” |
| `rollback.sql` bez zgody na PART 2 (po A+C+B) | PART 1 zatwierdzony: 0 aktywnych dostawców miejskich, 0 aktywnych wierszy miejskich (7 i 181 nadal w bazie); PART 2 przerywa na bloku zgody, nic nie zapisuje |
| `rollback.sql` z `SET rollout.krk_kat_data_rollback = 'yes'` (po PART 1) | R-0 7/181, R-B 181 + 7 usunięte, R-C 26 przywrócone, R-A 94 przywrócone + 7 usunięte + lokale; md5 progów, lokali, dostawców i katalogu = stan sprzed A |
| rollback po samym A / po A+C / bez zmian | sekcje niewykonanych kroków pomijają się (NOTICE); za każdym razem md5 4 tabel = stan sprzed A |
| A+C+B + zamówienie testowe (draft) na SUP_BUKAT_KRK, potem rollback z PART 2 | PART 1 wyłącza katalog; PART 2 przerywa w R-B („orders / receipts reference the city catalog”), dane zostają (wyłączone) |

## Rollback

Kolejność (`rollback.sql`):

1. **PART 1 — wyłącznik awaryjny (R-0), sam i najpierw, PRZED jakimkolwiek cofnięciem kodu na Railway/Vercel.** Wyłącza 7 dostawców miejskich i wszystkie 181 wiersze katalogu z `location_id` (sprawdza liczby: 7 i 181). Powód: stary backend ignoruje `location_id` i pokazuje zakładkę każdego aktywnego dostawcy, więc po cofnięciu kodu Bukat Kraków i reszta pojawiłyby się we wszystkich lokalach warszawskich; do tego stary `_primary_supplier_product` bierze najniższe `supplier_product_id` spośród aktywnych wierszy (`main:supply-os-v1/app/main.py:2761-2790`), a `SP_BUKAT_KRK_Pxxx` sortuje się przed `SP_BUKAT_Pxxx` — podpowiedzi opakowań i wartość stanu w Warszawie przeszłyby na wiersze krakowskie. Wyłączone wiersze są niewidoczne dla starego i nowego kodu.
2. **Cofnięcie kodu** (Railway / Vercel), jeśli potrzebne. Po cofnięciu kodu FORUM/SUPERSAM (`active=true`) widziałyby katalog warszawski — jeśli lokale już pracują, zdjąć ich kody z `SUPPLY_OS_CAPTAIN_TOKENS` albo uprzedzić managera. `locations.active` nie blokuje kapitana w obecnym kodzie.
3. **PART 2 — pełne cofnięcie danych (opcjonalnie, osobnym wywołaniem).** Wymaga odkomentowania `SET LOCAL rollout.krk_kat_data_rollback = 'yes'` — bez tego pierwszy blok przerywa i PART 2 nic nie zapisuje (ochrona przed uruchomieniem całego pliku naraz). R-B kasuje 181 wierszy i 7 dostawców (przerywa, jeśli istnieje zamówienie / przyjęcie / transport / reguła dostaw dla nich — wtedy zostaje PART 1), R-C przywraca 26 wierszy z kopii, R-A przywraca 94 progów z dopisku „przed a/b/c”, kasuje 7 nowych i wraca lokale do stanu z 2026-10-08 (`own_catalog=false`, `active=false`). Każda sekcja pomija się sama, gdy jej kroku nie było.
4. **Migracja 0029** — zostaje (addytywna); jej cofnięcie opisuje nagłówek 0029, tylko po PART 2.

## Dane publiczne (sprawdzone 2026-10-08, nikt nie był kontaktowany)

Wpisane do `suppliers.notes` (2 niezależne źródła, oznaczone „publiczne, niepotwierdzone”):

- Dis-Pack Opakowania sp. z o.o.: magazyn Morawica 356, 32-084 Morawica (k. Krakowa); biuro@dis-pack.pl — opakowaniakrakow.pl + panoramafirm.pl.
- Kuchnie Świata, oddział Kraków: tel. 12 296 76 60 — kuchnieswiata.com.pl + panoramafirm.pl.
- Selgros Kraków: ul. Nowohucka 52, 31-580 Kraków, tel. 12 68 33 000 — selgros.pl + directmap.info + pkt.pl.
- Selgros Katowice: ul. Lwowska 32, 40-389 Katowice, tel. 32 208 80 00 — selgros.pl + targeo.pl + pkt.pl.

Nie wpisane (jedno źródło, sprzeczne albo ogólne dla całej sieci):

- Dis-Pack: tel. 12 378 40 34/35; darmowa dostawa w Krakowie od 330 albo 400 zł (strona niespójna), kurierem w Polsce od 699 zł; oddziału w Katowicach nie znaleziono (obsługa z Morawicy).
- Kuchnie Świata Kraków: nowy adres ul. Radziwiłłów 140, 32-084 Aleksandrowice (katalogi firm mają stary: ul. Zawiła); krakow@kuchnieswiata.com.pl; minimum i dni dostaw tylko w panelu klienta. Na liście 8 oddziałów HoReCa nie ma Katowic — czy Kraków obsługuje Śląsk, nie wiadomo.
- Selgros: dowóz HoReCa w sieci istnieje (selgros.pl + horecanet.pl, bez potwierdzenia dla hali w Katowicach); e-maile horeca.krakow@ / horeca.katowice@selgros.pl (jedno źródło); minimum sprzeczne (750 vs 1000 zł netto) — `minimum_order_value_pln` zostaje puste.
- Bukat: oddziału w Krakowie nie znaleziono; strona podaje dostawy w woj. małopolskim bez wymienienia Krakowa (jedno źródło); minimum 400 zł dotyczy Warszawy.

## Uwagi i ryzyka

- **FORUM P018 Cebula biała** (Bukat Kraków, worek 5 kg z Warszawy, decyzja 4): target 2 kg < pół worka → sugestia w workach zawsze 0 (`case_suggestion`, `supply-os-v1/app/suggestion.py:136-142`). Ten sam układ jest w Warszawie. Do decyzji: target ≥ 2,5 albo bez opakowania zbiorczego w Krakowie.
- **FORUM P012 Tirokafteri** zostaje 1,5/4/4,5 (wartość Forum z sierpnia, target ≠ max) — decyzja 4 mówi „progi Forum bez zmian”.
- **P019 Przyprawa do souvlaki (FORUM 0,5/2/2)** → 0/0/0 tylko liczenie (Mory) — poza wprost wymienionymi P024/P026, ta sama reguła (decyzja 8).
- **P017 Florinis (FORUM 0,5/1,5/1,5)** — usunięty w C: żaden dostawca miejski go nie ma, a Papryka Red Sweet jest wstrzymana.
- **P127 Zszywki i P132 Markery** — Selgros (pozycje szare / marker), nie Mory; P132 tylko w Katowicach (w Krakowie liczony jako Mory).
- **Przeliczenia do potwierdzenia**: druciaki i ścierki Selgros „op. 5 szt” (jednostka zakupu opak ×5), Torebka na frytki kwadratowa = P088?, Gouda blok 3 kg = szt ×3, sól/pieprz w saszetkach 2 g vs 5 g w katalogu, oregano / papryka „duże” 1:1 do kg, pieprz „op” 1:1 do kg, Słomki 100 szt vs katalog 250 szt, ręcznik ZZ karton 4000 listków vs opak. w Warszawie, pokrywka do miski papierowej vs P083.
- **Selgros**: ceny z Warszawy (Intermlecz / Blue Service / Bukat) są tylko orientacyjne.
- **Wartość stanu** dla wierszy z pustą ceną będzie niepełna, dopóki manager nie uzupełni cen.

## Pytania do Marka (otwarte po decyzjach operatora)

1. Bukat Kraków: czy dowozi do Krakowa, w które dni, minimum; czy progi Forum z sierpnia są aktualne (pomidor 12/54 kg, rucola 10/35 op., tzatziki 5/14, tirokafteri 1,5/4,5, feta 0,5/2); cebula biała 2 kg przy worku 5 kg.
2. Selgros Kraków: które pozycje mają mieć progi (dziś wszystkie 0/0/0 poza masłem 3/9), w jakie dni przyjeżdża.
3. Katowice: skąd tzatziki, tirokafteri i feta (dziś tylko liczenie; feta Hotos w Kuchniach Świata jako główny 0/0/0).
4. Kontakty, sposób zamawiania, minimum i dni dostaw: Dis-Pack (Kraków, Katowice), Kuchnie Świata (który oddział obsługuje Katowice), Selgros (Kraków, Katowice), Bukat Kraków.
5. Pago, Mory, napoje (Coca-Cola, Filber, Pepsi) w obu miastach — dziś tylko liczenie.
6. Pozycje wstrzymane (tabela wyżej): JAX-GRILL i DIX vs Fenix/Tenzi, ręcznik 100 mb vs „papier w roli duży”, Papryka Red Sweet vs Florinis, Majonez dekoracyjny vs Fanex, Jogurt grecki 400 g, tacki 23/12 cm, Grill Cleaner Tytan, zmywaki Jan Niezbędny (ile w opak.), słomki 25 szt, sosjerki / wieczka / torby / torebki w paczkach po 50, Vileda „ten mniejszy”, końcówka szczotki; kawa, mleko, zapalniczka, butelka na sos (nowe produkty?).
7. Przeliczenia z sekcji „Uwagi i ryzyka”.

## Do zrobienia przez operatora

- [ ] Kontrola przed deployem (SELECT wyżej) tuż przed merge → 0 wierszy.
- [ ] Migracja 0029 na prod (przed A).
- [ ] A: STEP 0 (zapisać wynik tutaj), STEP 1, STEP 2 — liczby jak w „Diff przed” / „Audyt”.
- [ ] C: osobno, przy ekranie; STEP 0 → 26 × `match`, potem DELETE.
- [ ] Deploy kodu; `/health` na nowym commicie + nowy hash bundla Vercel.
- [ ] B: dopiero po deployu; STEP 0 (zanotować 0c), STEP 1, STEP 2 (a)–(i).
- [ ] Kody kapitanów FORUM / SUPERSAM w `SUPPLY_OS_CAPTAIN_TOKENS` — dopiero po B; kody tylko na czacie, nie w repo.
- [ ] Smoke po B, wyłącznie GET, kodem każdego lokalu: zakładki = tylko dostawcy miejscy, `/api/captain/inventory/products` = 104 (FORUM) i 107 (SUPERSAM) produktów; jeden lokal warszawski bez zmian. Żadnego submitu.
- [ ] SUPERSAM: e-mail lokalu (DW) — puste, `notes` lokalu to mówi.
- [ ] Kontakty dostawców po odpowiedzi Marka: e-mail / metoda, minimum, dni dostaw, godzina graniczna (do tego czasu zamówienia idą do managera, `manual`).
- [ ] Ceny wierszy z pustą ceną (tabela „Odstępstwa”).
- [ ] Seed CSV (`docs/pita-supply-os-v1/seed/`) nie ma tych danych — rozjazd seed ↔ prod rośnie.

