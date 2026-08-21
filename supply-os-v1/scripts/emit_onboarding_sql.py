"""SQL batch generator for the multi-location onboarding change (Phase B1).

Consumes the same parsed sheets + prod snapshot as `reconcile_inventory.py`
(imports its pure functions rather than re-parsing rendered report text) and
emits numbered, reviewable SQL batches under a `prod-sql/` directory:

    00-shared-suppliers.sql        one shared batch (e.g. Selgros)
    01-new-products.sql            one shared batch (P155+ sequence)
    02-new-supplier-products.sql   one shared batch (active=FALSE — F1 leak fix)
    03-locations.sql               one shared batch (INSERT/UPDATE per location map)
    10-<loc>-settings.sql          one per onboarding location (8 files)
    20-<loc>-activation.sql        one per onboarding location (8 files), operator-run LAST

Column lists for every INSERT mirror the Pydantic field order in `app/models.py`
(Product / Supplier / Location / SupplierProduct / LocationProductSetting) —
this repo's snapshot JSON already mirrors those fields 1:1 (see
`context/changes/multi-location-master-data/snapshot/README.md`), which is the
closest thing to a schema reference available to this offline tool. Sanity
check the column list against the real migration before running in prod.

Determinism: every list this module builds is EXPLICITLY sorted before it is
used to emit SQL or assign an id — no dict-iteration-order or set-iteration-
order is trusted for anything that affects generated text, so a rerun over an
unchanged snapshot + unchanged sheets is byte-identical (diffable, per the
"diff-before -> apply -> audit-after" master-data protocol).
"""
from __future__ import annotations

import pathlib
import re
import sys
from dataclasses import dataclass, field
from typing import Optional

try:
    # Works when this file is imported as a package module, e.g.
    # `from scripts.emit_onboarding_sql import ...` (pytest's invocation).
    from scripts.reconcile_inventory import (
        SHEET_SUPPLIER_ALIASES,
        SheetData,
        Snapshot,
        classify_quarantine,
        match_catalog,
        normalize_name,
        parse_sheet,
    )
except ImportError:
    # Works when this file is run directly, e.g.
    # `python3 scripts/emit_onboarding_sql.py` (sys.path[0] = scripts/).
    from reconcile_inventory import (  # type: ignore[no-redef]
        SHEET_SUPPLIER_ALIASES,
        SheetData,
        Snapshot,
        classify_quarantine,
        match_catalog,
        normalize_name,
        parse_sheet,
    )

# ---------- Location map (coordinator brief, Phase B1 dispatch) ----------

# mode: "existing" (reconciliation-only, no onboarding rows) |
#       "reuse_stub" (location row already correct, no locations.sql action) |
#       "reuse_stub_rename" (UPDATE location_name) | "new" (INSERT)
LOCATION_MAP: dict[str, dict] = {
    "wolska": {"location_id": "WOLA", "mode": "existing"},
    "bracka": {"location_id": "BRACKA", "mode": "existing"},
    "norblin": {"location_id": "NORBLIN", "mode": "existing"},
    "ken": {"location_id": "KEN", "mode": "existing"},
    "browary": {
        "location_id": "BROWARY",
        "mode": "reuse_stub",
        "location_name": "Pita Bros Browary",
    },
    "kulinarna_kamienica": {
        "location_id": "KAMIENICA",
        "mode": "reuse_stub_rename",
        "location_name": "Pita Bros Kulinarna Kamienica",
    },
    "stary_browar": {
        "location_id": "STARY_BROWAR",
        "mode": "new",
        "location_name": "Pita Bros Stary Browar",
    },
    "elektrownia": {
        "location_id": "ELEKTROWNIA",
        "mode": "new",
        "location_name": "Pita Bros Elektrownia",
    },
    "slony_spichlerz": {
        "location_id": "SLONY",
        "mode": "new",
        "location_name": "Pita Bros Słony Spichlerz",
    },
    "forum": {"location_id": "FORUM", "mode": "new", "location_name": "Pita Bros Forum"},
    "supersam": {
        "location_id": "SUPERSAM",
        "mode": "new",
        "location_name": "Pita Bros Supersam",
    },
    "westfield": {
        "location_id": "WESTFIELD",
        "mode": "new",
        "location_name": "Pita Bros Westfield",
    },
}

# The four live, already-configured locations a new second carrier must be
# pinned at (FR-026 narrowing) so onboarding never silently widens what they
# see (plan-review F1).
LIVE_PINNED_LOCATIONS: tuple[str, ...] = ("WOLA", "BRACKA", "NORBLIN", "KEN")

ONBOARDING_SHEET_STEMS: tuple[str, ...] = tuple(
    sorted(stem for stem, cfg in LOCATION_MAP.items() if cfg["mode"] != "existing")
)


# ---------- SQL rendering helpers ----------

def sql_str(v: Optional[str]) -> str:
    if v is None:
        return "NULL"
    return "'" + v.replace("'", "''") + "'"


