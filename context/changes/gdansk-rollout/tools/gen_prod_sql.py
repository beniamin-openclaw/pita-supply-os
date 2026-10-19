"""Generate the SLONY (Gdańsk) prod SQL from sheet-mapping.csv.

Run: python3 -I tools/gen_prod_sql.py  (from context/changes/gdansk-rollout/)
Writes prod-sql-1-location-catalog.sql, prod-sql-2-delete-template.sql, rollback.sql.
Prod facts embedded below were read with SELECT on 2026-10-16 (see research.md / rollout-notes.md).
"""
import csv
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
DATE = "2026-10-16"
LOC = "SLONY"

# --- prod state read 2026-10-16 -------------------------------------------------------------
TEMPLATE = (
    "P001 P002 P003 P004 P005 P006 P007 P008 P009 P010 P011 P012 P013 P014 P015 P016 P017 P018 "
    "P019 P020 P021 P022 P023 P024 P026 P027 P028 P029 P030 P031 P032 P033 P034 P035 P036 P037 "
    "P038 P039 P040 P041 P042 P043 P044 P046 P047 P048 P049 P050 P051 P052 P053 P054 P055 P056 "
    "P057 P058 P064 P065 P066 P067 P068 P069 P070 P071 P075 P076 P077 P082 P083 P084 P085 P086 "
    "P087 P088 P089 P090 P091 P092 P093 P094 P095 P096 P097 P098 P099 P100 P101 P102 P103 P104 "
    "P106 P107 P109 P111 P112 P113 P114 P116 P117 P118 P119 P121 P122 P123 P125 P127 P129 P130 "
    "P131 P132 P133 P143 P144 P176 P177"
).split()
TEMPLATE_MD5 = "11ee78f0bec056bf308d9adbc2feb457"  # md5(string_agg(s::text,'|' order by setting_id))
TEMPLATE_NOTE = "threshold TBC (sheet had no min/max)"
LEFTOVERS = "P017 P037 P039 P056 P064 P065 P068 P069 P109 P113 P114 P130".split()
COUNT_ONLY = "P029 P030 P031 P032 P033 P034 P035 P036 P176 P177".split()
LOC_BEFORE = {
    "location_name": "Pita Bros Słony Spichlerz", "delivery_address": None, "city": "Gdańsk",
    "active": False, "notes": "added 2026-08-22 (multi-location-master-data); address/city/company gap for the operator",
    "company_name": None, "company_address": None, "company_nip": None, "email": None,
    "sender_email": "slony@pitabros.pl", "phone": None, "own_catalog": False,
}
LOC_AFTER = {
    "delivery_address": "Słony Spichlerz, ul. Chmielna 10", "city": "80-748 Gdańsk",
    "company_name": "Pita Bros Gdańsk sp. z o.o.", "company_address": "ul. W. Laskonogiego 9, 02-496 Warszawa",
    "company_nip": "5223329662", "phone": "692 105 365", "own_catalog": True, "active": True,
    "notes": (f"rollout {DATE} (gdansk-rollout): adres lokalu i telefon z COMPANY_ENTITIES.md, siedziba i NIP "
              "spółki z umowy ramowej Erste (Drive); katalog własny Gdańsk (own_catalog); "
              "E-MAIL LOKALU DO UZUPEŁNIENIA"),
}

NOTE_HEAD = (f"gdansk-rollout {DATE}: dostawca miejski, katalog tylko dla SLONY (supplier_products.location_id); "
             "arkusz Marka 'Miasta poza Warszawą', zakładka Gdańsk; ")
SUPPLIERS = [  # id, name, method, minimum, nip, alerts, notes
    ("SUP_KUCHNIE_GDA", "Kuchnie Świata Gdańsk", "manual", None, "1180039859", True,
     NOTE_HEAD + "kontakt, minimum i dni dostaw do potwierdzenia — Marek; NIP jak SUP_KUCHNIE "
                 "(Kuchnie Świata S.A.); który oddział obsługuje Gdańsk - do potw."),
    ("SUP_SELGROS_GDA", "Selgros Gdańsk", "manual", None, None, True,
     NOTE_HEAD + "e-mail z arkusza: horeca.gdansk@selgros.pl (niepotwierdzony, nie wpisany w pole e-mail — "
                 "zamówienie ręczne); minimum i dni dostaw do potw."),
    ("SUP_COCACOLA_GDA", "Coca-Cola Gdańsk", "portal", None, "5242106963", True,
     NOTE_HEAD + "zamawianie przez portal: https://cchbcshop.com/websitePL/pl/ (z arkusza; jak SUP_COCACOLA); "
                 "konto / adres dostawy Gdańsk i minimum do potw.; NIP jak SUP_COCACOLA; szkło zwrotne — "
                 "skrzynki do zwrotu kapitan wpisuje w komentarzu"),
    ("SUP_WARSZAWA_GDA", "Pago + Magazyn + Lemoniady (Gdańsk)", "manual", "0.00", None, False,
     NOTE_HEAD + "jedno zamówienie Gdańska z Warszawy — Pago (Lineage), Magazyn własny Mory, lemoniady Filber, "
                 "nabiał Bukat; manager zbiera towar w Warszawie (Kopiuj listę) i oznacza jako zamówione; poza "
                 "Transportem zbiorczym; minimum 0 — towar wewnętrzny; alerty sugestii wył. jak SUP_PAGO / "
                 "SUP_WARSZAWA_KAT"),
    ("SUP_BLUESERV_GDA", "Blue Service Gdańsk", "manual", None, None, True,
     NOTE_HEAD + "lista jak warszawski Blue Service (+ biurowe z Magazynu); czy to ten sam Blue Service "
                 "(NIP 1251685763, m.filipiuk@blueservice.com.pl) czy hurtownia lokalna — do potw.; kontakt i "
                 "minimum do potw."),
]
SUP_NAME = {s[0]: s[1] for s in SUPPLIERS}
SUP_IDS = [s[0] for s in SUPPLIERS]


