# Lista dla Marka (stan 19.10, po drugiej turze odpowiedzi)

Zbudowana z odpowiedzi Bena z 19.10, arkusza „Miasta poza Warszawą”, maila Marka z 15.10, nagrań Wispr
i transkryptu spotkania z 19.10 po południu. Szczegóły i źródła: `marek-answers-2026-10-19.md`.
Zamknięte punkty są skreślone; to, co wgrane na prod, opisuje `prod-applied-2026-10-19.md`.

## Gdańsk (Słony Spichlerz)
- G1. Adres dostawy (Chmielna 10?), wejście dla dostawcy, godziny przyjmowania dostaw od–do (na spotkaniu padło „pierwsze dwie godziny pracy, od dziesiątej”).
- G2. E-mail lokalu do kopii (DW) w mailach do dostawców i telefon lokalu (czy 692 105 365 jest aktualny?).
- G3. Dni dostaw Kuchni Świata, Selgrosu i Blue Service. ~~Godzina graniczna~~ (17:00) i ~~minima~~ (jak w Warszawie) ustalone.
- ~~G4. Coca-Cola: ceny i progi puszek i Cappy PET~~ (wgrane 19.10: progi z arkusza GDA, ceny jak w Warszawie, szkło usunięte z listy). Do potwierdzenia: cena Kropli PET 0,5 ×12 (dziś szacunek 17,40 zł).
- ~~G5. Jeden transport Pago + magazyn + Filber~~ (potwierdzone).
- ~~G6. Ocet i cukier~~ (usuwamy; na prodzie ich nie ma).
- ~~G7. Produkcja własna~~ (progi 0).

## Katowice (Supersam)
- K1. Dis-Pack: kto składa zamówienie, Kapitan w aplikacji czy Ty? Wyślij jeszcze raz listę nazw z EAN-ami.
- K2. Coca-Cola: minimum zamówienia.
- ~~K3. Szkło czy puszki~~ (szkło).
- K4. ~~Rolki do kasy 80/20 i 80/80: max~~ (wgrane 19.10: 80/20 12/30, 80/80 6/24, jak w innych lokalach). Zostaje: rolki 80/20 w aplikacji po 6 w paczce, w arkuszu „10szt”. Ile jest w paczce?
- ~~K5. Kuchnie Świata: Feta, Majonez, Olej~~ (progi już są: feta 1/2, majonez 0,5/1,5, olej 1/2; Kuchnie to dostawca zapasowy).
- K6. Kuchnie Świata i Selgros Bytom: minimum, dni dostaw, godzina graniczna.
- ~~K7. Ceny szkła Fanta i Sprite~~ (z faktury Coca-Coli 20.08: 58,27 i 59,47 zł; Kropla 48,96 zł).

## Kraków (Forum)
- ~~R1. Selgros Kraków~~ (bez progów; zapasowe mają progi głównego dostawcy).
- ~~R2. Bukat tzatziki max 30~~ (Ben: „robimy 30”).
- R3. ~~Pepsi zamiast Coca-Coli~~ (wgrane 19.10: dostawca „Pepsi (Kraków)”, portal pephub, 8 pozycji z arkusza). Zostaje: minimum zamówienia Pepsi, dni dostaw, ceny (dziś szacunkowe; Toma bez ceny). Jak często jedzie towar z Warszawy?
- ~~R4. Bukat: wyprzedzenie~~ (2 dni, do 16:00; bez minimum).
- R5. Kuchnie Świata: Feta, Majonez Fanex, Olej TopQ bez progów (jak K5). Warunki Selgrosu Kraków.

## Warszawa
- W1. Zaktualizowana lista magazynu Mory: biurowe, mopy, szczotki do grilla, szczotki itp. (po godzinach dostaw).
- W2. Rolki 57 mm na Woli (57×20, 57×30): progi już są (10/40 i 10/80). Zostaje: czy w paczce jest 10 sztuk?
- W4. Kropla Beskidu: które lokale w Warszawie biorą PET (×12), a które szkło 0,33 (×24, KEN wg faktury)? Dziś jeden wspólny wiersz ×24 po 34,80 zł.
- W3. Ceny pozycji dodatkowych Selgrosu, których nie ma na fakturach.

## Wszystkie lokale
- A1. **Najpierw:** godziny przyjmowania dostaw w każdym lokalu (od–do). Westfield: 9–10. Przekazać handlowcom
  dostawców: bez pracownika na miejscu nie ma dostawy, każda dostawa sprawdzona i podpisana, żadnych kluczy.
- A2. Którzy dostawcy zabierają puste skrzynki i butle? Czy wpisywanie ich liczby ma być obowiązkowe? (razem z Bartkiem)
- A3. Burn: od którego dostawcy?
- ~~A4. Progi Fuzetea i Kinley~~ (wgrane 19.10: 6/24, jedna skrzynka, jak Wola i KEN; Westfield bez Kinleya na liście). Zostaje: cena Kinleya.
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
  ~~Alerty sugestii~~: włączone wszędzie 19.10 (także Pago Warszawa i Gdańsk).
  ~~Odpowiedzi 19.10 wieczór~~ (rolki, Fuzetea/Kinley, Gdańsk, ceny Katowic, Pepsi KRK): wgrane, `prod-sql-2026-10-19-answers-2.sql`.
  ~~P052 w pełnych 1 kg~~: już jest (kg ×1, pełne opakowania; przyprawa do souvlaków też).
  Zostaje: PET ×12 w Warszawie (W4), Dis-Pack minimum 700 zł i nazwy z EAN (po K1).
- B4. Zmiany w kodzie (osobne sesje):
  - mail: godziny dostaw per lokal (WP2, Westfield 9–10), dopisek „dostawa tylko przy pracowniku, z podpisem”, bez sufiksu „po ile pakowane” dla Intermleczu;
  - kapitan: pozycje zapasowe jako lista rozwijana, nie na jednym widoku (pkt 5).
- B5. Ordering PB v5: Ben dokańcza w sesji jarvis-codex (zgoda na poprawki 1–3, Fillo bez blokady).
- B6. Stopka „przekleić na sam dół w biuro”: doprecyzować, o którą stopkę chodzi.
