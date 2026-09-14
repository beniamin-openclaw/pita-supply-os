# Pita Supply OS

Pita Supply OS is Pita Bros' internal supplier-ordering tool. A location **Captain** enters
current stock and submits an order with a visible suggested quantity (stock deficit, rounded to
purchase units); a **Manager** reviews the queue, claims an order, edits or sends it back, and
dispatches it to the supplier. It is not guest- or menu-facing ordering. The app is in production
use across the Pita Bros restaurant network, starting from a single-location, single-supplier
pilot and expanding under a gated rollout (more suppliers, then more locations).

## Dla Captainów i Managerów

Ten system służy do zamawiania towaru u dostawców, a nie do obsługi gości. Kapitan wpisuje aktualny
stan na lokalizacji, widzi podpowiedź ilości do zamówienia razem z wyliczeniem i wysyła zamówienie
do konkretnego dostawcy. Manager widzi zgłoszone zamówienia w kolejce, może je przejąć, poprawić
ilości albo odesłać do Kapitana z komentarzem, a na końcu wysyła zamówienie do dostawcy. Każda
pozycja zamówienia zapisuje, co zasugerował system, co wpisał Kapitan i co zmienił Manager — to jest
podstawa uczenia się i poprawiania danych produktowych.

## Architecture

```
Captain / Manager (browser)
        |
        v
frontend/  React 19 + Vite + Tailwind SPA
        |  same-origin /api/* (Vercel rewrite, see frontend/vercel.json)
        v
supply-os-v1/  FastAPI + Pydantic backend
        |
        v
  _choose_backend()  --  seed CSVs (local dev)
                     --  Google Sheets (legacy production store)
                     --  Supabase Postgres (current production store)
        |
        v
  Supabase Storage  --  WZ goods-receipt photos (private bucket, signed URLs)
```

- **Backend** — `supply-os-v1/`: FastAPI + Pydantic, two-token bearer auth, the suggestion engine,
  and every persistence path routed through a single seam, `_choose_backend()`, so the data store
  can be swapped without touching route code.
- **Frontend** — `frontend/`: React 19 + Vite + Tailwind single-page app; Captain and Manager
  screens, API calls only through `src/apiClient.ts`.
- **Data** — `_choose_backend()` resolves, in order, Supabase Postgres (production), then Google
  Sheets (legacy production store, kept as a fallback), then seed CSVs (local dev and tests,
  in-memory, nothing persisted).
- **File storage** — WZ delivery-note photos captured during goods receiving go to a private
  Supabase Storage bucket; the app only ever mints short-lived signed URLs to view them.
- **Hosting** — backend on Railway, auto-deploying from `main`; frontend on Vercel, with
  `/api/*` rewritten to the Railway backend URL (`frontend/vercel.json`).
- **CI** — GitHub Actions (`.github/workflows/ci.yml`), three jobs: backend (ruff + pytest),
  backend-integration (pytest -m integration against a real Postgres service container), and
  frontend (build + lint + vitest).

## Run locally in seed mode

Seed mode reads master data from CSV files and never touches Google Sheets or Supabase. It needs
no credentials and no `.env` file — every relevant variable is overridden explicitly on the command
line below, so `supply-os-v1/.env` (if you have one) is not read for these variables.

Backend:

```sh
cd supply-os-v1
python3 -c "import fastapi" || python3 -m pip install -e ".[dev]"

SUPPLY_OS_DATA_BACKEND=seed \
SUPPLY_OS_SEED_DIR=../docs/pita-supply-os-v1/seed \
SUPPLY_OS_GOOGLE_SHEET_ID= \
SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON= \
SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_FILE= \
SUPPLY_OS_DATABASE_URL= \
SUPPLY_OS_SUPABASE_URL= \
SUPPLY_OS_SUPABASE_SERVICE_ROLE_KEY= \
SUPPLY_OS_CAPTAIN_TOKENS=WOLA:demo-captain \
SUPPLY_OS_EBIURO_APIKEY= \
  SUPPLY_OS_MANAGER_TOKEN=demo-manager \
python3 -m uvicorn app.main:app --port 8931
```

Verified: `curl -s localhost:8931/health` returns `{"status":"ok", ...}`, and
`curl -s -H "Authorization: Bearer demo-captain" localhost:8931/api/products` returns the seed
product list. `curl -s -H "Authorization: Bearer demo-manager" localhost:8931/health/internal`
returns `"data_backend":"seed"` — confirming the seed backend is active, not Sheets or Supabase.

Frontend (separate terminal; do not start the dev server unless you intend to use it):

```sh
cd frontend
npm ci
VITE_API_URL=http://localhost:8931 npm run dev
```

Open `http://localhost:5173/captain-v2` and sign in with the Captain token `demo-captain`
(location `WOLA`); open `http://localhost:5173/manager` and sign in with the Manager token
`demo-manager`. `npm run build` is the command CI runs and it already passes there.

## Tests & quality gates