def q(v):
    if v is None or v == "":
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    return "'" + str(v).replace("'", "''") + "'"


def brand_of_sp(sp):  # SP_SELGROS_KAT_P021 -> SELGROS
    return sp.split("_")[1]


def brand_of_sup(sup):  # SUP_SELGROS_GDA -> SELGROS
    return sup.split("_")[1]


rows = list(csv.DictReader(open(HERE / "sheet-mapping.csv", encoding="utf-8")))
cat = [r for r in rows if r["role"] in ("P", "P0", "B")]

# --- mapping invariants ---------------------------------------------------------------------
pairs = Counter((r["supplier_id"], r["product_id"]) for r in cat)
assert all(n == 1 for n in pairs.values()), [p for p, n in pairs.items() if n > 1]
prim = defaultdict(list)
for r in cat:
    if r["role"] in ("P", "P0"):
        prim[r["product_id"]].append(r)
assert all(len(v) == 1 for v in prim.values()), {k: len(v) for k, v in prim.items() if len(v) > 1}
for r in cat:
    assert r["src_sp"].endswith("_" + r["product_id"]), r
    if r["role"] == "B":
        assert r["product_id"] in prim and prim[r["product_id"]][0]["supplier_id"] != r["supplier_id"], r
    if r["role"] == "P":
        assert 0 <= float(r["min"]) <= float(r["max"]) and float(r["max"]) > 0, r
assert not set(LEFTOVERS) & set(prim), set(LEFTOVERS) & set(prim)
assert not set(COUNT_ONLY) & set(prim)
assert set(LEFTOVERS) <= set(TEMPLATE) and set(COUNT_ONLY) <= set(TEMPLATE)
kept_template = set(TEMPLATE) - set(LEFTOVERS)
assert kept_template == (set(prim) & set(TEMPLATE)) | set(COUNT_ONLY), kept_template ^ ((set(prim) & set(TEMPLATE)) | set(COUNT_ONLY))
new_products = sorted(set(prim) - set(TEMPLATE))
upd_products = sorted(p for p in set(prim) & set(TEMPLATE) if prim[p][0]["role"] == "P")
unchanged = sorted((set(prim) & set(TEMPLATE)) - set(upd_products)) + COUNT_ONLY
N_CAT = len(cat)
N_FINAL = len(prim) + len(COUNT_ONLY)
N_THRESH = sum(1 for v in prim.values() if v[0]["role"] == "P")
per_sup = {s: (sum(1 for r in cat if r["supplier_id"] == s and r["role"] != "B"),
               sum(1 for r in cat if r["supplier_id"] == s and r["role"] == "B")) for s in SUP_IDS}
assert N_CAT == 130 and N_FINAL == 121 and N_THRESH == 101, (N_CAT, N_FINAL, N_THRESH)
assert (len(new_products), len(upd_products), len(unchanged)) == (18, 90, 13)
N_AFTER1 = len(TEMPLATE) + len(new_products)  # 133
SOURCES = sorted({r["src_sp"] for r in cat})

# --- per-row SQL values ----------------------------------------------------------------------
map_values = []
for r in cat:
    sup, sp = r["supplier_id"], r["src_sp"]
    cross = brand_of_sp(sp) != brand_of_sup(sup) and sup != "SUP_WARSZAWA_GDA"
    price_null = r["price"] == "NULL"
    parts = [f"gdansk-rollout {DATE}: arkusz Marka Gdańsk poz. {r['sheet_row']}", f"pola z {sp}"]
    if r["role"] == "B":
        parts.append(f"ZAPASOWY (główny: {SUP_NAME[prim[r['product_id']][0]['supplier_id']]})")
    parts.append("cena do uzupełnienia" if price_null else "cena z wiersza źródłowego")
    if cross:
        parts.append("SKU / order_note / odbiór z magazynu nie kopiowane (inny dostawca źródłowy)")
    note = r["note"]
    if note and not (r["role"] == "B" and note.startswith("ZAPASOWY")):
        parts.append(note)
    elif r["role"] == "B" and "; " in note:
        parts.append(note.split("; ", 1)[1])
    extra = parts[3 if r["role"] == "B" else 2:]
    extra = [x for x in extra if x not in ("cena do uzupełnienia", "cena z wiersza źródłowego")
             and not x.startswith("SKU / order_note")]
    map_values.append("(" + ", ".join([
        r["sheet_row"], q(sup), q(r["product_id"]), q(sp), q(r["sheet_name"]), r["position"],
        q(r["role"] == "B"), q(r["pu"] or None), r["upp"] or "NULL", q(price_null),
        q(r["order_note"] or None), q("; ".join(extra) or None),
    ]) + ")")

set_values = []
for p in sorted(prim):
    r = prim[p][0]
    mn = r["min"] if r["role"] == "P" else "0"
    mx = r["max"] if r["role"] == "P" else "0"
    stamp = f"{SUP_NAME[r['supplier_id']]} poz. {r['sheet_row']}: arkusz {r['sheet_min'] or 0}/{r['sheet_max'] or 0} {r['sheet_unit']}".rstrip()
    if r["role"] == "P" and r["factor"] not in ("", "1"):
        stamp += f" -> {mn}/{mx} (x{r['factor']})"
    if r["role"] == "P0":
        stamp += " (bez progów)"
    set_values.append(f"({q(p)}, {mn}, {mx}, {q(stamp)})")