def sql_num(v: Optional[float]) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def render_batch(
    filename: str,
    purpose: str,
    preconditions: list[str],
    diff_before: list[str],
    statements: list[str],
    audit_after: list[str],
    rollback: list[str],
) -> str:
    """Shared header+body shape for every batch — diff-before -> apply ->
    audit-after -> rollback (master-data protocol, lessons.md)."""
    lines = [
        f"-- Batch: {filename}",
        f"-- Purpose: {purpose}",
    ]
    lines.append("-- Preconditions:")
    if preconditions:
        for p in preconditions:
            lines.append(f"--   {p}")
    else:
        lines.append("--   none")
    lines.append("-- Diff-before (run first, record the result):")
    for s in diff_before:
        lines.append(f"--   {s}")
    lines.append("")
    lines.extend(statements)
    lines.append("")
    lines.append("-- Audit-after (run after applying, compare to diff-before):")
    for s in audit_after:
        lines.append(f"--   {s}")
    lines.append("-- Rollback:")
    for s in rollback:
        lines.append(f"--   {s}")
    return "\n".join(lines) + "\n"


# ---------- Corpus loading ----------

def load_all_sheets(sheets_dir: pathlib.Path) -> dict[str, SheetData]:
    """Parse every *.json/*.md sheet export, keyed by filename stem, sorted."""
    out: dict[str, SheetData] = {}
    paths = sorted(
        p for p in sheets_dir.iterdir()
        if p.is_file() and p.suffix in (".json", ".md") and not p.name.startswith(".")
    )
    for path in paths:
        raw = path.read_text(encoding="utf-8")
        text = raw
        if path.suffix == ".json":
            import json

            try:
                data = json.loads(raw)
                if isinstance(data, dict) and "fileContent" in data:
                    text = data["fileContent"]
            except ValueError:
                pass
        out[path.stem] = parse_sheet(text)
    return out


def resolve_supplier_display(raw: str) -> str:
    """Canonical supplier display name for a sheet's raw supplier cell."""
    return SHEET_SUPPLIER_ALIASES.get(raw, raw)


# ---------- Batch 00: shared suppliers ----------

def discover_missing_suppliers(sheets: dict[str, SheetData], snapshot: Snapshot) -> list[str]:
    """Canonical supplier names appearing in ANY sheet (price or stock rows,
    alias-resolved) that are not in the snapshot's `suppliers` table. Sorted
    for determinism. Verifies the plan's claim that Selgros is the only one —
    callers should log/flag if this returns anything else."""
    known = {s["supplier_name"] for s in snapshot.suppliers}
    seen: set[str] = set()
    for sheet in sheets.values():
        for row in sheet.price_rows:
            seen.add(resolve_supplier_display(row.supplier))
        for row in sheet.stock_rows:
            seen.add(resolve_supplier_display(row.supplier))
    return sorted(seen - known)


def supplier_core_id(name: str) -> str:
    """SUP_<CORE> id for a new supplier — first word, ASCII-folded, upper-case.
    Mirrors the existing convention (SUP_BUKAT, SUP_KUCHNIE for "Kuchnie
    Świata", SUP_FILBER for "Filber Wyspy Piwne": first meaningful word)."""
    first_word = normalize_name(name).split(" ")[0] if name.strip() else "supplier"
    core = "".join(ch for ch in first_word.upper() if ch.isalnum()) or "SUPPLIER"
    return f"SUP_{core}"


def build_supplier_id_map(snapshot: Snapshot, new_suppliers: list[str]) -> dict[str, str]:
    """canonical supplier_name -> supplier_id, existing + newly-minted."""
    out = {s["supplier_name"]: s["supplier_id"] for s in snapshot.suppliers}
    for name in new_suppliers:
        out[name] = supplier_core_id(name)
    return out


def emit_batch_00(new_suppliers: list[str], supplier_id_map: dict[str, str]) -> str:
    ids = [supplier_id_map[name] for name in new_suppliers]
    statements: list[str] = []
    for name in new_suppliers:
        sid = supplier_id_map[name]
        statements.append(
            "INSERT INTO suppliers "
            "(supplier_id, supplier_name, email, ordering_method, delivery_days, "
            "cutoff_time, minimum_order_value_pln, active, notes)\n"
            f"VALUES ({sql_str(sid)}, {sql_str(name)}, NULL, 'manual', NULL, NULL, NULL, "
            f"FALSE, 'method TBC by operator')\n"
            "ON CONFLICT (supplier_id) DO NOTHING;"
        )
    id_list = ", ".join(sql_str(i) for i in ids) if ids else "NULL"
    return render_batch(
        "00-shared-suppliers.sql",
        "Add supplier(s) that appear in the onboarding sheets but do not yet "
        "exist in the suppliers table (inactive — same pattern as SUP_ALLEGRO; "
        "ordering_method unconfirmed, operator fills in).",
        ["none — additive, inactive rows only"],
        [f"SELECT supplier_id, supplier_name, active FROM suppliers WHERE supplier_id IN ({id_list});"],
        statements,
        [f"SELECT supplier_id, supplier_name, active FROM suppliers WHERE supplier_id IN ({id_list});"],
        [f"DELETE FROM suppliers WHERE supplier_id IN ({id_list});"],
    )


# ---------- Batch 01: new products ----------

_SPREADSHEET_ERROR_RE = re.compile(r"^\\?#(REF|VALUE|N/?A|DIV/0|NAME|NULL)\\?!?$")


def _looks_like_spreadsheet_error(name: str) -> bool:
    """True for a raw spreadsheet formula-error artifact captured as literal
    text (e.g. "\\#REF\\!", found in bracka's price list) — never a real
    product, regardless of what a fuzzy matcher makes of it."""
    return bool(_SPREADSHEET_ERROR_RE.match(name.strip()))


@dataclass
class NewProduct:
    product_id: str
    name: str
    category: str
    inventory_unit: str
    sheet_stems: list[str] = field(default_factory=list)


