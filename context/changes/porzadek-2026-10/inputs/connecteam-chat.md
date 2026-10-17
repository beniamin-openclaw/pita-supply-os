# Raport: czat Connecteam „Pita Supply OS" (28.08 – 16.10.2026)

Czat udało się odczytać w całości przez SSH, tylko do odczytu. Treści nie zgaduję, wszystko pochodzi z bazy archiwum. Niczego nie wysłałem i nie zapisałem w żadnej bazie. Plików nie zmieniałem.

## A. Jak to odczytałem (do powtórzenia)

1. **Office MCP.** W tej sesji nie jest podłączony. W `~/.claude.json` nie ma go wcale. Są tam tylko `beniamin-brain`, `brave-search`, `parallel-search`, `vercel`, `localo` (padł z błędem 401 na headersHelper) i `higgsfield`. Brain MCP nie ma żadnej wiedzy o czacie.
2. **Runbook.** Znalazłem go w `/Users/ben/Desktop/Jarvis/JARVIS V2/JARVIS-CODEX/docs/operations/connecteam-chat-archive-read-path.md`. Zezwala właścicielowi na odczyt przez SSH, gdy brakuje Office MCP.
3. **Ścieżka dostępu.**
   - Alias SSH: `droplet` (root@<droplet>, klucz działa, `BatchMode=yes`).
   - Kontener: `pitabros-db-1`.
   - Baza: `connecteam_chat_archive`.
   - Rola tylko do odczytu: `pita_mcp_chat_reader`. Hasło nie było potrzebne.
4. **Polecenie.** Użyłem transakcji `READ ONLY`, `SET LOCAL TIME ZONE 'Europe/Warsaw'` i `ROLLBACK`:
```
ssh -o BatchMode=yes droplet 'docker exec -i pitabros-db-1 psql -X -v ON_ERROR_STOP=1 -U pita_mcp_chat_reader -d connecteam_chat_archive' < zapytanie.sql
```
   - Zapytanie: `SELECT ... FROM messages WHERE conversation_id='f3af7627-0259-5ec6-91a3-4b304cb9f5b2' ORDER BY sent_at, occurrence_index`.
   - Rozmowa: `conversations.title = 'Pita Supply OS'`, 139 wiadomości, jedna, bez aliasów.
