# Odpowiedzi z rozmowy Ben–Marek (19.10)

Notatki na bieżąco (Ben: „notuj, nie wykonuj od razu”). **Pakiet SQL 19.10 jest wgrany na prod (19.10 ok. 15:00)**, szczegóły w `prod-applied-2026-10-19.md`; reszta niżej nie jest wykonana.

Źródła:
- czat z Benem 19.10 (odpowiedzi na punkty 1–19 i 26 listy otwartych spraw);
- nagranie Wispr „PAGO and BUKAT ordering logistics”, 19.10, 11:21–11:27, ok. 6 min. Urywa się, gdy Marek odbiera telefon.
  Notatki: https://notes.wisprflow.ai/shared/sbJKeAfhrMD0Ipo86gnywzYzITlXwFi13gzDjOuDhno
- arkusz Marka „Miasta poza Warszawą” (Drive `1i-sXUd5zQUyA4YASKkb9SBl61r3sV5M5fazagnsJnpg`), odczyt pełnego eksportu 19.10.
  Zakładki: Katowice (do wiersza 152), Kraków (do 170), Gdańsk (do 165). 16 komentarzy z 13.10 dalej OPEN;
- mail Marka z 15.10 „Re: Kraków i Katowice – czego jeszcze potrzebuję”; mail Bena z 12.10 „Gdańsk dane” (bez odpowiedzi mailem);
- Wispr 12.10 (`507da9d8`) i 01.09 (`2c8cea4c`); odczyty prodowe (SELECT) z 19.10.

## Ustalone

