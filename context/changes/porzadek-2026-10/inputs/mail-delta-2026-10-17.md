# Gmail research (read-only), stan na 2026-10-17

Skrzynka: beniamin@pitabros.pl. Nic nie zostało wysłane, zlabelowane, skasowane ani zmienione.
Uwaga: plik `report-mail.md` NIE został zapisany (narzędzie Write odrzuciło zapis przez subagenta). Raport jest tylko w tej wiadomości.

## Wniosek w 5 zdaniach
1. Od 16.10 po południu do 17.10 rano nie przyszło nic nowego od Marka ani Georgiosa o Supply OS poza podsumowaniem Daily Huddle z 16.10 (wysłane 17.10 08:38).
2. Brak jakiejkolwiek odpowiedzi Marka na "Gdańsk dane" (12.10) oraz na mail z korektami z 06.09.
3. Huddle 16.10 otwiera nowy wątek: Marek zgłasza potrzebę poprawek w narzędziu/zestawieniach dla Krakowa i Katowic (niekompletne wpisy wymuszają ręczne przenoszenie i kasowanie danych). Decyzje o rejestrowaniu zgłoszeń w aplikacji i o tym, kto kupuje, mają zapaść w poniedziałek 19.10.
4. Raporty kapitanów (Sahil, Khushi, Kamesh, Ismail) prawie nie zawierają błędów aplikacji. Wartość: braki materiałów eksploatacyjnych na KEN, nadzamawianie gyrosa na KEN.
5. Sygnały master-data z 4 tygodni, nadal otwarte wg maili: zły cennik Intermlecz dla Wolska/Westfield, KAN 1350 (rolka do kasy vs Fillo) w zamówieniu Browary.

## Tabela

