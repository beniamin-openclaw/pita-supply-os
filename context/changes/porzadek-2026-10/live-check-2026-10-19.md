# Live check zmian z porządku 2026-10 (stan 19.10)

Zakres: wszystko, co weszło na prod od podziału na lane'y (17.10), plus to, co czeka w otwartych PR-ach.

Kod na prodzie to `main` 8d535a8 (PR #76, CI zielone). Dane z 17.10 są opisane w logach:
- `porzadek-data-2026-10/prod-sql-applied.md`;
- `inventory-card-order/verification/prod-sql-applied-2026-10-17.md`.

Zasada przy sprawdzaniu: nie wysyłaj prawdziwych zamówień. Jeśli test wymaga „Wyślij”, zatrzymaj się na oknie potwierdzenia.

Legenda: ✅ na prodzie · 🟡 na prodzie, ale czeka na flagę albo dane · ⏳ otwarty PR, jeszcze nie na prodzie

## 1. Ekrany Kapitana

| Stan | Zmiana | Gdzie i jak sprawdzić | Kto zgłosił | Ref |
|---|---|---|---|---|
| ✅ | Przy liczbie sztuk w nawiasie kg, np. halloumi 200 g: `(2,4 kg)`, `= 1 karton (12 szt · 2,4 kg)` | FORUM albo lokal z halloumi → Inwentaryzacja oraz karta zamówienia. Wpisz 1 karton, powinny pokazać się kg. Po wyczyszczeniu pola kg znikają. Produkt liczony w kg nie pokazuje dodatkowego odczytu | Kraków, raport tygodniowy 11.10 (seniorbrospb@); Twoja decyzja 17.10 | PR #76 |
| ⏳ | Ostrzeżenie, gdy ta sama ilość jest wpisana w „kartony” i w „luzem” | Zamówienie Intermlecz: 2 kartony + 24 szt, powinien pojawić się komunikat „Razem 48 szt. Czy…” | Marek, czat 02.10 | PR #64 (konflikt z main, do rebase) |
| ⏳ | Przy odbiorze komunikat „Wpisz, kto odebrał dostawę” | Odbiór dostawy z pustym „Kto odebrał”: czerwony komunikat, nic się nie zapisuje | Ela i Nataliia, czat 03.10 | PR #66 |
| ⏳ | Szkic inwentaryzacji zapisywany osobno dla każdego lokalu | Zapisz szkic w lokalu A, zaloguj się do B: w B nie ma banera szkicu | wyszło z review kodu; Gdańsk to obchodził | PR #66 |
| ⏳ | Pole „skrzynki” w zamówieniu Coca-Cola Katowice | SUPERSAM → Coca-Cola: pole pod komentarzem, tak jak na Woli | Sahil, czat 12.10; Sławek, czat 15.09 | PR #66 |
| ⏳ | Karta źródła zapasowego: przerywana ramka i napis „Zapasowy · główny: X” | Produkt zapasowy na Katowicach | Twoja decyzja D10 (17.10) | PR #65 |
| ⏳ | U Kapitana bez końcówek „/12”, „/30” w nazwach | „Miód Agros 25g/30” wyświetla się bez „/30”. Mail i PDF dalej pokazują pełną nazwę | Ty, nagranie 12.10; D3 | PR #65 |
| ⏳ | ✓ na zakładce dostawcy zostaje po odświeżeniu; pytanie „Wysłać kolejne?”; podpowiedź o otwartym zamówieniu | Odśwież stronę po wysłaniu, ✓ powinien zostać. Przy drugim zamówieniu pojawia się ostrzeżenie (nie wysyłaj) | Ty, D10 (17.10) | PR #69 |
| ⏳ | Ostrzeżenie „Nie wpisano stanów” / „same zera” (tylko ostrzega, nie blokuje) | WOLA: puste stany, potem „Wyślij”, powinien pojawić się bursztynowy blok. NORBLIN: bez ostrzeżenia | Ty, nagranie 12.10 i D6; kontekst: Marek (czat 02.10), Rajeshwari | PR #70 + migracja 0030 + SQL (operator) |

## 2. Ekrany Managera

| Stan | Zmiana | Gdzie i jak sprawdzić | Kto zgłosił | Ref |
|---|---|---|---|---|
| ✅ | Filtr dostawców pokazuje wszystkich aktywnych (np. Spec Food) | Kolejka Managera → filtr: jest Spec Food | Ty, nagranie 12.10 (D11) | PR #68 |
| ✅ | Czerwone znaczniki „przejęte > 24 h” i „wysłane > 3 dni” oraz liczniki w nagłówkach pasów | Kolejka: stare przejęte zamówienia (47 sprzed 16.10) mają czerwone znaczniki | Ty, D16; impuls: Mirsini (czat) | PR #68 |
| ✅ | Zero wpisane przez Managera jest bursztynowe i przekreślone; kafelki miast pokazują „off” bez przekreślenia; przy linii zapasowej „u głównego” | Draft Transportu z wyzerowaną komórką; linia zapasowa z Katowic | Ty, D10 | PR #68 |
| ✅ | **Filtr „Pago + Magazyn Mory”** | Kolejka i archiwum: jedna opcja, w niej zamówienia obu dostawców | Marek, nagranie 12.10; D4 | PR #72 |
| ✅ | Przycisk „Zamówione (bez e-maila)” dla Filbera | Przejęte zamówienie Filber: po kliknięciu przechodzi do wysłanych bez linku do maila | Ty, nagrania 18.09 i 12.10; D4 | PR #72 |
| ✅ | „Zamknij bez przyjęcia” z wymaganym powodem i śladem w historii | Wysłane zamówienie bez odbioru: zamknij z powodem, licznik „wysłane > 3 dni” spada o 1. Przy zamówieniu z odbiorem przycisku nie ma | Ty i Marek, nagranie 12.10; D5 | PR #75 |

## 3. Transport

| Stan | Zmiana | Gdzie i jak sprawdzić | Kto zgłosił | Ref |
|---|---|---|---|---|
| ✅ | Dwa zamówienia z jednego lokalu dają jedną kolumnę w macierzy („zam. 1/2”); PDF kierowcy też ma jedną | Draft Transportu z dwoma zamówieniami KEN z Mory: jedna kolumna „Ken” | Ty, D10 (podejrzany duplikat, potwierdzony testem) | PR #71 |

## 4. Mail do dostawcy

| Stan | Zmiana | Gdzie i jak sprawdzić | Kto zgłosił | Ref |
|---|---|---|---|---|
| ✅ | Dane firmy przed „Pozdrawiam,” | Otwórz szkic w Gmailu (biuro@) | Ty, nagranie 12.10 | PR #73 |
| ✅ | Pozycje spoza katalogu jako kolejne numerowane wiersze z dopiskiem „(spoza katalogu)” | Treść szkicu, pod pozycjami z katalogu | Ty, nagranie 12.10 | PR #73 |
| ✅ | Jedno „Wyślij” tworzy szkic i go otwiera. Gdy przeglądarka zablokuje kartę, pojawia się „NIE jest jeszcze wysłany — Otwórz szkic”, a w kolejce znacznik „Szkic niewysłany” | Manager → panel wysyłki. Kroki: `supplier-email-v21/operator-steps.md` | Marek, nagranie 12.10 | PR #73 |
| 🟡 | Prawdziwa data dostawy w temacie i treści zamiast `__________` | Działa dopiero po ustawieniu na Railway `SUPPLY_OS_ORDER_EMAIL_DELIVERY_DATE_ENABLED=true`. **Do zrobienia przez Ciebie** | Marek, nagranie 12.10; D2 | PR #73 + flaga |

## 5. Dane lokali (SQL wgrany 17.10, żeby to zobaczyć, nie trzeba deployu)

| Stan | Zmiana | Gdzie sprawdzić | Kto zgłosił | Ref |
|---|---|---|---|---|
| ✅ | Gdańsk: tzatziki, tiro i feta mają dopisek „(Magazyn)” zamiast „(Bukat)”; godzina graniczna 17:00 dla Kuchni, Selgrosa i Blue Service | SLONY, zakładki dostawców | Marek, poprawki 16.10 | `gdansk-rollout/prod-sql-3-corrections.sql` |
| ✅ | Kraków: Bukat KRK wysyłany mailem, minimum 500 zł, godzina graniczna 16:00, dostawy pn/śr/pt; Dis-Pack mailem, minimum 700 zł; adresy Kuchni i Selgrosa; mail Supersamu; cebula na FORUM 0,5/1/1 | FORUM → Bukat: na zakładce godzina 16:00 i data dostawy pn/śr/pt | Marek, mail 15.10; błąd z 16:00: Kraków, raport 11.10 | Lane D plik 1 |
| ✅ | Browary: przyprawa do souvlaki 0,5/2/2; musztarda i majonez liczone w szt (1/2/2) | BROWARY | Marek, mail 29.09 i nagranie 12.10 | plik 2 |
| ✅ | Wola: rolki P129 max 30 | WOLA | Marek, mail 29.09 | plik 2 (P128 i P130 czekają na Marka) |
| ✅ | Gąbki 5/15 w 7 lokalach Warszawy | lokale warszawskie | Tushar, czat 15.10; Marek, mail 29.09; D17 | plik 2 |
| ✅ | Corfu: „box” zmieniony na „karton” ×12 | liczenie i zamówienie Corfu | Marek, nagranie 18.09 | plik 2 |
| ✅ | Wola: Cappy 0,25 l w szkle (skrzynka), PET usunięty | WOLA → Coca-Cola | Tushar, czat 27.09 i 04.10; Sławek, 30.09 | plik 2 |
| ✅ | KEN: gyros wieprzowy P024 max 45 kg (był 150) | KEN → Pago | Khushi, czat 08.10. **Odczytane ze screena: potwierdź z Khushi, czy chodziło o wieprzowy, a nie kurczaka** | plik 2 |
| 🟡 | Westfield: Fuzetea na liście z progiem 0/0/0; Cappy w szkle 10/24/24 (PET usunięty); do samego liczenia „Gyros wieprzowy ścięty” | WESTFIELD → liczenie | Mirsini, czat 04.10; Sebastian, 08.10 | pliki 3 i 4 (progi Fuzetei czekają na Marka) |
| 🟡 | Elektrownia: Fuzetea i Kinley na liście z progiem 0/0/0 | ELEKTROWNIA → liczenie | Sebastian, czat 08.10 | plik 3 (progi czekają na Marka) |
| ✅ | „Halloumi cięte” (kg), tylko do liczenia | FORUM → Produkcja | Kraków, raport 11.10; D8 | plik 4 |
| ✅ | Kolejność produktów jak na papierowych kartach, we wszystkich lokalach (napoje jak na liście papierowej) | Inwentaryzacja w dowolnym lokalu. FORUM: Mirinda, 7Up, Pepsi, Pepsi Zero, woda, lemoniady | Twoja decyzja 28.09; Kraków, raport 11.10; Sebastian, 08.10 | `inventory-card-order/prod-sql.sql` |
| ⏳ | Kolejność pozycji na listach Pago i Mory (jak w arkuszu Ordering PB v5) | Nie wgrane, czeka na Twoje OK | Ty, zmiana inventory-card-order | `inventory-card-order/prod-sql-pago-mory.sql` |

## 6. Twoje pytania z 19.10

**Gdańsk: Cappy w PET po 12 szt i cola w puszkach.**
Na liście do liczenia są i lokal je liczy, ale **nie da się ich zamówić**. Wolny katalog Gdańska ma od Coca-Coli tylko szkło. Stan z produ, spis z 18.10:

| Produkt | Spis 18.10 (spis 16.10) | Próg min/cel/max | Czy da się zamówić w SLONY |
|---|---|---|---|
| Cappy Jabłko PET (P064) | 14 szt (16) | 0/0/0 | nie: brak wiersza Coca-Cola Gdańsk. Warszawski wiersz to zgrzewka ×12, ale Gdańsk go nie widzi |
| Cappy Pomarańcza PET (P065) | 14 szt (19) | 0/0/0 | nie (jak wyżej) |
| Coca-Cola 0,33 puszka (P068) | 88 szt (119) | 0/0/0 | nie |
| Coca-Cola Zero 0,33 puszka (P069) | 69 szt (102) | 0/0/0 | nie |
| Cappy Jabłko/Pomarańcza szkło (P190/P191) | 0 | 12/48/48, skrzynka ×24 | tak |
| Coca-Cola / Zero 0,25 szkło (P186/P187) | 0 | 24/96/96 i 24/120/120, skrzynka ×24 | tak |

Ryzyko: przy stanie szkła 0 aplikacja **zasugeruje** Gdańskowi skrzynki szkła, mimo że lokal sprzedaje PET i puszki. Do tej pory Gdańsk nie złożył żadnego zamówienia Coca-Coli w aplikacji. Arkusz Gdańska z 12.10 podawał szkło („0.25 RGB SZKŁO X24”).

Ta sprawa to Twoja decyzja D15: Marek dopisuje dostawcę i progi dla puszek i Cappy. Pytanie do Marka: *Gdańsk zamawia PET i puszki czy przechodzi na szkło?*
- Jeśli PET i puszki: dodajemy wiersze Coca-Cola Gdańsk dla P064/P065 (zgrzewka ×12) i P068/P069 (zgrzewka ×24) z jego progami, a szkło ustawiamy na 0/0/0.
- Jeśli szkło: PET i puszki zostają tylko do liczenia, dopóki stan nie zejdzie do zera.

**Mory i Pago na jednej liście dla Marka.**
- ✅ Kolejka i archiwum mają jedną opcję filtra „Pago + Magazyn Mory” (PR #72, na prodzie od 17.10). W danych to dalej dwaj dostawcy.
- ✅ Transport: jeden kurs Pago zabiera też zamówienia Mory. Mają osobne bloki, najpierw Pago, potem Mory. Dokumenty dla Pago zawierają tylko pozycje Pago (PR #45, na prodzie od 01.10).
- ⏳ Kolejność pozycji jak w arkuszu Ordering nie jest jeszcze wgrana (`prod-sql-pago-mory.sql`). Do tego czasu pozycje Pago i Mory idą w kolejności domyślnej.
- Od 05.10 żaden Transport nie wyszedł z aplikacji: Pago i Mory idą arkuszem. Żeby Marek pracował na jednej liście, musi wrócić do Transportu w aplikacji. To jest otwarty punkt 4.6 w `plan.md`.

## 7. Na Tobie (żeby wszystko z tej listy działało)

1. Railway: ustaw `SUPPLY_OS_ORDER_EMAIL_DELIVERY_DATE_ENABLED=true`, inaczej w mailach nie będzie daty dostawy.
2. Daj OK na `prod-sql-pago-mory.sql`: kolejność pozycji Pago i Mory.
3. Lane C: daj OK na kolejne merge. Kolejność: #65 → #66 → #69 → #70. #70 dopiero po wgraniu migracji 0030 i SQL, bo bez tego ostrzeżenie pokaże się we wszystkich lokalach. #64 trzeba najpierw rebase'ować. #66 merguj poza godzinami liczenia, bo stary szkic przepadnie jeden raz.
4. Sprawdź z Khushi, o który gyros chodziło (P024 wieprzowy czy P179 kurczak).
5. Wyślij mail do Marka (szkic osobno).
