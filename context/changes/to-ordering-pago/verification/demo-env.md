# Demo environment (isolated, 2026-08-22)

- Postgres 16 (Homebrew) w scratchpadzie sesji, port 55432, db `pita_demo` — jednorazowy, ZERO kontaktu z prodem.
- Schemat: migracje 0001, 0003–0007, 0009 (bez 0002/RLS, bez 0008 z innego pasa).
- Dane: pełne master data z seed CSV (154 produkty, 10 dostawców), wagi na 33 SKU Pago/Bukat (2 celowo bez wagi → ostrzeżenie), 15 zamówień z liniami (5 do połączenia, 1 przejęte, 9 historycznych), 2 historyczne transporty: TRN-…-h1st01 (v2, WYSŁANY, kierowca Marek Kowalski / WX 12345) i TRN-…-1eg4cy (legacy, bez nagłówka).
- Start: preview `backend-demo` (uvicorn, backend=supabase→lokalny PG, tokeny: manager `demo-manager`, kapitanowie `demo-wola`/`demo-bracka`/`demo-norblin`/`demo-ken`) + `captain-frontend` (vite :5173).
- Seed script: scratchpad `seed_demo.py` (odtwarzalny; restart bazy = initdb + migracje + skrypt).

Znalezione i naprawione podczas smoke-testu na demo:
1. Zamówienie będące członkiem szkicu wracało na listę „Do połączenia" — drugi create mógł przechwycić marker. Fix: eligible wyklucza `TRN-*`, create pomija z powodem "already in transport …" (+2 testy; suite 527).
2. „Zapisz logistykę" zamykało panel szkicu i kasowało niezapisane edycje macierzy (refresh listy resetował wybór). Fix: `reloadBatchList` bez resetu + `refreshDetail(preserveDrafts)`.

Zweryfikowane na żywo w demo: login manager (auth WŁĄCZONY), lista eligible z danymi, utworzenie szkicu z 1 zamówienia, chip SZKIC, pasek wagi (127.3/700 kg), panel logistyki (zapis kierowcy/auta potwierdzony w DB), macierz edytowalna, przyciski dodaj produkt/lokalizację/wyślij, historyczne transporty (v2 i legacy) na liście.
