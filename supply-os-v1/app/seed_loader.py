"""Read seed CSVs from disk into Pydantic models. Local dev backend.

Uses a per-file mtime-aware cache so repeated requests don't re-parse the
CSVs. Hot-reloads when the file changes (useful during the Wola Captain
data-input session when seed values are being refreshed live).
"""
import csv
from pathlib import Path
from typing import Type, TypeVar

from pydantic import BaseModel

from .config import settings
from .models import (
    Location,
    LocationProductSetting,
    Product,
    Supplier,
    SupplierProduct,
)

T = TypeVar("T", bound=BaseModel)

# Capability flag (see ``main._is_persistent``): the seed loader is read-only (no
# write functions), so persistence-gated routes degrade instead of persisting.
SUPPORTS_PERSISTENCE = False

# Cache: { str(path): (mtime_at_read, parsed_rows) }
_cache: dict[str, tuple[float, list]] = {}


def _normalize(raw: dict) -> dict:
    """CSV strings → Python-friendly: empty → None, TRUE/FALSE → bool, strip whitespace."""
    out = {}
    for k, v in raw.items():
        if k is None:
            continue
        v_stripped = v.strip() if isinstance(v, str) else v
        if v_stripped == "":
            out[k] = None
        elif isinstance(v_stripped, str) and v_stripped.upper() in {"TRUE", "FALSE"}:
            out[k] = v_stripped.upper() == "TRUE"
        else:
            out[k] = v_stripped
    return out


def _read(path: Path, model: Type[T]) -> list[T]:
    """Parse a CSV at `path` into a list of `model` instances. No caching."""
    if not path.exists():
        raise FileNotFoundError(f"Seed file missing: {path}")
    with path.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows: list[T] = []
        for raw in reader:
            cleaned = _normalize(raw)
            cleaned = {k: v for k, v in cleaned.items() if v is not None}
            rows.append(model(**cleaned))
        return rows


def _read_cached(path: Path, model: Type[T]) -> list[T]:
    """Read with mtime-aware cache. Returns the cached list on hit."""
    if not path.exists():
        raise FileNotFoundError(f"Seed file missing: {path}")
    key = str(path)
    mtime = path.stat().st_mtime
    cached = _cache.get(key)
    if cached and cached[0] == mtime:
        return cached[1]  # type: ignore[return-value]
    rows = _read(path, model)
    _cache[key] = (mtime, rows)
    return rows


def load_products() -> list[Product]:
    return _read_cached(settings.seed_dir / "products.csv", Product)


def load_suppliers() -> list[Supplier]:
    return _read_cached(settings.seed_dir / "suppliers.csv", Supplier)


def load_locations() -> list[Location]:
    return _read_cached(settings.seed_dir / "locations.csv", Location)


def load_supplier_products() -> list[SupplierProduct]:
    return _read_cached(settings.seed_dir / "supplier_products.csv", SupplierProduct)


def load_location_product_settings() -> list[LocationProductSetting]:
    return _read_cached(
        settings.seed_dir / "location_product_settings.csv",
        LocationProductSetting,
    )
