---
change_id: bracka-rollout
title: Rollout lokalu Bracka — min/max z CSV, token Captain, kolejka Managera bez hardkodu WOLA
status: archived
created: 2026-08-07
updated: 2026-08-18
archived_at: 2026-08-18T17:40:31Z
---

## Notes

Wprowadzenie punktu **Bracka** do rolloutu (etap „+2 lokalizacje" z PRD). Źródło danych:
`Bracka - Inwentaryzacja - Bracka Min Max.csv` (118 wierszy, dostarczony przez operatora
2026-08-07). Cel operatora: **dzisiaj** Bracka składa zamówienia z pełną funkcjonalnością.

Stan zastany w prod (Supabase, sprawdzony 2026-08-07):

- `locations.BRACKA` istnieje, `active=true`, adres `ul. Bracka 20 / 00-028 Warszawa`,
  spółka `Pita Bros Centrum Sp. z o.o.` + NIP `5223314413` — stopka maila gotowa.
- `location_product_settings` dla BRACKA = **kopia 1:1 z WOLA** (0 różnic na 138 wierszach)
  → CSV operatora jeszcze nie wszedł.
- Brakuje 3 wierszy vs WOLA (141): P139/P140/P141 (miód saszetki, kawa Jacobs, herbata Lipton).

Blocker kodowy: `frontend/src/pages/ManagerPage.tsx:38` — `const LOCATION_ID = "WOLA"`.
Kolejka Managera odpytuje wyłącznie WOLA, więc zamówienia z Bracki nie pojawiłyby się
w panelu. `ManagerQueue` już renderuje `location_id`, `ManagerInventoryPage` ma już filtr
lokalizacji — brakuje go tylko w kolejce zamówień (FR-014: „supplier, location, status").

Decyzje operatora (2026-08-07):

1. Produkty spoza CSV, u dostawców objętych CSV → `min/max/target = 0`; produkcja własna
   (SUP_INTERNAL) i butla gazowa (SUP_KAMINO) zostają jak na WOLA.
2. Pozycje z CSV, których nie ma w systemie (Tacki papierowe, Kubeczki papierowe,
   Odświeżacz Spray, Odświeżacz Patyczki, Corfu Pilsner, Bifteki burgers) → **pomijamy dziś**,
   trafiają na listę follow-up (brak danych: jednostka zakupu, szt./opak., cena).
3. Rolki do kasy: ustawiamy tylko „80 na 80" (1/2); wiersze CSV 57/80 i 80/20 → do potwierdzenia.
