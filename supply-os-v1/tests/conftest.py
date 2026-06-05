"""Session-wide pytest bootstrap: settings env BEFORE any app import.

Pydantic settings load ONCE at the first `app.config` import. pytest imports
this conftest before collecting any test module, so setting the auth tokens +
data backend here — at module top level — guarantees they are present whichever
test file pytest imports first. This makes the suite order-independent (see
context/foundation/lessons.md, "Tests must be order-independent").

`setdefault` (not hard set) keeps a real external env able to override, and lets
the legacy per-file `os.environ.setdefault` preambles coexist harmlessly.
"""
import os

os.environ.setdefault(
    "SUPPLY_OS_CAPTAIN_TOKENS", "WOLA:test_wola_token,KEN:test_ken_token"
)
os.environ.setdefault("SUPPLY_OS_MANAGER_TOKEN", "test_manager_token")
os.environ.setdefault("SUPPLY_OS_DATA_BACKEND", "seed")
