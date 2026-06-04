# GCP Service Account Setup — Pita Bros Supply OS

Cel: stworzyć Google Cloud Service Account, który nasz backend (FastAPI na
dropletcie) użyje do czytania i pisania do Google Sheeta z danymi pilotu.

**Czas wykonania:** ~10-15 minut, jednorazowo.
**Co potrzebujesz:**
- Konto Google z dostępem do GCP (to samo co używasz dla Drive)
- Sheet ID (już masz: `1jYFQ5ZH07EeLWZ2lEtgNtv0v9DOw0X4A`)
- SSH do dropleta (do ostatniego kroku)

---

## ⚠ KROK 0 — Konwersja xlsx → Google Sheet (WAŻNE, najpierw)

Twój obecny plik to xlsx, NIE Google Sheet. gspread (biblioteka backendu)
**nie obsługuje xlsx**. Musimy go skonwertować.

### Jak skonwertować (5 sekund)

1. Otwórz Sheet: <https://docs.google.com/spreadsheets/d/1jYFQ5ZH07EeLWZ2lEtgNtv0v9DOw0X4A/edit>
2. Menu **File** (Plik) → **Save as Google Sheets** (Zapisz jako Arkusze Google)
3. Otworzy się nowa karta z prawdziwym Google Sheetem
4. Skopiuj NOWY URL — będzie wyglądać:
   `https://docs.google.com/spreadsheets/d/<NOWY_ID>/edit`
5. Daj mi NOWY Sheet ID (ten po `/d/` i przed `/edit`)

### Alternatywa: zmień Drive settings na zawsze

Jeśli chcesz uniknąć tego problemu w przyszłości:
1. Drive → ⚙ Settings → General
2. "Convert uploads" → włącz checkbox
3. Save

Od teraz każdy xlsx wrzucony do Drive auto-konwertuje się na Google Sheet.

---

## KROK 1 — Otwórz GCP Console + wybierz / stwórz projekt

1. Otwórz <https://console.cloud.google.com> (zaloguj się tym samym kontem co używasz dla Drive)
2. **Górny pasek** → kliknij na **nazwę projektu** po lewej obok "Google Cloud" (lub "Select a project" jeśli żadnego jeszcze nie masz)
3. W dropdown'ie:
   - **Jeśli masz już projekt** dla Pita Bros (np. taki, z którego działa OpenClaw / Gmail integration): wybierz ten istniejący — możesz w nim mieć już aktywne API i nie musisz znów płacić za nic.
   - **Jeśli nie masz** lub chcesz osobny: kliknij **NEW PROJECT** (góra po prawej).
     - **Project name:** `Pita Bros Supply OS`
     - **Project ID:** `pita-bros-supply-os` (GCP automatycznie zaproponuje wariant; możesz zostawić)
     - **Organization:** zostaw default (lub `pitabros.pl` jeśli widzisz)
     - **Location:** zostaw default
     - Kliknij **CREATE**
   - Czekaj ~30 sek. aż projekt powstanie. Notification w prawym górnym rogu Ci powie.
4. Po utworzeniu, **wybierz ten projekt** z dropdown'a (jeśli sam się nie wybrał).

**Verification:** górny pasek pokazuje nazwę projektu zamiast "Select a project".

---

## KROK 2 — Enable Google Sheets API

1. Lewy panel (☰ jeśli nie widzisz) → **APIs & Services** → **Library**
2. W search bar wpisz: `Google Sheets API`
3. Kliknij na **Google Sheets API** w wynikach
4. Niebieski przycisk **ENABLE**
5. Czekaj ~10 sek. Strona przeładuje się, pokaże "API enabled" i metryki użycia.

**Verification:** widzisz dashboard "Google Sheets API" zamiast przycisku ENABLE.

---

## KROK 3 — Enable Google Drive API

Powtórz krok 2 dla Drive:

1. Lewy panel → **APIs & Services** → **Library**
2. Search: `Google Drive API`
3. Kliknij wynik → **ENABLE**

(Dlaczego oba? Sheets API daje read/write komórek; Drive API daje sprawdzenie
istnienia pliku po ID — gspread używa obu.)