def _next_product_id_start(snapshot: Snapshot) -> int:
    max_n = 0
    for p in snapshot.products:
        pid = p.get("product_id", "")
        if pid.startswith("P") and pid[1:].isdigit():
            max_n = max(max_n, int(pid[1:]))
    return max_n + 1


@dataclass
class QuarantinedEntry:
    name: str
    sheet_stems: list[str]


@dataclass
class QuarantinedProductGroup:
    """A `QuarantineCluster` (reconcile_inventory.py) enriched with which
    sheet(s) each quarantined name came from, for the 01b operator report."""
    rule: str
    entries: list[QuarantinedEntry]
    catalog_suspect: Optional[tuple[str, str]] = None


def collect_new_products(
    sheets: dict[str, SheetData], snapshot: Snapshot
) -> tuple[list[NewProduct], dict[str, str], list[QuarantinedProductGroup]]:
    """Products missing (hard gap — near-miss EXCLUDED) across ALL sheets,
    deduped by normalized name — then run through `classify_quarantine`
    (Round-2 fix, coordinator review 2026-08-22): a name that looks like a
    near-duplicate of an existing catalog row, or of another candidate in
    THIS batch, is quarantined instead of minted as a new product. Ids are
    assigned only to the surviving "confident" names, deterministically from
    the next free Pxxx slot (sorted by normalized name — quarantining shrinks
    the id range but never reorders it).

    Returns (new_products, normalized_name -> product_id, quarantined_groups).
    A quarantined name appears in NEITHER new_products NOR the id map — every
    downstream step (pairs, settings, activation/pins) resolves products via
    that map, so quarantine cascades for free (see reconcile_inventory.py's
    resolve_products_for_sheet callers below).
    """
    catalog = snapshot.catalog
    by_norm: dict[str, NewProduct] = {}
    for stem in sorted(sheets):
        sheet = sheets[stem]
        names = [r.product for r in sheet.price_rows]
        match = match_catalog(names, catalog)
        unmatched = set(match.unmatched)  # near-miss deliberately excluded
        for row in sheet.price_rows:
            if row.product not in unmatched or _looks_like_spreadsheet_error(row.product):
                continue
            norm = normalize_name(row.product)
            existing = by_norm.get(norm)
            if existing is None:
                by_norm[norm] = NewProduct(
                    product_id="",  # assigned below, confident names only
                    name=row.product,
                    category=row.category,
                    inventory_unit=(row.unit or "").casefold(),
                    sheet_stems=[stem],
                )
            elif stem not in existing.sheet_stems:
                existing.sheet_stems.append(stem)

    ordered_norms = sorted(by_norm)
    display_names = [by_norm[norm].name for norm in ordered_norms]
    catalog_display_by_pid = {p["product_id"]: p["product_name_pl"] for p in snapshot.products}
    quarantine = classify_quarantine(display_names, catalog, catalog_display_by_pid)

    quarantined_groups = [
        QuarantinedProductGroup(
            rule=cluster.rule,
            entries=[
                QuarantinedEntry(name=n, sheet_stems=by_norm[normalize_name(n)].sheet_stems)
                for n in cluster.names
            ],
            catalog_suspect=cluster.catalog_suspect,
        )
        for cluster in quarantine.clusters
    ]

    confident_norms = sorted(normalize_name(n) for n in quarantine.confident)
    next_n = _next_product_id_start(snapshot)
    norm_to_pid: dict[str, str] = {}
    new_products: list[NewProduct] = []
    for norm in confident_norms:
        np = by_norm[norm]
        np.product_id = f"P{next_n:03d}"
        np.sheet_stems.sort()
        next_n += 1
        norm_to_pid[norm] = np.product_id
        new_products.append(np)
    return new_products, norm_to_pid, quarantined_groups


def emit_batch_01(new_products: list[NewProduct]) -> str:
    statements: list[str] = []
    ids = [np.product_id for np in new_products]
    for np in new_products:
        note = (
            f"added 2026-08-22 (multi-location-master-data) from "
            f"{', '.join(np.sheet_stems)} inventory sheets"
        )
        statements.append(
            "INSERT INTO products "
            "(product_id, gostock_id, product_name_pl, product_category, "
            "inventory_unit, is_critical, active, notes)\n"
            f"VALUES ({sql_str(np.product_id)}, NULL, {sql_str(np.name)}, "
            f"{sql_str(np.category)}, {sql_str(np.inventory_unit)}, FALSE, TRUE, "
            f"{sql_str(note)})\n"
            "ON CONFLICT (product_id) DO NOTHING;"
        )
    id_list = ", ".join(sql_str(i) for i in ids) if ids else "NULL"
    return render_batch(
        "01-new-products.sql",
        "Add products that appear in the onboarding sheets' price lists but "
        "have no catalog match at all (near-miss candidates are deliberately "
        "excluded — those need a human decision, not an auto-created row).",
        ["none — additive rows only, active=TRUE (new SKUs, not location-scoped)"],
        [f"SELECT product_id, product_name_pl FROM products WHERE product_id IN ({id_list});"],
        statements,
        [f"SELECT product_id, product_name_pl, product_category, inventory_unit FROM products WHERE product_id IN ({id_list});"],
        [f"DELETE FROM products WHERE product_id IN ({id_list});"],
    )


_RULE_LABELS = {
    "a": "Relaxed catalog match (likely duplicates an EXISTING product)",
    "b": "Intra-batch cluster (these candidates likely name the same new product)",
    "c": "Lowercase-only singleton (looks like a placeholder, not a real name)",
}


