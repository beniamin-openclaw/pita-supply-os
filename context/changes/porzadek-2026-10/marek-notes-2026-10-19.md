# Notatki: co potrzebujemy od Marka (stan 19.10)

Marek nie odpisał w sprawie Supply OS od 15.10 (ostatnie maile: „Kraków i Katowice” 09:43 oraz KAN 1350 14:44).

Szkic maila z 17.10 (`r-8821600299567990647`) nie został wysłany i jest już nieaktualny:
- pyta o wagę kartonu souvlaki, a ta sprawa jest zamknięta (5 kg);
- pyta Marka o Thammę, a to pytanie idzie do Krakowa;
- brakuje w nim rolek 57 mm, rolki papieru dla Westfield i progów napojów.

Zastępuje go nowy szkic z 19.10 (temat „Supply OS – zasady i dane, których potrzebuję (wersja 19.10)”). **Stary szkic usuń, żeby nie poszły dwa maile.**

## Otwarte pytania (co blokują)

| # | Czego potrzebujemy | Co to blokuje | Lokal |
|---|---|---|---|
| 1 | 8 punktów z maila 12.10: dane lokalu, godziny, e-mail, telefon, czy Pago, Mory i Filber idą razem | dokończenie wdrożenia Gdańska | SLONY |
| 2 | Czy „BlueService” w Gdańsku to warszawski Blue Service | katalog Gdańska | SLONY |
| 3 | **Cappy PET i Coca-Cola w puszkach**: lokal liczy 14+14 szt Cappy PET oraz 88+69 puszek (spis 18.10), a w aplikacji do zamówienia jest tylko szkło (stan 0, progi 12/48 i 24/96–120). Pytanie: PET i puszki czy szkło? | błędna sugestia: przy szkle na zero aplikacja podpowie zamówienie skrzynek szkła. Do tego progi dla 7 pozycji z D15 | SLONY |
| 4 | Ocet, cukier w saszetkach, Tenzi do szyb, Top Grill: czy w ogóle używane | usunięcie 12 pustych pozycji | SLONY |
| 5 | Min/max dla 24 pozycji Katowic; które produkty to cola 250 ml i woda 330 ml w szkle | sugestie w Katowicach (dziś 0/0/0) | SUPERSAM |
| 6 | Coca-Cola Katowice: czy konto cchbcshop działa, jakie jest minimum | zamówienia Coca-Coli KAT | SUPERSAM |
| 7 | Kuchnie Świata i Selgros KRK/KAT: minimum, dni dostaw, godzina graniczna | do tego czasu zostają w trybie „manual” | FORUM, SUPERSAM |
| 8 | Dis-Pack Katowice: te same warunki co Kraków? Nazwy i EAN (najpierw sprawdzić jego arkusz) | katalog Dis-Pack | SUPERSAM |
| 9 | Progi Forum i lista Selgrosa z progami (obiecał 15.10) | sugestie Forum | FORUM |
| 10 | Bukat KRK: zamawiać z 1 czy 2 dniami wyprzedzenia (pisał „najlepiej 2”) | data dostawy w mailu | FORUM |
| 11 | Rolki 57 mm P128/P130 na Woli: ile sztuk w paczce | blok 2.3 | WOLA |
| 12 | Westfield: który produkt to rolka papieru i od kogo | blok 3.4 | WESTFIELD |
| 13 | Progi napojów: Westfield Fuzetea, Elektrownia Fuzetea i Kinley, Supersam Coca-Cola (8 produktów) | sugestie (dziś 0/0/0) | WESTFIELD, ELEKTROWNIA, SUPERSAM |
| 14 | Dostawca Burna | dodanie produktu | ELEKTROWNIA, WESTFIELD, Powiśle |
| 15 | Godziny dostaw per lokal (znamy tylko Westfield, do 10:00) | godzina w mailu do dostawcy (WP2) | wszystkie |
| 16 | Warszawa: lista PET liczonych po 12, drobne biurowe na magazyn, mop na Bracką, progi frytek i KEN, ceny Selgrosa | dane Warszawy | Warszawa |
| 17 | KAN 1350: poprawione mapowanie rolek i która rolka dla Browarów | rolki Browary | BROWARY |
| 18 | Serwetki i ręczniki ZZ: w jakiej jednostce kupujemy; u których dostawców przeszkadza dopisek „po ile pakowane” | jednostki, D3 | wszystkie |
| 19 | „Zasady zamawiania Warszawa”, odbiór skrzynek i butli (z Bartkiem), korekty z 06.09 | zasady | Warszawa |
| 20 | Co jest „niekompletne” w narzędziu (huddle 16.10) | Kraków i Katowice | FORUM, SUPERSAM |
| 21 | Proces: oznaczać „wysłane” w chwili zamówienia; wspólny przegląd 47 „przejętych” i ok. 70 „wysłanych, nieprzyjętych”; Pago i Mory z powrotem przez Transport w aplikacji | kapitanowie nie mogą przyjąć dostawy; raporty | wszystkie |