| # | Temat | Co ustalono (źródło) | Do zrobienia po OK |
|---|---|---|---|
| U1 | Napoje PET i szkło: opakowanie zbiorcze | „PET woda (500 ml) i sok (330 ml) — opakowanie zbiorcze jest 12 sztuk. Szkło woda, sok jest po 24. Więc to trzeba odpowiednio wszędzie poprawić.” (Ben, czat). Marek 15.10: w Norblinie i Browarach po 12 liczymy „PET, czyli woda i soki” | Przegląd wszystkich lokali: PET ×12, szkło ×24. Przed SQL: SELECT wierszy wody i soków z typem butelki i `units_per_purchase_unit`; przy zmianie opakowania przeliczyć progi. Nie dotyczy gazowanych. **Uwaga Katowice:** arkusz KAT ma Kroplę i Cappy w **szkle** (0,33 / 0,25 SZKŁO ×24), a katalog SUPERSAM na prodzie ma Kroplę ×24 i Cappy PET ×12 (puszki/PET). Wcześniejsze „Kropla KAT ×24 → ×12” jest nieaktualne do czasu odpowiedzi Marka (pyt. M-K3) |
| U2 | Pago + Mory | Jedna lista (nagranie). Zgadza się z prodem (PR #72, PR #45) | nic. Problem jest procesowy: Pago i Mory idą arkuszem Ordering PB v5 |
| U3 | Zasięg Bukatu | Tylko Kraków i Poznań. Katowic Bukat nie obsługuje; do Gdańska wozimy sami | Poznań to przyszły lokal |
| U4 | Kraków: rytm | Bukat KRK ok. 2× w tygodniu, Selgros KRK ok. 1× (rzeczy spoza asortymentu), warzywa na zmianę | Reguła Bukat KRK pn/śr/pt jest od 17.10 |
| U5 | P052 papryka słodka mielona | Zamawiać całe opakowania 1 kg, nie 0,7 kg (nagranie). Na prodzie `kg ×1`, KEN 0,2/1/1 → prawdopodobnie KEN | Zaokrąglenie w górę do pełnego 1 kg we wszystkich lokalach; najpierw sprawdzić `rounding_rule` wiersza Intermleczu |
| N1 | „Dispatch” = **Dis-Pack** (Ben potwierdził) | Marek 15.10: zamówienie dzień wcześniej, minimum 700 zł, agata.filipowicz@dis-pack.pl; „zamień na te pozycje, które Ci wpisałem z ich nazewnictwem i z ich EAN-ami, a nie te z inwentaryzacji”. Arkusz ma nazwy Dis-Pack z kodami (np. „… 45193”) | Porównać nazwy i kody Dis-Pack KRK/KAT na prodzie z arkuszem; ustawić minimum 700 zł. Kto składa zamówienie: do potwierdzenia (M-K1) |
| N2 | Katowice: tzatziki, tiro, feta | Marek 15.10: „Odbiera z Bukat i przywozi je Mateusz razem z dostawą z PAGO”. Arkusz KAT, sekcja „Pago + Magazyn + Lemoniady”: tzatziki 2/20, tiro 1/4, feta 1/2 (pojemniki) | Dodać te 3 pozycje do SUP_WARSZAWA_KAT na SUPERSAM (dziś tylko liczenie) |

## Odpowiedzi Bena na listę otwartych spraw (19.10)

| Pkt | Temat | Odpowiedź / stan | Kto dalej |
|---|---|---|---|
| 1 | Gdańsk: 8 punktów z maila 12.10 | Część odpowiedziana w zakładce Gdańsk arkusza (progi Kuchnie Świata, Selgros, Cola, Pago+Magazyn, BlueService; Cola „zamawiają przez WhatsApp w niedzielę na następny weekend”). Reszta w liście dla Marka (G1–G7) | Marek |
| 2 | BlueService w Gdańsku | Ten sam Blue Service co w Warszawie | zamknięte |
| 3 | Gdańsk: progi puszek/PET | „W arkuszu”: są w zakładce Gdańsk (wiersze 86–93). Na prodzie 4 z 8 wierszy SUP_COCACOLA_GDA mają 0/0/0, a Fanta/Sprite/Kropla mają stare progi. Cen w arkuszu brak | SQL po OK Bena (P-2); ceny: Marek |
| 4 | Gdańsk: chemia | Używamy sprayów Feniks: do grilla, do szyb, anty-tłuszczowy. Chemię zunifikujemy i poprawimy później. Ocet i cukier w saszetkach: bez odpowiedzi | Marek (ocet, cukier) |
| 5 | Katowice: progi | Min/max są (w arkuszu), brak tylko dla pozycji zapasowych. **Prośba o zmianę UI:** pozycje zapasowe mają być w liście rozwijanej, nie na jednym widoku ze wszystkimi. Na prodzie 24 wiersze Coca-Cola KAT + Pago/Magazyn KAT dalej mają 0/0/0 | SQL po OK Bena (P-1); UI: zmiana kodu (K-1) |
| 6 | Coca-Cola Katowice | Konto działa. Minimum do dopytania | Marek |
| 7 | Kuchnie Świata i Selgros KRK/KAT: warunki | Zostaje do ogarnięcia przez Marka. Znane z 15.10: Kuchnie Świata = oddział krakowski (krakow@kuchnieswiata.com.pl) dla obu miast; Selgros KRK HoReCa.Krakow@selgros.pl, KAT horeca.bytom@selgros.pl | Marek |
| 8 | Progi Forum i lista Selgrosu | Arkusz Kraków: nowa sekcja Bukat (wiersze 157–170) z progami innymi niż na prodzie (szczegóły: P-3). Selgros Kraków (C53:D123) **dalej pusty**, choć Marek 15.10 pisał „za raz wpiszę”. Kuchnie Świata KRK i KAT: Feta, Majonez Fanex, Olej TopQ bez progów | Marek; SQL po OK Bena |
| 9 | Bukat KRK: wyprzedzenie | Do wyjaśnienia. Marek 15.10: „zamówienie musi od nas wyjść do 16:00 dnia poprzedniego, ale składać mają z 2-dniowym wyprzedzeniem”, minimum 500 zł, „nie możemy zamawiać 150 kg tzatzików na raz” | Marek |
| 10 | Biurowe na Mory | Zostaje: lista od Marka | Marek |
| 11 | Bracka: Tenzi, mop | Tenzi 1 l i 5 l: dwie opcje (5 l, gdy jest sprawne urządzenie do 1 l). Mop mogą dodać jako ekstra, ale Ben polecił kupować mopy, szczotki do grilla, szczotki itp. na magazyn Mory, żeby nie jeździć po jeden mop do Selgrosu. Marek ma dostarczyć zaktualizowaną listę magazynu Mory (razem z pkt 10) | Marek (lista Mory); dane po liście |
| 12 | Frytki Wola/Browary | Ben: „Nie masz min i max? Po co Ci to info, skąd to wziąłeś? Może to pytanie na Connecteam?”. Źródło: pytanie #2 do Marka z 28.09 (`master-data-followups/change.md:185`): WOLA zamawia ponad sugestię (cel 44), BROWARY poniżej (cel 28), plus mail 16.10 „zamawianie według miejsca w zamrażarce”. Progi są (WOLA 20/44, BROWARY 14/28) | zamknięte; ewentualnie pytanie do Kapitanów na Connecteam |
| 13 | Gyros KEN | OK. Jeździ 1× w tygodniu, jak trzeba (nasz kierowca), razem z Pago i magazynem Mory | zamknięte |
| 14 | KEN: rolki, torby, rękawiczki | Progi zostają | zamknięte |
| 15 | Ceny Selgrosu spoza faktur | Ben: „ocb?”. Źródło: spotkanie 12.10. Pozycje dodatkowe Selgrosu (wyszarzone, próg 0) mają być listą rozwijaną z jednostką i ceną z faktur; zadanie Marka: „uzupełnić ceny produktów dodatkowych, których brakuje w fakturach”. Dziś ceny są tylko orientacyjne (np. frytki w Selgrosie ok. 40 zł vs ok. 20 zł gdzie indziej) | Ceny z faktur: my; braki: Marek. Łączy się z K-1 |
| 16 | Rolki 57 mm Wola (P128, P130): ile w paczce | Ben: „powiedział w spotkaniu”. W transkrypcjach 12.10, 19.10, 22.09, 29.09, 13.10 brak liczby. Jedyne: 01.09 (`2c8cea4c`), Marek: „Po 10 albo po 6, w zależności od tego” (bez rozmiaru). Arkusz Kraków: „Rolki do kasy 57/30 10szt”; 80/20 „10szt”, 80/80 „6szt” | Marek: potwierdzić 10 szt dla 57×20 i 57×30 |
| 17 | KAN 1350 / arkusz Ordering PB v5 | Nie jest poprawiony. Osobny lane w jarvis-codex: generowanie dla Westfield Mokotów i Meze oraz lista produktów (miała być rolka, a wzięło kanaki), sprawdzenie przez wygenerowanie arkusza. Sesja „Ordering PB v5: fix Westfield/Meze and product list” uruchomiona 19.10 | jarvis-codex |
| 18 | Westfield: rolka papieru | tbd | — |
| 19 | Serwetki i ręczniki ZZ | tbd | — |
| 26 | „Niekompletne” z huddle 16.10 | Usunięte | — |

Punkty 20–25 i 27–29 nie zostały jeszcze omówione. Są w liście dla Marka (W-*) i w sprawach dla Bena.

## Arkusz vs prod (19.10, tylko odczyt)

- **P-1 SUPERSAM (Katowice).**
  - SUP_COCACOLA_KAT (8) i SUP_WARSZAWA_KAT (16): wszystkie progi 0/0/0. Arkusz KAT ma progi w wierszach 125–152.
  - Rozbieżności katalogu:
    - Cola w arkuszu to szkło 0,25 ×24, a na prodzie puszki 0,33 i Cappy PET;
    - na prodzie brak tzatzików, tiro, fety i boxów beżowych;
    - rolki 80/20 i 80/80 mają max „?”;
    - souvlaki w arkuszu „karton 50 szt”, na prodzie `karton ×5`: sprawdzić jednostkę.
- **P-2 SLONY (Gdańsk), Coca-Cola.** Przy U1 PET ×12, puszki ×24.

  | Produkt | Prod (szt) | Arkusz (opak.) |
  |---|---|---|
  | Coca-Cola puszka | 0/0 | 1/3 |
  | Coca-Cola Zero puszka | 0/0 | 1/4 |
  | Fanta | 12/48 | 0,5/1,5 |
  | Sprite | 12/48 | 0,5/1,5 |
  | Cappy pomarańcza, jabłko | 0/0 | 0,5/1,5 |
  | Kropla niegazowana | 36/96 | 1,5/3 |
  | Kropla gazowana | 24/48 | 1/2 |

  Rytm: zamówienie przez WhatsApp w niedzielę, dostawa na następny weekend.
- **P-3 FORUM (Kraków), Bukat.** Arkusz (wiersze 157–170) vs prod (wartości z sierpnia):

  | Produkt | Prod | Arkusz |
  |---|---|---|
  | Pomidor | 12/54 | 12/48 |
  | Rucola | 10/35 | 7/18 |
  | Sałata | 8/25 | 10/25 |
  | Awokado | 2/6 | 1/4 |
  | Cytryna | 0,5/2 | 0,5/1,5 |
  | Natka | 0,3/1 | 0,2/0,5 |
  | Czosnek | 0,2/1 | 0,2/0,5 |
  | Tiro | 1,5/4,5 | 2/10 |
  | Feta | 0,5/2 | 1/2 |
  | **Tzatziki** | 5/14 | **18/72** pojemników po 3 kg |

  Bez zmian: cebula biała 0,5/1, czerwona 5/20.

  Tzatziki 18/72 to do 216 kg: kłóci się z „nie możemy zamawiać 150 kg naraz”. Ta sama wartość stoi też w sekcji Pago+Magazyn Kraków, więc wygląda na kopię.
- **P-4 FORUM: nowe sekcje w arkuszu,** których nie ma na prodzie:
  - **Pepsi** (pephub.pepsico.com): Pepsi, Pepsi Zero, Mirinda, 7UP, Krystaliczne Źródło, Toma;
  - **Pago + Magazyn + Lemoniady Kraków** (gyros, souvlaki, pita, boxy, rolki 57/30, lemoniady).

  Prod FORUM ma tylko Bukat, Dis-Pack, Kuchnie Świata i Selgros.
- **P-5 SLONY:** progi Kuchnie, Selgros, Pago+Magazyn i BlueService są na prodzie. Pozycje zapasowe Selgrosu GDA w arkuszu nie mają progów, zgodnie z założeniem.

## Druga tura odpowiedzi (19.10, po południu)

Źródła: czat z Benem 19.10 oraz transkrypt spotkania Ben–Marek–Sławek (z udziałem Kamesha), wklejony przez Bena.
Transkrypt jest automatyczny i miejscami zniekształcony. Liczby niepewne są oznaczone.
Ben 19.10: „wykonaj, wgraj na prod potrzebne elementy (braki progów uzupełnimy potem)”.

| # | Temat | Odpowiedź (źródło) | Stan |
|---|---|---|---|
| K3 | Katowice: szkło czy puszki | „Katowice to szkło, a Gdańsk to puszka/PET (zgodnie z arkuszem teraz)” (Ben, czat) | SQL 19.10 (A) |
| G4 | Coca-Cola Gdańsk | Minimum nie ma. Zamawiają w grupie na WhatsAppie. Manager oznacza zamówienie jako wysłane ręcznie | notatka u dostawcy (E); ceny i progi puszek/PET dalej od Marka |
| G3 | Kuchnie Świata, Selgros, Blue Service Gdańsk | Zamawiać do 17:00 (na prodzie już jest). Minima „przekopiować z innych punktów” | SQL (E): Kuchnie 600 zł, Blue Service 500 zł jak w Warszawie; Selgros bez minimum. Dni dostaw: brak |
| G5 | Pago, magazyn, Filber do Gdańska | Jadą jednym transportem: potwierdzone | zamknięte |
| G6 | Ocet i cukier w saszetkach | Usuwamy oba | na prodzie ich nie ma (SLONY ma tylko sól i pieprz w saszetkach): nic do zrobienia |
| G7 | Produkcja własna | Progi zostają 0 | zamknięte |
| G1 | Godziny dostaw Gdańsk | Pierwsze dwie godziny pracy lokalu; padło „od dziesiątej” | dokładne od–do do potwierdzenia (A1); w mailu wymaga zmiany kodu (WP2) |
| R1 | Selgros Kraków | W arkuszu pusty i tak zostaje: brak progów. Pozycja zapasowa ma te same progi co u głównego dostawcy (Kraków ok. 80% z Bukatu) | zamknięte: progi są per lokal i produkt, więc zapasowy wiersz już je dzieli; wiersze Selgrosu pokrywające się z Bukatem są `is_backup` |
| R4 | Bukat Kraków: wyprzedzenie | Bukat dostarcza pn/śr/pt, zamówienie dzień przed do 16:00. Marek potrzebuje czasu, więc kapitan zamawia **2 dni** przed dostawą | SQL (C): `lead_days` 1 → 2, termin 16:00 |
| R2 | Bukat Kraków: tzatziki i tiro | Tzatziki: max ok. 1/3 z 72, w transkrypcie „Ok, trzyście pojemników” (czytam: 30). Tiro: 8 pojemników. Kapitan zawsze może wpisać więcej. Tzatziki z Pago: nie domyślnie, kapitan może dopisać | SQL (C): tzatziki 18/30, tiro 2/8 (min z arkusza). **Do potwierdzenia:** 30 czy 24 oraz min 18 |
| R2b | Bukat Kraków: minimum | Zamówienie ok. 300 zł przeszło, Bukat się zgodził: „nie mam minimum w tym przypadku” | SQL (C): minimum 500 → brak |
| — | Bukat Poznań | Codziennie oprócz weekendu, zamówienie dzień przed do 16:00 | Poznań (STARY_BROWAR) nieaktywny: do zrobienia przy starcie lokalu |
| A1 | Godziny przyjmowania dostaw | Priorytet przed listą Mory. Westfield: ludzie od 9:00, okno dostaw 9–10 (Kamesh). Ben: zakaz dostaw bez pracownika, bez podpisu i bez sprawdzenia; zakaz brania kluczy (np. z Żabki); tę informację dopisać w mailach do dostawców. Marek ma przekazać to handlowcom | WP2 + nowy dopisek w mailu: zmiana kodu (osobna sesja). Godziny pozostałych lokali: Marek |
| W1 | Lista magazynu Mory | Potrzebna, ale po godzinach dostaw | Marek |
| A5 | Dopiski „po ile pakowane” w mailu | Intermlecz: tak. „Nie zrobiliśmy tego tam?” Nie: PR #65 obciął sufiks `/N` tylko w widoku kapitana (D3). Mail i PDF dalej mają pełną nazwę | zmiana kodu: obcinać sufiks w mailu do Intermleczu (osobna sesja) |
| — | Stopka | „Przekleić stopkę z maila na samym dole w biuro” | do wyjaśnienia z Benem: którą stopkę i gdzie (podpis w Gmailu biuro@ czy stopka maila z aplikacji) |
| 17 | Ordering PB v5 | Ben zgadza się na poprawki 1–3. Fillo (4): bez blokady, tylko żeby się nie psuło i żeby dało się je dopisać. Ben dokończy w tamtej sesji | jarvis-codex |

### Pakiet SQL 19.10 (`prod-sql-2026-10-19-meeting.sql`)

- A. Katowice Coca-Cola na szkło + progi z arkusza.
- B. Katowice Pago + Magazyn + Lemoniady: progi z arkusza, nowe tzatziki/tiro/feta, feta z Kuchni Świata jako zapasowa.
- C. Bukat Kraków: progi z arkusza (tzatziki max 30, tiro max 8), zamawianie 2 dni wcześniej, bez minimum.
- D. Kraków: nowy dostawca „Pago + Magazyn + Lemoniady (Kraków)” (15 pozycji z arkusza, z progami).
- E. Gdańsk: minima Kuchnie Świata i Blue Service; Coca-Cola Gdańsk zamawiana ręcznie (WhatsApp), bez minimum.

Wgrane 19.10 ok. 15:00, audyt czysty. Poprawki po review przed wgraniem: „bez minimum” zapisane jako 0 (puste pole dawało domyślne 400 zł);
rolki 57/30 w Krakowie po 10 w opakowaniu (szablon miał 6), cena 1,29 zł jak w Mory; P092 w Krakowie nazwany „Boxy bezowe bez logo”;
Coca-Cola Gdańsk przestawiona z „portal” na zamawianie ręczne.

Celowo poza pakietem:
- progi bez wartości w arkuszu (rolki 80/20 i 80/80 w Katowicach, Selgros Kraków, Feta, Majonez i Olej w Kuchniach Świata);
- Pepsi dla Krakowa: potrzebne nowe produkty (Toma), a pytanie R3 jest dalej otwarte;
- godziny dostaw i dopisek w mailu: to zmiana kodu.