per_sup_sql = ",\n      ".join(f"({q(s)}, {a}, {b})" for s, (a, b) in per_sup.items())
FP = """
    SELECT md5(string_agg(t::text, '|' ORDER BY t.supplier_product_id)) FROM supplier_products t WHERE t.location_id IS NULL
""".strip()
FINGERPRINTS = {
    "shared_sp": "SELECT md5(string_agg(t::text, '|' ORDER BY t.supplier_product_id)) FROM supplier_products t WHERE t.location_id IS NULL",
    "other_scoped_sp": f"SELECT md5(string_agg(t::text, '|' ORDER BY t.supplier_product_id)) FROM supplier_products t WHERE t.location_id <> '{LOC}'",
    "other_settings": f"SELECT md5(string_agg(t::text, '|' ORDER BY t.setting_id)) FROM location_product_settings t WHERE t.location_id <> '{LOC}'",
    "other_suppliers": "SELECT md5(string_agg(t::text, '|' ORDER BY t.supplier_id)) FROM suppliers t WHERE t.supplier_id NOT IN (" + ", ".join(q(s) for s in SUP_IDS) + ")",
    "other_locations": f"SELECT md5(string_agg(t::text, '|' ORDER BY t.location_id)) FROM locations t WHERE t.location_id <> '{LOC}'",
}
SUP_IN = "(" + ", ".join(q(s) for s in SUP_IDS) + ")"
LEFT_IN = "(" + ", ".join(q(f"{LOC}__{p}") for p in LEFTOVERS) + ")"

loc_set = ",\n    ".join(f"{k} = {q(v)}" for k, v in LOC_AFTER.items())
sup_values = ",\n    ".join(
    "(" + ", ".join([q(sid), q(name), "NULL", q(method), "NULL", "NULL", minimum or "NULL", "true",
                     q(notes), q(nip), q(alerts), "false"]) + ")"
    for sid, name, method, minimum, nip, alerts, notes in SUPPLIERS)