5. **Świeżość.** `conversation_sync_state`: `last_success_at` = 2026-10-17 11:47 (Warszawa), status `ok`, brak błędu. Pierwsza wiadomość to utworzenie grupy 28.08 10:09, ostatnia 16.10 15:01. Od 17.10 nic nowego.
6. **Obrazy.** Nie ma ich. Wiadomości `image-gallery` mają w archiwum tylko podpis (czasem pusty). Tabela `message_media` ma 0 wierszy dla tej rozmowy (inne czaty mają 419 gotowych plików). Zawartości zrzutów ekranu nie znam i nie zgaduję. Żeby je zobaczyć, operator musiałby uruchomić synchronizację mediów dla tej rozmowy. To zapis, więc go nie robiłem.
7. **Ograniczenie.** Wiadomości typu `reply` nie mają w archiwum wskazania, na co odpowiadają. Przy takich wpisach zaznaczam niepewność.
8. **Lokalizacje autorów.** Plan jest taki: lokalizacja jest podana tylko wtedy, gdy wynika z treści czatu (np. Ben pisze „KEN" do Khushi i Ajitha). Reszta to „z kontekstu" albo „nieznana". Nie zgaduję.

## B. Chronologia wiadomości istotnych dla Supply OS (Europe/Warsaw)

Pomijam wiadomości czysto organizacyjne (grafik, „Okay", „👍"). Kody demo i loginy z wiadomości 01.09 nie są powtarzane. Typy: bug / prośba / decyzja / pytanie / dane / skarga / info. Numer z lewej jest odnośnikiem w sekcjach C i D.

| # | Data i godzina | Autor (lokal) | Cytat (skrót) | Typ |
|---|---|---|---|---|
| B1 | 28.08 10:19 | Ben | Zamiast Excela, WhatsAppa i portali dostawców będzie jedno miejsce. Spotkanie wprowadzające wt 1.09, 9:00, MEZE Wilcza 46. | info/decyzja |
| B2 | 01.09 09:24 | Ben | Link do captain-v2 plus kody demo dla Wolskiej, Bracki, KENa i Browarów. | info |
| B3 | 01.09 10:09 | Mirsini (Bracka, z kontekstu) | „Bracka -ken- wolca is missing pilsner beer" | dane |
| B4 | 01.09 10:19 | Mirsini | „Gaz botels we need emty and full options" | prośba |
| B5 | 02.09 16:06 | Ben | Przy składaniu zamówień nadal informujcie Marka, dzwońcie przez hotline. | decyzja |
| B6 | 02.09 16:44 | Khushi (KEN) | „Can we inform him on telegram" (nie pamięta o hotline) | pytanie |
| B7 | 02.09 18:07–18:10 | Ben | Przyjmujcie dostawy przez aplikację, zawsze ze zdjęciem WZ. Linki do filmów instruktażowych PL i EN. | decyzja |
| B8 | 03.09 15:18 | Tushar (Wola) [obraz] | „We need to remove this three things its showing in intermlecz section" (06.09 Ben: „Done") | prośba/dane |
| B9 | 06.09 11:37 | Ben | Zróbcie dziś inwentaryzację w aplikacji. Kto nieobecny, uzupełnia z prawdziwą datą. | decyzja |
| B10 | 06.09 12:11 | Ela (z kontekstu Bracka) | „po wysłuchaniu inwentaryzacji wszystkie dane się wyzerowały" (zapewne „po wysłaniu") | skarga/bug UX |
| B11 | 06.09 13:50–13:52 | Ben | Zeruje się, jest w historii remanentów. Zrobi lepszy komunikat i przycisk Historia. | decyzja |
| B12 | 06.09 14:25 | Ajith (KEN) | Dodać gyros chicken (stan i cut/uncut) oraz Corfu pilsner. | prośba/dane |
| B13 | 06.09 18:25–18:29 | Ben → Khushi i Ajith (KEN), Juliana (Browary), Tushar (Wola) | Trzy wiadomości z pytaniami o powody odchyleń. Odpowiedź do pon. EOD, targety aktualizuje we wtorek. | pytanie |
| B14 | 06.09 18:34 | Ben → @everyone | „Where do you put a block that is partly used and goes back into the freezer overnight?" (gyros cut vs whole) | pytanie |
| B15 | 06.09 18:40–18:48 | Juliana (Browary) | Bifteki: stan w kg, zamówienie w kartonach. „Jeśli wpisuję 0 kg i zamawiam 1 karton, system tego nie zapisuje." | bug |
| B16 | 06.09 18:48–18:51 | Tushar (Wola) | Zamawiamy opakowania, nie sztuki. Cola zero max 5 skrzynek, normalna max 4. | dane |
| B17 | 06.09 19:49 | Khushi (KEN) | Halloumi max 60. Cola 48 butelek. Tzatziki 6 pudeł (18 kg). Retsina 6 lub 12. Corfu max 6→12. Ocet 0. Olej 5L max 1. Musztarda max 1, majonez max 1. | dane (progi) |
| B18 | 07.09 11:58 | Tushar (Wola) | „add bombila 330ml bottles" w warzywach i w inwentaryzacji | prośba/dane |
| B19 | 07.09 11:59–12:35 | Tushar → Marek; Marek | Zamówiłem Pago z apki i z Telegrama oraz „magazyn własny mory". Marek: „We don't order this one anymore". | pytanie/decyzja |
| B20 | 07.09 12:13 | Tushar (Wola) | Kamino: razem 11 butli, można ustawić max 9 | dane |
| B21 | 07.09 15:28 | Juliana (Browary) [obraz] | „U mnie maksymalnie powinny być 2 sztuki, czyli 6 albo 8 kg." (bifteki) | prośba |
| B22 | 08.09 11:34–11:45 | Juliana; Sławek | Zamówione 2 puszki coli, przyjechała 1 butelka. Sławek: dopisać pojemność i „puszka/butelka" w nazwie. | skarga/prośba |
| B23 | 09.09 11:04 | Khushi (KEN) [obraz] | „There is no option for us to write anything here because yogurt and cheese are not mentioned" | bug/prośba |
| B24 | 09.09 17:32 | Mirsini (Bracka) | Butle gazowe: bez auto-podpowiedzi, zamawiamy tyle, ile pustych (np. 4 z 5). | prośba |
| B25 | 09.09 18:54–19:14 | Mirsini; Ela | Bracka: zamówienie coli z 2.09 nadal „in progress". Ela: „Możliwe że go nie potwierdziłam". | bug/skarga |
| B26 | 13.09 18:34–18:36 | Ben | Wracam we wtorek, zmiany będą wprowadzone. Każdy z grupy dopilnuje stanu inwentaryzacji do jutra. | decyzja |
| B27 | 14.09 12:44–12:48 | Tushar (Wola) [obrazy] | „When we order pago and in suggestion we can't see the number." Zamówiliśmy tydzień temu i nie dojechało. | bug/skarga |
| B28 | 14.09 12:46 | Sławek (menedżer) | Przydałoby się filtrowanie, sortowanie i wyszukiwanie produktów. | prośba |
| B29 | 15.09 20:20 | Sławek | Przy zamówieniach coli podać, ile skrzynek plastikowych do odbioru. „Otherwise they wont collect." | prośba |
| B30 | 21.09 14:02–21:00 | Khushi (KEN) z Benem | Dodać jogurt BAKOMA grecki 370 g/12 do Intermlecz, max 2. | prośba/dane |
| B31 | 22.09 12:20 | Tushar (Wola) | „this things still we face please can you check" (treść niejasna, zrzut) | skarga |
| B32 | 22.09 14:22 | Sławek [obraz] | „Jednostki przy produktach Pago wymagają weryfikacji. Przy stanie powinno mnożyć wagę kartonu" | bug |
| B33 | 24.09 18:27 | Tushar (Wola) [obraz] | „When we order and we put quantity then suggestion is not showing." | bug |
| B34 | 24.09 20:49–20:53 | Ben | Sugestie nie mają sensu, dopóki nie ma systemu na zamawianie z wyprzedzeniem. Może je zwrócić bez alertów. Oraz podsumowanie „Co zmieniliśmy po Waszych zgłoszeniach". | decyzja |
| B35 | 25.09 12:06–12:09 | Khushi (KEN) [obrazy] | Kurczak 6 kg → 6 boxes lub 36 kg, to samo wieprzowina. Koperty 60 boxes → 60 packs lub sztuk. | dane |
| B36 | 25.09 18:02 | Sławek | Przy wysyłce do dostawcy używać precyzyjnych nazw: rodzaj, marka, wariant, gramatura (np. „frytki Aviko 9,5 mm"). | prośba |
| B37 | 27.09 09:28 | Tushar (Wola) [obraz] | „need to change quantity we have it 1 case = 24 bottles" | dane |
| B38 | 30.09 15:17 | Sławek | „Glass bottles 24 but plastic 12 in a pack. Similar with water." | dane |
| B39 | 01.10 14:56 | Marek | „Wysłałem pełne nazwy 3 dni temu" (odpowiedź, adresat niepewny) | info |
| B40 | 01.10 18:45 | Nataliia (Norblin/Elektrownia/Westfield, z kontekstu) | „Czy można dodać Ankaja ???" | prośba |
| B41 | 01.10 19:01 | Marek | „Zdjęcia też dziewczynom nie wchodzą … czarny ekran". Pomysł: dodaj z galerii. | bug |
| B42 | 02.10 13:46–13:47 | Ben | Dołączają Norblin, Elektrownia i Westfield Mokotów. Alla, Nataliia i Mirsini odpowiadają za wdrożenie. | decyzja |
| B43 | 02.10 14:31–14:34 | Khushi (KEN) | Koperty i spinacze do Blue Service zamiast „magazyn własny mory". „I placed the order twice … we never received it." | prośba/skarga |
| B44 | 02.10 15:17 | Ben | Zmiany: dwa przyciski zdjęcia WZ (aparat i galeria), nazwy jak na fakturach, „pełne opakowania + luzem", waga słoika. | info/decyzja |
| B45 | 02.10 18:48–19:13 | Marek [obrazy]; Alla; Ela | Zamówienie Alli bez wpisanych stanów, „Ale 0 frytek?". Alla: masło czosnkowe i halloumi pokrojone, więc nie ma zapasu w kartonach. | pytanie |
| B46 | 02.10 19:08–19:09 | Marek | „Beniu też coś namieszałeś, z tymi kartonami i sztukami. Dubluje zamówienie, daje X2" (Browary/Intermlecz). Nazwy wzięte z Intermleczu; dopiski „po ile pakowane" mogą zmylić sortownię. | bug |
| B47 | 02.10 19:43–19:48 | Marek; Alla | „możecie tak wysyłać, ale wtedy mam mniejszą kontrolę". Alla: niedzielna inwentaryzacja pokaże, ile zeszło. | decyzja |
| B48 | 03.10 12:11–12:22 | Ela; Nataliia | „Zrobiłam zdjęcia dostawy i nie można zatwierdzić odbioru." Nataliia: trzeba wpisać imię osoby odbierającej. | bug/UX |
| B49 | 03.10 14:03 | Sławek | „jak liczymy i wpisujemy serwetki do podajnika oraz ręczniki ZZ. Niektórzy w kartonach, inni liczą wszystkie małe opakowania." | pytanie |
| B50 | 04.10 12:53 | Mirsini | Na „Molotos" dodać Fuzetea i Burn, napoje w szkle (skrzynka 24, nie 12), do środków czystości rolki papieru. „Please put cut gyros in the system" | prośba/dane |
| B51 | 04.10 16:17 | Tushar (Wola) [obraz] | Tak samo w Woli; soki jabłkowy i pomarańczowy po 24 szt (szkło) | dane |
| B52 | 08.10 14:21–14:25 | Sebastian Korczak (Powiśle/Westfield) | Podział na kategorie przy wpisanej inwentaryzacji, jak w Google Sheets. Bifteki i Burn łatwo pominąć. Dodać: Powiśle Fuzetea i Kinley, Westfield Fuzetea i Burn. | prośba |
| B53 | 08.10 14:48–14:49 | Khushi (KEN) [obraz] | „change the amount of this gyros … 3 pcs are enough until next delivery" | dane |
| B54 | 11.10 16:11 | Sławek | Dodał do grupy 2 nowe osoby | info |
| B55 | 12.10 13:53 | Sahil Thapa (Katowice) | „Katowice we get on crates … cola bottles are of 250ml and Water 330ml glass. 1 crate: 24 bottles" | dane |
| B56 | 12.10 15:58 | Rajeshwari Parab (lokal nieznany z czatu) | „i have mailed you regarding the new app. Please review" | pytanie |
| B57 | 13.10 11:07 | Mirsini | „we have received an order but in the system is still with the manager and we can't confirm" | bug |
| B58 | 15.10 11:08 | Tushar (Wola) [obraz] → Marek | Dostawca liczy dwie różne sztuki, nie paczki. Wpisałem 10 szt gąbek, dowieźli 2 szt. Zmienić na paczki. | bug/prośba |
| B59 | 15.10 11:43 | Rajeshwari Parab | „Yesterday will ordering the app did not take any input from inventory! It was all mentioned as 0." | bug |
| B60 | 16.10 13:25–15:01 | Ben; Mirsini | Mirsini: „the system is not informing on time … last week we confirmed coca cola 2 days later". Ben do Marka: „Maybe you didint change status?" | pytanie |

## C. Synteza (ID z `crosscheck.md` / `plan.md`)

Status „NOWE" znaczy, że nie ma tego w `crosscheck.md` ani w `plan.md`. Gdzie wiem, że to jest w innym pliku repo, podaję go.

### C1. Otwarte bugi

| Pozycja | Źródło | Status w backlogu |
|---|---|---|
| Podwojenie zamówienia przy wpisie „kartony + luzem" na Browarach/Intermlecz (X2) | B46 | **NOWE.** Crosscheck uznaje W22/W23 za SHIPPED bez uwag. Nie wiem, czy poprawiono po 02.10. |
| Nie można potwierdzić odbioru, bo zamówienie wciąż „u menedżera", mimo że towar dojechał. Powtarza się: Bracka 09.09, Mirsini 13.10 i 16.10, Marek nie zmienił statusu. | B25, B57, B60 | Częściowo W73 / WP10 / D5 / Etap 4.1. Tamte pozycje dotyczą „zamknij bez przyjęcia" po stronie menedżera, nie blokady kapitana. **Wariant NOWY.** |
| „Pobrało same zera z inwentaryzacji" przy zamówieniu | B59 | **NOWE.** Wymaga powtórzenia (lokal, id zamówienia). |
| Brak komunikatu, że trzeba wpisać „kto odebrał" przy zatwierdzaniu odbioru. Poradziła koleżanka, nie aplikacja. | B48 | **NOWE.** Mały błąd UX. |
| Gąbki: dowieźli 2 szt zamiast 10 (dostawca liczy inaczej niż aplikacja) | B58 | Sprzeczne z W24 („zostaje na sztuki") i częściowe M2-5 („10szt, 0,5/1,5", PARTIAL). Wymaga decyzji, patrz D. |
| Mory/Koperty: KEN zamówił 2 razy i nigdy nie dojechało | B43 | **NOWE.** Wiąże się z Etapem 4.1 (16 zamówień „claimed" Pago/Mory wiszących od 21.09). Możliwe, że te zamówienia w ogóle nie wyszły. |

Załatwione zgodnie z czatem, których nie ma w crosscheck jako pozycji (potwierdzam tylko to, co powiedział Ben):
- Zdjęcia WZ z galerii (B41, ogłoszone 02.10 w B44). Ela 03.10 zrobiła zdjęcia (B48), ale nie sprawdzałem tego na żywo.
- Bifteki kg↔karton (B15), puszka/szkło jako osobne produkty (B22), pole notatki przy przyjęciu (B23), gaz bez sugestii (B24), sugestie Pago bez alertów (B27, B33, B34).
- Remanent wyszukiwarka/kategorie/sortowanie (B28). Tu zostaje ślad: patrz C2.

### C2. Prośby o zmiany

- Kategorie i grupowanie na ekranie po wpisaniu inwentaryzacji, „jak w Google Sheets". Sławek 14.09 (B28), Sebastian 08.10 (B52, bifteki i Burn „odseparowane"). Mapa: **W36 PARTIAL**. Przyczyna może być w danych: kolejność kart (`inventory-card-order`, Etap 4.5) nie jest zastosowana na prodzie.
- Podanie liczby skrzynek do odbioru dla coli (B29). Mapa: **W38 PARTIAL**. Jest tylko dla `SUP_COCACOLA`. Sahil (B55) pisze, że Katowice też dostają na skrzynkach, więc prompt trzeba rozszerzyć też na `SUP_COCACOLA_KAT`.
- Precyzyjne nazwy w zamówieniu (B36, B46). Mapa: **W64/W65/D3**. Nowy argument jest w D (N10).
- Zasada liczenia serwetek i ręczników ZZ (B49). Mapa: zasada W23/W49 („jedna jednostka na produkt"), ale ten przypadek jest **NOWY**.
- Zasada liczenia gyrosa częściowo użytego (cięty vs cały), zadana wszystkim 06.09 (B14), potem Mirsini 04.10 „put cut gyros in the system" (B50). Mapa: analogia do **W75/D8** (halloumi cięte), ale gyros jest **NOWE**. Nikt nie odpowiedział na pytanie z 06.09.
- Halloumi w kawałkach: Alla 02.10 (B45) opisuje ten problem w Warszawie (Norblin/Elektrownia/Westfield, z kontekstu), nie tylko w Krakowie. To wzmacnia **D8/W75**.
- Telegram zamiast hotline do powiadamiania Marka (B6). Mapa: luźno **W9**, praktycznie przestarzałe po decyzji W46 „wszyscy tylko przez aplikację". **NOWE**, niski priorytet.

### C3. Poprawki danych (master data) per lokal

Gdzie piszę „nie weryfikowałem na prodzie", dane pochodzą z repo i czatu, bez odczytu bazy.

- **KEN (Khushi/Ajith)**
  - B17 (06.09): progi halloumi, cola, retsina, Corfu, ocet, olej, musztarda, majonez. Wg repo objęte archiwami `2026-09-06-week1-feedback-targets` i `2026-09-17-week2-feedback-quantities`. Nie weryfikowałem na prodzie. Brak w crosscheck.
  - B35 (25.09): souvlaki kurczak/wieprz „6 boxes lub 36 kg" i koperty 60 box→opak. Otwarte w `master-data-followups/change.md`. **Brak w crosscheck**, czyli NOWE dla porządku. Do ustalenia waga kartonu: prod ma 1 karton = 5 kg, a Khushi liczy 6 kg/box.
  - B53 (08.10): gyros „3 pcs wystarczy do następnej dostawy". Mapa: **MD12 / M2-2** (KEN gyros, brak progu). Dochodzi liczba od Khushi.
  - B43 (02.10): koperty i spinacze do Blue Service. **Sprzeczne** z W71 (12.10: drobne biurowe na magazyn główny/Mory) i M2-5 (29.09 Marek: koperty ze Blue Service). Patrz D (N6).
- **Wola (Tushar)**
  - B16: cola zero max 5, normalna max 4 skrzynki. Nie weryfikowałem.
  - B37 i B51 (27.09, 04.10): Cappy jabłko/pomarańcza po 24 w szkle. W repo to pozycja otwarta (prod ma zgrzewka ×12). **Brak w crosscheck.**
  - B18 (07.09): „bombila 330 ml" do warzyw. Niejasne, czy to nie ten sam produkt, który Marek kazał usunąć jako „bąbila" (W2 SHIPPED). Bombilla Bukat P135 jest w repo jako sztuki. Trzeba zapytać Tushara, o co chodzi.
  - B58 (15.10): gąbki, jednostka. Patrz C1.
- **Browary (Juliana)**
  - B21: bifteki max 2 szt (6–8 kg) → karton 4,2 kg, shipped.
  - Cola: szkło czy puszka (Etap 4.7). B22 pokazuje, że 08.09 przyszła butelka zamiast puszki.
  - Frytki: M2-2 (przestrzeń).
- **Bracka (Mirsini/Ela, z kontekstu)** B3, B4, B24. Piwo Pilsner, gaz i pozycje gazu: shipped zgodnie z B34.
- **Molotov/„Molotos"** (Mirsini, B50 i B2 z 31.08 „shift on Molotov"). W repo słowa „Molotov" nie ma nigdzie. **NOWE:** czy to lokal objęty Supply OS? Nie wiem. Prośba: Fuzetea, Burn, skrzynka 24 w szkle, rolki papieru, gyros cięty.
- **Norblin/Elektrownia/Westfield**
  - B52 (Sebastian): Powiśle Fuzetea i Kinley, Westfield Fuzetea i Burn. **NOWE.** Wg przeglądu zerowych progów z 01.10 (`zero-thresholds-review.md`) Elektrownia ma tylko Burn, i to „bez aktywnego dostawcy". Na Browarach, KENie i Elektrowni Burn jest oznaczony „REMOVE?". Potrzebny dostawca Burna od Marka.
  - B40 (Nataliia): „Ankaja". Nie wiem, co to jest. Nie ma w repo.
  - B45 (Alla): masło czosnkowe 3 szt, halloumi pokrojone (patrz C2).
- **Katowice (Sahil)** B55: butelki 250 ml cola, woda 330 ml szkło, skrzynka 24. **NOWE** dane wejściowe do M6 i Etapu 3 pkt 2 (24 pozycje Cola/Pago/Magazyn). Nie wiem, które pozycje z listy pasują.
- **Wspólne:** B38 (Sławek): szkło 24, plastik 12 w opakowaniu, także woda. Mapa: **W59 (PET po 12 na Norblinie/Browarach) / M6**. Czeka na listę PET od Marka.

### C4. Decyzje podjęte na czacie

- B5: informować Marka telefonem przez hotline (02.09).
- B7: dostawy przyjmować przez aplikację, zawsze ze zdjęciem WZ (02.09).
- B9, B26: inwentaryzacja w aplikacji obowiązkowa, spóźnione wpisy z prawdziwą datą (06.09, 13.09).
- B34: sugestie wracają bez alertów, do czasu systemu na zamawianie z wyprzedzeniem (24.09). Zgodne z archiwum `pago-suggestion-no-alerts`.
- B42: od 02.10 Norblin, Elektrownia, Westfield; odpowiedzialne Alla, Nataliia, Mirsini.
- B47 (02.10): zamówienia bez wpisanych stanów mogą iść, ale Marek ma mniejszą kontrolę. **Zderza się z W60 (12.10)**, gdzie Ben wprowadza obowiązkowe stany na próbę do końca miesiąca. Chronologicznie 12.10 jest późniejsze, ale argument Alli („inwentaryzacja w niedzielę pokaże") i skarga Rajeshwari (B59, same zera) warto dołączyć do **D6**. Czy „Ali" z W60 to Alla, nie jest zweryfikowane, tylko prawdopodobne.

### C5. Pytania bez odpowiedzi (stan na 17.10 11:47)

Do Bena:
- Nataliia 01.10: Ankaja (B40).
- Khushi 02.10: koperty i spinacze w Blue Service (B43).
- Sławek 03.10: liczenie serwetek i ZZ (B49).
- Mirsini 04.10 i Tushar 04.10: Molotov, cut gyros, skrzynki 24 (B50, B51).
- Sebastian 08.10: kategorie, Fuzetea, Kinley, Burn (B52).
- Khushi 08.10: gyros 3 szt (B53).
- Sahil 12.10: butelki w Katowicach (B55).
- Rajeshwari 12.10: mail o nowej aplikacji (B56) oraz 15.10 „same zera" (B59). Ben zapytał tylko „which order?" 16.10 13:25 (B60). To mogło dotyczyć jej albo Mirsini, bo adresat odpowiedzi nie jest zapisany. Odpowiedziała Mirsini.
- Ben 06.09 do wszystkich: gyros cięty vs cały (B14). Nikt nie odpowiedział.

Do Marka:
- Ben 16.10 15:01: zmieniłeś status? (B60). Brak odpowiedzi w archiwum.
- Mirsini 13.10 (B57), Tushar 15.10 (B58).

Odpowiedzi na pytania Bena z 06.09:
- Tushar (Wola, B16) i Khushi (KEN, B17) odpowiedzieli w czacie, Juliana (Browary, B15) częściowo (bez „event" i coli).
- To zawęża Etap 3 pkt 7 w `plan.md`: pytania do Marka z maila z 06.09 trzeba zostawić tylko tam, gdzie nikt nie odpisał. Odpowiedzi kapitanów nie zastępują jednak odpowiedzi Marka, o którą prosi `crosscheck`.

## D. Pozycje NOWE: rekomendacje

| # | Pozycja | Rekomendacja | Wymaga decyzji Bena? | Gdzie pasuje |
|---|---|---|---|---|
| N1 | Podwojenie przy „kartony + luzem" (B46) | Odtworzyć testem na koszyku Browary/Intermlecz i naprawić. Błąd wprost zmienia ilość zamówienia u dostawcy. | Nie, do wdrożenia (najpierw powtórzenie) | Lane C (kapitan), frontend `captain-mp` + backend `order_qty.py` |
| N2 | Same zera po „Zamów" (B59) | Poprosić Rajeshwari o lokal, godzinę i id zamówienia. Zajrzeć do jej maila z 12.10. Potem decyzja, czy to błąd, czy stan niepoliczony („Puste = nie policzone"). | Nie (najpierw dane) | Lane C, może WP12 |
| N3 | Kapitan nie może potwierdzić odbioru, gdy status to „u menedżera" (B57, B60, B25) | Rekomendacja: (a) znacznik „u menedżera ponad 24 h" w kolejce, (b) pozwolić kapitanowi potwierdzić odbiór takiego zamówienia z ostrzeżeniem i śladem. Najpierw operator domyka 16 zamówień (Etap 4.1). | **Tak** | Rozszerzenie WP10 / D5 |
| N4 | Komunikat „wpisz, kto odebrał" (B48) | Pokazać błąd przy polu i dezaktywowany przycisk z podpowiedzią. | Nie, do wdrożenia | Lane C, mały |
| N5 | Gąbki: paczki zamiast sztuk (B58) | Zamawiać w paczkach (opak 10 szt), zgodnie z prośbą Tushara i nazwą Marka „Gąbki do naczyń 10szt". Decyzja unieważnia W24 („na sztuki"). Sprawdzić, co dostaje Blue Service w mailu/PDF. | **Tak** | WP8 (dane), z M2-5 |
| N6 | Koperty/spinacze: Blue Service czy magazyn główny (B43) | Zostawić Mory/magazyn główny (zgodnie z W71, 12.10), ale najpierw sprawdzić, czy zamówienia KENa z Mory w ogóle wyszły (Etap 4.1). Jeśli Mory czegoś nie ma, zostawić to w Blue Service. Potwierdzić z Markiem. | **Tak** | WP8 + Etap 4.1 |
| N7 | Brakujące napoje: Powiśle Fuzetea i Kinley, Westfield Fuzetea i Burn, Molotov Fuzetea i Burn (B50, B52) | Dodać pozycje Fuzetea/Kinley (jest dostawca Coca-Cola). Burn dopiero po wskazaniu dostawcy przez Marka. | Częściowo: dostawca Burna od Marka | Lane D (dane), WP8 |
| N8 | Co to jest „Molotov" (B2, B50) | Zapytać Bena, czy to lokal w Supply OS. Bez tego nic nie robić. | **Tak (pytanie)** | — |
| N9 | „Ankaja" (B40) | Zapytać Nataliię, co to za produkt i skąd. | Nie (najpierw wyjaśnienie) | WP8 |
| N10 | Argument do D3: nazwy z „po ile pakowane" mogą zmylić sortownię dostawcy (B46) | D3 zakłada „mail i PDF zostają z nazwą fakturową". Marek mówi, że dopiski w nazwach u dostawcy powodują nadmiar w paczkowaniu. Rekomendacja: zapytać Marka, którzy dostawcy tego doświadczają (Intermlecz), i dla nich obciąć sufiks także w mailu. | **Tak** (przy D3) | WP4 |
| N11 | Gyros cięty/cały oraz halloumi cięte w Warszawie (B14, B50, B45) | Rozszerzyć D8: osobna pozycja „cięte" w liczeniu produkcji, tylko do liczenia, bez sugestii zamówienia. Dla wszystkich lokali, które kroją. | **Tak** (D8) | WP14, WP8 |
| N12 | Serwetki i ręczniki ZZ (B49) | Liczyć w jednostce zakupu (karton) plus luzem, korzystając z mechanizmu „pełne opakowania + luzem" z 02.10. Podpowiedź w karcie. Potwierdzić z Markiem jednostkę zakupu. | Nie, do wdrożenia po potwierdzeniu | WP4 / W49 |
| N13 | Katowice: skrzynka 24, cola 250 ml, woda 330 ml szkło (B55) | Wpisać do listy 24 pozycji w Etapie 3 pkt 2. Prompt „liczba skrzynek" dla `SUP_COCACOLA_KAT`. | Nie | WP7, WP13 |
| N14 | Cappy w szkle po 24 (Wola) (B37, B51) | Gotowe do SQL: trzy niezależne źródła (Tushar 27.09 i 04.10, Sławek 30.09). Sprawdzić najpierw stan prodowy i typ butelki per lokal. PET ma 12. | Nie | Lane D / WP8 |
| N15 | Souvlaki KEN 6 box / 36 kg i koperty 60 (B35) | Dopytać Khushi o wagę kartonu (prod: 5 kg vs 6 kg/box). Wpisać do `crosscheck` jako brakującą pozycję (leży w `master-data-followups`). | Nie | WP8 |
| N16 | „Bombila 330 ml" (B18) | Dopytać Tushara, czy to napój w butelce, czy usunięta wcześniej „bąbila" (W2). | Nie (najpierw wyjaśnienie) | WP8 |
| N17 | Hotline czy Telegram do informowania Marka (B5, B6) | Prawdopodobnie przestarzałe po W46. Ben potwierdza i kasuje zasadę z komunikatu 02.09. | **Tak** (bardzo małe) | Poza kodem |
| N18 | Mail Rajeshwari z 12.10 o „nowej aplikacji" (B56) | Przeczytać mail. Treść poza czatem, jej nie znam. | Nie | — |

Na koniec: najpilniejsze według mnie są N1 (możliwy błąd ilości zamówień u dostawców) i N3 (blokada odbioru, pojawia się co tydzień). N8 i N9 to dwa szybkie pytania, bez których dane nie ruszą.