| # | date | from | type | short quote | implication for the app | status hint |
|---|------|------|------|-------------|-------------------------|-------------|
| 1 | 2026-10-17 (huddle z 16.10) | Georgios (Daily Huddle) | bug / feature | "niekompletne wpisy wymuszają ręczne przenoszenie i kasowanie danych" (Marek, narzędzie i zestawienia Kraków/Katowice) | Walidacja kompletności wpisów (min/max, produkty) w arkuszach/imporcie dla Krakowa i Katowic; wyeliminować ręczne przenoszenie | otwarte; nie wiadomo, czy dotyczy arkusza Marka czy aplikacji |
| 2 | 2026-10-17 (huddle z 16.10) | Georgios (Daily Huddle) | decision | "Beniamin zaproponował centralizację zamówień u Marka oraz ewentualne dodanie kategorii do narzędzia" | Możliwa nowa kategoria (materiały eksploatacyjne / zgłoszenia) w aplikacji; zamówienia poza Warszawą centralnie u Marka | do ustalenia w poniedziałek 19.10 |
| 3 | 2026-10-17 (huddle z 16.10) | Georgios (Daily Huddle) | decision | papier termiczny poza Warszawą zamawiany bezpośrednio, po 4 paczki na lokal, domówienie gdy zostaje ostatnia paczka (parafraza, nie cytat) | Reguła min/max w opakowaniach (4 paczki, próg = 1 paczka) dla rolek/papieru w lokalach poza Warszawą | otwarte, związane z pkt 2 |
| 4 | 2026-10-12 | Ben -> Marek ("Gdańsk dane") | question | "Dane lokalu ... e-mail lokalu do kopii (DW) ... telefon lokalu (czy 692 105 365 jest aktualny?)" | Gdańsk (Chmielna 10): adres/wskazówki dostawy, e-mail DW, arkusz min/max, dostawcy, Coca-Cola (cchbcshop), produkty spoza katalogu + lista "Zamówienia zapasowe", rolki do kas, produkcja własna | BRAK ODPOWIEDZI (wątek ma 1 wiadomość, sprawdzone 17.10) |
| 5 | 2026-10-12 (pkt 4 maila) | Ben -> Marek | question | "czy Gdańsk zamawia Pago, Magazyn (Mory) i Filber jako jedno zamówienie, jak Katowice?" | Konfiguracja zamówienia zbiorczego Warszawa->Gdańsk (transport, częstotliwość) | BRAK ODPOWIEDZI |
| 6 | 2026-09-06 | Ben -> Manager@ ("tydzień 1: Twoje korekty ilości") | question | temat: "Supply OS, tydzień 1: Twoje korekty ilości, kilka pytań" | Korekty ilości i pytania z tygodnia 1 | BRAK ODPOWIEDZI w wątku (sprawdzone 17.10) |
| 7 | 2026-10-12 | Georgios -> Marek (feedback) | decision | min-max Supply OS to cel października nr 1; ok. 25 raportów kapitanów bez pisemnej odpowiedzi Marka (z odczytu 16.10) | Priorytet: min/max Kraków, Katowice, Gdańsk; Marek nie odpowiada pisemnie na raporty | kontekst, w toku |
| 8 | 2026-10-13/14 | Daily Huddle 13.10 (korekta) i 14.10 | decision | Marek odpowiada za min/max dla Krakowa, Katowic i Gdańska (z odczytu 16.10) | Dane wejściowe z Gdańska zablokowane do odpowiedzi Marka (pkt 4-5) | w toku |
| 9 | 2026-10-14 | Marek -> Intermlecz ("Korekty faktur Pita Bros Westfield") | master-data | FS 88644 (507,26), FS 94413 (1 086,81), FS 99716 (719,09) = 2 313,16 zł netto; 42 wiersze korekt, 15 produktów | Cennik/ceny w aplikacji dla Westfield muszą pasować do cennika dostawcy; błąd powtarzalny przy złym przypisaniu cennika | czeka na dostawcę |
| 10 | 2026-09-17 | Ben -> Intermlecz ("Korekty faktur i poprawienie cennika — Wołoska") | master-data | zły cennik; przypisać "jednym cennikiem" (parafraza) | Jeden cennik na lokal u dostawcy; sprawdzić przypisanie cenników w master-data | otwarte wg stanu na 14.10 |
| 11 | 2026-10-15 | biuro -> Marek ("Zlecenie odbioru własnego WAW 13.10") | master-data | "proszę z waszego systemu wykazywać KAN 1350 Meze ... a wy zamawiacie na Browary 13/10 2 sztuki" | Błąd mapowania: rolka do kasy vs KAN 1350 Fillo (Marek: w arkuszu są 4 rodzaje rolek, "przeskoczyło na Fillo jak kopiowałem") | otwarte; rolki powinny mieć własne, różne kody/nazwy |
| 12 | 2026-10-04 | Khushi (KEN), raport tygodniowy | master-data / min-max | "we had to throw away more than 2 kg of gyros pork" (ok. 15 kg gyrosa na 3-4 dni wg raportu) | Nadzamawianie gyrosa na KEN; min/max i krok zamówienia gyros dla KEN do przeglądu | brak odpowiedzi Marka w znalezionych mailach |
| 13 | 2026-09-21 | Khushi (KEN) | master-data | "running low on some important stock, such as paper rolls, takeaway bags, and gloves" | Rolki, torby, rękawiczki: progi min/max dla KEN; pokrywa się z potrzebą kategorii materiałów eksploatacyjnych (pkt 2-3) | brak odpowiedzi w znalezionych mailach |
| 14 | 2026-10-04 | Khushi (KEN) | info | "I showed him how to place orders through the website" | Uczenie nowej osoby składania zamówień; potwierdza użycie aplikacji w KEN, bez zgłoszenia błędu | informacja |
| 15 | 2026-10-14 | biuro -> Marek ("Stany magazynowe Bukat 13.10") | info | "Tzatzyki i Tiro musimy już zamówić" | Stany Bukat (tzatziki 3 kg: 686, Tiro 2 kg: 37) - sygnał do doświetlenia progów, nie błąd aplikacji | informacja |
| 16 | 2026-10-08/09 | Ben (własne maile) | feature | szkolenie Sahila z Tusharem na Wolskiej 09.10 + karty szkoleniowe, login do aplikacji dla Katowic w dalszej kolejności | Konto Katowic (Sahil) do utworzenia/potwierdzenia | do potwierdzenia, czy login wydany |
| 17 | 2026-10-09 | Georgios -> Tushar (feedback Wola) | master-data | korekta nazwy produktu, godzina niedzielnej inwentaryzacji, praktyka zamawiania Ketsi (z odczytu 16.10) | Nazwa produktu do poprawy w master-data (konkretnej nazwy nie ustalono w tej sesji) | do sprawdzenia w danych |
| 18 | 2026-10-10/14 | Georgios -> Sahil, Khushi; odpowiedzi | (brak) | brak wzmianki o aplikacji ani o zamówieniach | feedbacki wrześniowe nie zawierają bugów ani próśb do aplikacji; odpowiedzi Sahila (10.10) i Khushi (14.10) to podziękowania | zamknięte dla Supply OS |
| 19 | 2026-10-16 18:41 | noreply@supervoip.pl | info | poczta głosowa z numeru 692105365 na numer 221189845 | To ten sam numer, o który Ben pytał w "Gdańsk dane" ("czy 692 105 365 jest aktualny?"); treści nagrania nie odsłuchano | tylko fakt zbieżności numeru; nic nie wnioskuję o nadawcy |

