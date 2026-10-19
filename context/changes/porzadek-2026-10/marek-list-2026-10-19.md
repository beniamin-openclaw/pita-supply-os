# Lista dla Marka (stan 19.10, po drugiej turze odpowiedzi)

Zbudowana z odpowiedzi Bena z 19.10, arkusza „Miasta poza Warszawą”, maila Marka z 15.10, nagrań Wispr
i transkryptu spotkania z 19.10 po południu. Szczegóły i źródła: `marek-answers-2026-10-19.md`.
Zamknięte punkty są skreślone; to, co wgrane na prod, opisuje `prod-applied-2026-10-19.md`.

## Gdańsk (Słony Spichlerz)
- G1. Adres dostawy (Chmielna 10?), wejście dla dostawcy, godziny przyjmowania dostaw od–do (na spotkaniu padło „pierwsze dwie godziny pracy, od dziesiątej”).
- G2. E-mail lokalu do kopii (DW) w mailach do dostawców i telefon lokalu (czy 692 105 365 jest aktualny?).
- G3. Dni dostaw Kuchni Świata, Selgrosu i Blue Service. ~~Godzina graniczna~~ (17:00) i ~~minima~~ (jak w Warszawie) ustalone.
- G4. Coca-Cola: ceny i progi puszek i Cappy PET (dziś 0/0/0). ~~Minimum, kanał~~ (WhatsApp, bez minimum).
- ~~G5. Jeden transport Pago + magazyn + Filber~~ (potwierdzone).
- ~~G6. Ocet i cukier~~ (usuwamy; na prodzie ich nie ma).
- ~~G7. Produkcja własna~~ (progi 0).

## Katowice (Supersam)
- K1. Dis-Pack: kto składa zamówienie, Kapitan w aplikacji czy Ty? Wyślij jeszcze raz listę nazw z EAN-ami.
- K2. Coca-Cola: minimum zamówienia.
- ~~K3. Szkło czy puszki~~ (szkło).
- K4. Rolki do kasy 80/20 i 80/80: wpisz max (dziś stoi „?”). Rolki 80/20: w aplikacji opakowanie po 6, w arkuszu „10szt”. Ile jest w paczce?
- K5. Kuchnie Świata: Feta, Majonez Fanex, Olej TopQ nie mają progów. Wpisz je albo napisz „nie”.
- K6. Kuchnie Świata i Selgros Bytom: minimum, dni dostaw, godzina graniczna.
- K7. Ceny szkła: Fanta i Sprite 0,25 (po zmianie z puszek nie mają ceny).

## Kraków (Forum)
- ~~R1. Selgros Kraków~~ (bez progów; zapasowe mają progi głównego dostawcy).
- R2. Bukat tzatziki: max 30 pojemników (w nagraniu „trzyście”, czy na pewno nie 24?) i min 18. Tiro 2/8: ok?
- R3. Pepsi zamiast Coca-Coli? Arkusz ma sekcję Pepsi (Pepsi, Mirinda, 7UP, Krystaliczne Źródło, Toma). Jak często jedzie towar z Warszawy?
- ~~R4. Bukat: wyprzedzenie~~ (2 dni, do 16:00; bez minimum).
- R5. Kuchnie Świata: Feta, Majonez Fanex, Olej TopQ bez progów (jak K5). Warunki Selgrosu Kraków.

## Warszawa
- W1. Zaktualizowana lista magazynu Mory: biurowe, mopy, szczotki do grilla, szczotki itp. (po godzinach dostaw).
- W2. Rolki 57 mm na Woli (57×20, 57×30): czy w paczce jest 10 sztuk?
- W3. Ceny pozycji dodatkowych Selgrosu, których nie ma na fakturach.

## Wszystkie lokale
- A1. **Najpierw:** godziny przyjmowania dostaw w każdym lokalu (od–do). Westfield: 9–10. Przekazać handlowcom
  dostawców: bez pracownika na miejscu nie ma dostawy, każda dostawa sprawdzona i podpisana, żadnych kluczy.
- A2. Którzy dostawcy zabierają puste skrzynki i butle? Czy wpisywanie ich liczby ma być obowiązkowe? (razem z Bartkiem)
- A3. Burn: od którego dostawcy?
- A4. Progi napojów: Fuzetea i Kinley (Westfield, Elektrownia).
- ~~A5. Dopiski „po ile pakowane” w mailu~~ (Intermlecz; zmiana kodu po naszej stronie).

## Odłożone (tbd)
- Rolka papieru na Westfield i od kogo.
- Serwetki i ręczniki ZZ: w czym kupujemy.

# Sprawy dla Bena (nie dla Marka)
- B1. WP17 „Zasady zamawiania Warszawa”: dokument Marka z 22.09 czeka na Twoją akceptację.
- B2. Proces:
  - oznaczać „wysłane” w chwili zamówienia, także dla portalu Coca-Coli, WhatsAppa w Gdańsku i Pago/Mory;
  - przejrzeć z Markiem zamówienia „przejęte” i „wysłane, nieprzyjęte” (m.in. Katowice 13.10, Bukat KRK 14.10);
  - ustalić, kiedy Pago i Mory wracają z arkusza do Transportu.
- B3. Prod SQL: pakiet 19.10 (Katowice szkło i Pago, Bukat KRK, Pago KRK, minima Gdańsk, Coca-Cola Gdańsk ręcznie) **wgrany 19.10**, log w `prod-applied-2026-10-19.md`.
  Decyzja dla Ciebie: alerty o niskim stanie dla „Pago + Magazyn” w Katowicach i Krakowie oraz Coca-Coli w Katowicach są wyłączone (powód „brak progów” już nie obowiązuje). Włączyć?
  Zostaje: PET ×12 we wszystkich lokalach (U1), P052 w pełnych 1 kg, Dis-Pack minimum 700 zł i nazwy z EAN (po K1), Pepsi KRK (po R3).
- B4. Zmiany w kodzie (osobne sesje):
  - mail: godziny dostaw per lokal (WP2, Westfield 9–10), dopisek „dostawa tylko przy pracowniku, z podpisem”, bez sufiksu „po ile pakowane” dla Intermleczu;
  - kapitan: pozycje zapasowe jako lista rozwijana, nie na jednym widoku (pkt 5).
- B5. Ordering PB v5: Ben dokańcza w sesji jarvis-codex (zgoda na poprawki 1–3, Fillo bez blokady).
- B6. Stopka „przekleić na sam dół w biuro”: doprecyzować, o którą stopkę chodzi.
