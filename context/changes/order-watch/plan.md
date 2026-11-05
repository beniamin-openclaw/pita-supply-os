# Plan — order-watch

## Problem (diagnoza ze sweepu 2026-11-03)
Backlog statusów: ~47 zamówień `manager_claimed` nigdy nieoznaczonych `sent` (Pago 22, Mory 13, Filber 4, Cola 4, Kraków 2, Katowice 1, Intermlecz 1 — mail Bena 19.10) + ~70 `sent` bez przyjęcia od czerwca. Skutek: kapitan nie może potwierdzić dostawy, pętla nauki sugestii urwana, zator wraca co tydzień. Brak jakiejkolwiek obserwowalności — nikt nie widzi zatoru, zanim kapitan nie zadzwoni.

## Zakres
**IN:**
1. `supply-os-v1/scripts/order_watch.py` — watcher polling `/api/manager/queue` (manager token, env). Zero nowych zależności (urllib). Eventy vs poprzedni stan (JSON file):
   - `submitted` → Telegram do Bena: „<lokal> złożył zamówienie <dostawca> — N pozycji, dostawa <data>".
   - `sent` → Telegram + propozycja wiadomości na grupę lokalu (draft markdown + e-mail aliasu w danych lokalu, jeśli dostępny w API).
   - `expected today` (delivery date == dziś, status sent/claimed) → poranny digest 08:00 Europe/Warsaw do Bena + draft dla grupy.
   - `stale claimed >24h` / `stale sent >3d` → eskalacja do Bena z nazwą statusu i lokalu (=„kto/gdzie zawinił": claimed-not-sent = menedżer nie kliknął wysyłki; sent-not-received = dostawa/przyjęcie niepotwierdzone).
   - `--once` dla crona; `--dry-run` wypisuje eventy bez wysyłki. Brak tokena Telegrama = tylko log/drafty (degrades off jak supabase_storage).
2. `tests/test_order_watch.py` — zamockowane HTTP (queue + detail), pokrycie: nowy submit, sent, expected-today, stale progi, idempotentność stanu, brak telefonu Telegrama.
3. `context/changes/order-watch/prod-sql-diagnosis.sql` — READ-ONLY: backlog per lokal×status×wiek, atrybucja (claimed_by/status vs sent/received), weryfikacja buga „same zera z remanentu".
4. `context/changes/order-watch/prod-sql-backlog-cleanup.sql` — konwencja porządku: BEFORE odczyt → guard → zmiana → AUDIT → rollback. Próg >7 dni claimed, >30 dni sent-unreceived (parametry, decyzja operatora).
5. `context/changes/order-watch/prod-sql-limit-fixes.sql` — BEFORE/UPDATE/AUDIT: souvlaki KEN karton 5→6 kg, gyros KEN, cola KEN 72/96→48/72, Kamino max 9, gąbki paczka-10 (wartości ze sweepu; każdy UPDATE z komentarzem-źródłem).
6. `context/changes/order-watch/ops-marek-session.md` — jeden arkusz braków: Gdańsk (maile/progi/cena PET/Kropla), Katowice (24 progi, Dis-Pack flow, Bukat→Pago), Wrocław Hala Świebodzki (godziny/dostawcy/progi) + komunikat „Zgłoś problem→Trello" + decision doc `supplier-per-location` (opcje A/B/C).
7. Runbook `context/changes/order-watch/watch-runbook.md` — env, cron (Railway/Mini), token Telegram, dry-run, rollback (skrypt jest additive, wyłączenie = usunięcie crona).

**OUT:** zmiany UI, realny send do Connecteam (brak write-API), deploy, merge na main, zastosowanie SQL na prod (operator+Ben), supplier-per-location implementation.

## Podejście
Watcher zewnętrzny (skrypt), nie wewnątrz FastAPI — żadnych zmian w `main.py`/`_choose_backend()`/`order_lines` (kontrakty prod). Poll API zamiast DB = zero nowych poświadczeń DB poza backendem. State: `watch_state.json` (last_seen per order+event-kind). Timezone Europe/Warsaw dla "dziś"/progi. Teksty PL, krótkie.

## Testy
- Nowe: `tests/test_order_watch.py` (pytest, monkeypatch urllib).
- Regresja: `ruff check .` + pełny `python -m pytest` (skrypt poza app/ nie dotyka ścieżek prod).
- Ręczny: `--dry-run` przeciw seed-dev backend lokalnie przed PR.

## Rollback
Skrypt i docs są additive. Wyłączenie crona = pełny rollback. SQL: każdy blok ma rollback statement w pliku.

## Progress
- [x] lane + research (endpoint `/api/manager/queue` wystarcza; brak nowych endpointów)
- [ ] implementacja watchera + testy
- [ ] artefakty SQL + ops docs
- [ ] verify + PR do review Bena