def emit_batch_01b(quarantined_groups: list["QuarantinedProductGroup"]) -> str:
    """Render `01b-quarantined-names.md` -- every name held back from batch 01
    (Round-2 fix), grouped by which rule caught it, with the sheets each name
    came from and, for a rule-(a) group, the existing catalog row it is
    suspected of duplicating. Markdown, not SQL: there is nothing to apply --
    the operator reads this and decides, per group, to link a name to the
    named existing product, pick one canonical spelling among a cluster, or
    confirm it is genuinely new (at which point it can be added by hand, or a
    future run's candidate list will re-surface it once nothing quarantines
    it any more).
    """
    lines = [
        "# Quarantined product-name candidates (not minted in 01-new-products.sql)\n",
        "Every name below LOOKS new (no exact/near-miss catalog match) but was held "
        "back because it also looks like a near-duplicate -- of an existing catalog "
        "row, of another candidate in this same batch, or of a placeholder value. "
        "Cascade: a quarantined name gets NO product row, NO supplier_products pair, "
        "NO settings row, and NO activation reference/pin anywhere in this run's SQL.\n",
    ]
    if not quarantined_groups:
        lines.append("_none_\n")
        return "\n".join(lines)

    # Stable, deterministic ordering: rule a/b/c, then by first name in the group.
    ordered = sorted(quarantined_groups, key=lambda g: (g.rule, g.entries[0].name))
    for i, group in enumerate(ordered, start=1):
        lines.append(f"## Group {i} -- {_RULE_LABELS.get(group.rule, group.rule)}\n")
        if group.catalog_suspect is not None:
            pid, display = group.catalog_suspect
            lines.append(f"Catalog suspect: **{pid} -- {display}**\n")
        lines.append("| Name | Sheets |")
        lines.append("| --- | --- |")
        for entry in sorted(group.entries, key=lambda e: e.name):
            lines.append(f"| {entry.name} | {', '.join(entry.sheet_stems)} |")
        if group.catalog_suspect is not None:
            decision = (
                "link to the existing product above / confirm genuinely new "
                "(then add by hand)."
            )
        else:
            decision = (
                "pick one spelling as canonical / confirm each name is genuinely "
                "new (then add by hand)."
            )
        lines.append(f"\n**Operator decides:** {decision}\n")
    return "\n".join(lines)



# ---------- Cross-sheet product resolution ----------

def resolve_products_for_sheet(
    sheet: SheetData, snapshot_catalog: dict[str, str], new_product_by_norm: dict[str, str]
) -> dict[str, str]:
    """raw sheet product name -> product_id, for names that resolve to EITHER
    an existing catalog entry OR a batch-01 new product. Near-miss and
    genuinely-unresolvable names are absent from the returned dict."""
    out: dict[str, str] = {}
    for row in sheet.price_rows:
        norm = normalize_name(row.product)
        pid = snapshot_catalog.get(norm) or new_product_by_norm.get(norm)
        if pid is not None:
            out[row.product] = pid
    return out


# ---------- Batch 02: new supplier_products pairs ----------

@dataclass
class NewPair:
    supplier_product_id: str
    supplier_id: str
    product_id: str
    supplier_product_name: str
    purchase_unit: str
    units_per_purchase_unit: float
    rounding_rule: str
    price_estimate_pln: Optional[float]
    notes: str
    sheet_stems: list[str] = field(default_factory=list)


def collect_new_pairs(
    sheets: dict[str, SheetData],
    snapshot: Snapshot,
    supplier_id_map: dict[str, str],
    new_product_by_norm: dict[str, str],
) -> list[NewPair]:
    """New (supplier, product) pairs referenced by any sheet's price list
    that are not already in snapshot.supplier_products. Deduped by
    (supplier_id, product_id), first sheet (alphabetical) wins for naming;
    price = first non-null occurrence across ALL sheets/rows for that pair,
    in the same deterministic order."""
    snapshot_catalog = snapshot.catalog
    existing_pairs = {(sp["supplier_id"], sp["product_id"]) for sp in snapshot.supplier_products}
    existing_units_by_pid: dict[str, list[dict]] = {}
    for sp in sorted(snapshot.supplier_products, key=lambda r: r["supplier_product_id"]):
        existing_units_by_pid.setdefault(sp["product_id"], []).append(sp)

    by_pair: dict[tuple[str, str], NewPair] = {}
    for stem in sorted(sheets):
        sheet = sheets[stem]
        resolved = resolve_products_for_sheet(sheet, snapshot_catalog, new_product_by_norm)
        for row in sheet.price_rows:
            pid = resolved.get(row.product)
            if pid is None:
                continue
            supplier_name = resolve_supplier_display(row.supplier)
            supplier_id = supplier_id_map.get(supplier_name)
            if supplier_id is None:
                continue  # defensive — should not happen once batch 00 covers every sheet supplier
            pair_key = (supplier_id, pid)
            if pair_key in existing_pairs:
                continue
            existing = by_pair.get(pair_key)
            if existing is None:
                donor_rows = existing_units_by_pid.get(pid)
                if donor_rows:
                    donor = donor_rows[0]
                    units = donor["units_per_purchase_unit"]
                    rounding = donor["rounding_rule"]
                    notes = f"packaging copied from {donor['supplier_product_id']}"
                else:
                    units = 1.0
                    rounding = "full_only"
                    notes = "packaging TBC"
                core = supplier_id.replace("SUP_", "")
                by_pair[pair_key] = NewPair(
                    supplier_product_id=f"SP_{core}_{pid}",
                    supplier_id=supplier_id,
                    product_id=pid,
                    supplier_product_name=row.product,
                    purchase_unit=(row.unit or "").casefold(),
                    units_per_purchase_unit=units,
                    rounding_rule=rounding,
                    price_estimate_pln=row.price,
                    notes=notes,
                    sheet_stems=[stem],
                )
            else:
                if stem not in existing.sheet_stems:
                    existing.sheet_stems.append(stem)
                if existing.price_estimate_pln is None and row.price is not None:
                    existing.price_estimate_pln = row.price

    return [by_pair[k] for k in sorted(by_pair)]


