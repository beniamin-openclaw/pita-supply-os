<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: feedback-r4-suppliers-master-data

- **Plan**: context/changes/feedback-r4-suppliers-master-data/change.md (brak formalnego plan.md — baseline = change.md + decyzje operatora z rozmowy)
- **Scope**: całość (ops Supabase + commit b5cb22c)
- **Date**: 2026-07-16
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 5 observations
- **Triage**: 2026-07-16 — F2-F5,F7 FIXED; F1 ACCEPTED; F6 ACCEPTED-AS-RULE (lessons.md)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Success criteria evidence: FE eslint czysty, vitest 83/83, build OK; BE ruff czysty,
pytest 419 passed; audyt DB: 0× min>max, 0× target≠max (135/135 WOLA), Bombilla
spójna, jedyne placeholder-emaile to znane Blue Service + Pago.
Drift: 4/4 punkty intencji MATCH; diff = dokładnie 3 pliki; e-mail/phone/manual
bez zmian behawioralnych; `key={detail.order_id}` resetuje stan potwierdzenia.

## Findings

### F1 — Multi-adresowe pole `to` (Gmail, %2C) niezweryfikowane na żywo

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: suppliers.email (SUP_EUROFOOD, SUP_KUCHNIE) × frontend/src/pages/manager/lib/emailBody.ts:111 × supply-os-v1/app/gmail_url.py:168
- **Detail**: Emaile Eurofood (3 adresy) i Kuchnie Świata (2) zapisane jako string
  rozdzielony przecinkami; oba buildery kodują przecinek jako %2C. Gmail powinien
  rozbić to na wielu odbiorców, ale nie ma na to dowodu w tym wdrożeniu — a projekt
  ma historię cichego niedostarczenia (Blue Service). Jeśli Gmail wziąłby tylko
  pierwszy adres, manager nie zobaczy żadnego sygnału.
- **Fix**: Jednorazowy test ręczny: otworzyć draft Gmail dla Eurofood i sprawdzić,
  że pole Do zawiera 3 odbiorców, zanim pójdzie realne zamówienie.
- **Decision**: ACCEPTED — intencja multi-adresowa potwierdzona przez operatora; weryfikacja pola „Do" przy pierwszym realnym zamówieniu Eurofood

### F2 — 'TBD' nadal przechodzi jako poprawny email (klasa błędu niezamknięta w kodzie)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/manager/DispatchPanel.tsx:211 (`noEmail = !to.trim()`) + supply-os-v1/app/main.py (gate `not supplier.email`)
- **Detail**: Root cause feedbacku ('TBD' jako odbiorca) naprawiono DANYMI dla 4
  dostawców, ale kod dalej uznaje dowolny niepusty string za email. Blue Service
  i Pago wciąż mają 'TBD' — kolejna wysyłka do nich powtórzy cichą utratę zamówienia.
- **Fix**: Walidacja obecności `@`: FE `noEmail = !to.includes("@")` + analogiczny
  gate w backendzie (dispatch email-channel), z komunikatem manager.noEmail.
- **Decision**: FIXED — walidacja "@" w FE (noEmail) + BE (gate dispatchu i gmail_url) + test placeholdera

### F3 — parsePortalUrl nie odcina cudzysłowów/nawiasów końcowych

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/manager/DispatchPanel.tsx:55-59
- **Detail**: Regex kończy URL na białym znaku/`)`, strip tylko `.,;` — notes w formie
  `"https://x.com"` lub `[...]` dałyby zepsuty href. Obecna notka Coca Coli jest czysta.
- **Fix**: Poszerzyć strip o `"'\]}` (jednolinijkowiec).
- **Decision**: FIXED — strip poszerzony o cudzysłowy/nawiasy

### F4 — „Kopiuj listę" znika w kroku potwierdzenia

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/manager/DispatchPanel.tsx (branch confirming)
- **Detail**: W kroku „czy na pewno złożyłeś…" przycisk kopiowania listy jest ukryty —
  manager musi anulować, skopiować i wrócić. Kosmetyka.
- **Fix**: Renderować copyListButton również w branchu confirming.
- **Decision**: FIXED — copyListButton widoczny też w kroku potwierdzenia

### F5 — Martwy klucz i18n manager.markedOrdered (pre-existing)

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/i18n/strings.ts:477
- **Detail**: Klucz bez żadnej referencji w src — sprzed tej zmiany.
- **Fix**: Usunąć lub podpiąć jako toast po „Oznacz jako zamówione".
- **Decision**: FIXED — manager.markedOrdered jako toast dla kanałów nie-emailowych

### F6 — Ops bez formalnego planu (proces)

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: N/A
- **Detail**: Batch master-data poszedł bez plan.md (świadomie — ops przez MCP z
  diff-raportem przed zapisem). Wzorzec diff→apply→verify zadziałał; przy większych
  batchach warto go zachować jako minimum.
- **Fix**: Zapisać jako konwencję (lesson) — „master-data ops: zawsze diff-raport
  przed UPDATE i audyt po".
- **Decision**: ACCEPTED-AS-RULE — „Master-data ops: diff przed, audyt po" w context/foundation/lessons.md

### F7 — Liść Laurowy / Ziele Angielskie: min=max=0,5 opak

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality (dane)
- **Location**: location_product_settings WOLA__P054 / WOLA__P055
- **Detail**: Po zmianie jednostki na opakowania wartości 0,5/0,5 (z CSV, w kg) dają
  sugestię 1 opak z adnotacją „exceeds max by 0.5". Działa, ale mylące.
- **Fix**: SQL: min=1, max=1 (target=1) dla P054/P055 — po potwierdzeniu operatora.
- **Decision**: FIXED — SQL: WOLA__P054/P055 min=max=target=1
