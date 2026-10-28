# Odpowiedzi Marka z 26.10 i plan wdrożenia

Źródło: odpowiedź Marka z 26.10 na maila Bena „Supply OS – czego jeszcze potrzebujemy do domknięcia lokali” (24.10). Stan prod sprawdzony 28.10 (tylko SELECT).

Nic z tego nie jest jeszcze na prodzie. Każdy krok danych idzie jak dotąd:
1. diff;
2. plik SQL ze strażnikami;
3. review subagenta;
4. OK Bena;
5. wgranie z `lock_timeout`;
6. audyt i wpis w `prod-applied-2026-10-19.md`.

## A. Gotowe do wgrania (odpowiedzi jednoznaczne)

| # | Co | Odpowiedź Marka | Zmiana na prodzie |
|---|---|---|---|
| A1 | Godziny dostaw (mail do dostawcy) | Norblin, Elektrownia, Browary 10–12; Westfield 9–10; Wola, KEN, Bracka od 11; Kraków od 10:30; Katowice od 10; Gdańsk 10–12 (pkt 2b; w pkt 1 „od 10”) | `locations.delivery_window_from/_to`: NORBLIN, ELEKTROWNIA, BROWARY, SLONY `10:00`/`12:00`; WOLA, KEN, BRACKA `11:00`/NULL; FORUM `10:30`/NULL; SUPERSAM `10:00`/NULL. WESTFIELD bez zmian. Nieaktywne lokale (KAMIENICA, KULINARNA, STARY_BROWAR) bez zmian |
| A2 | Gdańsk: e-mail i wejście | `pitabrosslony@gmail.com`, tel. 692 105 365 (bez zmian), wejście od ul. Chmielnej | `locations.email` SLONY (dziś NULL, więc lokal nie dostaje kopii maili). `delivery_address`: „Słony Spichlerz, ul. Chmielna 10 (wejście od ul. Chmielnej)” |
| A3 | Minima zamówień | Coca-Cola KAT 500; Kuchnie 600 i Selgros 750 (Katowice i Kraków); Pepsi KRK 450 | `suppliers.minimum_order_value_pln`: SUP_COCACOLA_KAT 500, SUP_KUCHNIE_KAT 600, SUP_SELGROS_KAT 750, SUP_KUCHNIE_KRK 600, SUP_SELGROS_KRK 750, SUP_PEPSI_KRK 450 (dziś 0) |
| A4 | Godzina graniczna | „wszyscy wszędzie powinni składać do 17:00”; Bukat poza Warszawą do 16:00 (już jest) | `suppliers.cutoff_time` 17:00 dla miejskich dostawców KAT/KRK, które dziś mają NULL |
| A5 | Dni dostaw Kraków i Gdańsk | Kuchnie i Selgros Kraków: pn–sob do 17:00. Kuchnie i Selgros Gdańsk: pn–sob | Nowe `supplier_delivery_rules`: SUP_KUCHNIE_KRK, SUP_SELGROS_KRK, SUP_KUCHNIE_GDA, SUP_SELGROS_GDA, dostawy Mon–Sat, termin 17:00, `lead_days` 1 (założenie jak Kuchnie w Warszawie; Marek nie podał) |
| A6 | Rolki: sztuk w paczce | Każda rolka 10 szt, tylko 80/80 po 6; 57 mm na Woli też 10 | `case_unit` opak, `units_per_case` 10: P183 (80/20) w SP_MORY, SP_WARSZAWA_GDA, SP_WARSZAWA_KAT (dziś ×6); P128 (57/20), P130 (57/30), P184 (57/80) w SP_MORY (dziś bez paczki). P129 (80/80) zostaje ×6, SP_WARSZAWA_KRK_P130 już ×10 |
| A7 | Ceny Pepsi Kraków | Puszki 2,10 zł, woda 1,30 zł, sok Toma 2,60 zł | Puszki ×24 = 50,40 (Pepsi, Pepsi Zero, Mirinda, 7Up); KŹ ×12 = 15,60 (gaz, niegaz); Toma ×12 = 31,20 (pomarańcz, jabłko). Założenie: ceny netto za sztukę, Toma po 12 w zgrzewce (pytanie B5) |
| A8 | Kropla Beskidu w Warszawie | Norblin i Browary: PET 0,5 po 12; reszta: szkło 0,33 po 24 („zgrzewka”, nie skrzynka) | Patrz C1. Wspólny wiersz SP_COCACOLA_P070/P071 (dziś ×24 za 34,80, cena PET) staje się szkłem 0,33 ×24 za 48,96 (faktura HBC, KEN) |
| A9 | Transport Warszawa → Kraków | W szczycie co 8 dni, teraz co 10–11 dni | Notatka w SUP_WARSZAWA_KRK. Do rozważenia: progi Forum dla towaru z Warszawy na 11 dni |

## B. Pytania do Marka (w drafcie odpowiedzi)

