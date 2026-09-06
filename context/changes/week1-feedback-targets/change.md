---
change_id: week1-feedback-targets
title: Tydzień 1 Supply OS — feedback kapitanów: targety KEN/Wola, bifteki, powód „zapas do dostawy”, komunikacja
status: implemented
created: 2026-09-06
updated: 2026-09-06
archived_at: null
---

## Notes

Źródło: eksport czatu Connect Teams „Pita Supply OS” (2026-08-28 → 2026-09-06 19:50,
plik `~/Downloads/Pita Supply OS.xlsx`) + odpowiedzi kapitanów na pytania operatora
z 2026-09-06 18:25–18:34 (Khushi 19:49, Tushar 18:48, Uliana 18:40, Ajith 14:25)
+ dane prod Supabase `lpzhphufjwrndfogkfub` (zamówienia, odbiory, inwentaryzacje
1–6.09, master data) sprawdzone 2026-09-06 wieczorem.

Decyzje operatora (2026-09-06, „Zaaplikuj wszystkie zmiany… resztę tak jak
zrozumiałeś”): przyjęte rekomendacje z raportu „Feedback tygodnia 1: decyzje”
(zapisane 1:1 w `plan.md`, sekcja 2). Pilsner ma być na Bracka/Wola/KEN —
potwierdzone, że już jest (commit a3d7013, 2026-09-06 18:15).

Już zrobione dziś w innych zmianach (NIE powtarzać):
- `inventory-confirm-and-history` (a3d7013): ekran „Remanent zapisany” + Historia,
  split gyrosu P176–P179, Corfu Pilsner WOLA/BRACKA/KEN, Spec Food.
- `pack-units-display-mobile-wrap` (9ff1518, zarchiwizowane 21:23): „N szt = M zgrzewek”
  na ekranach zamówień Kapitana/Managera i na inwentaryzacji.

Operator 2026-09-06 ~22:00: „wykonaj plan e2e, post implementation review, poprawki, commit push merge”.

## Wykonane (2026-09-06, 22:00–22:40)

- **Tor A (prod master data):** `prod-sql.sql` odpalony na Supabase prod. UPDATE 22 progów
  (18 KEN, 3 WOLA, 1 BROWARY bifteki-obejście) + INSERT P185 „Gyros kurczak nieścięty”
  (products / SP_INTERNAL_P185 / KEN__P185). AFTER audit: 23 wiersze z notatką, 0 rekordów
  z `min > target`, liczniki 185 / 253 / 1552. BEFORE snapshot (= rollback) w pliku.
- **Tor B (aplikacja):** migracja `0016_reason_code_stock_until_next_delivery.sql`
  zastosowana na prod PRZED kodem (Supabase MCP `apply_migration`, success). Kod:
  `ReasonCode.STOCK_UNTIL_NEXT_DELIVERY` (models.py), unia w `types.ts`, `REASON_CODES`
  w `captain-mp/types.ts`, i18n PL/EN, tabela w `DATA_MODEL.md`. Testy: backend
  `test_submit_deviation_with_stock_until_next_delivery_reason`, FE `reasonCodes.test.ts`
  (3 asercje: każdy kod ma PL+EN, pozycja nowego kodu, OTHER ostatni).
  `/verify`: ruff OK, pytest 644 passed, vitest 365 passed, eslint OK, vite build OK.
- **Tor C:** draft Gmail „Supply OS: 4 pytania po feedbacku kapitanów” w wersjach roboczych
  operatora (id `r-5920679289641500573`), bez odbiorcy — operator wpisuje adres managera.
- **Tor D:** tekst PL+EN w `plan.md` §5; **wysyła operator w poniedziałek** po potwierdzeniu
  bundla na prod (plan §6 pkt 5).

## Post-implementation review (2026-09-06, Fable, self-review po wdrożeniu)

Zakres vs plan: A, B, C dostarczone 1:1; D przygotowane, celowo nie wysłane (decyzja planu).
Nic ponad zakres.

**Sprawdzone i czyste**
- Jedyne miejsca enumerujące kody: `models.py`, `types.ts`, `captain-mp/types.ts`, i18n.
  `OrderLineTable` i `ManagerSuggestionReviewPage` budują klucz `reason.codes.${code}`
  dynamicznie, więc nowy kod renderuje się bez zmian tam. `apiErrors.ts` nie zna kodów.
- Sheets backend zapisuje `reason_code.value` jako tekst, brak walidacji, brak zmian.
- CHECK na prod po migracji: 8 wartości (zweryfikowane `apply_migration` success; CHECK
  odczytany przed migracją z `pg_constraint`, 7 wartości).
- Kolejność wdrożenia zachowana: migracja → kod → (push poniżej).

**Findings**
- **R1 (docs, nie poprawiane):** `DESIGN_HANDOFF.md:285,350` mówi „7 codes” — dokument
  historyczny z fazy projektowej (mockupy MP), nie jest źródłem prawdy; `DATA_MODEL.md`
  zaktualizowany. Zostawić.
- **R2 (do obserwacji):** nowy kod nie ma jeszcze żadnej linii w `order_lines`; jeśli
  po tygodniu kapitani nadal wybierają EVENT dla dostaw wtorkowych, to problem komunikacji
  (D), nie kodu.
- **R3 (odziedziczone, poza zakresem):** `_diff_inventory_lines` / pre-fill FR-017
  nadal ufa jednostce w snapshotcie — tor A′ (ręczna korekta remanentów) jest
  jedynym zabezpieczeniem do wtorku. Kandydat na osobną zmianę: walidacja „stan > 3×max
  → ostrzeżenie o jednostce” na ekranie remanentu.

## Otwarte po tej zmianie
- C-1 waga kartonu bifteki → `prod-sql.sql` sekcja PENDING (upp + powrót targetu w kg).
- C-3 Coca-Cola KEN (faktury + minimum 500) → ewentualna korekta 72/96 → 48/72.
- A′ wtorek rano: snapshoty halloumi KEN/BRACKA/BROWARY, gyros BROWARY (plan §2.5).
- D wysyłka poniedziałek. Archiwum po C-1.