![CI](https://github.com/beniamin-openclaw/pita-supply-os/actions/workflows/ci.yml/badge.svg)

```sh
cd supply-os-v1 && python3 -m ruff check . && python3 -m pytest -q
```

668 tests on `main`. A further 21 integration tests exercise the Supabase backend against a real
Postgres instance and run only in CI (`pytest -m integration`); they skip locally without
`SUPPLY_OS_DATABASE_URL`.

```sh
cd frontend && npm run build && npm run lint && npm run test
```

365 tests (Vitest + Testing Library).

`context/foundation/test-plan.md` is the risk-to-test map: it lists the top failure scenarios (a
test dispatching a real order, wrong purchase-unit rounding, a lost edit under concurrent access,
IDOR across roles, wrong transport aggregation, wrong receiving variance) and which tests defend
each one.

## Deploy

The backend runs on **Railway**, configured by `supply-os-v1/railway.toml`, auto-deploying from
`main`, health-checked at `/health`. The frontend runs on **Vercel**, building from `frontend/`
with the `/api/*` rewrite in `frontend/vercel.json` pointed at the Railway backend URL. Production
data lives on **Supabase** — Postgres for orders/inventory (migrations in `supply-os-v1/migrations/`,
applied by the operator) and Storage for WZ photos. The production URL,
https://pita-supply-os.vercel.app, is a token-protected internal tool, not a public site. The
operator runbook for backend deploys is `docs/pita-supply-os-v1/RAILWAY_DEPLOY_RUNBOOK.md`.

## Certification map (10xDevs Builder)

<table>
<tr><th>Requirement</th><th>Where it lives</th></tr>
<tr><td>Access control</td><td>Two-token bearer auth: one Captain token per location, one Manager
token. Backend: <code>supply-os-v1/app/auth.py</code> (<code>require_captain</code>,
<code>require_manager</code>, <code>require_any_auth</code>). Frontend: <code>AuthGate</code>
(<code>frontend/src/AuthGate.tsx</code>) gates the Captain and Manager routes before
rendering.</td></tr>
<tr><td>Create</td><td><code>POST /api/captain/submit</code> — Captain submits a stock-based
order for one supplier.</td></tr>
<tr><td>Read</td><td>Captain: <code>GET /api/captain/orders</code>,
<code>GET /api/captain/order/{order_id}</code>. Manager: <code>GET /api/manager/queue</code>,
<code>GET /api/manager/order/{order_id}</code>.</td></tr>
<tr><td>Update</td><td><code>PATCH /api/captain/order/{order_id}</code> (Captain edit,
pre-claim) and <code>PATCH /api/manager/order/{order_id}</code> (Manager save).</td></tr>
<tr><td>Delete</td><td>Soft cancel, never a hard delete:
<code>POST /api/manager/cancel/{order_id}</code> (single order, with a required reason) and
the transport-level <code>POST /api/manager/transport/cancel</code>. Both record who/when/why
(<code>cancel_reason</code>, <code>cancelled_by</code>, <code>cancelled_at</code>) so every
order stays inspectable — a deliberate audit-trail decision, not a missing feature.</td></tr>
<tr><td>Business logic</td><td>Suggestion engine <code>supply-os-v1/app/suggestion.py</code>:
<code>max(0, target − stock)</code> converted to purchase units under a per-product rounding
rule. Order lifecycle: <code>captain_submitted → manager_claimed → manager_sent →
closed</code> (or <code>cancelled</code>), enforced with atomic expected-status checks.
Transport aggregation combines per-location lines into one supplier dispatch. Deviation
reasons are required past a configured threshold.</td></tr>
<tr><td>Tests &harr; risks</td><td><code>context/foundation/test-plan.md</code> — risk map,
coverage status per risk, and the cookbook for adding new tests.</td></tr>
<tr><td>Documentation</td><td><code>context/foundation/prd.md</code>, <code>roadmap.md</code>,
<code>infrastructure.md</code>, <code>stack-assessment.md</code>, <code>health-check.md</code>,
<code>lessons.md</code>; root <code>AGENTS.md</code> for agent-facing conventions.</td></tr>
</table>

## How this repo is worked on (10x workflow)

Product decisions and their history live under `context/`:

- `context/foundation/` — the standing documents: PRD, roadmap, test plan, infrastructure decision,
  stack assessment, health check, and `lessons.md` (an append-only register of recurring rules,
  re-read by the planning and review steps below).
- `context/changes/` — one folder per change in progress, each with its own `change.md` and
  `plan.md`.
- `context/archive/` — changes that shipped and were closed out; 54 changes archived so far
  (`ls context/archive | wc -l`).

Day-to-day development follows the 10x workflow: `/10x-new` opens a change, `/10x-research` and
`/10x-plan` produce a plan, `/10x-plan-review` checks it, `/10x-implement` builds it,
`/10x-impl-review` checks the result, and `/10x-archive` closes the change out and updates the
roadmap. These are Claude Code skills installed into `.claude/skills/` via
`npx @przeprogramowani/10x-cli get`; the directory is gitignored, so a fresh clone re-installs it
rather than tracking it. `CLAUDE.md` at the repo root is a symlink to `AGENTS.md`, so every agent
(Claude Code, Cursor, Codex) reads the same rules from one file.

## Repository layout

```
supply-os-v1/      FastAPI backend, tests, migrations, Railway config
frontend/          React + Vite + Tailwind SPA
context/           product docs — foundation / changes / archive
docs/              product reference docs (seed data, deploy runbook, design handoff)
.github/workflows/ CI pipeline (ci.yml)
AGENTS.md          agent-facing conventions (CLAUDE.md symlinks here)
```

## Read next

- `AGENTS.md` — hard rules and conventions for anyone (human or agent) changing this repo.
- `context/foundation/prd.md` — product spec: personas, user stories, requirements.
- `context/foundation/roadmap.md` — what shipped, what's next, and why.
- `context/foundation/test-plan.md` — the risk-to-test map referenced above.
