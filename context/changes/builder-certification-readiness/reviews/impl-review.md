# Impl-review — builder-certification-readiness

> Recenzent: Claude (niezależny subagent impl-review) · Data: 2026-09-13 · Base: `main` · Head: `1401f12` (`cert/builder-readiness`, 22 commity, 64 pliki)

Zakres: plan rev 2 z obiema recenzjami, pełny diff `main...HEAD`, artefakty `ci-cd-code-review`, `ai-review.yml` i composite action. Weryfikacja wykonana, nie deklarowana: testy akcji uruchomione lokalnie bez cache (8/8, ruff czysty), `pytest --collect-only` (668 + 21 integration), `vitest run` (365), istnienie każdej ścieżki, trasy i funkcji cytowanej w README, test-plan §6 oraz tabeli Horizon 3.

## Scorecard

| Wymiar | Ocena | Uwaga |
|---|---|---|
| Plan drift | 8/10 | Fazy 1–4 wykonane; brak 4.6; `.gitignore` szerszy niż w planie |
| 1. Poprawność | 8/10 | Liczby testów, trasy, ścieżki archiwum zgodne; zła liczba archiwów w README |
| 2. Bezpieczeństwo workflow | 8/10 | Uprawnienia, fork guard, maskowanie OK; ryzyko `max_tokens` na ścieżce live |
| 3. Security / higiena | 10/10 | Brak sekretów; `.env`, `sa.json`, GoStock poza diffem |
| 4. Jakość dokumentacji | 7/10 | Jedno przeterminowane zdanie w AGENTS.md, trzy nieaktualne liczby |
| 5. Zgodność z kursem | 7/10 | test-plan zgodny ze schematem, ale 2× za długi; m5l3 bez impl-review w `reviews/` |

## Ustalenia

**F1 · MED · `context/changes/ci-cd-code-review/reviews/` (pusty katalog)** — plan 4.6 i End state 5 wymagają ścieżki m5l3 „requirements → research → plan → implement → impl-review"; recenzja nie została zapisana, Progress 4.6 otwarty. Recenzent kursu szuka tego pliku. Fix: zapisać `reviews/impl-review.md` (może streszczać F4–F5 stąd), odhaczyć 4.6 z SHA.

**F2 · MED · `AGENTS.md:35`** — „no tool or host preference is set yet (decisions pending)" sprzeczne z linią 29 (Railway/Vercel/Supabase) i z End state 3 („no false claims"). Fix: „Hosts: Railway (backend), Vercel (frontend), Supabase (data, storage) — see `context/foundation/infrastructure.md`".

**F3 · MED · `README.md:173`** — „45 changes archived so far (`ls context/archive | wc -l`)"; polecenie zwraca **54**. Fix: 54.

**F4 · MED · `.github/actions/ai-code-review/review.py:158–159`** — `max_tokens: 4000` przy `reasoning.effort: high`; na OpenRouter tokeny rozumowania wchodzą w ten limit, więc pierwszy prawdziwy run może zwrócić ucięty JSON → `ValueError` → `status=error` → brak komentarza i etykiety, czyli brak dowodu Championa. `finish_reason` nie jest sprawdzany. Fix: `max_tokens` 16000 (koszt nadal poniżej 0,02 USD/review), jawny błąd przy `finish_reason == "length"`, opcjonalnie `"reasoning": {"effort": ..., "exclude": true}`.

**F5 · LOW · `.github/workflows/ai-review.yml:84–85`** — `gh api --paginate --jq` zwraca wynik na każdą stronę; PR z >30 komentarzami da wielolinijkowe `$existing` i PATCH z błędną ścieżką (krok upada miękko, komentarz nie jest aktualizowany). Fix: `| tail -n1` albo `--slurp` z filtrem `.[][]`.

