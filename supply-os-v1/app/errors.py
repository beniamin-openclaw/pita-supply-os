"""Backend-agnostic data-layer errors.

Canonical home for the data-layer exception types so routes and any backend
(Sheets, Supabase, …) can raise or catch them without coupling to one backend
module. ``app.sheets`` re-exports these for back-compat with existing
``sheets.OrderNotFoundError`` references; new backends import from here.
"""


class ConfigDriftError(Exception):
    """Raised when a worksheet's headers don't match the expected schema."""


class OrderNotFoundError(Exception):
    """Raised when an update can't find the order_id (or receipt_id) it targets."""


class OrderAlreadyDispatchedError(Exception):
    """Raised when an update would transition an already-dispatched order back."""


class OrderStatusConflictError(Exception):
    """Raised when an atomic status-transition UPDATE matches 0 rows — the order
    was not in the expected status (a concurrent change won the race). Routes map
    it to HTTP 409. The Supabase backend raises this from a conditional
    ``UPDATE … WHERE status = :expected``; Sheets enforces the same contract via
    each route's preflight re-read + its dispatch guard and never raises it."""
