"""Session-wide pytest settings — applied BEFORE any app/config import.

Pydantic settings (``app.config.Settings``) load exactly once, at the first
import of ``app.config`` (often pulled in transitively via ``app.sheets``).
Setting auth tokens + the data backend here — in the single ``conftest.py``
pytest imports before any test module — instead of via per-file
``os.environ.setdefault`` makes the suite order-independent (see
``context/foundation/lessons.md``: "Tests must be order-independent").

It also forces the seed backend AND blanks the Google-Sheets credentials so the
suite NEVER touches the live Google Sheet — and stays insulated from a sheet-mode
``.env`` present in ``supply-os-v1/`` (an env var takes precedence over ``.env``
in pydantic-settings; the creds must be blanked too, else a real
``SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_FILE`` in ``.env`` leaks into
``is_configured()`` unit tests). Tests that exercise the sheet path patch
``sheets.settings`` attributes directly per-test, so these global defaults do
not affect them.

``setdefault`` (not assignment) so a developer can still override any of these
from the real environment when they deliberately want to (e.g. to run a real
integration check).
"""
import os

os.environ.setdefault(
    "SUPPLY_OS_CAPTAIN_TOKENS", "WOLA:test_wola_token,KEN:test_ken_token"
)
os.environ.setdefault("SUPPLY_OS_MANAGER_TOKEN", "test_manager_token")
os.environ.setdefault("SUPPLY_OS_DATA_BACKEND", "seed")
# Blank the live-sheet creds so a sheet-mode .env can't leak into the suite.
os.environ.setdefault("SUPPLY_OS_GOOGLE_SHEET_ID", "")
os.environ.setdefault("SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON_FILE", "")
os.environ.setdefault("SUPPLY_OS_GOOGLE_SERVICE_ACCOUNT_JSON", "")
# Blank Supabase Storage creds so a real .env can't make is_configured() true in
# unit tests (the WZ-photo side-service degrades off when these are empty).
os.environ.setdefault("SUPPLY_OS_SUPABASE_URL", "")
os.environ.setdefault("SUPPLY_OS_SUPABASE_SERVICE_ROLE_KEY", "")
os.environ.setdefault("SUPPLY_OS_SUPABASE_WZ_BUCKET", "wz-photos")