def emit_batch_02(new_pairs: list[NewPair]) -> str:
    statements: list[str] = []
    ids = [p.supplier_product_id for p in new_pairs]
    for p in new_pairs:
        statements.append(
            "INSERT INTO supplier_products "
            "(supplier_product_id, supplier_id, product_id, supplier_product_name, "
            "purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, "
            "active, notes, order_note)\n"
            f"VALUES ({sql_str(p.supplier_product_id)}, {sql_str(p.supplier_id)}, "
            f"{sql_str(p.product_id)}, {sql_str(p.supplier_product_name)}, "
            f"{sql_str(p.purchase_unit)}, {sql_num(p.units_per_purchase_unit)}, "
            f"{sql_str(p.rounding_rule)}, {sql_num(p.price_estimate_pln)}, "
            f"FALSE, {sql_str(p.notes)}, NULL)\n"
            "ON CONFLICT (supplier_product_id) DO NOTHING;"
        )
    id_list = ", ".join(sql_str(i) for i in ids) if ids else "NULL"
    return render_batch(
        "02-new-supplier-products.sql",
        "Add new (supplier, product) catalog pairs referenced by the "
        "onboarding sheets. INSERTED INACTIVE ON PURPOSE (plan-review F1): a "
        "global, active supplier_products row would leak an \"also supplied "
        "by\" badge into the four LIVE locations before their pin is applied. "
        "Each onboarding location's own 20-<loc>-activation.sql flips its "
        "rows active.",
        [
            "none to apply this batch — every row lands active=FALSE",
            "activation batches below must not run before this batch",
        ],
        [
            f"SELECT supplier_product_id, supplier_id, product_id, active FROM supplier_products WHERE supplier_product_id IN ({id_list});"
        ],
        statements,
        [
            f"SELECT supplier_product_id, active FROM supplier_products WHERE supplier_product_id IN ({id_list}); -- expect active=false for every row"
        ],
        [f"DELETE FROM supplier_products WHERE supplier_product_id IN ({id_list});"],
    )


# ---------- Batch 03: locations ----------

def emit_batch_03() -> str:
    statements: list[str] = []
    comments: list[str] = []
    ids_touched: list[str] = []
    for stem in sorted(LOCATION_MAP):
        cfg = LOCATION_MAP[stem]
        if cfg["mode"] == "existing":
            continue
        loc_id = cfg["location_id"]
        if cfg["mode"] == "reuse_stub":
            comments.append(
                f"-- {loc_id}: stub already has the correct name/active state — no action needed."
            )
            continue
        if cfg["mode"] == "reuse_stub_rename":
            ids_touched.append(loc_id)
            statements.append(
                f"UPDATE locations SET location_name = {sql_str(cfg['location_name'])} "
                f"WHERE location_id = {sql_str(loc_id)};"
            )
            statements.append(
                "-- NOTE: the separate 'KULINARNA' stub is a probable duplicate of this "
                "location (research §3.6) and is NOT touched here — operator confirms "
                "or deletes it."
            )
            continue
        # mode == "new"
        ids_touched.append(loc_id)
        gap_note = sql_str(
            "added 2026-08-22 (multi-location-master-data); "
            "address/city/company gap for the operator"
        )
        statements.append(
            "INSERT INTO locations "
            "(location_id, location_name, delivery_address, city, active, notes, "
            "company_name, company_address, company_nip)\n"
            f"VALUES ({sql_str(loc_id)}, {sql_str(cfg['location_name'])}, NULL, NULL, "
            f"FALSE, {gap_note}, NULL, NULL, NULL)\n"
            "ON CONFLICT (location_id) DO NOTHING;"
        )
    id_list = ", ".join(sql_str(i) for i in ids_touched) if ids_touched else "NULL"
    return render_batch(
        "03-locations.sql",
        "Onboard the 6 brand-new locations (inactive), rename the KAMIENICA "
        "stub to match the real sheet, and leave BROWARY's already-correct "
        "stub untouched.",
        ["none — new rows are inactive; the rename only touches location_name"],
        [f"SELECT location_id, location_name, active FROM locations WHERE location_id IN ({id_list});"],
        statements,
        [f"SELECT location_id, location_name, active, city FROM locations WHERE location_id IN ({id_list});"],
        [
            f"UPDATE locations SET location_name = 'Pita Bros Kamienica' WHERE location_id = 'KAMIENICA'; "
            f"DELETE FROM locations WHERE location_id IN ({id_list}) AND location_id <> 'KAMIENICA';"
        ],
    )


# ---------- Batch 10-<loc>-settings ----------

@dataclass
class SettingRow:
    product_id: str
    min_qty: float
    max_qty: float
    target_qty: float
    notes: str


