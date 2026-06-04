# Pita Supply OS — Resume State (2026-06-02)

> **Po co ten plik:** trwały punkt wznowienia dla inicjatywy **Pita Supply OS**, odtworzony z konwersacji
> "supply os" (sesja `62f1533a`, lane `romantic-elbakyan` — już zretirowany). Konwersacja nie zaginęła;
> została zarchiwizowana razem z lane'em. Ten dokument jest źródłem prawdy dla "gdzie skończyliśmy" i
> "co dalej", żeby praca szła do przodu niezależnie od tego, która sesja czatu jest otwarta.
>
> **Żywy lane:** worktree `Purchase/.claude/worktrees/pita-supply-os`, branch `claude/supply-os-manager-v2`.

---

## TL;DR — trzy otwarte wątki

| Wątek | Status | Blocker / next |
|---|---|---|
| **Repo hygiene** | ✅ + Krok 5 PR otwarty | Branch `claude/supply-os-manager-v2` wypchnięty na origin (20 commitów); **PR #8 → main** otwarty (NIE zmergowany — czeka na Twoje review). https://github.com/beniamin-openclaw/jarvis-codex/pull/8 |
| **TesterArmy** | ✅ near-term done (2026-06-02) | **4/4 testów ZIELONYCH na prod.** Test Accounts już istnieją (blocker w tym docu był nieaktualny). Deferred: rotacja 2 ujawnionych tokenów + auto-runy na deploy |
| **Manager V2 (Phase G)** | ✅ **WDROŻONY end-to-end (2026-06-02)** | Backend (rsync+restart) + frontend (`vercel --prod`) live. Manager V2 na `/manager`. Carrier block (T-Mobile×nip.io) ominięty przez Vercel same-origin `/api` proxy. User potwierdził login na T-Mobile. Szczegóły: `REMOTE_RUNTIME_STATE.md` |
| **Dane** | 🟡 Ad.1 ✅ (1 defer) / Ad.4 w toku | **Ad.1 (jednostki) ZROBIONY** — 21 komórek + seed, 11 wierszy, ratio-fix usuwa over-order (demo: 9 kg deficyt 11→9). **Critic review** (`CRITIC_REVIEW_2026-06-02.md`) znalazł 1 wiersz pominięty przez audyt: **P015 Halloumi** (`szt`/0.2, critical, target 72) — ODŁOŻONY do potwierdzenia z kapitanem (jednostka + podejrzany target). **Ad.4 (dostawcy):** kontakty dostawców `TBD` (Pago email = blocker pilota); mail do Sławka (`officebropb@gmail.com`) zdraftowany (draft `r7953468460061634060`, NIE wysłany). |

**TesterArmy domknięty (2026-06-02):** 3 authenticated testy odpalone przez REST API → **3/3 PASS** (Captain login, Captain submit-confirm z bezpiecznym back-out = 0 realnych zamówień, Manager dashboard). Public smoke nadal 6/6 → **4/4 testów zielonych na prod**. Następny najszybszy ruch: **Manager V2 deploy** lub **fix jednostek**.

---

## 1. Repo hygiene — ✅ domknięte

- **PR #4** (junior-bro) i **PR #5** — **MERGED** do `main`.
- **Retirement romantic:** PR #3 **CLOSED**, branch `claude/romantic-elbakyan-3d712b` usunięty z origin i lokalnie (Krok 6 ✅). Treść zachowana w archiwum: `docs/archive/romantic-retirement-2026-05-30/` (PR #6).
- **GitHub czysty:** origin branche = `main`, `pita-supply-os`, `junior-bro-phase3`, `infra-claude-dispatch`. Zero romantic. Brak otwartych PR.
- **Krok 5 — PR OTWARTY (2026-06-02):** branch `claude/supply-os-manager-v2` wypchnięty na origin (20 commitów), **PR #8 → main** (https://github.com/beniamin-openclaw/jarvis-codex/pull/8). Backend+frontend już są na prodzie, więc merge to tylko source-of-truth/historia (NIE trigger deployu). Czeka na Twoje review/merge.

