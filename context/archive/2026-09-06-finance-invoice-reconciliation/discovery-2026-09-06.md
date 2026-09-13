# Discovery — raport przyjęć dla finansów + kojarzenie faktur z dostawami

Data: 2026-09-06 (uzupełnione 2026-09-07). Status: opcje spisane, decyzja operatora otwarta,
czeka na feedback z rozmowy z finansami.

## 1. Co już istnieje (zweryfikowane)

### Supply OS (to repo)
- Przyjęcia dostaw GR-01: `receipts` / `receipt_lines` (ilość zamówiona vs odebrana per linia,
  `variance_qty_purchase`, `received_by`, `receipt_date`, `notes`) — `supply-os-v1/migrations/0001_initial_schema.sql:168-198`.
- Zdjęcia WZ: prywatny bucket Supabase `wz-photos`, prefix `wz/<order_id>/<receipt_id>-NN`,
  signed URL 1h, nigdy nie persystowane — `supply-os-v1/app/supabase_storage.py`. Endpointy
  upload/list tylko dla tokenu Kapitana (`main.py` `captain_receipt_photos`); Manager widzi tylko
  licznik zdjęć (`DeliverySection.tsx`), nie same zdjęcia.
- Email: ZERO wysyłki serwerowej. `gmail_url.py` = tylko URL compose. Jedyna ścieżka "prawie
  wysyłki" to frontend OAuth `gmail.compose` tworzący DRAFT z załącznikami (`frontend/src/pages/manager/lib/gmailDraft.ts`).
- Scheduler: brak (Railway = jeden proces `web`, `railway.toml` bez cron). Eksporty: tylko
  `inventoryCsv.ts` (CSV z BOM) i `transportPdf.ts` (pdfmake). Brak XLSX.
- Master data przydatne do kojarzenia: `supplier_products.supplier_product_name`, `supplier_sku`,
  `units_per_purchase_unit`, `price_estimate_pln` (w seedzie 130/154 pozycji), `locations.company_name/company_address/company_nip`.
  BRAK: `suppliers.nip`, encji faktury, ceny zapłaconej, typu dokumentu per zdjęcie, numeru WZ na przyjęciu.
- ROADMAP.md Faza 4 "Forecasting, finance, KSeF" (WZ vs faktura, KSeF ingest, price variance,
  `finance_export` runs) — zaparkowane. GR-01 research (`context/archive/2026-06-09-gr-01/research.md`)
  oceniał 3 mechanizmy wysyłki: smtplib + app password, Gmail API DWD, Resend/SendGrid; zasada
  "mail do księgowej osobno od manager_dispatch"; test guardrail: odbiorcy z env, domyślnie beniamin@.
- `context/foundation/infrastructure.md:101` — otwarta decyzja: 1h signed URL umiera zanim
  księgowa otworzy maila ⇒ załączać bajty albo link re-signowalny.

### JARVIS-CODEX ("integracja z Symfonią")
- `tools/symfonia_ebiuro/` = READ-ONLY klient REST Symfonia eBiuro (`apps.symfonia.pl`, auth
  email+apikey "Klucz 1 / Oprogramowanie księgowe" — NIE regenerować, używa go konektor księgowego).
  Sync codziennie 07:30 na droplecie (`scripts/run_symfonia_ebiuro_weekly.sh`) do SQLite
  `/opt/pitabros/data/ebiuro/ebiuro.db`. Dokumenty state=2 (zweryfikowane): `contractor_nip`,
  `contractor_name`, `doc_type` ("Faktura zakupu", "Korekta zakupu", "Paragon"…), `issue_date`,
  `sell_date`, `payment_deadline`, netto/brutto/vat, `kategoria`, PDF url; pozycje: name, quantity,
  netto, vat. 8 company_id (7 spółek + JDG).
- LUKA: dashboard (`tools/pitabros_ebiuro_dashboard/data.py`) oczekuje schematu v2 z
  `invoice_number`, `ksef_number`, `v2_state`, MPK per pozycja — producenta v2 nie ma w main tree.
  Zweryfikować na droplecie zanim projektować przeciw v2.
