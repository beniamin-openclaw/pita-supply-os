---
change_id: rolki-minima-master-data
title: Rolki per lokal (tabela Sławka) + minima dostawców (arkusz Marka) w prod master data
status: implemented
created: 2026-09-05
updated: 2026-09-05
archived_at: null
---

## Notes

Domknięcie dwóch inputów Marka/Sławka, na które czekała zmiana
`training-feedback-0901` (karty Trello z terminem 2026-09-04):

1. **Rolki per lokal** — mail Sławka „Rolki” z 2026-09-04 08:39
   (slawek@pitabros.pl → Marek@pitabros.pl, DW beniamin@; Gmail thread
   `1a06b92dd784e680`). Ta sama tabela jest w zakładce 1 arkusza:
   https://docs.google.com/spreadsheets/d/19fknN9XAJKnjnK547AKvKLmF08N_lnlAxv5gYN96liI
2. **Minima dostawców** — zakładka 2 tego samego arkusza (Warszawa: Norblin,
   Powiśle/Elektrownia, Wolska, Browary, KEN, Bracka, Westfield).

**Decyzje operatora (2026-09-05):**
- Tabela Sławka jest źródłem nr 1 — wygrywa z raportem Marka z 2025-07-28
  (Bracka 80/20 zamiast 57/20; KEN bez 57/30; Norblin 80/20 zamiast 57/50).
- Progi dla nowych wierszy: kopia z istniejących wierszy rolek w tym samym lokalu.
- Minima: z arkusza Marka.

**Czego NIE ma w źródłach (otwarte):**
- **Taśmy** — ani w mailu, ani w arkuszu. Wciąż zablokowane na inpucie Marka.
- **Pack size rolek** (opak 10 / 6) — nie podane; `purchase_unit` zostaje `szt`.
- Minima dla Pago, Eurofood, Filber, Kamino, Allegro, Selgros — nie w arkuszu.
- **GoGastro — minimum 600 PLN (arkusz Marka)**, ale dostawca nie istnieje w
  systemie (brak katalogu, metody zamawiania, e-maila). Wpisać przy onboardingu
  dostawcy; celowo nie tworzymy zaślepki w `suppliers` (review 2026-09-05).
- Minima dla lokali poza Warszawą — arkusz obejmuje tylko Warszawę, a
  `suppliers.minimum_order_value_pln` jest globalne (bez wymiaru lokalu).
- Lokale „Nocny Market” i „MEZE” z tabeli Sławka nie istnieją w `locations` — pominięte.

### Execution log (2026-09-05)

Applied to prod Supabase in one transaction (`prod-sql.sql`, section 2), after an
independent plan-harden review by Gemini 3.8 Flash (7 findings, all applied — see
`plan.md` "Review"). BEFORE re-check matched the snapshot exactly.

| | BEFORE | AFTER |
|---|---|---|
| products | 175 | 177 (P183 80/20, P184 57/80; P142 57/50 inactive) |
| supplier_products | 243 | 245 (SP_MORY_P183/P184; SP_MORY_P142 inactive) |
| location_product_settings | 1514 | 1516 (+8 / −6) |
| suppliers | 14 | 14 (5 minima: Intermlecz 650, Bukat 500, Cola 500, Kuchnie 600, Blue Service 500) |

Per-location: BRACKA 144, BROWARY 120, KEN 141, NORBLIN 143, WOLA 151, ELEKTROWNIA 111,
STARY_BROWAR 128, SUPERSAM 114, WESTFIELD 107 — all as planned. Audit assertions a–c:
zero rows. Orderable-Mory simulation (same join as `_build_orderable_items`) per active
location returns exactly Sławek's sizes: WOLA 57/20·57/30·80/80, KEN 57/20·80/80,
BROWARY 57/20·57/80·80/80, BRACKA 80/20·80/80·57/80, NORBLIN 80/20·80/80.
Idempotence proven with poisoned probe values (99/999/'probe'): counts unchanged, 0 leaks.

**No deploy involved** — data only; prod reads Supabase.

### Open follow-ups

1. **Taśmy** — still no source (Marek). 2. **Pack size rolek** (opak 10/6) — Marek.
3. **GoGastro 600 PLN** — enter when the supplier is onboarded. 4. Minima outside Warsaw
unknown. 5. Operator eye-check on prod: Bracka inventory shows 3 rolls; Manager chip
for Intermlecz reads against 650. 6. ESTIM thresholds on the 4 new active rows
(BRACKA__P183/P184, BROWARY__P184, NORBLIN__P183) to be verified after the first order
cycle. 7. Tell Sławek/Marek: KEN lost 57/30 (ordered 80 szt on 2026-09-01, cancelled).