## 2. TesterArmy — 🟡 setup w połowie

**Decyzja architektoniczna (zweryfikowana 2026-05-30/31):**
- ❌ **Brak MCP / pluginu Claude Code** (potwierdzone z `docs.tester.army/llms-full.txt` — koryguje wcześniejsze "recovered" badania).
- ✅ **Pełne sterowanie programowe przez REST API** `https://tester.army/api/v1/` (Bearer). Z OpenAPI: `POST /tests`, `GET /tests`, `POST /tests/{id}/runs`, `GET /runs/{id}`, `POST /projects/{id}/memories`, `GET/POST /projects/{id}/credentials`, `POST /groups/{id}/runs` + webhooks.
  - **Zweryfikowane 2026-06-02 (działa):** projekt `frontend` = `7ab9876c-7d88-4563-bf57-3979203354b4`. `GET /tests` wymaga `?projectId=`. `POST /tests/{id}/runs` body opcjonalny → `{runId}`; poll `GET /runs/{id}` (`status`: queued→running→completed; `stepResults[].status`). ⚠️ **Gotcha:** OpenAPI `servers` mówi `/v1`, ale realny prefix to `/api/v1` — używaj `/api/v1`.
- **Wniosek:** Claude może autonomicznie pisać testy, wrzucać Memory, odpalać runy po deployu i czytać wyniki — bez MCP.

**Co już jest w projekcie TesterArmy (`frontend`, id `7ab9876c-…`):**
- **Memory (1):** "Pita Supply OS — structure, routes, auth" (routes, auth-model, Captain/Manager flow, ostrzeżenie o realnych danych).
- **Testy (4):**

  | Test | Kroki | Stan |
  |---|---|---|
  | Public Landing Page – Smoke | 6 | ✅ **przeszedł** (run przez API, 6/6, 55s) |
  | Captain — login + order screen | 4 | ✅ **PASS** (4/4, 51.7s, run `9795acce`) |
  | Captain — submit confirm dialog (safe, backs out) | 7 | ✅ **PASS** (7/7, 70.5s, back-out OK → 0 real orders, run `91cfc68b`) |
  | Manager — dashboard + queue | 4 | ✅ **PASS** (4/4, 44.2s, run `61f5c05c`) |

  (Łącznie 21 kroków — pod limitem free tier 50.)

**~~Blocker — 2 Test Accounts~~ ✅ ROZWIĄZANE (2026-06-02):**
- Oba konta **już istniały** w TesterArmy z poprawnymi labelami: **„Captain test"** (`d551d5de-bf27-453f-a231-929ac77a9b87`) i **„Manager test"** (`b4fc333d-df98-4bc5-95b2-2bcf32f70484`). Ten doc je błędnie raportował jako brakujące — najpewniej dodane po jego spisaniu. Credentials są wypełnione (loginy przeszły w testach).
- 3 authenticated testy odpalone przez REST API → **3/3 PASS** (patrz tabela wyżej). Nie trzeba już żadnego kroku operatora dla near-term.

**⚠️ Bezpieczeństwo (otwarte):**
- 2 tokeny (captain + manager) **zostały ujawnione** w czacie AI TesterArmy → rekomendacja: **zrotować** na droplecie (SSH). Na teraz, bez rotacji, działają obecne tokeny.
- Opcja docelowa: dedykowany **`TESTQA`** test-token (zmiana `SUPPLY_OS_CAPTAIN_TOKENS` / `SUPPLY_OS_MANAGER_TOKEN` w `.env` na droplecie przez SSH) — odłożona.
- Klucz API TesterArmy: trzymany lokalnie w `~/.config/testerarmy/api_key` (chmod 600). **Nigdy do repo.** Można zrotować w dashboardzie (Profile → API Keys).

**Dokumenty TesterArmy (ten folder):**
`TESTERARMY_APP_BRIEF.md` (brief dla ich AI), `TESTERARMY_RESEARCH_RECOVERED.md`, `TESTING_AUTOMATION_PLAN.md`.