def collect_location_settings(
    sheet: SheetData, snapshot_catalog: dict[str, str], new_product_by_norm: dict[str, str]
) -> list[SettingRow]:
    """One row per product on this sheet's price list (first-occurrence wins
    for a product listed under >1 supplier — thresholds are supplier-agnostic).
    Products with no resolved product_id (near-miss / unmatched) are skipped."""
    resolved = resolve_products_for_sheet(sheet, snapshot_catalog, new_product_by_norm)
    by_pid: dict[str, SettingRow] = {}
    for row in sheet.price_rows:
        pid = resolved.get(row.product)
        if pid is None or pid in by_pid:
            continue
        if row.min_qty is not None and row.max_qty is not None:
            by_pid[pid] = SettingRow(
                product_id=pid,
                min_qty=row.min_qty,
                max_qty=row.max_qty,
                target_qty=row.max_qty,
                notes="",
            )
        else:
            by_pid[pid] = SettingRow(
                product_id=pid,
                min_qty=0,
                max_qty=0,
                target_qty=0,
                notes="threshold TBC (sheet had no min/max)",
            )
    return [by_pid[pid] for pid in sorted(by_pid)]


def emit_batch_10(loc_id: str, rows: list[SettingRow]) -> str:
    statements: list[str] = []
    for r in rows:
        setting_id = f"{loc_id}__{r.product_id}"
        statements.append(
            "INSERT INTO location_product_settings "
            "(setting_id, location_id, product_id, min_stock_qty_base, "
            "max_stock_qty_base, target_stock_qty_base, is_critical_for_location, "
            "allow_over_max_due_to_packaging, notes, source_supplier_id)\n"
            f"VALUES ({sql_str(setting_id)}, {sql_str(loc_id)}, {sql_str(r.product_id)}, "
            f"{sql_num(r.min_qty)}, {sql_num(r.max_qty)}, {sql_num(r.target_qty)}, "
            f"FALSE, FALSE, {sql_str(r.notes)}, NULL)\n"
            "ON CONFLICT (location_id, product_id) DO NOTHING;"
        )
    pid_list = ", ".join(sql_str(r.product_id) for r in rows) if rows else "NULL"
    return render_batch(
        f"10-{loc_id.lower()}-settings.sql",
        f"Add location_product_settings rows for every product on {loc_id}'s "
        "price list (target = max convention; 0/0/0 + a TBC note where the "
        "sheet had no min/max).",
        [f"03-locations.sql applied ({loc_id} row exists)"],
        [
            f"SELECT product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base "
            f"FROM location_product_settings WHERE location_id = {sql_str(loc_id)} "
            f"AND product_id IN ({pid_list});"
        ],
        statements,
        [
            f"SELECT count(*) FROM location_product_settings WHERE location_id = {sql_str(loc_id)};"
        ],
        [f"DELETE FROM location_product_settings WHERE location_id = {sql_str(loc_id)};"],
    )


# ---------- Batch 20-<loc>-activation ----------

def _dual_supplier_products_in_sheet(
    sheet: SheetData, resolved: dict[str, str]
) -> dict[str, set[str]]:
    """product_id -> set of supplier display names, for products this sheet's
    price list names under >= 2 suppliers (substitutes; never pinned)."""
    by_pid: dict[str, set[str]] = {}
    for row in sheet.price_rows:
        pid = resolved.get(row.product)
        if pid is None:
            continue
        by_pid.setdefault(pid, set()).add(resolve_supplier_display(row.supplier))
    return {pid: sups for pid, sups in by_pid.items() if len(sups) >= 2}


def _single_supplier_per_product_in_sheet(
    sheet: SheetData, resolved: dict[str, str]
) -> dict[str, str]:
    """product_id -> the ONE supplier_id this sheet's price list names for
    it (skips products named under >=2 suppliers — those are substitutes)."""
    by_pid: dict[str, set[str]] = {}
    for row in sheet.price_rows:
        pid = resolved.get(row.product)
        if pid is None:
            continue
        by_pid.setdefault(pid, set()).add(row.supplier)
    return {pid: next(iter(sups)) for pid, sups in by_pid.items() if len(sups) == 1}


@dataclass
class ActivationPlan:
    loc_id: str
    activate_supplier_product_ids: list[str]
    own_pins: list[tuple[str, str]]  # (product_id, supplier_id) — pin AT loc_id
    live_pins: list[tuple[str, str, str]]  # (live_loc_id, product_id, supplier_id)
    substitutes: list[tuple[str, list[str]]]  # (product_id, [supplier display names])


