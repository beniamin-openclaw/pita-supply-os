"""Reconciliation engine for the per-location "Inwentaryzacja" sheets
(change `multi-location-master-data`, Phase A1).

Offline tooling — plain Python, no third-party dependencies, no I/O at import
time. Pure-function core (`parse_sheet`, `normalize_name`, `match_catalog`,
`reconcile`, `render_report`) is imported directly by
`tests/test_reconcile_inventory.py`; the CLI at the bottom wires it to real
files.

Grammar (verified across all 12 downloaded sheets — see
`context/changes/multi-location-master-data/research.md` §2):

  - STOCK rows (dated count sections). Two sub-variants, and the two-column
    "side-by-side" table layout means a single physical line can carry TWO
    independent stock entries (one per half of the table):
      `[Category?] | Supplier | Product | Magazyn | Wydawka | Suma | Jedn. Miary`
  - PRICE-LIST rows (the per-location catalog):
      `idx | Kategoria | Dostawca | Produkt | Ilość | Jedn. Miary |
       [Minimalna ilość | Maksymalna ilość |] jednostka miary | Cena |
       Cena za jednostkę miary | VAT | Wartość`
    The bracketed columns are OPTIONAL — present only in norblin/wolska/forum
    (research §2). Column POSITION is resolved from each sheet's own header
    row (by column name), never hardcoded, so both the 11-column (no
    min/max) and 13-column (with min/max) schemas parse correctly without a
    format flag.

  Westfield's raw capture (`westfield.md`) is a hand-normalized note format,
  not a pipe table: `Section | Supplier | Product | Unit | price...`, with the
  supplier/product cells sometimes carrying a trailing "(...)" annotation
  (e.g. "Bukat (stock sheet: Pago)") that must be stripped before matching.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from typing import Optional

# ---------- Vocabulary (research §2 / proto_parse.py) ----------

SUPPLIERS: set[str] = {
    "Blue Service", "Pago", "Bukat", "Intermlecz", "Selgros", "Kuchnie Świata",
    "Coca Cola Hub", "Eurofood", "Filber Wyspy Piwne", "Kamino", "Pita Bros",
    "Allegro",
}
CATEGORIES: set[str] = {
    "Chłodnia", "Mrożonki", "Produkcja", "Spożywcze", "Napoje", "Wino",
    "Opakowania", "Chemia", "Biurowe", "Gaz", "Alkohol", "Soft drinks",
}
# Unit tokens recognized while scanning stock-row cells for a trailing unit.
# Matched case-insensitively against a cell's stripped text.
_UNIT_TOKENS: set[str] = {
    "kg", "szt", "szt.", "opak", "ltr", "l", "box", "karton", "blok",
    "wiadro", "zgrzewka",
}
# Units treated as equivalent for the unit-mismatch check (case-insensitive
# on both sides already; these are the additional cross-spelling pairs).
_UNIT_EQUIVALENCES: list[set[str]] = [
    {"szt.", "szt"},
    {"ltr", "l"},
]

# Sheet-side supplier display name -> canonical snapshot `supplier_name`, for
# suppliers whose sheet spelling is a genuine alias rather than a different
# real-world supplier (F1, coordinator review 2026-08-21: every location's
# supplier-conflict table was inflated by "Pita Bros" vs the snapshot's
# "Pita Bros (internal production)" — same supplier, cosmetic name only).
# Applied only when comparing a sheet row's supplier against snapshot
# supplier names in `reconcile()` — never in matching/parsing.
SHEET_SUPPLIER_ALIASES: dict[str, str] = {
    "Pita Bros": "Pita Bros (internal production)",
    "Kuchnie Swiata": "Kuchnie Świata",
}

_IDX_RE = re.compile(r"^\d+$")
_TRAILING_PUNCT_RE = re.compile(r"[\s.,;:!?'\"-]+$")
_GLUED_DIGITS_RE = re.compile(r"(?<=[^\d\s])\d+$")
# Polish "ł"/"Ł" (U+0142/U+0141) has no Unicode decomposition — NFKD leaves it
# untouched, unlike ó/ą/ę/ć/ń/ś/ż/ź which decompose into base + combining mark.
# Fold it to plain "l" explicitly before the NFKD accent-strip pass.
_MANUAL_FOLD = str.maketrans({"ł": "l", "Ł": "L"})


# ---------- Data model ----------

@dataclass
class PriceRow:
    category: str
    supplier: str
    product: str
    unit: Optional[str]
    min_qty: Optional[float]
    max_qty: Optional[float]
    price: Optional[float]
    vat: Optional[str]


@dataclass
class StockRow:
    supplier: str
    product: str
    unit: str


@dataclass
class SheetData:
    price_rows: list[PriceRow] = field(default_factory=list)
    stock_rows: list[StockRow] = field(default_factory=list)


@dataclass
class MatchResult:
    matched: dict[str, str] = field(default_factory=dict)
    near_miss: dict[str, str] = field(default_factory=dict)
    unmatched: list[str] = field(default_factory=list)


@dataclass
class Report:
    missing_products: list[dict] = field(default_factory=list)
    supplier_conflicts: list[dict] = field(default_factory=list)
    dual_supplier_in_sheet: dict[str, list[str]] = field(default_factory=dict)
    stock_vs_pricelist_conflicts: list[dict] = field(default_factory=list)
    unit_mismatches: list[dict] = field(default_factory=list)
    minmax_coverage: dict = field(default_factory=dict)
    near_misses: dict[str, str] = field(default_factory=dict)
    # Sheet product names carrying no min/max (either bound is missing) —
    # separate from `missing_products` (which is about catalog matching, not
    # threshold coverage). Used by the operator gap list.
    no_minmax_products: list[str] = field(default_factory=list)


# ---------- normalize_name ----------

def normalize_name(s: str) -> str:
    """Casefold + strip accents + collapse whitespace + strip a digit run
    glued to the LAST word (never to a standalone numeric token — "Rolki do
    kasy 57 na 20" keeps its numbers; "Liść Laurowy2" loses the "2").

    Basis for all catalog matching in this module.
    """
    if not s:
        return ""
    decomposed = unicodedata.normalize("NFKD", s.translate(_MANUAL_FOLD))
    no_accents = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    folded = no_accents.casefold()
    collapsed = re.sub(r"\s+", " ", folded).strip()
    collapsed = _TRAILING_PUNCT_RE.sub("", collapsed).strip()
    if not collapsed:
        return collapsed
    tokens = collapsed.split(" ")
    last = tokens[-1]
    if last and not last.isdigit():
        stripped = _GLUED_DIGITS_RE.sub("", last)
        if stripped:
            tokens[-1] = stripped
        else:
            tokens.pop()
    return " ".join(t for t in tokens if t)


# ---------- Levenshtein (small, inline — near-miss detection only) ----------

def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        cur = [i] + [0] * len(b)
        for j, cb in enumerate(b, start=1):
            cost = 0 if ca == cb else 1
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
        prev = cur
    return prev[-1]


# ---------- match_catalog ----------

_PAREN_RE = re.compile(r"\([^)]*\)")


def _strip_parenthetical(s: str) -> str:
    """Remove "(...)" annotations and collapse the resulting whitespace —
    e.g. "frytki aviko (opakowania)" -> "frytki aviko". `normalize_name`
    deliberately does NOT do this (parens are ordinary characters to it);
    this is a narrower helper used only for the token-subset near-miss
    check below."""
    return re.sub(r"\s+", " ", _PAREN_RE.sub("", s)).strip()


def _numeric_tokens_conflict(name_tokens: set[str], cand_tokens: set[str]) -> bool:
    """True when both sides carry pure-digit tokens that are NOT identical —
    signals a genuinely different size/quantity variant (e.g. "80" vs "20"
    in "Rolki do kasy 80 na 20" vs "...80 na 80"), not a naming/spelling
    variant. Shared by both near-miss mechanisms in `match_catalog` (plain
    edit-distance and `_token_subset_candidate`) — a low edit distance alone
    is not enough to rule this out, since e.g. "20" -> "80" is a single
    character substitution."""
    name_nums = {t for t in name_tokens if t.isdigit()}
    cand_nums = {t for t in cand_tokens if t.isdigit()}
    return bool(name_nums) and bool(cand_nums) and name_nums != cand_nums


def _token_subset_candidate(norm: str, catalog: dict[str, str]) -> Optional[str]:
    """Token-subset near-miss (plan.md: "edit distance <= 2 OR token-subset";
    dropped from the original brief — F2, coordinator review 2026-08-21).

    Catches a sheet name that's a trimmed variant of a catalog entry once its
    parenthetical annotation is stripped — e.g. "Frytki Aviko" vs catalog
    "Frytki Aviko (opakowania)", "Pita" vs "Pita (opakowania) szt 10", "Oliwa
    z Oliwek Extra Virgin 1L" vs "Oliwa z Oliwek 1L" (subset in either
    direction). Never auto-linked — same as the edit-distance near-miss, this
    only decides `near_miss` vs `unmatched`.

    Two guards keep it from dragging in a genuinely different product:
      - a single shared token only counts when it is >= 4 chars (blocks
        short/generic-word coincidences);
      - if BOTH sides carry pure-digit tokens, those digit sets must be
        IDENTICAL — otherwise this is a different size/quantity variant, not
        a naming variant (e.g. "Rolki do kasy 80 na 20" must NOT near-miss
        onto "Rolki do kasy 80 na 80" just because "80" is shared while "20"
        vs the candidate's second "80" differ).
    """
    name_tokens = set(norm.split())
    if not name_tokens:
        return None
    best_pid: Optional[str] = None
    best_shared = 0
    for cand_norm, cand_pid in catalog.items():
        cand_tokens = set(_strip_parenthetical(cand_norm).split())
        if not cand_tokens:
            continue
        if not (name_tokens <= cand_tokens or cand_tokens <= name_tokens):
            continue
        shared = name_tokens & cand_tokens
        if len(shared) >= 2:
            pass
        elif len(shared) == 1 and len(next(iter(shared))) >= 4:
            pass
        else:
            continue
        if _numeric_tokens_conflict(name_tokens, cand_tokens):
            continue
        if len(shared) > best_shared:
            best_shared = len(shared)
            best_pid = cand_pid
    return best_pid


def match_catalog(names: list[str], catalog: dict[str, str]) -> MatchResult:
    """Bucket `names` (raw sheet product strings) against `catalog`
    (normalized name -> product_id).

    NEAR-MISSES ARE NEVER AUTO-LINKED: a name within edit distance <= 2 of a
    catalog entry (on normalized forms), OR a token-subset match once a
    parenthetical annotation is stripped (`_token_subset_candidate`), but not
    exactly equal, lands in `near_miss` (report material for a human call),
    never in `matched`.
    """
    result = MatchResult()
    seen: set[str] = set()
    for name in names:
        if name in seen:
            continue
        seen.add(name)
        norm = normalize_name(name)
        pid = catalog.get(norm)
        if pid is not None:
            result.matched[name] = pid
            continue
        name_tokens = set(norm.split())
        best_pid: Optional[str] = None
        best_dist: Optional[int] = None
        for cand_norm, cand_pid in catalog.items():
            d = _levenshtein(norm, cand_norm)
            if d <= 2 and (best_dist is None or d < best_dist):
                # A single-character edit can still be a genuinely different
                # size/quantity variant (e.g. "...na 20" vs "...na 80") —
                # the same numeric guard as `_token_subset_candidate` applies
                # here too, not just to the token-subset mechanism.
                if _numeric_tokens_conflict(name_tokens, set(cand_norm.split())):
                    continue
                best_dist = d
                best_pid = cand_pid
        if best_pid is None:
            best_pid = _token_subset_candidate(norm, catalog)
        if best_pid is not None:
            result.near_miss[name] = best_pid
        else:
            result.unmatched.append(name)
    return result


# ---------- Cell helpers (pipe-table grammar) ----------

def _cells_of(line: str) -> list[str]:
    """Split a markdown pipe-table row into cells.

    Only the OUTER boundary pipes produce a spurious leading/trailing empty
    string (exactly one each, since every row starts and ends with "|"); an
    interior blank cell (e.g. the unnamed idx-column header) is a genuine
    empty string and must be PRESERVED so header and data rows stay
    index-aligned. Do not loop-strip — that would eat real blank columns.
    """
    parts = [c.strip() for c in line.split("|")]
    if parts and parts[0] == "":
        parts = parts[1:]
    if parts and parts[-1] == "":
        parts = parts[:-1]
    return parts


def _to_float(raw: Optional[str]) -> Optional[float]:
    """Polish-decimal-comma string -> float. Tolerates garbage (`\\#REF\\!`,
    blank, non-numeric) by returning None rather than raising."""
    if not raw:
        return None
    s = raw.strip()
    if not s:
        return None
    if s.endswith("zł"):
        s = s[:-2].strip()
    # Thousands separator in the real sheets is sometimes a non-breaking
    # space (U+00A0), e.g. "2\xa0881,10 zł" — `\s` matches it, plain " "
    # replace() would not and silently drops any price >= 1000 to None.
    s = re.sub(r"\s", "", s).replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def _index_map(cells: list[str]) -> dict[str, int]:
    """First-occurrence column-name -> index map for a header row."""
    idx_map: dict[str, int] = {}
    for i, c in enumerate(cells):
        if c and c not in idx_map:
            idx_map[c] = i
    return idx_map


def _get(cells: list[str], header_map: dict[str, int], name: str) -> str:
    idx = header_map.get(name)
    if idx is None or idx >= len(cells):
        return ""
    return cells[idx] or ""


def _is_price_header(cells: list[str]) -> bool:
    # "Dostawca" is NOT required: at least one real sheet (elektrownia) ships
    # a price-list header with a genuinely blank cell in the supplier-column
    # position (the data rows still carry a supplier name there) — see
    # `_resolve_supplier_index`. "Kategoria" + "Produkt" + "Cena" together is
    # still specific enough to never false-positive on a stock-section header
    # (stock headers never carry a "Cena" column).
    return "Kategoria" in cells and "Produkt" in cells and "Cena" in cells


def _resolve_supplier_index(header_map: dict[str, int]) -> Optional[int]:
    """Column index of the supplier cell in a price-list data row.

    Normally the named "Dostawca" column. When the header's supplier cell is
    blank (elektrownia — the label is simply missing even though the data
    rows carry a real supplier name there), fall back to the single column
    sitting between "Kategoria" and "Produkt".
    """
    if "Dostawca" in header_map:
        return header_map["Dostawca"]
    kat = header_map.get("Kategoria")
    prod = header_map.get("Produkt")
    if kat is not None and prod is not None and prod == kat + 2:
        return kat + 1
    return None


def _extract_price_row(cells: list[str], header_map: dict[str, int]) -> Optional[PriceRow]:
    supplier_idx = _resolve_supplier_index(header_map)
    supplier = cells[supplier_idx] if supplier_idx is not None and supplier_idx < len(cells) else ""
    supplier = supplier or ""
    product = _get(cells, header_map, "Produkt")
    if not supplier or not product:
        return None
    category = _get(cells, header_map, "Kategoria")
    # "jednostka miary" (the unit repeated next to price) is the more
    # specific column; "Jedn. Miary" (the Ilość unit) is the only one present
    # on sheets without min/max (research §2).
    unit = _get(cells, header_map, "jednostka miary") or _get(cells, header_map, "Jedn. Miary")
    min_raw = _get(cells, header_map, "Minimalna ilość")
    max_raw = _get(cells, header_map, "Maksymalna ilość")
    price_raw = _get(cells, header_map, "Cena")
    vat_raw = _get(cells, header_map, "VAT")
    return PriceRow(
        category=category,
        supplier=supplier,
        product=product,
        unit=unit or None,
        min_qty=_to_float(min_raw),
        max_qty=_to_float(max_raw),
        price=_to_float(price_raw),
        vat=vat_raw or None,
    )


def _looks_like_unit(cell: str) -> bool:
    return cell.strip().casefold() in _UNIT_TOKENS


def _extract_stock_rows(cells: list[str]) -> list[StockRow]:
    """Scan every cell position for a (Category?, Supplier, Product) triple.

    Scanning the WHOLE cell list (not just cells[0:2]) is what makes this one
    routine handle all three stock-row shapes seen in the real sheets: a
    plain `Supplier | Product | ... | Unit` row, a `Category | Supplier |
    Product | ...` row, AND the two-column "side-by-side" table where a
    single physical line concatenates two independent stock entries — the
    prototype parser only ever looked at the left half and silently dropped
    the right column's data (see reconcile_inventory report-back notes).
    """
    rows: list[StockRow] = []
    n = len(cells)
    i = 0
    while i < n:
        cell = cells[i]
        supplier: Optional[str] = None
        product_idx: Optional[int] = None
        if cell in CATEGORIES and i + 1 < n and cells[i + 1] in SUPPLIERS:
            supplier = cells[i + 1]
            product_idx = i + 2
        elif cell in SUPPLIERS:
            supplier = cell
            product_idx = i + 1
        if supplier is not None and product_idx is not None and product_idx < n:
            product = cells[product_idx]
            if product and product not in CATEGORIES and product not in SUPPLIERS and len(product) > 2:
                unit = ""
                for j in range(product_idx + 1, n):
                    nxt = cells[j]
                    if nxt in SUPPLIERS or nxt in CATEGORIES:
                        break
                    if _looks_like_unit(nxt):
                        unit = nxt
                        break
                rows.append(StockRow(supplier=supplier, product=product, unit=unit))
                i = product_idx + 1
                continue
        i += 1
    return rows


def _parse_pipe_table(text: str) -> SheetData:
    price_rows: list[PriceRow] = []
    stock_rows: list[StockRow] = []
    header_map: Optional[dict[str, int]] = None
    seen_price_keys: set[tuple[str, str]] = set()

    for line in text.split("\n"):
        if "|" not in line:
            continue
        cells = _cells_of(line)
        if not cells:
            continue
        if _is_price_header(cells):
            header_map = _index_map(cells)
            continue
        if header_map is not None and cells[0] and _IDX_RE.match(cells[0]):
            row = _extract_price_row(cells, header_map)
            if row is not None:
                key = (row.supplier, normalize_name(row.product))
                if key not in seen_price_keys:
                    seen_price_keys.add(key)
                    price_rows.append(row)
                continue
        stock_rows.extend(_extract_stock_rows(cells))

    return SheetData(price_rows=price_rows, stock_rows=stock_rows)


# ---------- Westfield secondary parser ----------

_WESTFIELD_LINE_RE = re.compile(
    r"^\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*$"
)
_WESTFIELD_PRICE_RE = re.compile(r"^-?[\d\s]+,\d+")


def _clean_westfield_field(raw: str) -> str:
    """Strip a trailing "(...)" annotation, e.g. "Bukat (stock sheet: Pago)"
    -> "Bukat", "Rucola 125 gr (stock sheet: \"Rucola 500gr\")" -> "Rucola
    125 gr". Westfield's raw capture carries these notes inline (research
    §2); they are not part of the real supplier/product name."""
    idx = raw.find(" (")
    if idx != -1:
        return raw[:idx].strip()
    return raw.strip()


def _parse_westfield(text: str) -> SheetData:
    price_rows: list[PriceRow] = []
    seen: set[tuple[str, str]] = set()
    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        m = _WESTFIELD_LINE_RE.match(line)
        if not m:
            continue
        category_raw, supplier_raw, product_raw, unit_raw, price_raw = m.groups()
        supplier = _clean_westfield_field(supplier_raw)
        product = _clean_westfield_field(product_raw)
        unit = unit_raw.strip() or None
        price_match = _WESTFIELD_PRICE_RE.match(price_raw)
        price = _to_float(price_match.group(0)) if price_match else None
        key = (supplier, normalize_name(product))
        if key in seen:
            continue
        seen.add(key)
        price_rows.append(
            PriceRow(
                category=category_raw.strip(),
                supplier=supplier,
                product=product,
                unit=unit,
                min_qty=None,
                max_qty=None,
                price=price,
                vat=None,
            )
        )
    return SheetData(price_rows=price_rows, stock_rows=[])


def _looks_like_westfield(text: str) -> bool:
    """True when no non-blank, non-comment line starts with "|" — westfield's
    raw capture is a plain "Section | Supplier | Product | Unit | price" note
    format, not a markdown pipe table."""
    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("|"):
            return False
    return True


def parse_sheet(text: str, fmt: str = "auto") -> SheetData:
    """Parse one sheet's raw text into price-list + stock rows.

    `fmt`: "auto" (default) picks the westfield note-format parser when the
    text has no pipe-table rows, else the standard grammar; "pipe_table" or
    "westfield" force one or the other.
    """
    if fmt == "auto":
        fmt = "westfield" if _looks_like_westfield(text) else "pipe_table"
    if fmt == "westfield":
        return _parse_westfield(text)
    if fmt == "pipe_table":
        return _parse_pipe_table(text)
    raise ValueError(f"unknown fmt: {fmt!r}")


# ---------- Snapshot ----------

_PRODUCTS_COLUMNS = [
    "product_id", "product_name_pl", "product_category", "inventory_unit",
    "is_critical", "active",
]
_SUPPLIERS_COLUMNS = ["supplier_id", "supplier_name", "ordering_method", "active", "email_is_null"]
_LOCATIONS_COLUMNS = [
    "location_id", "location_name", "city", "active", "settings_count", "orders_count",
]
_SUPPLIER_PRODUCTS_COLUMNS = [
    "supplier_product_id", "supplier_id", "product_id", "purchase_unit",
    "units_per_purchase_unit", "rounding_rule", "price_estimate_pln", "active",
]
_LOCATION_PRODUCT_SETTINGS_COLUMNS = [
    "location_id", "product_id", "min", "max", "target",
    "is_critical_for_location", "allow_over_max",
]


def _load_rows(path: pathlib.Path, columns: list[str]) -> list[dict]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return [dict(zip(columns, row)) for row in raw]


@dataclass
class Snapshot:
    products: list[dict] = field(default_factory=list)
    suppliers: list[dict] = field(default_factory=list)
    locations: list[dict] = field(default_factory=list)
    supplier_products: list[dict] = field(default_factory=list)
    location_product_settings: list[dict] = field(default_factory=list)

    @property
    def catalog(self) -> dict[str, str]:
        """normalized product name -> product_id, active products only."""
        return {
            normalize_name(p["product_name_pl"]): p["product_id"]
            for p in self.products
            if p.get("active", True)
        }

    @property
    def product_by_id(self) -> dict[str, dict]:
        return {p["product_id"]: p for p in self.products}

    @property
    def supplier_name_by_id(self) -> dict[str, str]:
        return {s["supplier_id"]: s["supplier_name"] for s in self.suppliers}

    def suppliers_for_product(self, product_id: str) -> set[str]:
        """Supplier NAMES (not ids) carrying `product_id` per supplier_products."""
        names = self.supplier_name_by_id
        return {
            names.get(sp["supplier_id"], sp["supplier_id"])
            for sp in self.supplier_products
            if sp["product_id"] == product_id
        }

    @classmethod
    def load(cls, snapshot_dir: str) -> "Snapshot":
        base = pathlib.Path(snapshot_dir)
        return cls(
            products=_load_rows(base / "products.json", _PRODUCTS_COLUMNS),
            suppliers=_load_rows(base / "suppliers.json", _SUPPLIERS_COLUMNS),
            locations=_load_rows(base / "locations.json", _LOCATIONS_COLUMNS),
            supplier_products=_load_rows(
                base / "supplier_products.json", _SUPPLIER_PRODUCTS_COLUMNS
            ),
            location_product_settings=_load_rows(
                base / "location_product_settings.json",
                _LOCATION_PRODUCT_SETTINGS_COLUMNS,
            ),
        )


# ---------- reconcile ----------

def _units_equivalent(a: Optional[str], b: Optional[str]) -> bool:
    if a is None or b is None:
        return True  # nothing to compare — not a mismatch
    fa, fb = a.strip().casefold(), b.strip().casefold()
    if fa == fb:
        return True
    for group in _UNIT_EQUIVALENCES:
        if fa in group and fb in group:
            return True
    return False


def reconcile(sheet: SheetData, snapshot: Snapshot) -> Report:
    catalog = snapshot.catalog
    product_names = [r.product for r in sheet.price_rows]
    match = match_catalog(product_names, catalog)

    # ---- missing_products: no catalog candidate at all (hard gap) ----
    # A near-miss name already has a candidate — it is surfaced separately
    # via `near_misses` (and the operator gap list's own near-miss section)
    # and is deliberately EXCLUDED here. Counting it in both places would
    # double-book the same finding and hide the effect of a near-miss fix
    # (e.g. F2's token-subset match) actually resolving a name to a soft
    # candidate instead of a hard gap.
    missing_names = set(match.unmatched)
    missing_products: list[dict] = []
    seen_missing: set[tuple[str, str]] = set()
    for row in sheet.price_rows:
        if row.product in missing_names:
            key = (row.supplier, row.product)
            if key in seen_missing:
                continue
            seen_missing.add(key)
            missing_products.append(
                {"product": row.product, "category": row.category, "supplier": row.supplier}
            )
    missing_products.sort(key=lambda d: (d["product"], d["supplier"]))

    # ---- price-list supplier sets per matched product_id ----
    price_suppliers_by_pid: dict[str, set[str]] = {}
    price_suppliers_by_display: dict[str, set[str]] = {}
    display_name_by_norm: dict[str, str] = {}
    for row in sheet.price_rows:
        norm = normalize_name(row.product)
        display_name_by_norm.setdefault(norm, row.product)
        price_suppliers_by_display.setdefault(display_name_by_norm[norm], set()).add(row.supplier)
        pid = match.matched.get(row.product)
        if pid is not None:
            price_suppliers_by_pid.setdefault(pid, set()).add(row.supplier)

    # ---- supplier_conflicts ----
    supplier_conflicts: list[dict] = []
    seen_conflict: set[tuple[str, str]] = set()
    for row in sheet.price_rows:
        pid = match.matched.get(row.product)
        if pid is None:
            continue
        snapshot_suppliers = snapshot.suppliers_for_product(pid)
        if not snapshot_suppliers:
            continue
        resolved_supplier = SHEET_SUPPLIER_ALIASES.get(row.supplier, row.supplier)
        if resolved_supplier not in snapshot_suppliers:
            key = (pid, row.supplier)
            if key in seen_conflict:
                continue
            seen_conflict.add(key)
            supplier_conflicts.append(
                {
                    "product_id": pid,
                    "product": row.product,
                    "sheet_supplier": row.supplier,
                    "snapshot_suppliers": sorted(snapshot_suppliers),
                }
            )

    # ---- dual_supplier_in_sheet (substitutes) ----
    grouped_suppliers_by_norm: dict[str, set[str]] = {}
    for name, sups in price_suppliers_by_display.items():
        norm = normalize_name(name)
        grouped_suppliers_by_norm.setdefault(norm, set()).update(sups)
    dual_supplier_in_sheet: dict[str, list[str]] = {
        display_name_by_norm[norm]: sorted(sups)
        for norm, sups in grouped_suppliers_by_norm.items()
        if len(sups) >= 2
    }

    # ---- stock_vs_pricelist_conflicts ----
    stock_suppliers_by_norm: dict[str, set[str]] = {}
    stock_display_by_norm: dict[str, str] = {}
    for row in sheet.stock_rows:
        norm = normalize_name(row.product)
        stock_display_by_norm.setdefault(norm, row.product)
        stock_suppliers_by_norm.setdefault(norm, set()).add(row.supplier)

    price_suppliers_by_norm: dict[str, set[str]] = {}
    for name, sups in price_suppliers_by_display.items():
        norm = normalize_name(name)
        price_suppliers_by_norm.setdefault(norm, set()).update(sups)

    stock_vs_pricelist_conflicts: list[dict] = []
    for norm, stock_sups in stock_suppliers_by_norm.items():
        price_sups = price_suppliers_by_norm.get(norm)
        if price_sups is None:
            continue
        if stock_sups.isdisjoint(price_sups):
            stock_vs_pricelist_conflicts.append(
                {
                    "product": stock_display_by_norm[norm],
                    "stock_suppliers": sorted(stock_sups),
                    "pricelist_suppliers": sorted(price_sups),
                }
            )
    stock_vs_pricelist_conflicts.sort(key=lambda d: d["product"])

    # ---- unit_mismatches ----
    unit_mismatches: list[dict] = []
    seen_unit: set[str] = set()
    for row in sheet.price_rows:
        pid = match.matched.get(row.product)
        if pid is None or row.unit is None or pid in seen_unit:
            continue
        product = snapshot.product_by_id.get(pid)
        if product is None:
            continue
        catalog_unit = product.get("inventory_unit")
        if not _units_equivalent(row.unit, catalog_unit):
            seen_unit.add(pid)
            unit_mismatches.append(
                {
                    "product_id": pid,
                    "product": row.product,
                    "sheet_unit": row.unit,
                    "catalog_unit": catalog_unit,
                }
            )

    # ---- minmax_coverage ----
    total = len(sheet.price_rows)
    with_minmax = sum(1 for r in sheet.price_rows if r.min_qty is not None and r.max_qty is not None)
    minmax_coverage = {
        "total_price_rows": total,
        "with_min_max": with_minmax,
        "without_min_max": total - with_minmax,
    }
    no_minmax_products = sorted(
        {r.product for r in sheet.price_rows if r.min_qty is None or r.max_qty is None}
    )

    return Report(
        missing_products=missing_products,
        supplier_conflicts=supplier_conflicts,
        dual_supplier_in_sheet=dual_supplier_in_sheet,
        stock_vs_pricelist_conflicts=stock_vs_pricelist_conflicts,
        unit_mismatches=unit_mismatches,
        minmax_coverage=minmax_coverage,
        near_misses=dict(match.near_miss),
        no_minmax_products=no_minmax_products,
    )


# ---------- render_report ----------

def _md_table(headers: list[str], rows: list[list[str]]) -> str:
    if not rows:
        return "_none_\n"
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(str(c) for c in row) + " |")
    return "\n".join(lines) + "\n"


def render_report(location: str, report: Report) -> str:
    parts: list[str] = [f"# {location}\n"]

    parts.append("## Missing products\n")
    parts.append(
        _md_table(
            ["Product", "Category", "Supplier"],
            [[m["product"], m["category"], m["supplier"]] for m in report.missing_products],
        )
    )

    parts.append("## Supplier conflicts\n")
    parts.append(
        _md_table(
            ["Product", "Sheet supplier", "Snapshot supplier(s)"],
            [
                [c["product"], c["sheet_supplier"], ", ".join(c["snapshot_suppliers"])]
                for c in report.supplier_conflicts
            ],
        )
    )

    parts.append("## Dual supplier in sheet (substitutes)\n")
    parts.append(
        _md_table(
            ["Product", "Suppliers"],
            [[name, ", ".join(sups)] for name, sups in sorted(report.dual_supplier_in_sheet.items())],
        )
    )

    parts.append("## Stock vs price-list conflicts\n")
    parts.append(
        _md_table(
            ["Product", "Stock supplier(s)", "Price-list supplier(s)"],
            [
                [c["product"], ", ".join(c["stock_suppliers"]), ", ".join(c["pricelist_suppliers"])]
                for c in report.stock_vs_pricelist_conflicts
            ],
        )
    )

    parts.append("## Unit mismatches\n")
    parts.append(
        _md_table(
            ["Product", "Sheet unit", "Catalog unit"],
            [[m["product"], m["sheet_unit"], m["catalog_unit"]] for m in report.unit_mismatches],
        )
    )

    parts.append("## Min/max coverage\n")
    cov = report.minmax_coverage
    parts.append(
        f"- Total price-list rows: {cov.get('total_price_rows', 0)}\n"
        f"- With min/max: {cov.get('with_min_max', 0)}\n"
        f"- Without min/max: {cov.get('without_min_max', 0)}\n"
    )

    parts.append("## Gaps for the operator\n")
    parts.append("### Near-miss names needing a human call\n")
    parts.append(
        _md_table(
            ["Sheet name", "Candidate product_id"],
            [[name, pid] for name, pid in sorted(report.near_misses.items())],
        )
    )
    parts.append("### Unmatched names\n")
    # `missing_products` is already near-miss-free (see reconcile()), so no
    # extra filtering is needed here.
    unmatched_only = sorted(m["product"] for m in report.missing_products)
    parts.append(_md_table(["Sheet name"], [[name] for name in unmatched_only]))
    parts.append("### Products with no min/max in the sheet\n")
    parts.append(_md_table(["Sheet name"], [[name] for name in report.no_minmax_products]))

    return "\n".join(parts)


# ---------- Cross-location summary ----------

def _render_summary(reports: dict[str, Report]) -> str:
    lines = ["# Cross-location summary\n"]
    lines.append("| Location | Missing | Supplier conflicts | Dual supplier | Stock vs price | Unit mismatches | Min/max coverage |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- |")
    all_missing: dict[str, int] = {}
    for loc, r in sorted(reports.items()):
        cov = r.minmax_coverage
        cov_str = f"{cov.get('with_min_max', 0)}/{cov.get('total_price_rows', 0)}"
        lines.append(
            f"| {loc} | {len(r.missing_products)} | {len(r.supplier_conflicts)} | "
            f"{len(r.dual_supplier_in_sheet)} | {len(r.stock_vs_pricelist_conflicts)} | "
            f"{len(r.unit_mismatches)} | {cov_str} |"
        )
        for m in r.missing_products:
            all_missing[m["product"]] = all_missing.get(m["product"], 0) + 1

    lines.append("\n## Products missing everywhere\n")
    everywhere = sorted(name for name, count in all_missing.items() if count == len(reports))
    if everywhere:
        for name in everywhere:
            lines.append(f"- {name}")
    else:
        lines.append("_none_")

    lines.append("\n## Full operator gap list\n")
    for loc, r in sorted(reports.items()):
        lines.append(f"### {loc}\n")
        lines.append(f"- Missing thresholds (no min/max): see `{loc}.md` Min/max coverage")
        lines.append(f"- Unresolved supplier conflicts: {len(r.supplier_conflicts)}")
        lines.append(f"- Near-miss names needing a human call: {len(r.near_misses)}")
        lines.append("")

    return "\n".join(lines) + "\n"


# ---------- CLI ----------

def _read_sheet_file(path: pathlib.Path) -> str:
    raw = path.read_text(encoding="utf-8")
    if path.suffix == ".json":
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return raw
        if isinstance(data, dict) and "fileContent" in data:
            return data["fileContent"]
        return raw
    return raw


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Reconcile per-location Inwentaryzacja sheets against a DB snapshot."
    )
    parser.add_argument("--sheets-dir", required=True, help="Directory of *.json/*.md sheet exports")
    parser.add_argument("--snapshot-dir", required=True, help="Directory of snapshot/*.json files")
    parser.add_argument("--out-dir", required=True, help="Directory to write <loc>.md + _summary.md")
    parser.add_argument("--only", default=None, help="Restrict to one location (filename stem)")
    args = parser.parse_args(argv)

    sheets_dir = pathlib.Path(args.sheets_dir)
    out_dir = pathlib.Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    snapshot = Snapshot.load(args.snapshot_dir)

    paths = sorted(
        p for p in sheets_dir.iterdir()
        if p.is_file() and p.suffix in (".json", ".md") and not p.name.startswith(".")
    )
    if args.only:
        paths = [p for p in paths if p.stem == args.only]

    reports: dict[str, Report] = {}
    for path in paths:
        loc = path.stem
        text = _read_sheet_file(path)
        sheet = parse_sheet(text)
        report = reconcile(sheet, snapshot)
        reports[loc] = report
        (out_dir / f"{loc}.md").write_text(render_report(loc, report), encoding="utf-8")

    (out_dir / "_summary.md").write_text(_render_summary(reports), encoding="utf-8")
    print(f"Wrote {len(reports)} report(s) + _summary.md to {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