---

## KROK 4 — Stwórz Service Account

1. Lewy panel → **IAM & Admin** → **Service Accounts**
2. Górny pasek → **+ CREATE SERVICE ACCOUNT**
3. **Step 1 — Service account details:**
   - **Service account name:** `pita-supply-os-sa`
   - **Service account ID:** auto-fill → `pita-supply-os-sa` (zostaw)
   - **Description:** `Backend service account for Pita Bros Supply OS — reads/writes the Wola Pilot Sheet`
   - Kliknij **CREATE AND CONTINUE**
4. **Step 2 — Grant this service account access to project:**
   - **NIE dawaj żadnej roli** — uprawnienia do Sheeta zarządzamy per-file przez Share (krok 7), nie przez project-wide IAM
   - Kliknij **CONTINUE**
5. **Step 3 — Grant users access to this service account:**
   - Pusty (nikt nie potrzebuje impersonate'ować SA)
   - Kliknij **DONE**

**Verification:** w liście Service Accounts widzisz `pita-supply-os-sa` z emailem typu
`pita-supply-os-sa@<project-id>.iam.gserviceaccount.com`.

**Skopiuj ten email** — przyda się w kroku 7.

---

## KROK 5 — Wygeneruj JSON key

1. W liście Service Accounts kliknij na **`pita-supply-os-sa@...`** (otworzy detal)
2. Górny tab **KEYS**
3. **ADD KEY** → **Create new key**
4. Wybierz **JSON** → **CREATE**
5. **Plik JSON automatycznie się pobierze do twojego ~/Downloads**
   - Nazwa typu `pita-bros-supply-os-abc123de456f.json`
6. **🔒 ZAPISZ TEN PLIK BEZPIECZNIE** (1Password / Bitwarden / dedykowany szyfrowany folder)
   - Tego klucza **NIE MOŻNA ponownie pobrać** — jak zgubisz, trzeba wygenerować nowy
   - Każdy kto ma ten JSON może czytać/pisać Twój Sheet

**Verification:** w tabie KEYS widzisz wiersz z typem "JSON" i datą utworzenia.

---

## KROK 6 — Skopiuj email Service Account (jeszcze raz, dla pewności)

Email z kroku 4:

```
pita-supply-os-sa@<project-id>.iam.gserviceaccount.com
```

Skopiuj go. Zaraz wkleisz do Sheet → Share.

---

## KROK 7 — Share Sheet z Service Account

1. Otwórz NOWY Google Sheet (ten po konwersji z kroku 0)
2. Górny prawy róg → niebieski przycisk **Share**
3. W input "Add people, groups, and calendar events":
   - **Wklej email Service Account** (`pita-supply-os-sa@...`)
   - Po prawej dropdown: zmień na **Editor** (writeable, nie tylko Viewer)
4. **WAŻNE: odznacz checkbox "Notify people"** (Service Account nie ma skrzynki, mail by się odbił)
5. Kliknij **Share**

**Verification:** w liście shared w Sheet "Share with people" widzisz email SA z labelką Editor.

---

## KROK 8 — Wklej do `.env` na dropletcie

```sh
ssh root@46.101.213.61
nano /opt/pitabros/supply-os/.env
```

W edytorze zmień te dwie linie:

**Linia 1: Sheet ID** (z kroku 0, NOWY ID po konwersji)

```
SUPPLY_OS_GOOGLE_SHEET_ID=<NOWY_SHEET_ID>
```

**Linia 2: JSON key jako jednolinijkowy string**

JSON key z kroku 5 to plik z newlinami w środku. Trzeba go skonwertować na
jedną linię.

**Metoda A (terminal Mac, najszybsza):**

```sh
# Na swoim Macu, w terminalu (nie SSH):
cat ~/Downloads/pita-bros-supply-os-*.json | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)))" | pbcopy
# JSON jest w schowku
```

Wróć do SSH session na dropletcie, w nano:

```
SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON=<wklej z Cmd+V>
```

**Metoda B (jeśli nie używasz Macowego terminala):**

Otwórz JSON w VS Code → Ctrl+A → kopiuj → wklej do nano. Nano sam zrobi
to jako jedna linia (lub nie — sprawdź czy nie ma `\n` w środku, jeśli są,
metoda A jest pewniejsza).

**Zapisz w nano:** `Ctrl+O`, Enter, `Ctrl+X`.

**NIE restartuj jeszcze service'u.** Czekamy aż Claude wdroży `app/sheets.py`
z obsługą tych env vars (Phase C, ~następne 4-6 godzin Claude'a). Restart
przyjdzie później.

```sh
exit
```

---

## KROK 9 — Verification (po Phase C deploy Claude'a)

Po tym jak Claude wdroży kod Phase C:

```sh
# Z droplet'a:
systemctl restart jarvis-supply-os.service
sleep 3
journalctl -u jarvis-supply-os.service -n 10 --no-pager

# Następnie z laptopa:
curl -H "Authorization: Bearer <MANAGER_TOKEN>" \
  https://supply.46-101-213-61.nip.io/health/internal
# data_backend powinno być "sheet" zamiast "seed"
```

Po pierwszym poprawnym podłączeniu zobaczysz w Sheet'a "Last modified by
`pita-supply-os-sa@...`" gdy backend zrobi pierwszy read.

---

## Gotchas / co może pójść nie tak

| Problem | Diagnoza | Fix |
|---|---|---|
| `gspread.exceptions.SpreadsheetNotFound` | SA nie ma dostępu do Sheeta | Powtórz Krok 7 — share Sheet z SA email |
| `gspread.exceptions.APIError: ... insufficientPermissions` | Sheets API albo Drive API nie enabled | Powtórz Krok 2 i 3 — enable obu API |
| `ValueError: Service account info was not in the expected format` | JSON ma newliny / złą strukturę po paste | Powtórz Krok 8 metodą A (`pbcopy` z Macowego terminala) |
| `gspread.exceptions.APIError: ... quotaExceeded` | Free tier limit (100 read/100s) — mało prawdopodobne dla Wola pilotu | Czekaj 100s, retry; w Phase 2 dodamy cache |
| Sheet nadal pokazuje "xlsx" w mimeType | Krok 0 nie wykonany — backend będzie próbować, gspread rzuci błąd | Zrób Krok 0 — File → Save as Google Sheets |

---

## Co ten Service Account może / nie może

✅ Czytać Twój Sheet (specific ID, NIE inne Sheety)
✅ Pisać do Twojego Sheeta (Editor permission)
✅ Tworzyć nowe wiersze w zakładkach `orders` + `order_lines`
✅ Aktualizować istniejące wiersze (manager dispatch flips status)

❌ Czytać żadnego innego pliku w Twoim Drive
❌ Tworzyć nowych plików w Twoim Drive (default — chyba że dasz mu Drive access)
❌ Dostęp do Gmail, Calendar, czy innych Google services (poza tym co enabled w Step 2-3)
❌ Logować się jako Ty albo Twoja inna user

Zakres jest minimalny — tylko ten konkretny Sheet, tylko ten konkretny SA.

---

## Rotacja klucza (Phase 2+)

Najlepsza praktyka: rotuj JSON key co 90 dni.

```
1. GCP Console → IAM & Admin → Service Accounts → pita-supply-os-sa
2. KEYS tab → Add Key → Create new (JSON) → pobierz nowy
3. Zaktualizuj /opt/pitabros/supply-os/.env z nowym JSON
4. systemctl restart jarvis-supply-os.service
5. Sprawdź że działa
6. KEYS tab → kliknij stary klucz → Delete (revoke)
```

Bezprzerwowa rotacja — service na chwilę używa starego, restart przeładowuje nowy.

---

## Co dalej po wykonaniu wszystkich kroków

1. Powiedz mi: "GCP done, Sheet ID = `<NOWY>`"
2. Ja deployuję Phase C kod (`app/sheets.py` + write endpoints) — ~4-6h
3. Razem testujemy: curl submit → wiersz pojawia się w Sheetcie
4. Frontend (Magic Patterns + Vercel) — Phase D
5. Wola Captain session — Phase E (możesz umówić równolegle z Phase D)