def build_activation_plans(
    sheets: dict[str, SheetData],
    snapshot: Snapshot,
    supplier_id_map: dict[str, str],
    new_product_by_norm: dict[str, str],
    new_pairs: list[NewPair],
) -> dict[str, ActivationPlan]:
    """One ActivationPlan per onboarding location (sheet stem's LOCATION_MAP
    entry), computed against the "final" post-B1-rollout carrier set (existing
    snapshot carriers UNION every new pair created anywhere in the corpus) so
    the pin decision does not depend on the order the 8 activation batches are
    actually run in.
    """
    snapshot_catalog = snapshot.catalog
    existing_carriers: dict[str, set[str]] = {}
    for sp in snapshot.supplier_products:
        existing_carriers.setdefault(sp["product_id"], set()).add(sp["supplier_id"])

    final_carriers: dict[str, set[str]] = {pid: set(sups) for pid, sups in existing_carriers.items()}
    new_pairs_by_pid: dict[str, list[NewPair]] = {}
    for p in new_pairs:
        final_carriers.setdefault(p.product_id, set()).add(p.supplier_id)
        new_pairs_by_pid.setdefault(p.product_id, []).append(p)

    # Live-location settings, so a WOLA/BRACKA/NORBLIN/KEN pin is only ever
    # emitted for a product that location actually stocks.
    live_settings: dict[str, set[str]] = {loc: set() for loc in LIVE_PINNED_LOCATIONS}
    for row in snapshot.location_product_settings:
        if row["location_id"] in live_settings:
            live_settings[row["location_id"]].add(row["product_id"])

    # Attribute each pid's "1 -> 2 carriers" live-location pin to exactly ONE
    # onboarding location (the alphabetically-first one whose sheet creates a
    # new pair for that pid) so it is never emitted twice across 8 batches.
    pid_new_carrier_owners: dict[str, list[str]] = {}
    for stem in ONBOARDING_SHEET_STEMS:
        sheet = sheets[stem]
        resolved = resolve_products_for_sheet(sheet, snapshot_catalog, new_product_by_norm)
        for pid in resolved.values():
            for p in new_pairs_by_pid.get(pid, []):
                if stem in p.sheet_stems:
                    pid_new_carrier_owners.setdefault(pid, [])
                    if stem not in pid_new_carrier_owners[pid]:
                        pid_new_carrier_owners[pid].append(stem)
    for pid in pid_new_carrier_owners:
        pid_new_carrier_owners[pid].sort()

    plans: dict[str, ActivationPlan] = {}
    for stem in ONBOARDING_SHEET_STEMS:
        loc_id = LOCATION_MAP[stem]["location_id"]
        sheet = sheets[stem]
        resolved = resolve_products_for_sheet(sheet, snapshot_catalog, new_product_by_norm)
        dual = _dual_supplier_products_in_sheet(sheet, resolved)
        single = _single_supplier_per_product_in_sheet(sheet, resolved)

        activate_ids = sorted(
            {
                p.supplier_product_id
                for p in new_pairs
                if stem in p.sheet_stems
            }
        )

        own_pins: list[tuple[str, str]] = []
        for pid, sheet_supplier in sorted(single.items()):
            if len(final_carriers.get(pid, set())) >= 2:
                supplier_id = supplier_id_map.get(resolve_supplier_display(sheet_supplier))
                if supplier_id is not None:
                    own_pins.append((pid, supplier_id))

        live_pins: list[tuple[str, str, str]] = []
        for pid, pre_existing in sorted(existing_carriers.items()):
            if len(pre_existing) != 1:
                continue
            owners = pid_new_carrier_owners.get(pid)
            if not owners or owners[0] != stem:
                continue
            (only_existing_supplier,) = tuple(pre_existing)
            for live_loc in LIVE_PINNED_LOCATIONS:
                if pid in live_settings.get(live_loc, set()):
                    live_pins.append((live_loc, pid, only_existing_supplier))

        substitutes = sorted(
            (pid, sorted(resolve_supplier_display(s) for s in sups))
            for pid, sups in dual.items()
        )

        plans[stem] = ActivationPlan(
            loc_id=loc_id,
            activate_supplier_product_ids=activate_ids,
            own_pins=own_pins,
            live_pins=live_pins,
            substitutes=substitutes,
        )
    return plans


def emit_batch_20(stem: str, plan: ActivationPlan) -> str:
    statements: list[str] = []
    statements.append(f"UPDATE locations SET active = TRUE WHERE location_id = {sql_str(plan.loc_id)};")
    if plan.activate_supplier_product_ids:
        id_list = ", ".join(sql_str(i) for i in plan.activate_supplier_product_ids)
        statements.append(
            f"UPDATE supplier_products SET active = TRUE WHERE supplier_product_id IN ({id_list});"
        )
    else:
        statements.append(
            "-- no new supplier_products rows to activate (every carrier this "
            "location uses was already active in the snapshot)"
        )

    if plan.own_pins:
        statements.append(
            f"-- Pin {plan.loc_id} to its sheet's single named supplier for every "
            "product that now has >= 2 catalog carriers:"
        )
        for pid, supplier_id in plan.own_pins:
            statements.append(
                f"UPDATE location_product_settings SET source_supplier_id = {sql_str(supplier_id)} "
                f"WHERE location_id = {sql_str(plan.loc_id)} AND product_id = {sql_str(pid)};"
            )

    if plan.live_pins:
        statements.append(
            "-- This activation gives the following product(s) a SECOND active "
            "carrier for the first time — pin the four already-live locations "
            "to their CURRENT (pre-onboarding) supplier so their behavior does "
            "not change (FR-026 narrowing, plan-review F1):"
        )
        for live_loc, pid, supplier_id in plan.live_pins:
            statements.append(
                f"UPDATE location_product_settings SET source_supplier_id = {sql_str(supplier_id)} "
                f"WHERE location_id = {sql_str(live_loc)} AND product_id = {sql_str(pid)};"
            )

    if plan.substitutes:
        statements.append(
            f"-- Substitutes at {plan.loc_id} — left UNPINNED on purpose (FR-027/028): "
            "the sheet names more than one supplier for these, so all remain visible:"
        )
        for pid, sups in plan.substitutes:
            statements.append(f"--   {pid}: {', '.join(sups)}")

    return render_batch(
        f"20-{plan.loc_id.lower()}-activation.sql",
        f"OPERATOR-RUN LAST for {plan.loc_id}. Flips the location + its new "
        "catalog rows live, and narrows visibility exactly where a product "
        "gains a second real-world carrier (this location's own pin, and — "
        "the first time it happens — the four already-live locations).",
        [
            "migration 0008 deployed (location_product_settings.source_supplier_id column exists)",
            "PR #26 deployed (supplier-per-location read/write path live)",
            "00/01/02/03 and 10-<loc>-settings.sql already applied",
        ],
        [
            f"SELECT active FROM locations WHERE location_id = {sql_str(plan.loc_id)};",
            "SELECT supplier_product_id, active FROM supplier_products WHERE supplier_product_id IN ("
            + (", ".join(sql_str(i) for i in plan.activate_supplier_product_ids) or "NULL")
            + ");",
        ],
        statements,
        [
            f"SELECT active FROM locations WHERE location_id = {sql_str(plan.loc_id)}; -- expect true",
            f"SELECT product_id, source_supplier_id FROM location_product_settings WHERE location_id = {sql_str(plan.loc_id)};",
        ],
        [
            f"UPDATE locations SET active = FALSE WHERE location_id = {sql_str(plan.loc_id)};",
            "-- plus reversing each UPDATE above by hand if needed",
        ],
    )