- Reguły per dostawca JUŻ SPISANE: `memory/coo-cfo/vendor_mpk_mapping.yaml` (25 dostawców,
  default MPK/lokal, routing po adresie dostawy, `shared-invoice-split`) i
  `memory/coo-cfo/shared_invoice_rules.yaml` (Blue Service: faktura zbiorcza dzielona po numerach
  WZ per lokal; Greek Gourmet: miesięczna zbiorcza na PB ZOO dzielona z danych zamówień; podział
  wykonuje księgowa ręcznie przy księgowaniu). Otwarte pytania księgowe: `memory/coo-cfo/open-questions.md`
  (cut-off faktur między miesiącami, korekty, transport, koszty centralne).
- Braki faktur: wspólny arkusz Google "BRAKI" (Gosia/MJS). Istniejący matcher płatności kartą ↔
  eBiuro: `docs/grok-bot-invoice-coordinator/` (statusy MATCHED_EBIURO / MISSING / …, draft only).
- Zespół finansów (`memory/coo-cfo/finance-team.md`): Małgorzata (finanse@, kontrola faktur, VAT,
  refaktury), Beata (pracuje w Symfonii, taguje MPK na fakturach), Klaudia (faktury intercompany,
  faktury KEN), MJS/Mariusz (zewnętrzna księgowość, księguje w Symfonia FK przez konektor eBiuro),
  Sławek (GoStock). Odbiorcy finansowi znane w repo: finanse@pitabros.pl, fakturymeze@gmail.com,
  gosia@vafidis.pl, klaudia@pitabros.pl.
- Spółki (NIP): PB sp. z o.o. 9522100633 (WOLA, NORBLIN, BROWARY, Supersam, Mokotów, MEZE dark
  kitchen), PB KEN 5223241275, PB Centrum 5223314413 (BRACKA, Elektrownia), PB Poznań 5223311834,
  PB Gdańsk 5223329662, PB Mokotów 5223356334 (Kraków Forum), Greek MEZE 9522104424.
- Gmail: brak service account / DWD w main tree; zasada "outbound = DRAFT, Ben wysyła sam"
  wymuszona w kodzie w kilku miejscach.

### GoStock (analiza `docs/pita-supply-os-v1/analysis/gostock-2026-09-06/`)
- PZ export ręczny z GoPOS/GoStock: Lokalizacja, Produkt, Data, Ilość, Ilość odebrana, Wartość
  netto/brutto — BEZ dostawcy i BEZ numeru faktury. Data PZ może być datą faktury. Ilość ==
  Ilość odebrana w 100% wierszy ⇒ GoStock nie zna niedostaw. 15/40 SKU nigdy nie miało PZ.
  Kto księguje PZ = pytanie otwarte do księgowości.

## 2. Fakty zewnętrzne (zweryfikowane 2026-09-06, ≥2 źródła)
- KSeF obowiązkowy: 1 lut 2026 (>200 mln PLN), 1 kwi 2026 wszyscy pozostali; mikro ≤10 tys.
  PLN/mies. do 1 sty 2027. Do 31 gru 2026: paragon z NIP ≤450 zł = faktura uproszczona, brak kar.
  Schemat FA(3). Offline24 = tryb stały.
- Nabywca może pobierać faktury zakupu przez API 2.0: `POST /invoices/query/metadata`
  (subjectType=Subject2, NIP nabywcy, okno ≤3 mies.), `GET /invoices/ksef/{nr}` XML, bulk export.
  Auth: Token KSeF lub certyfikat (Profil Zaufany nie działa w API). Per NIP ⇒ 7 tokenów.
  Biblioteki: Python `ksef-client` (smekcio), TS `ksef-client-ts`. Pola linii FA(3): P_7 nazwa,
  P_8A jm, P_8B ilość, P_9A cena netto (jednoźródłowe — sprawdzić z XSD).
- Symfonia: KSeF Plus ma automatyczne pobieranie faktur zakupu z KSeF; eBiuro ma API (upload do
  OCR + odczyt); import do FK formatem 3.0 txt; F-K WebAPI PurchaseInvoice (jednoźródłowe).
- GoStock: import faktur TYLKO z XML (FA(3)/KSeF, Comarch, Saldeo, Selgros, Makro…), bez PDF/CSV/
  OCR; ręczne łączenie produktów; API partnerskie zamknięte (partner@gopos.pl).