## 3. Manager V2 (Phase G) — 🟡 zbudowany, niewdrożony

| Faza | Co | Status |
|---|---|---|
| **G1** | Szkielet dwupanelowy: kolejka + szczegóły zamówienia + tabela linii (read-only) | ✅ done |
| **G2** | Edytowalne „Manager zamawia" + komentarz, **zapis bez wysyłki** | ✅ done |
| **G3** | Dispatch zależny od kanału (email / portal / telefon / manual) + edytowalny podgląd maila + link Gmail (limit 8000 zn.) | ✅ done |
| **G4** | „Zamówione" — historia wysłanych (read-only) | ⏸️ odłożone (ships last) |
| **post-G** | `ordering_url`/`phone` w master data, `delivery_address` w detalu, per-manager auth, okno współbieżności | 📋 backlog (Pareto — gdy zaboli) |

- **Stan:** G1+G2+G3 gotowe, zweryfikowane, zacommitowane na `claude/supply-os-manager-v2` (commity `4c34ff6`, `1c70377`; 196 testów backendu ✓, tsc czyste ✓).
- **Nic nie wdrożone** — wisi na bramce deployu (decyzja świadomie odłożona 2×).
- **Deploy wymaga:** backend najpierw na droplet przez SSH (frontend woła nowy endpoint zapisu + czyta kanał dostawcy). Backend backward-compatible. Runbook: `DROPLET_DEPLOY_RUNBOOK.md`.
- Spec: `MANAGER_V2_SPEC.md`.

## 4. Dane — 🟡 otwarte

- **Ad.1 — fix jednostek (logika sugestii):** zamawiamy w **opakowaniach / sztukach**, nie w kg. Przykłady do poprawienia: Gyros sprzedawany 15/25 kg, ale zamawiany na sztuki; pita: 1 karton = 12 opakowań, 1 opakowanie = 10 szt. Sugestie targetów liczą się błędnie (np. „target 10 szt, stan 1, sugestia 1" zamiast 9). Trzeba przejrzeć wszystkie produkty pod kątem jednostki zamówienia. Audyt: `PRODUCT_UNITS_AUDIT.md`, `CATEGORIES_AND_UNITS.md`.
- **Ad.4 — baza dostawców / mail do Sławka:** uzupełnić master data dostawców.
- Dodatkowo z QA: opcja potwierdzenia „Czy na pewno wysłać?" przed wysyłką + jasny status edytowalności / „ostatnia edycja" widoczny dla kapitana i managera.

---

## Exact next steps (kolejność)

1. ~~Operator dodaje 2 Test Accounts → Claude odpala 3 testy~~ ✅ **DONE 2026-06-02** — konta już istniały, 3/3 authenticated testy PASS (4/4 na prod). Next dla TesterArmy = tylko deferred (rotacja tokenów + auto-runy).
2. **Manager V2 deploy** — backend na droplet (SSH, wg `DROPLET_DEPLOY_RUNBOOK.md`) + frontend, żeby realnie używać bogatego dashboardu. *(większy krok)*
3. **Krok 5** — PR `pita-supply-os → main` (najlepiej razem z deployem Manager V2).
4. **Dane** — tabela „przed→po" jednostek (Ad.1) + baza dostawców (Ad.4).
5. **TesterArmy Phase 2** (opcja) — auto-runy po deployu przez webhook/CI; rotacja tokenów + dedykowany `TESTQA`.

## Kluczowe lokalizacje

- **App live:** https://pita-supply-os.vercel.app (`/captain-v2`, `/captain-v2/orders`, `/manager-v2`).
- **Specy / docs:** `docs/pita-supply-os-v1/` (BRIEF, BUILD_PLAN, DATA_MODEL, DESIGN_HANDOFF, MANAGER_V2_SPEC, DROPLET_DEPLOY_RUNBOOK, ROADMAP, …).
- **Backend:** FastAPI na droplecie (SSH). **Frontend:** React/Vite na Vercel (projekt `pita-supply-os`).
- **Pilot:** 1 dostawca (Pago) × 1 lokalizacja (Wola).