SQL1 = f"""-- gdansk-rollout — prod SQL step 1: SLONY location + 5 Gdańsk suppliers + 130 scoped catalog rows + settings
-- Generated by context/changes/gdansk-rollout/tools/gen_prod_sql.py from sheet-mapping.csv ({DATE}).
-- No DELETE in this file. Run order: STEP 0 (save output) -> STEP 1 with dry_run = true (expect
-- 'DRY RUN OK ...', nothing written) -> STEP 1 with dry_run = false -> STEP 2 audits ->
-- prod-sql-2-delete-template.sql -> captain token SLONY:<code> on Railway (operator).
-- Code + migration 0029 are live (own_catalog / location_id / is_backup), FORUM and SUPERSAM use them.

-- =====================================================================================
-- STEP 0 — read-only diff (save the output in rollout-notes.md as "Diff przed")
-- =====================================================================================
-- 0a. location row (expect: active=false, own_catalog=false, city 'Gdańsk', no address/company)
SELECT row_to_json(l) FROM locations l WHERE location_id = '{LOC}';

-- 0b. settings: count + md5 (expect 115, md5 {TEMPLATE_MD5})
SELECT count(*), md5(string_agg(s::text, '|' ORDER BY s.setting_id)) FROM location_product_settings s WHERE s.location_id = '{LOC}';

-- 0c. new ids absent (expect 0 / 0)
SELECT (SELECT count(*) FROM suppliers WHERE supplier_id IN {SUP_IN}) AS gda_suppliers,
       (SELECT count(*) FROM supplier_products WHERE location_id = '{LOC}' OR supplier_id IN {SUP_IN}) AS slony_rows;

-- 0d. source rows (expect {len(SOURCES)} found; inactive ones are fine — the copies are written active)
WITH m(src) AS (VALUES {", ".join(f"({q(s)})" for s in SOURCES)})
SELECT count(*) AS listed, count(sp.supplier_product_id) AS found,
       string_agg(CASE WHEN NOT sp.active THEN m.src END, ', ') AS inactive_sources
FROM m LEFT JOIN supplier_products sp ON sp.supplier_product_id = m.src;

-- 0e. fingerprints of everything that must not change (compare with STEP 2 (i))
{chr(10).join(f"SELECT '{k}' AS part, ({v}) AS md5;" for k, v in FINGERPRINTS.items())}

-- 0f. activity at SLONY (expect 0 / 0 / 0)
SELECT (SELECT count(*) FROM orders WHERE location_id = '{LOC}') AS orders,
       (SELECT count(*) FROM inventory_counts WHERE location_id = '{LOC}') AS counts,
       (SELECT count(*) FROM receipts WHERE location_id = '{LOC}') AS receipts;

-- =====================================================================================
-- STEP 1 — one transaction per call. Defined once as a function (payload sent once), called with
-- dry_run = true (raises 'DRY RUN OK …' → everything rolled back) and then false, then dropped.
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.gdansk_rollout_step1(dry_run boolean) RETURNS text
LANGUAGE plpgsql AS $fn$
DECLARE
  n int;
  fp_before text[];
  fp_after text[];
  bad text;
BEGIN
  -- guards ------------------------------------------------------------------------------
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public'
     AND ((table_name = 'locations' AND column_name = 'own_catalog')
       OR (table_name = 'supplier_products' AND column_name IN ('location_id', 'is_backup')));
  IF n <> 3 THEN RAISE EXCEPTION 'migration 0029 columns missing (%)', n; END IF;

  SELECT count(*) INTO n FROM locations
   WHERE location_id = '{LOC}' AND active = false AND own_catalog = false AND delivery_address IS NULL
     AND company_nip IS NULL AND city = 'Gdańsk';
  IF n <> 1 THEN RAISE EXCEPTION 'SLONY is not in the expected pre-rollout state'; END IF;

  SELECT count(*) INTO n FROM location_product_settings WHERE location_id = '{LOC}';
  IF n <> {len(TEMPLATE)} THEN RAISE EXCEPTION 'SLONY settings: expected {len(TEMPLATE)}, found %', n; END IF;
  IF (SELECT md5(string_agg(s::text, '|' ORDER BY s.setting_id)) FROM location_product_settings s
       WHERE s.location_id = '{LOC}') <> '{TEMPLATE_MD5}' THEN
    RAISE EXCEPTION 'SLONY settings changed since the 2026-10-16 read — regenerate';
  END IF;

  IF EXISTS (SELECT 1 FROM orders WHERE location_id = '{LOC}')
     OR EXISTS (SELECT 1 FROM inventory_counts WHERE location_id = '{LOC}')
     OR EXISTS (SELECT 1 FROM receipts WHERE location_id = '{LOC}') THEN
    RAISE EXCEPTION 'SLONY already has orders / counts / receipts';
  END IF;

  IF EXISTS (SELECT 1 FROM suppliers WHERE supplier_id IN {SUP_IN}) THEN
    RAISE EXCEPTION 'a Gdańsk supplier already exists — step 1 was applied?';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_products WHERE location_id = '{LOC}' OR supplier_id IN {SUP_IN}) THEN
    RAISE EXCEPTION 'SLONY-scoped or Gdańsk catalog rows already exist';
  END IF;

  SELECT count(*) INTO n FROM supplier_products
   WHERE supplier_product_id IN ('SP_COCACOLA_P066', 'SP_COCACOLA_P067')
     AND units_per_purchase_unit = 24 AND case_unit IS NULL;
  IF n <> 2 THEN RAISE EXCEPTION 'SP_COCACOLA_P066/P067 not 24 per unit without case (%)', n; END IF;

  fp_before := ARRAY[({FINGERPRINTS['shared_sp']}),
                     ({FINGERPRINTS['other_scoped_sp']}),
                     ({FINGERPRINTS['other_settings']}),
                     ({FINGERPRINTS['other_suppliers']}),
                     ({FINGERPRINTS['other_locations']})];

  -- mapping (from sheet-mapping.csv) ----------------------------------------------------
  CREATE TEMP TABLE gda_map (
    sheet_row int, supplier_id text, product_id text, src_sp text, name text, pos int,
    is_backup boolean, pu text, upp numeric, price_null boolean, order_note text, extra text,
    cross_brand boolean, notes text
  ) ON COMMIT DROP;
  INSERT INTO gda_map (sheet_row, supplier_id, product_id, src_sp, name, pos, is_backup, pu, upp,
                       price_null, order_note, extra) VALUES
    {(","+chr(10)+"    ").join(map_values)};
  -- cross-brand source (Mory -> Blue Service, Kuchnie -> Selgros): no SKU / order_note / pickup copied;
  -- the Warsaw-goods supplier keeps them (B2 pattern)
  UPDATE gda_map SET cross_brand = split_part(src_sp, '_', 2) <> split_part(supplier_id, '_', 2)
                                   AND supplier_id <> 'SUP_WARSZAWA_GDA';
  UPDATE gda_map m SET notes = 'gdansk-rollout {DATE}: arkusz Marka Gdańsk poz. ' || m.sheet_row
      || '; pola z ' || m.src_sp
      || CASE WHEN m.is_backup THEN '; ZAPASOWY (główny: ' || (SELECT CASE p.supplier_id {" ".join(f"WHEN {q(k)} THEN {q(v)}" for k, v in SUP_NAME.items())} END
             FROM gda_map p WHERE p.product_id = m.product_id AND NOT p.is_backup) || ')' ELSE '' END
      || CASE WHEN m.price_null THEN '; cena do uzupełnienia' ELSE '; cena z wiersza źródłowego' END
      || CASE WHEN m.cross_brand THEN '; SKU / order_note / odbiór z magazynu nie kopiowane (inny dostawca źródłowy)' ELSE '' END
      || coalesce('; ' || m.extra, '');

  SELECT count(*) INTO n FROM gda_map m JOIN supplier_products sp ON sp.supplier_product_id = m.src_sp;
  IF n <> {N_CAT} THEN RAISE EXCEPTION 'source rows: expected {N_CAT} matches, found %', n; END IF;
  SELECT string_agg(m.product_id, ', ') INTO bad FROM gda_map m JOIN products p USING (product_id) WHERE NOT p.active;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'inactive products in the mapping: %', bad; END IF;

  CREATE TEMP TABLE gda_set (product_id text, mn numeric, mx numeric, stamp text) ON COMMIT DROP;
  INSERT INTO gda_set VALUES
    {(","+chr(10)+"    ").join(set_values)};

  -- 1. location -------------------------------------------------------------------------
  UPDATE locations SET
    {loc_set}
   WHERE location_id = '{LOC}';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'location update: %', n; END IF;

  -- 2. suppliers ------------------------------------------------------------------------
  INSERT INTO suppliers (supplier_id, supplier_name, email, ordering_method, delivery_days, cutoff_time,
                         minimum_order_value_pln, active, notes, nip, suggestion_alerts_enabled,
                         coverage_prompt_enabled)
  VALUES
    {sup_values};
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> {len(SUPPLIERS)} THEN RAISE EXCEPTION 'suppliers inserted: %', n; END IF;

  -- 3. scoped catalog rows (copies of the source rows with overrides; always active) -----
  INSERT INTO supplier_products (supplier_product_id, supplier_id, product_id, supplier_product_name,
         purchase_unit, units_per_purchase_unit, rounding_rule, price_estimate_pln, active, notes,
         order_note, unit_weight_kg, supplier_sku, warehouse_pickup, display_order,
         counts_toward_minimum, case_unit, units_per_case, location_id, is_backup)
  SELECT 'SP_' || substr(m.supplier_id, 5) || '_' || m.product_id, m.supplier_id, m.product_id, m.name,
         coalesce(m.pu, sp.purchase_unit), coalesce(m.upp, sp.units_per_purchase_unit), sp.rounding_rule,
         CASE WHEN m.price_null THEN NULL ELSE sp.price_estimate_pln END, true, m.notes,
         CASE WHEN m.order_note IS NOT NULL THEN m.order_note WHEN m.cross_brand THEN NULL ELSE sp.order_note END,
         sp.unit_weight_kg,
         CASE WHEN m.cross_brand OR m.price_null THEN NULL ELSE sp.supplier_sku END,
         CASE WHEN m.cross_brand THEN false ELSE sp.warehouse_pickup END,
         m.pos, sp.counts_toward_minimum, sp.case_unit, sp.units_per_case, '{LOC}', m.is_backup
    FROM gda_map m JOIN supplier_products sp ON sp.supplier_product_id = m.src_sp;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> {N_CAT} THEN RAISE EXCEPTION 'catalog rows inserted: %', n; END IF;

  -- 4. settings: update template rows (old values stamped verbatim in notes), insert new rows
  UPDATE location_product_settings s
     SET min_stock_qty_base = v.mn, target_stock_qty_base = v.mx, max_stock_qty_base = v.mx,
         notes = s.notes || ' [{DATE} arkusz GDA, przed ' || s.min_stock_qty_base::text || '/'
                 || s.target_stock_qty_base::text || '/' || s.max_stock_qty_base::text || '; ' || v.stamp || ']'
    FROM gda_set v
   WHERE s.location_id = '{LOC}' AND s.product_id = v.product_id
     AND (s.min_stock_qty_base, s.target_stock_qty_base, s.max_stock_qty_base) IS DISTINCT FROM (v.mn, v.mx, v.mx);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> {len(upd_products)} THEN RAISE EXCEPTION 'settings updated: expected {len(upd_products)}, got %', n; END IF;

  INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base,
         max_stock_qty_base, target_stock_qty_base, is_critical_for_location,
         allow_over_max_due_to_packaging, notes)
  SELECT '{LOC}__' || v.product_id, '{LOC}', v.product_id, v.mn, v.mx, v.mx, false, false,
         '{DATE} arkusz GDA (nowy wiersz); ' || v.stamp
    FROM gda_set v
   WHERE NOT EXISTS (SELECT 1 FROM location_product_settings s WHERE s.location_id = '{LOC}' AND s.product_id = v.product_id);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> {len(new_products)} THEN RAISE EXCEPTION 'settings inserted: expected {len(new_products)}, got %', n; END IF;

  -- post-checks -------------------------------------------------------------------------
  SELECT string_agg(e.supplier_id, ', ') INTO bad FROM (VALUES
      {per_sup_sql}) e(supplier_id, n_primary, n_backup)
   WHERE (SELECT count(*) FROM supplier_products sp WHERE sp.supplier_id = e.supplier_id AND sp.location_id = '{LOC}'
           AND sp.active AND NOT sp.is_backup) <> e.n_primary
      OR (SELECT count(*) FROM supplier_products sp WHERE sp.supplier_id = e.supplier_id AND sp.location_id = '{LOC}'
           AND sp.active AND sp.is_backup) <> e.n_backup;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'per-supplier primary/backup counts wrong: %', bad; END IF;

  SELECT string_agg(b.supplier_product_id, ', ') INTO bad FROM supplier_products b
   WHERE b.location_id = '{LOC}' AND b.is_backup AND b.active
     AND NOT EXISTS (SELECT 1 FROM supplier_products p WHERE p.location_id = '{LOC}' AND p.product_id = b.product_id
                      AND p.active AND NOT p.is_backup);
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'backup without primary: %', bad; END IF;

  SELECT string_agg(product_id, ', ') INTO bad FROM (
    SELECT product_id FROM supplier_products WHERE location_id = '{LOC}' AND active AND NOT is_backup
     GROUP BY product_id HAVING count(*) > 1) x;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'two primaries: %', bad; END IF;

  SELECT string_agg(supplier_id || '/' || product_id, ', ') INTO bad FROM (
    SELECT supplier_id, product_id FROM supplier_products WHERE location_id = '{LOC}' AND active
     GROUP BY supplier_id, product_id HAVING count(*) > 1) x;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'duplicate active (supplier, product): %', bad; END IF;

  SELECT string_agg(sp.supplier_product_id, ', ') INTO bad FROM supplier_products sp
   WHERE sp.location_id = '{LOC}'
     AND NOT EXISTS (SELECT 1 FROM location_product_settings s WHERE s.location_id = '{LOC}' AND s.product_id = sp.product_id);
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'scoped rows without settings: %', bad; END IF;

  SELECT count(*) INTO n FROM supplier_products
   WHERE supplier_id IN {SUP_IN} AND (location_id IS DISTINCT FROM '{LOC}' OR NOT active);
  IF n <> 0 THEN RAISE EXCEPTION 'Gdańsk supplier rows outside SLONY or inactive: %', n; END IF;

  SELECT count(*) INTO n FROM location_product_settings
   WHERE location_id = '{LOC}' AND NOT (min_stock_qty_base <= target_stock_qty_base AND target_stock_qty_base <= max_stock_qty_base
                                       AND target_stock_qty_base = max_stock_qty_base);
  IF n <> 0 THEN RAISE EXCEPTION 'settings with min > target / target <> max: %', n; END IF;

  SELECT count(*) INTO n FROM location_product_settings WHERE location_id = '{LOC}';
  IF n <> {N_AFTER1} THEN RAISE EXCEPTION 'settings total: expected {N_AFTER1}, got %', n; END IF;
  SELECT count(*) INTO n FROM location_product_settings WHERE location_id = '{LOC}' AND max_stock_qty_base > 0;
  IF n <> {N_THRESH} THEN RAISE EXCEPTION 'settings with thresholds: expected {N_THRESH}, got %', n; END IF;

  fp_after := ARRAY[({FINGERPRINTS['shared_sp']}),
                    ({FINGERPRINTS['other_scoped_sp']}),
                    ({FINGERPRINTS['other_settings']}),
                    ({FINGERPRINTS['other_suppliers']}),
                    ({FINGERPRINTS['other_locations']})];
  IF fp_after IS DISTINCT FROM fp_before THEN
    RAISE EXCEPTION 'data outside SLONY changed: % -> %', fp_before, fp_after;
  END IF;

  IF dry_run THEN
    RAISE EXCEPTION 'DRY RUN OK: location 1, suppliers {len(SUPPLIERS)}, catalog rows {N_CAT}, settings updated {len(upd_products)} / inserted {len(new_products)} / total {N_AFTER1} ({N_THRESH} with thresholds); nothing written';
  END IF;
  RETURN 'APPLIED: location 1, suppliers {len(SUPPLIERS)}, catalog rows {N_CAT}, settings updated {len(upd_products)} / inserted {len(new_products)} / total {N_AFTER1}';
END
$fn$;

SELECT public.gdansk_rollout_step1(true);   -- expect ERROR 'DRY RUN OK: …' (nothing written)
SELECT public.gdansk_rollout_step1(false);  -- the real run, returns 'APPLIED: …'
DROP FUNCTION public.gdansk_rollout_step1(boolean);

-- =====================================================================================
-- STEP 2 — audits (read-only). Expected result next to each query.
-- =====================================================================================
-- (a) suppliers — expect 5 rows, active, e-mail NULL; alerts off only for SUP_WARSZAWA_GDA
SELECT supplier_id, supplier_name, ordering_method, email, minimum_order_value_pln, nip, active,
       suggestion_alerts_enabled, coverage_prompt_enabled
  FROM suppliers WHERE supplier_id IN {SUP_IN} ORDER BY supplier_id;

-- (b) catalog per supplier — expect {", ".join(f"{s.split('_')[1]} {a}+{b}" for s, (a, b) in per_sup.items())} (primary+backup), all active
SELECT supplier_id, count(*) FILTER (WHERE NOT is_backup) AS primary_rows, count(*) FILTER (WHERE is_backup) AS backup_rows,
       count(*) FILTER (WHERE NOT active) AS inactive
  FROM supplier_products WHERE location_id = '{LOC}' GROUP BY supplier_id ORDER BY supplier_id;

-- (c) backups without an active primary at SLONY — expect 0 rows
SELECT b.supplier_product_id FROM supplier_products b
 WHERE b.location_id = '{LOC}' AND b.is_backup AND b.active
   AND NOT EXISTS (SELECT 1 FROM supplier_products p WHERE p.location_id = '{LOC}' AND p.product_id = b.product_id AND p.active AND NOT p.is_backup);

-- (d) scoped rows without settings — expect 0 rows
SELECT sp.supplier_product_id FROM supplier_products sp
 WHERE sp.location_id = '{LOC}'
   AND NOT EXISTS (SELECT 1 FROM location_product_settings s WHERE s.location_id = '{LOC}' AND s.product_id = sp.product_id);

-- (e) settings — expect total {N_AFTER1} before step 2 ({N_FINAL} after), {N_THRESH} with thresholds, 0 bad
SELECT count(*) AS total, count(*) FILTER (WHERE max_stock_qty_base > 0) AS with_thresholds,
       count(*) FILTER (WHERE NOT (min_stock_qty_base <= target_stock_qty_base AND target_stock_qty_base = max_stock_qty_base)) AS bad
  FROM location_product_settings WHERE location_id = '{LOC}';

-- (f) captain view: tabs with orderable rows — expect 5 suppliers ({", ".join(f"{s.split('_')[1]} {a + b}" for s, (a, b) in per_sup.items())})
SELECT su.supplier_name, count(*) AS orderable
  FROM supplier_products sp
  JOIN suppliers su ON su.supplier_id = sp.supplier_id AND su.active
  JOIN products p ON p.product_id = sp.product_id AND p.active
  JOIN location_product_settings s ON s.location_id = '{LOC}' AND s.product_id = sp.product_id
 WHERE sp.location_id = '{LOC}' AND sp.active
 GROUP BY su.supplier_name ORDER BY 1;

-- (g) inventory list size (settings with an active product) — expect {N_AFTER1 - 1} before step 2 (P037 inactive), {N_FINAL} after
SELECT count(*) FROM location_product_settings s JOIN products p USING (product_id) WHERE s.location_id = '{LOC}' AND p.active;

-- (h) location row — expect active, own_catalog, Chmielna 10, Pita Bros Gdańsk sp. z o.o., 5223329662
SELECT row_to_json(l) FROM locations l WHERE location_id = '{LOC}';

-- (i) fingerprints — expect identical to STEP 0e
{chr(10).join(f"SELECT '{k}' AS part, ({v}) AS md5;" for k, v in FINGERPRINTS.items())}
"""