1. Kropla PET w Gdańsku: konkretna cena za zgrzewkę 12 szt. Odpowiedź „nie mamy limitu, ceny nieco wyższe” nie daje liczby; dziś jest szacunek 17,40.
2. Coca-Cola w Gdańsku idzie WhatsAppem: kto wysyła (kapitan sam czy Marek) i czy kapitan ma nadal wpisywać zamówienie w aplikacji? Szkic ze szkłem: czy kapitan go usunął?
3. Blue Service Gdańsk: ile dni od zamówienia do dostawy i w jakie dni przywożą? Bez odpowiedzi proponujemy 7 dni („najlepiej z tygodniowym wyprzedzeniem”).
4. Katowice: dni dostaw Kuchni Świata, Selgrosu Bytom i Coca-Coli (pn–sob jak w Krakowie?).
5. Pepsi Kraków: dni dostaw („Dni dostaw !!!!” bez odpowiedzi); czy ceny są netto; ile butelek Tomy w zgrzewce.
6. Selgros Gdańsk: minimum (750 jak w Katowicach i Krakowie?).
7. Pkt 5d: co jeszcze (poza wkładami do mopów) bierzemy z Selgrosu w Warszawie i po ile.
8. Czy zasady dla handlowców (pracownik, podpis, klucze) zostały przekazane?

## C. Decyzje dla Bena

1. **Kropla PET i szkło w Warszawie.** Lokal warszawski widzi tylko wspólne wiersze katalogu (`supplier_catalog.py`: lokal bez `own_catalog` nie widzi wierszy z `location_id`), więc „wiersz tylko dla Norblina” zostałby zignorowany. Proponowane rozwiązanie bez kodu:
   - dwa nowe produkty, P195 „Kropla Beskidu Niegazowana PET 0,5 l” i P196 „Kropla Beskidu Gazowana PET 0,5 l”, ze wspólnymi wierszami Coca-Coli ×12 za 17,40;
   - Norblin i Browary: progi przenoszone z P070/P071 na P195/P196 (te same liczby w sztukach), ustawienia P070/P071 w tych lokalach usunięte;
   - P070/P071 zostają szkłem 0,33 ×24 dla reszty Warszawy.

   Kapitan widzi tylko produkty, które mają ustawienie w jego lokalu. Historia spisów Norblina i Browarów zostaje pod P070/P071.

   Druga droga to zmiana w kodzie: wiersz lokalu nadpisuje wspólny. To większa zmiana z testami.
2. **Linia w mailu do dostawcy.** Marek proponuje dopisać, że towar ma być dostarczony w podanych godzinach i sprawdzony przez pracownika. Propozycja: „WAŻNE: dostawa tylko w podanych godzinach i tylko przy naszym pracowniku. Każdą dostawę sprawdzamy i podpisujemy. Bez pracownika prosimy nie zostawiać towaru i nie brać od nikogo kluczy do lokalu.” To zmiana kodu w obu builderach i w golden fixtures (mały PR).
3. **Dis-Pack Katowice.** Dziś Sahil wysyła Markowi listę, a Marek klika na stronie Dis-Packa (ok. 15 min na zamówienie). W aplikacji jest już katalog SUP_DISPACK_KAT (28 pozycji, bez kodów). Propozycja:
   - Sahil zamawia w aplikacji;
   - Marek dostaje zamówienie z nazwami Dis-Packa i kodami EAN z arkusza, który podlinkował (do odczytania i zmapowania na `supplier_sku`);
   - `ordering_method` zmienia się na `portal`.

   To samo dotyczy Dis-Packa w Krakowie (26 pozycji).
4. **Magazyn Mory, rzeczy biurowe i środki czystości.** Według Marka z Mory bierzemy opakowania, rolki oraz:
   - zszywki, które jest też w Blue Service; lokale chcą też zszywaczy, bo się psują;
   - koperty, długopisy i markery, też dostępne w Blue Service (Mati kupuje pudełka po 20 szt);
   - szczotki do grilla: jedni zamawiają po 2 szt, inni po tygodniu chcą nową;
   - mopy: zamienniki z Blue Service są słabe, wkłady kupujemy w Selgrosie.

   Do decyzji:
   - czy P127, P131, P132, P133 przechodzą do Blue Service, czy zostają w Mory;
   - czy dodać zszywacz;
   - czy szczotka do grilla zostaje w Mory z limitem (np. 1 szt na zamówienie);
   - skąd wkłady do mopa w Warszawie (SUP_SELGROS w Warszawie jest nieaktywny).

## D. Kolejność

1. Teraz, po OK Bena: jeden plik SQL z A1–A7 (godziny, Gdańsk e-mail i adres, minima, godzina graniczna, reguły dostaw, rolki, ceny Pepsi). Review subagenta, potem wgranie i audyt.
2. Po decyzji C1: plik SQL z Kroplą (P195/P196, przeniesienie progów, cena szkła).
3. Po decyzji C2: mały PR z nową linią w mailu.
4. Po odpowiedziach Marka (B) i decyzjach C3–C4: Blue Service Gdańsk, Katowice dni, Pepsi dni, Dis-Pack, Mory.