Pominięte jako niezwiązane z aplikacją (czytane tylko w nagłówkach): Westfield Arkadia, Hala Świebodzki sprzęt, Słony/SDG, Kulinarna Kamienica, terminale Norblin (decyzja 16.10: oba terminale zostają), Glovo nagrania, rozliczenia księgowe.

## Open questions waiting on Ben or Marek

Marek:
1. Odpowiedź na "Gdańsk dane" (12.10): dane lokalu (Chmielna 10, wejście, godziny przyjęć, e-mail DW, telefon), arkusz min/max, dostawcy lokalni z minimami/dniami/godziną graniczną, czy Pago + Magazyn (Mory) + Filber jako jedno zamówienie, Coca-Cola (konto cchbcshop, minimum, szkło/puszka, Cappy), produkty spoza katalogu, rolki, produkcja własna.
2. Odpowiedź na mail z korektami z 06.09 (nadal brak odpowiedzi w wątku).
3. Poprawki w narzędziu/zestawieniach dla Krakowa i Katowic zgłoszone w huddle 16.10: co dokładnie jest niekompletne i gdzie (arkusz czy aplikacja).
4. Naprawa mapowania KAN 1350 (Fillo vs rolka do kasy) i potwierdzenie, że Browary dostały właściwy towar.
5. Czy dostawca (Intermlecz) potwierdził korekty Westfield/Wolska (2 313,16 zł netto) i przypisał właściwy cennik.

Ben (decyzje na poniedziałek 19.10):
1. Czy dodać kategorię (materiały eksploatacyjne / zgłoszenia) do aplikacji i jak rejestrować zgłoszenia.
2. Kto odpowiada za zakupy poza Warszawą: centralizacja u Marka vs bezpośrednio w lokalach (papier termiczny: 4 paczki, domówienie przy ostatniej).
3. Czy konto Supply OS dla Katowic (Sahil) zostało wydane po szkoleniu 09.10.
4. Czy poprawić nazwę produktu zgłoszoną w feedbacku Georgiosa do Tushara (konkretna nazwa niezweryfikowana).

## Coverage

- Zapytania wyszukiwania: ok. 12 (w tym szerokie zapytanie `after:2026/10/16` z wykluczeniem promocji, zwróciło 20 wątków; przejrzane nagłówki).
- Wątki przeczytane w całości: ok. 25 (w tym ponownie, po błędach ID: "Gdańsk dane", odpowiedź Khushi, odpowiedź Sahila).
- Nieudane odczyty: 2 (błędne ID wiadomości zamiast wątku) - naprawione w tej sesji i odczytane poprawnie.
- Luki: nie czytano w całości maili feedbackowych do Ali/Eli/Juliany/Natalii, Office Day 13.10 (1a1341631f4d5222) i raportu Krakowa z 11.10 pod kątem nowych punktów (te były pokryte 16.10); załączniki (poczta głosowa, arkusze) nie były otwierane; brak dostępu do skrzynek biuro@ i Manager@ poza tym, co widać w skrzynce Bena.
- Sprawdzone ponownie wg polecenia (status): odpowiedzi Marka z 29.09 i 15.10 oraz mail z 08.10 - bez nowych wiadomości po 15.10; huddle 16.10 jest jedyną nowością.