- Rynek PL AP: SaldeoSMART, Comarch OCR&KSeF, Scanye — OCR + KSeF + obieg; nikt nie reklamuje
  formalnego 3-way match.

## 3. Opcje (spisane w rozmowie 2026-09-06)

| # | Opcja | Co daje finansom | Nakład | Ryzyko |
|---|---|---|---|---|
| 1 | Raport dzienny + Rejestr w Google Sheets | mail ze zdjęciami + XLSX, arkusz do ręcznego rozliczania | ~1 tydz. | dryf arkusza, brak auto-kojarzenia |
| 2 | Moduł Finanse w aplikacji (3. token) | ekran rozliczeń, eksport, audyt | 2–3 tyg. | trzecia rola poza PRD v0 |
| 3 | Kojarzenie z eBiuro | raport niezgodności faktura vs dostawa | ~2 tyg. po 1 | opóźnienie dni, jakość OCR pozycji |
| 4 | KSeF jako źródło | to samo, tego samego dnia, bez OCR | 1–2 tyg. + auth/spółka | 7 tokenów KSeF |
| 5 | GoStock PZ jako 3. noga | lista faktur do importu, brakujące PZ | mały | tylko XML, API zamknięte |

Szczegóły:
- **1**: job 06:30 → per spółka mail na finanse@ (tabela + zdjęcia w załączniku + XLSX) +
  append do arkusza "Rejestr dostaw" (kolumny systemowe append-only, kolumny finansów: nr faktury,
  kwota, status, uwagi — nigdy nie nadpisywane; klucz = receipt_id). Adapter Sheets istnieje.
  Decyzja: nadawca (dedykowana skrzynka systemowa + Gmail API DWD) vs Resend/Postmark.
- **2**: tabele za `_choose_backend()`: supplier_invoices, invoice_receipt_links, photo metadata
  (typ dokumentu). Ekran finansów; arkusz jako lustro.
- **3**: droplet po syncu 07:30 pcha zweryfikowane faktury do tabeli lustrzanej w Supabase;
  silnik w Supply OS: nagłówek (NIP dostawcy + NIP spółki + okno dat + kwota), linie (aliasy nazw/
  SKU, ilość po przeliczeniu jm, cena vs cennik). Suggest-only; potwierdzenia uczą aliasy.
- **4**: ten sam silnik na XML FA(3) pobieranym per spółka; mail/zdjęcia jako fallback dla
  paragonów i mikrodostawców do końca 2026. Sprawdzić czy MJS ma KSeF Plus (auto-download).
- **5**: tygodniowa lista faktur KSeF do importu per lokal dla Sławka + lista SKU bez PZ.

### Profil fakturowania dostawcy (jedna tabela, zasilona z yaml-i w JARVIS-CODEX)
NIP; kanał dokumentu (KSeF / PDF mailem / paragon); częstotliwość (per dostawa / tygodniowa /
miesięczna zbiorcza); granulacja (per lokal / per spółka / jedna faktura dzielona po nr WZ);
okno dat dostawa→faktura; tolerancje ilości i ceny; aliasy nazw + SKU; przelicznik jm; cennik
z datą obowiązywania; czy wymagane zdjęcie dowodu (odbiór własny Pago, zakupy gotówkowe).

### Statusy kojarzenia
dopasowana / częściowa / faktura bez dostawy / dostawa bez faktury po oknie / różnica ilości /
różnica ceny / niezgodność jednostki.

### Dzień docelowy
06:30 raport przyjęć → finanse@ + Rejestr · 07:30 sync eBiuro · 08:00 pobranie KSeF per spółka ·
08:15 kojarzenie + raport niezgodności + kandydaci do BRAKI · Beata potwierdza sugestie; sporna
dostawa = gotowy draft reklamacji (wysyła człowiek) · tygodniowo odchylenia cen do Bena ·
miesięcznie lista dostaw bez faktury per spółka dla MJS (rezerwy).

