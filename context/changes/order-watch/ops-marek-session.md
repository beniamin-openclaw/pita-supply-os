# ops — sesja wsadowa z Markiem + komunikaty (drafty do akceptacji Bena)

## 1) Komunikat do zespołu — rozdzielenie kanałów (P0, dziś)
Korekta po uwadze Bena 03.11: „Zgłoś problem" to kanał **techniczny** (sprzęt, awarie lokalowe — istnieje i działa), NIE kanał zgłoszeń do Supply OS. Błąd był w komunikacji, nie w funkcji.
Draft (grupy):
> „Prosto: awarie/sprzęt → „Zgłoś problem” jak zawsze. Sprawy zamówień i aplikacji Supply OS (progi, jednostki, nazwy, błędy w apce) → ten czat albo Trello, lista „Supply OS – błędy”. Dzięki!”

## 2) Jeden arkusz braków — kolejność: domknąć Gdańsk/Katowice → Wrocław
| Lokal | Brakuje | Źródło |
|---|---|---|
| Gdańsk | start wysyłki maili z aplikacji (Cola idzie WhatsApp), progi produktów, cena Kropla PET 17,40→faktura, Toma 12/zgrzewka potw. | mail 30.10, raport sweep |
| Katowice | ~24 brakujące progi; Dis-Pack: Marek klika ręcznie ~15 min/zamówienie → kandydat na kanał w app; Bukat→Pago: czy tylko tzatziki/tiro/feta, lodówka kiedy, dni kursu, kto zamawia Bukat | mail 19.10 cz.2, B55 |
| Wrocław Hala Świebodzki | godziny przyjmowania, dostawcy+minima+dni, adres/wejście, e-mail+telefon lokalu, progi startowe | mail 30.10+03.11 (blokuje utworzenie lokalu) |
| Wszystkie | Magazyn Mory setup: dostawca/nazwa/szt-opak/max per pozycja (zszywki, koperty, markery, szczotka grilla max 1, wkłady mopu) | mail 30.10 §2 |
| Westfield/Powiśle/Mokotów | Burn — brak dostawcy w app | B50 |
| Data | souvlaki KEN 5 vs 6 kg/karton (dopytać Khushi); „Ankaja” (Nataliia 01.10); Molotov=Mokotów? (SELECT, nie pytać) | B35, B38 |

## 3) Decyzja: supplier-per-location (blocked 08.10)
Opcje do decyzji Bena/Marka (z backlogu lane):
- **A. Duplikaty SKU per lokal** (teraz): „Cola Katowice” ≠ „Cola Warszawa”. Koszt 0, bałagan w raportach/nauce sugestii.
- **B. Model supplier-per-location** (lane `supplier-per-location`): produkt ma dostawcę per lokal. Właściwe docelowo; wymaga migracji + UI + zmiana „1 produkt=1 dostawca”.
- **C. Hibernacja**: dopiąć Katowice/Gdańsk/Wrocław jako duplikaty, decyzję B przełożyć po Wrocławiu.
Rekomendacja sweepu: **C krótkoterminowo + termin decyzji B** (mnożenie duplikatów betonuje zły model co nowy lokal).

## 4) Pozostałe (P0 ze sweepu — poza tym lane'm)
- `railway login` + read-only prod DB + log drain — Ben/operator.
- PR #27: zamknąć; H-01 (lockfile, strict, pyright) od zera małymi PR.
- Backlog statusów: patrz `prod-sql-diagnosis.sql` → `prod-sql-backlog-cleanup.sql` (decyzja).