leftover_values = ",\n    ".join(
    f"({q(f'{LOC}__{p}')}, {q(LOC)}, {q(p)}, 0.0000, 0.0000, 0.0000, false, false, {q(TEMPLATE_NOTE)}, NULL)"
    for p in LEFTOVERS)

SQL2 = f"""-- gdansk-rollout — prod SQL step 2: delete the {len(LEFTOVERS)} template leftovers at SLONY
-- Contains DELETE: the Supabase connector asks a human to confirm — run as its own call with the
-- operator at the screen (lessons.md). Run only after step 1. The captain token goes live after this.
-- Leftovers = template products Gdańsk does not carry (they would show on the inventory list):
-- {", ".join(LEFTOVERS)}.

-- STEP 0 — backup check (read-only): expect {len(LEFTOVERS)} x 'match'
WITH b(setting_id, location_id, product_id, min_stock_qty_base, max_stock_qty_base, target_stock_qty_base,
       is_critical_for_location, allow_over_max_due_to_packaging, notes, inventory_order) AS (VALUES
    {leftover_values})
SELECT b.setting_id,
       CASE WHEN s.setting_id IS NULL THEN 'MISSING'
            WHEN (s.location_id, s.product_id, s.min_stock_qty_base, s.max_stock_qty_base, s.target_stock_qty_base,
                  s.is_critical_for_location, s.allow_over_max_due_to_packaging, s.notes, s.inventory_order)
                 IS NOT DISTINCT FROM
                 (b.location_id, b.product_id, b.min_stock_qty_base, b.max_stock_qty_base, b.target_stock_qty_base,
                  b.is_critical_for_location, b.allow_over_max_due_to_packaging, b.notes, b.inventory_order::int)
            THEN 'match' ELSE 'DIFFERS' END AS state
  FROM b LEFT JOIN location_product_settings s ON s.setting_id = b.setting_id ORDER BY 1;

-- STEP 1 — guarded delete (one transaction)
DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM locations WHERE location_id = '{LOC}' AND own_catalog AND active) THEN
    RAISE EXCEPTION 'step 1 not applied (SLONY not own_catalog/active)';
  END IF;
  SELECT count(*) INTO n FROM suppliers WHERE supplier_id IN {SUP_IN} AND active;
  IF n <> {len(SUPPLIERS)} THEN RAISE EXCEPTION 'step 1 not applied (suppliers %)', n; END IF;
  SELECT count(*) INTO n FROM supplier_products WHERE location_id = '{LOC}' AND active;
  IF n <> {N_CAT} THEN RAISE EXCEPTION 'step 1 not applied (catalog rows %)', n; END IF;
  SELECT count(*) INTO n FROM location_product_settings WHERE location_id = '{LOC}';
  IF n <> {N_AFTER1} THEN RAISE EXCEPTION 'SLONY settings: expected {N_AFTER1}, found %', n; END IF;
  IF EXISTS (SELECT 1 FROM inventory_counts WHERE location_id = '{LOC}') THEN
    RAISE EXCEPTION 'SLONY already has inventory counts';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_products WHERE location_id = '{LOC}' AND product_id IN ({", ".join(q(p) for p in LEFTOVERS)})) THEN
    RAISE EXCEPTION 'a leftover product has a SLONY catalog row';
  END IF;

  SELECT count(*) INTO n FROM location_product_settings s
   WHERE s.setting_id IN {LEFT_IN} AND s.location_id = '{LOC}'
     AND s.min_stock_qty_base = 0 AND s.max_stock_qty_base = 0 AND s.target_stock_qty_base = 0
     AND NOT s.is_critical_for_location AND NOT s.allow_over_max_due_to_packaging
     AND s.notes = {q(TEMPLATE_NOTE)} AND s.inventory_order IS NULL;
  IF n <> {len(LEFTOVERS)} THEN RAISE EXCEPTION 'leftover rows differ from the backup (% of {len(LEFTOVERS)} match)', n; END IF;

  DELETE FROM location_product_settings WHERE location_id = '{LOC}' AND setting_id IN {LEFT_IN};
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> {len(LEFTOVERS)} THEN RAISE EXCEPTION 'deleted %', n; END IF;

  SELECT count(*) INTO n FROM location_product_settings WHERE location_id = '{LOC}';
  IF n <> {N_FINAL} THEN RAISE EXCEPTION 'SLONY settings after delete: expected {N_FINAL}, got %', n; END IF;
  RAISE NOTICE 'DELETED {len(LEFTOVERS)} leftovers; SLONY settings = {N_FINAL}';
END $$;

-- STEP 2 — audits: expect total {N_FINAL}, inventory list {N_FINAL}, leftovers 0
SELECT count(*) AS total,
       (SELECT count(*) FROM location_product_settings s JOIN products p USING (product_id) WHERE s.location_id = '{LOC}' AND p.active) AS inventory_list,
       (SELECT count(*) FROM location_product_settings WHERE setting_id IN {LEFT_IN}) AS leftovers
  FROM location_product_settings WHERE location_id = '{LOC}';
"""

