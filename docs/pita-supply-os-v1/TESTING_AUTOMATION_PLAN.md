# Testing automation — plan działania (2026-05-30)

Cel: po każdej zmianie/deployu automatycznie wyłapać regresje w Captain i
Manager, niskim kosztem utrzymania, dla małego zespołu. Bez nowego frameworka,
dopóki nie nazwiemy realnego bottlenecku (zasada Pareto z AGENTS.md).

## Co już mamy (i co to łapie)

| Warstwa | Narzędzie | Łapie | Nie łapie |
|---|---|---|---|
| Backend | `pytest` (182 testy, `supply-os-v1/tests/`) | logika API, state machine, auth, sheets paths | UI, realny render, integrację front↔back |
| Frontend typy | `tsc -b` (gate przed deploy) | błędy typów | błędy runtime (TDZ, render crash), regresje wizualne |
| Post-deploy | `scripts/supply_os_frontend_smoke.sh` | 5 route'ów = 200, bundle parsuje, markery i18n obecne | **zero interakcji** — nie klika, nie loguje, nie sprawdza czy modal/flow działa |
| Ręcznie | QA z telefonu + laptopa | realny UX | powtarzalność, czas, dyscyplina; nie skaluje |

**Główna luka:** brak automatycznego, realnego **E2E w przeglądarce** dla
flow'ów interakcyjnych. To właśnie tu wpadały białe ekrany (render crash przy
montowaniu), których smoke heurystyczny nie złapie.

## Flow'y krytyczne do pokrycia (z maszyny stanów)

1. **Captain happy path:** login (token) → wybór dostawcy → wpisanie ilości →
   `Wyślij` → **dialog potwierdzenia F5** → wysłane → status `U menedżera`.
2. **Captain critical warning:** krytyczny produkt z 0/pusto → dialog pokazuje
   ostrzeżenie → `Wyślij mimo to`.
3. **Manager happy path:** `Przejmij` (claim) → `Zamów` → otwiera gmail compose.
4. **Send-back loop:** Manager `Odrzuć do poprawy` (reason) → Captain widzi
   banner → edytuje → resubmit → Manager `Przejmij` → `Zamów`.
5. **i18n toggle** PL/EN nie wywala renderu (regresja z `formatDateTime`).

## Opcje (do decyzji — bez kodu teraz)

- **A. Rozszerzyć bash smoke.** Tanie, ale płytkie — nadal brak interakcji.
  Wartość ograniczona. Odrzucam jako rozwiązanie docelowe.
- **B. Playwright self-hosted w CI.** Realna przeglądarka, darmowe, pełna
  kontrola, wersjonowane w repo. Koszt: utrzymanie testów + obsługa auth +
  trigger (deployujemy przez Vercel CLI, nie git-connected, więc trigger trzeba
  spiąć ręcznie albo przez GitHub Action po deployu). Najlepsze jeśli chcemy
  testy "u siebie" i żeby **Claude pisał/uruchamiał je bezpośrednio**.
- **C. TesterArmy.** AI-authored E2E, hostowane, triggery na PR/Vercel deploy,
  REST API + CLI (+ prawdopodobnie MCP) do sterowania przez Claude. Free tier =
  50 kroków (mało na 5 flow'ów). Koszt: subskrypcja + dane logowania u 3rd
  party (flaga bezpieczeństwa). Szczegóły: `TESTERARMY_RESEARCH_RECOVERED.md`.
- **D. Hybryda.** Playwright dla 2 happy-pathów w CI (deterministyczne,
  darmowe) + TesterArmy jako warstwa AI-eksploracyjna gdy zechcemy szerzej.

## Rekomendacja (fazowo)

- **Faza 0 — done.** pytest + tsc + smoke route'ów. Zostaje jako szybki gate.
- **Faza 1 — najbliższa.** Dodać **2 deterministyczne E2E happy-pathy**
  (Captain submit+dialog, Manager claim+order) w realnej przeglądarce,
  odpalane po deployu. Dwie ścieżki realizacji do wyboru z userem:
  - **1a Playwright** (jeśli chcemy własność + Claude steruje bezpośrednio), albo
  - **1b TesterArmy free/paid eval** (jeśli chcemy AI-authored + triggery z pudełka).
- **Faza 2 — po evaluacji TesterArmy** (gdy wrócisz): rozstrzygnąć B vs C/D dla
  pełnej regresji (wszystkie 5 flow'ów + send-back loop).

## Auth w testach — jak zrobić bezpiecznie (dotyczy każdej opcji)

- Token Bearer kapitana jest wklejany w modal. W testach: trzymać jako **sekret
  CI / zmienną środowiskową**, nigdy w kodzie testu ani w repo.
- **Nie używać prawdziwego produkcyjnego tokenu WOLA** w zewnętrznej platformie.
  Wydzielić **dedykowany test-token / test-location** o minimalnych
  uprawnieniach, rotowalny — żeby wyciek nie dotknął realnych zamówień.
- Manager ma pojedynczy token — ta sama zasada (osobny test-token).

## Decyzja potrzebna od Ciebie (gdy wrócisz)

1. Faza 1: **Playwright (1a)** czy **TesterArmy eval (1b)**?
2. Czy zakładamy dedykowany **test-location + test-tokeny** (potrzebne do każdej
   opcji, robisz to po swojej stronie — ja nie tworzę kont/tokenów).
3. Osobny lane dla testów czy w `claude/pita-supply-os`? (Rekomendacja: osobny
   `claude/supply-os-e2e` gdy zaczniemy pisać testy — to nowy bounded initiative.)