## Przejście z Bukatu na Pago

**Najpierw potwierdź zakres.** W repo i w poczcie nie ma decyzji typu „przenosimy X z Bukatu na Pago”. Najbardziej prawdopodobne odczytanie to **tzatziki P011, tiro P012 i feta P014 dla Katowic**, wysyłane kursem Pago (mail Marka z 15.10).

Stan dziś (prod, odczyt 19.10):
- Warszawa (BRACKA, BROWARY, ELEKTROWNIA, KEN, NORBLIN, WESTFIELD, WOLA) zamawia P011/P012/P014 bezpośrednio z Bukatu. Wiersze `SP_PAGO_P011/12/14` istnieją, ale są wyłączone celowo („przychodzą z Bukatu”, `supply-os-v1/app/main.py:311`).
- Gdańsk już działa w tym modelu: P011/P012/P014 zamawia z „Magazynu” (`SUP_WARSZAWA_GDA`, dopisek zmieniony z „(Bukat)” 17.10). Progi są tymczasowe.
- Katowice: P011/P012/P014 są tylko do liczenia (0/0/0), a w `SUP_WARSZAWA_KAT` ich nie ma. Fizycznie Mateusz odbiera je z Bukatu razem z dostawą Pago. Feta poszła raz przez Kuchnie KAT (15.10).
- Kraków się nie zmienia: nabiał przychodzi z Bukatu KRK.

W aplikacji, wzorem Gdańska, wystarczą 3 wiersze w `SUP_WARSZAWA_KAT` i progi, bez zmian w kodzie. Kod byłby potrzebny tylko wtedy, gdyby Katowice miały wejść do Transportu albo dostać reguły dostaw.

Blokery:

| Bloker | Czyj |
|---|---|
| Zakres: które produkty, które lokale, od kiedy | Ben → Marek |
| Lodówka na tzatziki w Katowicach: zamówiona 15.10, nie wiadomo, kiedy dojedzie (zamrażarka już jest) | Marek |
| Jak często jedzie kurs Pago do Katowic (dni). Wiadomo tylko „na minimum 2 tyg. powinno starczyć” | Marek |
| Progi min/max dla tych 3 produktów w Katowicach (zapas na 2 tygodnie) | Marek |
| Kto i gdzie zamawia u Bukatu ilość dla Katowic. Aplikacja nie łączy zamówienia z „Magazynu” z zamówieniem Bukatu, a Bukat ma minimum 500 zł | Marek / Mateusz |
| Pago idzie arkuszem „Ordering PB v5”, a nie aplikacją (od 05.10 żaden Transport nie wyszedł z aplikacji) | Marek, Ben |
| Zapis na prod drogą (b) tylko do 31.10, potem SQL wkleja operator | Ben |