# ---------- CLI ----------

def generate_all(sheets_dir: pathlib.Path, snapshot_dir: pathlib.Path, out_dir: pathlib.Path) -> dict:
    """Run the full pipeline and write every batch file. Returns a summary
    dict for reporting (row counts, id ranges, discovered anomalies)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    snapshot = Snapshot.load(str(snapshot_dir))
    sheets = load_all_sheets(sheets_dir)

    new_suppliers = discover_missing_suppliers(sheets, snapshot)
    supplier_id_map = build_supplier_id_map(snapshot, new_suppliers)
    (out_dir / "00-shared-suppliers.sql").write_text(
        emit_batch_00(new_suppliers, supplier_id_map), encoding="utf-8"
    )

    new_products, new_product_by_norm, quarantined_groups = collect_new_products(sheets, snapshot)
    (out_dir / "01-new-products.sql").write_text(emit_batch_01(new_products), encoding="utf-8")
    (out_dir / "01b-quarantined-names.md").write_text(
        emit_batch_01b(quarantined_groups), encoding="utf-8"
    )

    new_pairs = collect_new_pairs(sheets, snapshot, supplier_id_map, new_product_by_norm)
    (out_dir / "02-new-supplier-products.sql").write_text(emit_batch_02(new_pairs), encoding="utf-8")

    (out_dir / "03-locations.sql").write_text(emit_batch_03(), encoding="utf-8")

    settings_counts: dict[str, int] = {}
    for stem in ONBOARDING_SHEET_STEMS:
        loc_id = LOCATION_MAP[stem]["location_id"]
        rows = collect_location_settings(sheets[stem], snapshot.catalog, new_product_by_norm)
        settings_counts[loc_id] = len(rows)
        (out_dir / f"10-{loc_id.lower()}-settings.sql").write_text(
            emit_batch_10(loc_id, rows), encoding="utf-8"
        )

    plans = build_activation_plans(sheets, snapshot, supplier_id_map, new_product_by_norm, new_pairs)
    pin_counts: dict[str, dict] = {}
    for stem in ONBOARDING_SHEET_STEMS:
        plan = plans[stem]
        pin_counts[plan.loc_id] = {
            "own_pins": len(plan.own_pins),
            "live_pins": len(plan.live_pins),
            "substitutes": len(plan.substitutes),
            "activated": len(plan.activate_supplier_product_ids),
        }
        (out_dir / f"20-{plan.loc_id.lower()}-activation.sql").write_text(
            emit_batch_20(stem, plan), encoding="utf-8"
        )

    quarantined_by_rule: dict[str, int] = {}
    quarantined_total = 0
    for group in quarantined_groups:
        quarantined_by_rule[group.rule] = quarantined_by_rule.get(group.rule, 0) + len(group.entries)
        quarantined_total += len(group.entries)

    return {
        "new_suppliers": new_suppliers,
        "new_product_id_range": (
            (new_products[0].product_id, new_products[-1].product_id) if new_products else None
        ),
        "new_products_count": len(new_products),
        "new_pairs_count": len(new_pairs),
        "settings_counts": settings_counts,
        "pin_counts": pin_counts,
        "quarantined_total": quarantined_total,
        "quarantined_by_rule": quarantined_by_rule,
    }


def main(argv: Optional[list[str]] = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Generate onboarding SQL batches (Phase B1).")
    parser.add_argument("--sheets-dir", required=True)
    parser.add_argument("--snapshot-dir", required=True)
    parser.add_argument("--out-dir", required=True)
    args = parser.parse_args(argv)

    summary = generate_all(
        pathlib.Path(args.sheets_dir), pathlib.Path(args.snapshot_dir), pathlib.Path(args.out_dir)
    )
    print(f"new suppliers: {summary['new_suppliers']}")
    print(f"new product id range: {summary['new_product_id_range']} ({summary['new_products_count']} products)")
    print(f"new (supplier, product) pairs: {summary['new_pairs_count']}")
    print(f"settings row counts: {summary['settings_counts']}")
    print(f"pin counts: {summary['pin_counts']}")
    print(f"quarantined names: {summary['quarantined_total']} (by rule: {summary['quarantined_by_rule']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