loc_restore = ",\n    ".join(f"{k} = {q(v)}" for k, v in LOC_BEFORE.items() if k != "location_name")

RB = f"""-- gdansk-rollout — rollback
-- PART 1 (kill switch, UPDATE only — safe unattended): deactivates the 5 Gdańsk suppliers and every
--   SLONY-scoped catalog row. The captain then sees no supplier tabs. NOT a hard stop: an already open
--   order screen can still submit (captain_submit resolves inactive scoped rows). The hard stop is
--   removing the SLONY:<code> pair from Railway SUPPLY_OS_CAPTAIN_TOKENS.
-- PART 2 (full data rollback, has DELETE — operator at the screen): ONLY after the SLONY token is
--   removed from Railway — it restores own_catalog=false + the template, i.e. the Warsaw catalog.
--   Refuses if SLONY has any order / count / receipt. Ends by checking the settings md5 equals the
--   2026-10-16 read ({TEMPLATE_MD5}).

-- =====================================================================================
-- PART 1 — kill switch
-- =====================================================================================
BEGIN;
DO $$
DECLARE n_sup int; n_sp int;
BEGIN
  UPDATE suppliers SET active = false WHERE supplier_id IN {SUP_IN} AND active;
  GET DIAGNOSTICS n_sup = ROW_COUNT;
  UPDATE supplier_products SET active = false WHERE location_id = '{LOC}' AND supplier_id IN {SUP_IN} AND active;
  GET DIAGNOSTICS n_sp = ROW_COUNT;
  IF n_sup > {len(SUPPLIERS)} OR n_sp > {N_CAT} THEN RAISE EXCEPTION 'unexpected counts % / %', n_sup, n_sp; END IF;
  RAISE NOTICE 'kill switch: % suppliers, % catalog rows deactivated', n_sup, n_sp;
END $$;
COMMIT;
-- Undo PART 1: UPDATE suppliers SET active = true WHERE supplier_id IN {SUP_IN};
--              UPDATE supplier_products SET active = true WHERE location_id = '{LOC}' AND supplier_id IN {SUP_IN};

-- =====================================================================================
-- PART 2 — full data rollback (opt-in: uncomment the SET LOCAL line)
-- =====================================================================================
BEGIN;
-- SET LOCAL gdansk.rollback = 'yes';
DO $$
DECLARE n int;
BEGIN
  IF coalesce(current_setting('gdansk.rollback', true), '') <> 'yes' THEN
    RAISE EXCEPTION 'PART 2 is opt-in: uncomment SET LOCAL gdansk.rollback = ''yes'' (token removed from Railway first)';
  END IF;
  IF EXISTS (SELECT 1 FROM orders WHERE location_id = '{LOC}')
     OR EXISTS (SELECT 1 FROM inventory_counts WHERE location_id = '{LOC}')
     OR EXISTS (SELECT 1 FROM receipts WHERE location_id = '{LOC}') THEN
    RAISE EXCEPTION 'SLONY has orders / counts / receipts — stay on PART 1 (keeps history)';
  END IF;
  IF EXISTS (SELECT 1 FROM supplier_delivery_rules WHERE supplier_id IN {SUP_IN}) THEN
    RAISE EXCEPTION 'delivery rules reference Gdańsk suppliers — remove them first';
  END IF;

  -- R-2: re-insert the {len(LEFTOVERS)} leftovers deleted by step 2 (no-op if step 2 never ran)
  INSERT INTO location_product_settings (setting_id, location_id, product_id, min_stock_qty_base,
         max_stock_qty_base, target_stock_qty_base, is_critical_for_location,
         allow_over_max_due_to_packaging, notes, inventory_order)
  VALUES
    {leftover_values}
  ON CONFLICT (setting_id) DO NOTHING;

  -- R-1: catalog rows, suppliers, settings, location
  DELETE FROM supplier_products WHERE location_id = '{LOC}' AND supplier_id IN {SUP_IN};
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n NOT IN (0, {N_CAT}) THEN RAISE EXCEPTION 'catalog rows deleted: %', n; END IF;
  IF EXISTS (SELECT 1 FROM supplier_products WHERE supplier_id IN {SUP_IN}) THEN
    RAISE EXCEPTION 'Gdańsk supplier rows outside SLONY exist';
  END IF;
  DELETE FROM suppliers WHERE supplier_id IN {SUP_IN};

  UPDATE location_product_settings s
     SET min_stock_qty_base = m[1]::numeric, target_stock_qty_base = m[2]::numeric, max_stock_qty_base = m[3]::numeric,
         notes = regexp_replace(s.notes, ' \\[{DATE} arkusz GDA, przed [^]]*\\]$', '')
    FROM (SELECT setting_id, regexp_match(notes, '\\[{DATE} arkusz GDA, przed ([0-9.]+)/([0-9.]+)/([0-9.]+);') AS m
            FROM location_product_settings WHERE location_id = '{LOC}') x
   WHERE s.setting_id = x.setting_id AND x.m IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n NOT IN (0, {len(upd_products)}) THEN RAISE EXCEPTION 'settings restored: %', n; END IF;

  DELETE FROM location_product_settings WHERE location_id = '{LOC}' AND notes LIKE '{DATE} arkusz GDA (nowy wiersz)%';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n NOT IN (0, {len(new_products)}) THEN RAISE EXCEPTION 'new settings rows deleted: %', n; END IF;

  UPDATE locations SET
    {loc_restore}
   WHERE location_id = '{LOC}';

  IF (SELECT md5(string_agg(s::text, '|' ORDER BY s.setting_id)) FROM location_product_settings s
       WHERE s.location_id = '{LOC}') <> '{TEMPLATE_MD5}' THEN
    RAISE EXCEPTION 'SLONY settings do not match the 2026-10-16 state after rollback';
  END IF;
  RAISE NOTICE 'rolled back: SLONY back to the 2026-10-16 template';
END $$;
COMMIT;
"""

(HERE / "prod-sql-1-location-catalog.sql").write_text(SQL1, encoding="utf-8")
(HERE / "prod-sql-2-delete-template.sql").write_text(SQL2, encoding="utf-8")
(HERE / "rollback.sql").write_text(RB, encoding="utf-8")
print(f"catalog rows {N_CAT}, per supplier {per_sup}, settings final {N_FINAL} "
      f"(thresholds {N_THRESH}), update {len(upd_products)}, insert {len(new_products)} {new_products}, "
      f"unchanged {len(unchanged)}, after step 1 {N_AFTER1}, sources {len(SOURCES)}")
