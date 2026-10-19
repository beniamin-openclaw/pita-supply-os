# Lista dla Marka (stan 19.10)

Zbudowana z odpowiedzi Bena z 19.10, arkusza „Miasta poza Warszawą”, maila Marka z 15.10 i nagrań Wispr.
Szczegóły i źródła: `marek-answers-2026-10-19.md`. Nic z tej listy nie jest jeszcze wgrane na prod.

## Gdańsk (Słony Spichlerz)
- G1. Adres dostawy (Chmielna 10?), wejście dla dostawcy, godziny przyjmowania dostaw.
- G2. E-mail lokalu do kopii (DW) w mailach do dostawców i telefon lokalu (czy 692 105 365 jest aktualny?).
- G3. Warunki dostawców: Kuchnie Świata, Selgros Gdańsk, Blue Service (czy warunki takie jak w Warszawie?). Przy każdym podaj minimum, dni dostaw i godzinę graniczną.
- G4. Coca-Cola: konto (zamawiacie przez WhatsApp, w niedzielę na następny weekend: z kim?), minimum i ceny puszek, Cappy PET i Kropli.
- G5. Towar z Warszawy: czy Pago, Magazyn Mory i Filber idą jednym transportem, jak często i czym?
- G6. Ocet i cukier w saszetkach: używacie czy usuwamy?
- G7. Produkcja własna (sosy, kasza, gyros): progi albo świadome „0”.

## Katowice (Supersam)
- K1. Dis-Pack: kto składa zamówienie, Kapitan w aplikacji czy Ty? Wyślij jeszcze raz listę nazw z EAN-ami, bo w nazwach jest bałagan.
- K2. Coca-Cola: minimum zamówienia.
- K3. Cola w arkuszu jest w szkle 0,25 ×24, Kropla i Cappy też w szkle. W aplikacji Katowice mają puszki 0,33 i Cappy w PET. Co faktycznie zamawiacie?
- K4. Rolki do kasy 80/20 i 80/80: wpisz max (dziś stoi „?”).
- K5. Kuchnie Świata: Feta, Majonez Fanex, Olej TopQ nie mają progów. Wpisz je albo napisz „nie”.
- K6. Kuchnie Świata i Selgros Bytom: minimum, dni dostaw, godzina graniczna.

## Kraków (Forum)
- R1. Selgros Kraków (C53:D123) dalej pusty. Wpisz progi tam, gdzie zamawiacie, a przy reszcie napisz „nie”.
- R2. Bukat: nowe progi z arkusza różnią się od tych w aplikacji. Tzatziki 18/72 pojemników po 3 kg to do 216 kg, a pisałeś, że nie zamawiamy 150 kg naraz. Ile ma być? Tzatziki stoją też w sekcji Pago: skąd je bierzecie?
- R3. W arkuszu są nowe sekcje: Pepsi (Pepsi, Mirinda, 7UP, woda, soki Toma) oraz Pago + Magazyn + Lemoniady. Czy Kraków zamawia Pepsi zamiast Coca-Coli? Jak często jedzie towar z Warszawy?
- R4. Bukat: zamawiać 1 dzień wcześniej (do 16:00) czy 2 dni? Ustawimy to jako przypomnienie.
- R5. Kuchnie Świata: Feta, Majonez Fanex, Olej TopQ bez progów (jak K5). Do tego warunki Selgrosu Kraków.

## Warszawa
- W1. Zaktualizowana lista magazynu Mory: biurowe (koperty, spinacze, zszywki, markery, długopisy) oraz mopy, szczotki do grilla, szczotki itp. Kupujemy je na magazyn, żeby nie jeździć po jedną sztukę do Selgrosu.
- W2. Rolki 57 mm na Woli (57×20, 57×30): czy w paczce jest 10 sztuk? W arkuszu Kraków jest „57/30 10szt”.
- W3. Ceny pozycji dodatkowych Selgrosu, których nie ma na fakturach. Resztę weźmiemy z faktur.

## Wszystkie lokale
- A1. Godziny przyjmowania dostaw w każdym lokalu (od–do). Bez tego mail dalej pisze „od 11:00”, a Westfield ma do 10:00.
- A2. Którzy dostawcy zabierają puste skrzynki i butle? Czy wpisywanie ich liczby ma być obowiązkowe? (razem z Bartkiem)
- A3. Burn: od którego dostawcy?
- A4. Progi napojów: Fuzetea i Kinley (Westfield, Elektrownia).
- A5. Przy których dostawcach dopisek „po ile pakowane” w mailu przeszkadza?

## Odłożone (tbd)
- Rolka papieru na Westfield i od kogo.
- Serwetki i ręczniki ZZ: w czym kupujemy.

# Sprawy dla Bena (nie dla Marka)
- B1. WP17 „Zasady zamawiania Warszawa”: dokument Marka z 22.09 czeka na Twoją akceptację.
- B2. Proces:
  - oznaczać „wysłane” w chwili zamówienia, także dla portalu Coca-Coli i Pago/Mory;
  - przejrzeć z Markiem zamówienia „przejęte” i „wysłane, nieprzyjęte”;
  - ustalić, kiedy Pago i Mory wracają z arkusza do Transportu.
- B3. Prod SQL do przygotowania, kiedy dasz znać (z arkusza, po review):
  - progi Katowice: Cola i Pago/Magazyn, 24 wiersze dziś na 0, plus tzatziki, tiro i feta;
  - progi Coca-Coli w Gdańsku;
  - progi Bukat Kraków (po R2);
  - PET ×12 i szkło ×24 (po K3);
  - P052 w pełnych 1 kg;
  - Dis-Pack: minimum 700 zł i nazwy z EAN.
- B4. Zmiany w kodzie:
  - pozycje zapasowe jako lista rozwijana, nie na jednym widoku (prośba z pkt 5);
  - godziny dostaw per lokal w mailu (po A1);
  - nowi dostawcy Kraków: Pepsi oraz Pago/Magazyn (po R3).
- B5. Ordering PB v5 (KAN 1350, Westfield, Meze): osobny lane w jarvis-codex, uruchomiony 19.10.