**F6 · LOW · `context/foundation/test-plan.md`** — (a) §1–§5 ≈ 1430 słów wobec budżetu schematu 300–600; (b) l. 64: symbol `require_any_auth` w Risk Response Guidance (schemat: bez anchorów kodu); (c) l. 76: dwa foldery w jednej komórce „Change folder" (parser oczekuje jednego); (d) l. 123: `headers=MANAGER` — w testach stałe to `MANAGER_AUTH` / `CAPTAIN_AUTH` / `WOLA_AUTH`; (e) plan 2.1 przewidywał cytowania `interview Q<n>` — brak. Fix: skrócić §2, (b) → „the shared any-role dependency covers it", `captain-bukat-submit` przenieść do §6.1, poprawić nazwy stałych, dodać `interview Q1/Q5` przy ryzyku #4 i w §7.

**F7 · LOW · `context/foundation/health-check.md:205`, `roadmap.md:276`** — „Fix #1 (CI covers the product)": na liście CI to #5 (l. 163); „lessons.md (7 entries)" — jest 13. Fix: #5, 13.

**F8 · LOW · `AGENTS.md:24`, `README.md:77,191`** — port 8901 w AGENTS.md vs 8931 w README; README nie wspomina `ai-review.yml` (layout, sekcja testów); override seed nie zeruje `SUPPLY_OS_EBIURO_APIKEY`, więc przy wypełnionym `.env` sync finansów wyjdzie do eBiuro. Fix: ujednolicić port, jedna linia o advisory AI review, dodać `SUPPLY_OS_EBIURO_APIKEY=` do override.

**F9 · LOW · drift** — `.gitignore:24` ignoruje cały `docs/pita-supply-os-v1/analysis/` (plan: tylko `**/raw/`); `feat/dynamic-target-wola` nie zawiera żadnego pliku analysis. Bezpieczniejsze niż plan, ale nieodnotowane. `supplier-per-location/change.md` → `status: blocked` (plan: tylko adnotacja). Fix: dopisać obie decyzje w `change.md` tej zmiany.

## Zweryfikowane bez uwag

- Workflow: `permissions: {}` na górze, job `contents: read, pull-requests: write, issues: write`; fork guard po `head.repo.full_name`; `::add-mask::` i klucz tylko przez `env`; `continue-on-error` na review / comment / label; ścieżka bez sekretu przechodzi na zielono (unit-test → diff → „AI review skipped" → artefakt `if-no-files-found: ignore`); `${{ github.action_path }}` i `python3` po `setup-python`; `test_review.py` importuje `review` z rootdir repo; brak błędów składni wyrażeń.
- Higiena: `git diff --name-only | grep -iE 'env|sa\.json|analysis'` trafia tylko przeniesiony `demo-env.md` (tokeny demo); żadnych ciągów w kształcie sekretu w dodanych liniach; brak emoji i polskich znaków w artefaktach skill (poza cytatami UI w lessons.md).
- Poprawność: 9 tras CRUD z README istnieje w `main.py`; `require_captain/manager/any_auth` w `auth.py`; `SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_FILE` istnieje w `config.py` (choć nie w `.env.example`); `[dev]` + zależności bazowe zawierają uvicorn; `/captain-v2` i `/manager` w `App.tsx`; wersje w test-plan §4 zgodne z manifestami; 21 funkcji testowych i 4 pliki frontend z §6 istnieją.
- Archiwum: 31 ścieżek `context/archive/...` z roadmapy i 5 folderów §3 istnieją; `complete` = 0 otwartych checkboxów, gr-01 = 9/11 (poprawnie `implementing`); 9 zarchiwizowanych `change.md` ma `status: archived` + `archived_at`; `ls context/changes` = dokładnie 5 pozycji z planu; `wc -l AGENTS.md` = 40.

## Werdykt

**SHIP-WITH-FIXES.** F1–F4 przed otwarciem cert PR (łącznie poniżej 30 min pracy); F5–F9 w tym samym PR albo odnotowane w `reviews/triage.md`.