### Rekomendacja
Faza 1 = opcja 1 + 3 tanie pola na przyjęciu (numer WZ, typ dokumentu per zdjęcie, dostęp
finansów do zdjęć). Faza 2 = profile dostawców + opcja 3. Faza 3 = KSeF. Opcja 2 dopiero gdy
arkusz przestanie wystarczać. Pilot: Blue Service (zbiorcza po WZ), Bukat, Pago (odbiór własny).

### Decyzje operatora (otwarte)
1. Nadawca i mechanizm maila (system sender vs draft-only).
2. Rejestr w Sheets czy od razu moduł w aplikacji.
3. Kto trzyma tokeny KSeF per spółka; czy MJS ma KSeF Plus.
4. Pilotażowi dostawcy.

## 4. Pytania na rozmowę z finansami

**Dziś: obieg faktury zakupu**
1. Gdzie fizycznie ląduje faktura od dostawcy: finanse@, fakturymeze@, biuro@, aliasy lokali,
   portal dostawcy, papier z kierowcą? Które dostawcy jakim kanałem?
2. Kto i jak wrzuca faktury do eBiuro (mail-forward, upload, konektor)? Ile dni od faktury do
   state=2 "zweryfikowana"? Kto weryfikuje OCR pozycji — czy pozycje są w ogóle sprawdzane?
3. Jak Beata taguje MPK: per faktura czy per pozycja? Skąd wie, który lokal (adres dostawy,
   numer WZ, nazwa na fakturze)?
4. Czy i jak dziś porównują fakturę z tym, co przyjechało? Skąd wiedzą o niedostawie / uszkodzeniu?
   Kto reklamuje u dostawcy i jak (mail, telefon)? Jak wygląda korekta.
5. Arkusz BRAKI: co jest w nim wierszem, kto dopisuje, jak zamykają.
6. Faktury zbiorcze (Blue Service po WZ, Greek Gourmet miesięczna, Coca-Cola per adres): jak
   fizycznie dzielą — czy mają numery WZ z faktury pod ręką? Czy WZ przyjeżdża z towarem?
7. Paragony i zakupy gotówkowe (Selgros, Allegro, Makro): kto je zbiera, jak trafiają do księgowości.

**KSeF i Symfonia**
8. Czy spółki mają tokeny/certyfikaty KSeF? Kto jest adminem KSeF per spółka (Ben? MJS?).
9. Czy MJS/Symfonia pobiera faktury zakupu z KSeF automatycznie (KSeF Plus)? Czy numer KSeF
   trafia do eBiuro (pole `ksef_number` w v2)?
10. Czy księgują z eBiuro (konektor) czy z KSeF? Co jest źródłem prawdy dla kwoty i daty.

**GoStock**
11. Kto tworzy PZ w GoStock, z czego (faktura PDF? XML z KSeF?), kiedy (data faktury vs dostawy)?
    Dlaczego 15 SKU nie ma PZ. Czy remanenty są zamykane czy zostają Draft.

**Czego chcą od nas**
12. Raport: codziennie czy tygodniowo? Per spółka czy jeden? Mail + Excel czy arkusz Google
    wspólny? Jakie kolumny są im potrzebne do rozliczenia (nr faktury, kwota netto/brutto, termin
    płatności, status, MPK)?
13. Zdjęcia: załącznik w mailu wystarczy, czy potrzebny trwały link/folder per dostawca/miesiąc?
14. Co uznają za "niezgodność" wartą alertu: ilość, cena vs cennik, brak faktury po N dniach,
    faktura na złą spółkę, faktura bez dostawy? Jakie tolerancje.
15. Cenniki/umowy z dostawcami: gdzie leżą, kto aktualizuje, czy chcą pilnować cen na fakturze.
16. Kto miałby w tym pracować dzień w dzień (Beata?) i ile minut dziennie to może zająć.

## 5. Następne kroki
1. Ben: rozmowa z finansami (pytania wyżej) → feedback dopisać poniżej / do change.md.
2. Potem `/10x-shape` prowadzony punkt po punkcie → shape-notes → PRD delta (FR-025+).
3. Przed opcją 3: sprawdzić na droplecie schemat/producenta v2 w `ebiuro.db`.
4. Przed opcją 4: inwentaryzacja tokenów KSeF per spółka.

## 6. Feedback z rozmowy z finansami
(do uzupełnienia)
