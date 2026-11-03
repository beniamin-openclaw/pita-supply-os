# Diagnoza prod — 2026-11-03 (~15:40 UTC)

Źródło: `prod-sql-diagnosis.sql` na prod DB (read-only) + dry-run watchera na prod API.

## Liczby

| Lane | n | najstarsze | śr. wiek |
|---|---|---|---|
| manager_claimed | 66 | 2026-09-21 | 512 h (~21 dni) |
| manager_sent bez odbioru | 105 | 2026-06-16 | 982 h (~41 dni) |

## Rozkład claimed (kto/gdzie)

- **Pago + Mory = 40 z 66** (61%) — Wola 11, KEN 7, Elektrownia 7, Bracka 7, Norblin 4, Browary 4, Westfield 3. Te wiersze NIE mają ref `TRN-` → to nie drafty transportu, tylko realne zamówienia nieoznaczone „wysłane".
- Katowice (SUPERSAM): Selgros 3, Kuchnie 2, Warszawa 2, Coca-Cola 1 = 8.
- Kraków (FORUM): Bukat 1, Kuchnie 1.
- Zewnętrzni warszawscy: CocaCola 6, Filber 6, Intermlecz 1, Bukat 0.

## Sent bez odbioru (105)

Dominują Pago/Mory — transport fizycznie jechał, ale nikt nie potwierdził odbioru w aplikacji. Najstarsze od czerwca. Normalni dostawcy też są (Intermlecz, Bukat, Coca-Cola, Filber, Eurofood, BlueServ).

## Atrybucja — weryfikacja schematu

- `manager_claimed`: pole `manager_user` PUSTE we wszystkich 66 → **nie da się powiedzieć kto przejął**.
- `manager_sent`: `manager_user='manager-default'` we wszystkich 105 → placeholder, nie osoba.
- Wniosek: backlog to problem PROCESU (brak wymuszonego kroku), nie konkretnej osoby. Atrybucja wymaga nowego pola (backlog).

## Bug „same zera z remanentu"

3 zamówienia z wszystkimi liniami = 0: WESTFIELD Mory (closed), BROWARY Pago + BRACKA Pago (oba cancelled 01.10). Wszystkie już rozwiązane — bug nie jest aktywny, ale mechanizm submit-all-zeros istniał.

## Watcher dry-run (prod API, te same dane)

274 potencjalne alerty → `--baseline` je wycisza (cel: zero spamu przy starcie). Po baseline watcher raportuje tylko NOWE zdarzenia.

## Rekomendowane decyzje

1. Baseline + cron watchera na Mini (alerty o NOWYCH zdarzeniach od dziś).
2. Cleanup: claimed>7d → 66 zamówień (próg pokrywa WSZYSTKIE — najnowszy ma 2 dni, więc faktycznie claimed>7d = ~64), sent>30d bez odbioru → ~85 z 105. SQL gotowe, czeka na „leć".
3. Osobny change: auto-'sent' lub flagowany odbiór dla Pago/Mory (trwałe leczenie, nie objęte tu).
4. Pole `claimed_by`/`manager_claimed_at` — backlog, jeśli atrybucja potrzebna.

## WYKONANE 2026-11-03 ~15:55 UTC — sent>7d cleanup (decyzja Bena)

- BEFORE: 71 wierszy `manager_sent` >7d bez odbioru, 9 świeżych (≤7d) zostaje, 25 `TRN-` wykluczone. Suma 105 ✓.
- Wykonano: UPDATE→`closed` + INSERT 71× `order_events.closed_without_receipt` (actor `operator-watchdog`, event_id `OC-<order_id>`), jedna transakcja, COMMIT.
- PO: `manager_sent` = 34 (9 świeżych + 25 TRN), `closed` = 378, events = 71 ✓.
- Rollback dump: `/tmp/order_watch_rollback_dump_2026-11-03.csv` (71 wierszy, statusy+pola anulowania).
- Zostaje: 66 claimed (osobna decyzja) + trwałe obejście Pago/Mory (pkt 3).
