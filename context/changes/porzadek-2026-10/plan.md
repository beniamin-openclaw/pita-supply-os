# Porządek 2026-10: plan domknięcia Supply OS

Cel nadrzędny (Office Day 13.10): Supply OS we wszystkich lokalach do końca października.
Stan na 17.10: kod na main = `7b03cf9` (PR #62, 09.10). Od tego czasu nic nie weszło na main.
Pełne dowody leżą w `inputs/`; tabela ustaleń ze statusem jest w `inputs/crosscheck.md`
(źródła W = Wispr, M/MD = mail, S = sesje).

**Zasada pracy.** Decyzje zapadają tutaj. Kod piszą osobne sesje według kontraktów z Etapu 5:
jedna sesja na jeden zestaw plików. Odczyty z produ działają. Zapisy na prod (UPDATE/DELETE/DDL)
blokuje klasyfikator trybu auto w Claude Code („Production Deploy”). Blokuje je nawet wtedy, gdy
Ben zgodził się na czacie (05.10 i 17.10). Agent przygotowuje więc SQL jako diff + guard + audit.
Uruchamia go jedna z trzech dróg:
(a) Ben w edytorze SQL Supabase;
(b) agent, po dodaniu reguły zezwalającej na `execute_sql` w ustawieniach Claude Code;
(c) sesja na mini z pominięciem uprawnień, za wyraźną zgodą Bena.

---

## Etap 0 — Zabezpieczenie pracy (agent, dziś, ~15 min)

Te rzeczy istnieją tylko lokalnie albo na gałęziach i mogą przepaść.

- [x] 0.1 Commit + push tej gałęzi: `context/changes/gdansk-rollout/` (było tylko na mini,
      niezacommitowane) + `context/changes/porzadek-2026-10/`.
- [x] 0.2 Docs PR z `origin/claude/rollout-katowice-krakow-b96616` (b844dfb, 455822e:
      log prod 0029/A/C/B/B2, kody FORUM/SUPERSAM, smoke GET).
- [x] 0.3 Docs z `origin/claude/transport-v2` (a633703). Wchodzą do main razem z archiwizacją R-36 (Etap 6).
- [x] 0.4 Commit niezacommitowanych plików z innych worktree:
      materiały szkoleniowe `docs/pita-supply-os-v1/training/2026-10-09-captain-training/`
      (worktree wonderful-albattani) oraz strona decyzji
      `context/meetings/supply-os-ze-spotkan.html` (worktree przepisz-nr-normlanie).
- [x] 0.5 Roadmapa: poprawić nieaktualne wiersze R-33 i R-37. Dopisać R-38 gdansk-rollout
      oraz dwa brakujące wiersze: inventory-card-order i transport-pago-mory-combined.

## Etap 1 — Domknięcie Gdańska (SLONY) (agent przygotowuje, operator zatwierdza)

Na prodzie (odczyt 17.10): SLONY aktywny, 5 dostawców GDA, 130 pozycji, są już 2 zamówienia.
Brakuje:
- [ ] 1.1 (SQL gotowy: `gdansk-rollout/prod-sql-3-corrections.sql`; zapis zablokowany, czeka na drogę a/b/c) Korekta od Marka (16.10). Kuchnie Świata, Selgros i Blue Service: termin „dzień
      wcześniej do 17:00” (dziś wszystkie mają `cutoff_time` NULL). Tzatziki/tiro/feta zostają
      w „Pago + Magazyn”, a etykieta zmienia się z „(Bukat)” na „(Magazyn)”. Coca-Cola i Pago bez zmian.
- [ ] 1.2 ~~DELETE 12 pustych pozycji~~ **wstrzymane (D15)**. Spis z natury z 16.10 (`INV-20261016-SLO-da3c42`)
      ma stany na 7 z nich: Coca-Cola 0,33 puszka 119, Cola Zero 102, Cappy jabłko 16, Cappy pomarańcza 19,
      rolki 57/30 24, Top Glass Tenzi 8, papryka Florina 3. Zera mają: ocet, cukier w saszetkach,
      Tenzi do szyb i Top Grill. Ocet spirytusowy (P037) nie był liczony.
- [ ] 1.3 DROP tymczasowej funkcji `gdansk_rollout_step1(boolean)`: w tym samym pliku co 1.1.
- [ ] 1.4 Ben potwierdza, że `SLONY:<kod demo SLONY>` jest w Railway i że kapitan się loguje
      (2 zamówienia sugerują, że tak). Po demo zmienić kod na trudniejszy do zgadnięcia (review F8).
- [ ] 1.5 Audyt + odhaczenie `gdansk-rollout/plan.md`. Reszta czeka na pakiet od Marka (Etap 3).

## Etap 2 — Decyzje Bena (jedna sesja tutaj, ~20 min)

Rekomendacja w nawiasie. Każda decyzja odblokowuje konkretny pakiet pracy (WP).

| # | Decyzja | Rekomendacja | Odblokowuje |
|---|---|---|---|
| D1 | Próg odchylenia 20% czy 25% | zostaje 25% (tak jest w kodzie i w archiwum) | — |
| D2 | Włączyć datę dostawy w mailu (`SUPPLY_OS_ORDER_EMAIL_DELIVERY_DATE_ENABLED`) | tak | WP1 |
| D3 | Sufiks „/12” w nazwach: obcinać w widoku czy w danych; na których ekranach | obcinać tylko w widoku kapitana; mail i PDF zostają z nazwą fakturową | WP4 |
| D4 | Pago+Mory jako jedna kategoria: przeniesienie w danych czy grupowanie tylko w UI? Filber: towarzysz w transporcie czy przycisk „zamówione”? | grupowanie tylko w UI (dane bez zmian); Filber dostaje przycisk „zamówione”, bez trzeciej warstwy agregacji | WP9 |
| D5 | „Zamknij bez przyjęcia” | nowa akcja managera dla `manager_sent` z powodem i śladem; tylko manager | WP10 |
| D6 | Obowiązkowe stany do 31.10 | ostrzeżenie zamiast twardej blokady, wszystkie lokale poza Norblinem i Elektrownią | WP12 |
| D7 | Dostawcy Kraków/Katowice: `manual` czy `email` | `email` tam, gdzie mamy adres i minimum (Dis-Pack, Bukat KRK) | WP7 |
| D8 | Kraków: halloumi w kawałkach, pita na sztuki | halloumi cięte jako osobna pozycja produkcji; pita bez zmian (jedna jednostka na produkt, W49) | WP14 |
| D9 | Kategoria materiałów eksploatacyjnych i zakupy poza Warszawą (poniedziałek 19.10) | po huddle 19.10 | WP16 |
| D10 | Wybór opcji na stronie „Supply OS ze spotkań” (wyszarzanie, podwójny ✓, karta zapasowa) | wybrać tam i wkleić „Kopiuj decyzje” | WP5, WP6 |
| D11 | Filtr managera pokazuje wszystkich aktywnych dostawców (Spec Food) | tak | WP11 |
| D12 | Raport strat i eksport GoStock: w V1 czy później | później, zgodnie z „najpierw analiza” Georgiosa (W55) | WP18, WP19 |
| D13 | Lemoniady Filber P075–P077 w zakładce Katowic | zostają | WP7 |
| D14 | Przyszłość lane'ów bocznych: PR #59 (guard AGENTS.md), `10x-autonomous-workflow-v2`, H-01, `captain-history-and-draft-ux` (sharp-fermat) | #59 merge; reszta: osobna decyzja w Etapie 6 | Etap 6 |
| D15 | Gdańsk: 7 „pustych” pozycji ma stan w spisie z 16.10 (Coca-Cola puszki, Cappy, rolki, Top Glass, papryka) | zostawić wszystkie 12. Marek dopisuje dostawcę i progi dla tych 7 (Coca-Cola puszki → SUP_COCACOLA_GDA). Zera usunąć dopiero po jego potwierdzeniu | Etap 1, Etap 3 |

## Etap 3 — Pakiet danych od Marka (jeden mail, agent pisze draft, Ben wysyła)

Jedna lista zamiast pięciu wątków. Marek odpowiada w arkuszu albo punkt po punkcie.
1. **Gdańsk:** wszystkie 8 punktów maila z 12.10, w tym czy Pago+Mory+Filber idą jako jedno zamówienie.
   E-mail lokalu. Czy „BlueService” w Gdańsku to warszawski Blue Service.
2. **Kraków/Katowice:** minima, dni dostaw i godziny dla Kuchni Świata i Selgrosa
   (15.10 przyszły tylko adresy e-mail). Konto i minimum Coca-Coli w Katowicach. Min/max dla 24 pozycji
   Coca-Cola/Pago/Magazyn/Lemoniady w Katowicach. Ponownie wpisane progi Forum. Lista Selgrosa z progami.
   Katalog Dis-Pack z ich nazwami i EAN. Dostawca i cena Thamma Lemon/Mastiha.
   Co dokładnie jest „niekompletne” w narzędziu (huddle 16.10).
3. **Godziny dostaw per lokal** (na razie znamy tylko Westfield: do 10:00).
4. **Warszawa:** lista PET liczonych po 12 (Norblin/Browary). Drobne biurowe do przeniesienia na magazyn główny.
   Który mop na Brackę. Progi dla frytek (Wola/Browary), gyrosa KEN, rolek/toreb/rękawiczek KEN.
   Ceny Selgrosa spoza faktur.
5. **KAN 1350:** poprawione mapowanie rolek w arkuszu i potwierdzenie, którą rolkę Browary powinny dostać.
6. **Zasady:** „Zasady zamawiania Warszawa” do akceptacji Bena; zasady odbioru skrzynek i butli (z Bartkiem).
7. Odpowiedzi na pytania o korekty z tygodnia 1 (mail z 06.09).

## Etap 4 — Weryfikacje i porządki operatora (Ben fizycznie, prowadzę krok po kroku)

Kolejność: najpierw to, co blokuje pracę albo grozi błędnym zamówieniem.
- [ ] 4.1 **Zamówienia wiszące:** oznaczyć jako wysłane Mory 04.10 (BRO `8fbdd2`, KEN `06569d`) i 3 zamówienia Coca-Cola z 04.10.
      Dla 16 zamówień „claimed” (Pago/Mory od 21.09) i ogona ok. 20 starych zamówień Woli zdecydować: wysłać, anulować czy zamknąć.
      Anulować testowe `ORD-20261001-WOL-INTE-1851ca`.
- [ ] 4.2 **KAN 1350 (Browary):** sprawdzić, czy pozycja pochodzi z aplikacji czy z arkusza
      (agent przygotuje SELECT, uruchomi go operator).
- [ ] 4.3 **R-36 Transport v2:** E2E pierwszego kursu Marka i logowanie Marka na biuro@. Potem archiwizacja.
- [ ] 4.4 **R-33 order-email-v2:** pkt 4.4/4.5 (draft Gmail na żywo, dosyłka, link awaryjny).
- [ ] 4.5 **inventory-card-order:** zastosować `prod-sql.sql` (kolejność kart) i `prod-sql-pago-mory.sql`
      (najpierw SELECT, czy już nie poszło). Kontrole na żywo 4.6–4.8.
- [ ] 4.6 **transport-pago-mory-combined 5.3:** potwierdzić na podstawie kursu z 05.10.
- [ ] 4.7 **R-34 resztki:** 7 bloków DELETE (Cappy P190/P191 są dziś niewidoczne w części lokali) przy ekranie Supabase.
      Do tego 1.11d/h oraz Coca-Cola na Browarach: szkło czy puszka.
- [ ] 4.8 **Bezpieczeństwo:** rotacja tokenów kapitanów/managera (otwarte od czerwca), klucze Viva z maila „KLUCZE”,
      RLS na 9 tabelach backupu (`training-feedback-0901/prod-sql-phase0.sql`). Najpierw SELECT, czy już nie zrobione.
- [ ] 4.9 **Potwierdzenia u kapitanów:** KEN widzi BAKOMA i GOUDA na ekranie Intermlecz; Sahil ma kod SUPERSAM;
      smoke GET jednym tokenem warszawskim (R-37).
- [ ] 4.10 **Eksport WZ za wrzesień:** 101 zdjęć czeka na klucz `service_role`. Decyzja: dokończyć albo odpuścić.
- [ ] 4.11 **Drafty w Gmailu:** sugestie dla Marka z 28.09 (prawdopodobnie zastąpi je mail z Etapu 3), Chefs Culinar (wpisać datę).
- [ ] 4.12 **Connecteam:** czatu „Pita Supply OS” nie da się odczytać przez API. Wkleić zrzuty albo eksport.

## Etap 5 — Kontrakty pracy (osobne sesje kodujące)

Kolejność według terminu 31.10. Każdy lane to jedna sesja przechodząca pełny cykl 10x
(new → plan → plan-review → implement → impl-review → /verify → PR). Lane'y w jednej fali nie
dzielą plików, więc mogą iść równolegle.

**Fala A — bez blokad, start po Etapie 0**
- **Lane E (e-mail):** WP1 = kolejność stopki, pozycje spoza katalogu jako wiersze tabeli, przełącznik daty (D2).
  Do tego WP3 = jeden przycisk „Wyślij”, który tworzy draft i otwiera właśnie ten draft.
  Pliki: `gmail_url.py`, `emailBody.ts`, `DispatchPanel.tsx`, `orderEmailDraft.ts` + testy golden.
  Później WP2 (godziny dostaw per lokal, migracja), gdy Marek poda godziny.
- **Lane C (kapitan):** WP6 = podwójny ✓ „wysłane” odtwarzany po odświeżeniu (`CaptainMP.tsx:110`).
  WP5 = karta zapasowa nie wygląda na pustą, dodatki Selgrosa jako lista (po D10).
- **Lane M (manager):** WP11 = wszyscy aktywni dostawcy w filtrze (D11). WP10 = „zamknij bez przyjęcia” (D5).
- **Lane D (dane prod, tylko SQL + audyt, aplikuje operator):** gotowe od ręki:
  - Kraków: cutoff Bukatu 16:00 jako reguła dostaw (pn/śr/pt), kontakty i minima z 15.10 (D7), e-mail Supersamu, cebula FORUM ok. 1 kg.
  - Warszawa: przyprawa souvlaki na Browarach 0,5/2/2; majonez i musztarda na Browarach (kg → szt); rolki Woli max 5 op.;
    progi gąbek 0,5/1,5; zmiana „box” na „karton” dla Corfu.

**Fala B — po decyzjach z Etapu 2**
- WP4 nazwy produktów (D3). WP9 Pago+Mory i Filber (D4). WP12 obowiązkowe stany (D6).
- WP14 prośby Krakowa (D8). WP16 materiały eksploatacyjne (D9).

**Fala C — po danych od Marka (Etap 3)**
- Gdańsk: reszta pakietu. WP7: reszta Krakowa i Katowic (Dis-Pack EAN, 24 progi, Selgros).
- WP8: reszta Warszawy (PET po 12, przeniesienia biurowe, mop, progi KEN).
- WP2 godziny dostaw. WP13 skrzynki i butle poza Coca-Colą. WP17 zasady zamawiania w aplikacji.

**Fala D — park/V2 (bez kształtowania teraz)**
- WP18 eksport GoStock, WP19 raport strat, WP20 przypomnienia na Telegramie / R-32.
- R-17 dynamiczny target, H-01 (lockfile, pyright, TS strict).

## Etap 6 — Porządki repo (agent, po Etapie 4)

- [ ] 6.1 Archiwizacja: `order-email-v2`, `inventory-card-order`, `transport-pago-mory-combined`,
      `transport-v2`, `krakow-katowice-rollout`, `gdansk-rollout`. `master-data-followups` zastąpi
      lane D, a `supplier-per-location` zostaje zablokowane.
- [ ] 6.2 Usunięcie zmergowanych gałęzi i worktree według listy w `inputs/repo-wip.md` (C).
      Pokażę listę i usunę dopiero po „ok” Bena.
- [ ] 6.3 Mini: odświeżyć klon (241 commitów za main) i wyczyścić worktree po sesjach z 16.10.
- [ ] 6.4 Decyzja D14 dla lane'ów bocznych.

---

## Progress

- [x] Zebranie: sesja z mini 16.10, repo, Wispr, Gmail, sesje laptopa, weryfikacja vs kod (`inputs/`)
- [x] Etap 0 — zabezpieczenie (17.10, PR #63)
- [ ] Etap 1 — Gdańsk
- [ ] Etap 2 — decyzje
- [ ] Etap 3 — pakiet do Marka
- [ ] Etap 4 — weryfikacje operatora
- [ ] Etap 5 — fala A
- [ ] Etap 5 — fala B
- [ ] Etap 5 — fala C
- [ ] Etap 6 — porządki
