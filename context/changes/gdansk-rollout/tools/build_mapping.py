"""Build sheet-mapping.csv for the SLONY rollout from the Gdańsk tab dump + per-row decisions.

Run: python3 -I tools/build_mapping.py  (from context/changes/gdansk-rollout/)
Inputs: inputs/gdansk-sheet-dump.txt. Output: sheet-mapping.csv (the single source of truth for SQL).
Roles: P primary with thresholds, P0 primary 0/0/0, B backup (is_backup, no thresholds),
H held (no catalog product / pack differs), D duplicate of another row, X 0/0 with no product.
"""
import csv
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
SECTIONS = [  # (first row, last row, supplier_id, position offset, label suffix)
    (3, 10, "SUP_KUCHNIE_GDA", 2),
    (14, 82, "SUP_SELGROS_GDA", 13),
    (86, 93, "SUP_COCACOLA_GDA", 85),
    (96, 113, "SUP_WARSZAWA_GDA", 95),
    (116, 165, "SUP_BLUESERV_GDA", 115),
]
KS, SEL, CC, WAW, BS = (s[2] for s in SECTIONS)

# row: (role, product_id, source supplier_product_id, factor, overrides dict, note)
D = {}
def r(row, role, pid="", src="", factor=1, note="", **ov):
    D[row] = (role, pid, src, factor, ov, note)

# Kuchnie Świata — clone the Katowice city rows (same sheet names, same pack decisions)
r(3, "P", "P021", "SP_KUCHNIE_KAT_P021")
r(4, "P", "P022", "SP_KUCHNIE_KAT_P022", note="Selgros (poz. 24) ma 2/5 — wygrywa Kuchnie Świata 2/4 (jak Katowice)")
r(5, "P", "P015", "SP_KUCHNIE_KAT_P015")
r(6, "P", "P020", "SP_KUCHNIE_KAT_P020", 5, "arkusz karton 5 kg -> kg (x5)")
r(7, "P", "P038", "SP_KUCHNIE_KAT_P038")
r(8, "P", "P048", "SP_KUCHNIE_KAT_P048")
r(9, "H", note="brak produktu (P017 Florinis to inna pozycja) — wstrzymane jak w Katowicach")
r(10, "P", "P013", "SP_KUCHNIE_KAT_P013", 2, "arkusz bidon 2 kg -> kg (x2)")

# Selgros — clone the Katowice Selgros rows
for row, pid in [(14, "P004"), (15, "P016"), (16, "P002"), (17, "P005"), (18, "P003"), (19, "P008"),
                 (20, "P007"), (21, "P009"), (22, "P006"), (23, "P010"), (24, "P018"), (25, "P045"),
                 (26, "P001"), (27, "P046"), (28, "P047"), (29, "P043"), (30, "P042"), (31, "P044"),
                 (32, "P041"), (33, "P049"), (35, "P040"), (40, "P053"), (43, "P054"), (44, "P055"),
                 (45, "P057"), (46, "P058")]:
    r(row, "P", pid, f"SP_SELGROS_KAT_{pid}")
r(34, "P", "P023", "SP_SELGROS_KAT_P023", 2.5, "arkusz szt 2,5 kg -> kg (x2,5)")
r(41, "P", "P051", "SP_SELGROS_KAT_P051", note="arkusz 'szt' (duże), katalog kg 1:1 — waga opakowania do potw.")
r(42, "P", "P052", "SP_SELGROS_KAT_P052", note="arkusz 'szt' (duże), katalog kg 1:1 — waga opakowania do potw.")
r(47, "P", "P050", "SP_SELGROS_KAT_P050", note="arkusz 'op', katalog kg 1:1 — waga do potw.")
r(36, "B", "P021", "SP_SELGROS_KAT_P021", note="ZAPASOWY (główny: Kuchnie Świata Gdańsk); arkusz 10/36 = jak główny")
r(37, "B", "P022", "SP_SELGROS_KAT_P022", note="ZAPASOWY (główny: Kuchnie Świata Gdańsk); arkusz 2/5")
r(38, "B", "P106", "SP_SELGROS_KAT_P106", note="ZAPASOWY (główny: Blue Service Gdańsk); arkusz 1/3 = jak główny")
r(39, "B", "P107", "SP_SELGROS_KAT_P107", note="ZAPASOWY (główny: Blue Service Gdańsk); arkusz 1/3 = jak główny")
for row, pid in [(48, "P118"), (49, "P117"), (50, "P119"), (51, "P116"), (54, "P104"), (55, "P125"),
                 (57, "P122"), (60, "P127"), (64, "P095"), (65, "P096"), (72, "P088"), (74, "P123"),
                 (77, "P132"), (56, "P126")]:
    r(row, "B", pid, f"SP_SELGROS_KAT_{pid}",
      note="ZAPASOWY (główny: Blue Service Gdańsk); arkusz bez progów")
r(81, "B", "P015", "SP_KUCHNIE_P015", note="ZAPASOWY (główny: Kuchnie Świata Gdańsk); arkusz bez progów")
for row, why in [(52, "tacki 23x12 250 szt — inny rozmiar niż P143"), (53, "brak produktu (papier w roli)"),
                 (58, "spray Tytan — niejednoznaczny (P111/P113/P115)"), (59, "zmywaki Jan Niezbędny — liczba w opak. nieznana"),
                 (61, "słomki 25 szt — inna paczka niż P102 (250)"), (62, "brak produktu (kawa Nescafe 500 g)"),
                 (63, "brak produktu (mleko)"), (66, "sosjerka x50 — inna paczka niż P086 (100)"),
                 (67, "wieczko x50 — inna paczka niż P087 (100)"), (68, "torby na wynos 50 — inna paczka niż P093 (250)"),
                 (70, "brak produktu (butelka na sos)"), (71, "torebki fałdowane 50 — inna paczka niż P094"),
                 (73, "brak produktu (zapalniczka)"), (75, "końcówka szczotki — P148 to szczotka z kijem"),
                 (76, "zapas mopa Vileda (mniejszy) — niejednoznaczne: P153 to Ultra Max"), (78, "marker do tablicy — brak produktu (P132 = permanentny)"),
                 (79, "miska + pokrywki w zestawie — brak produktu"), (80, "kubeczki 150 ml — inny rozmiar niż P144 (200 ml)"), (82, "Feta 200 g — brak produktu (P014 to blok 2 kg)")]:
    r(row, "H", note=why)
r(69, "D", note="duplikat frytek (poz. 23) — jeden wiersz, jak w Katowicach")

# Coca-Cola — glass crates where a glass product exists (Westfield/Browary pattern)
CRATE = "arkusz skrzynka 24 -> szt (x24); max do pełnej skrzynki"
r(86, "P", "P186", "SP_COCACOLA_P186", 24, CRATE, crate=24)
r(87, "P", "P187", "SP_COCACOLA_P187", 24, CRATE, crate=24)
for row, pid in [(88, "P067"), (89, "P066")]:
    r(row, "P", pid, f"SP_COCACOLA_{pid}", 24,
      "arkusz szkło 0,25 skrzynka 24 -> szt (x24), max do pełnej skrzynki; brak produktu 'szkło' — wiersz katalogu jako skrzynka, cena do uzupełnienia",
      pu="skrzynka", upp="24", price="NULL", order_note="1 skrzynka = 24 szt (szkło 0,25)", crate=24)
r(90, "P", "P191", "SP_COCACOLA_P191", 24, CRATE, crate=24)
r(91, "P", "P190", "SP_COCACOLA_P190", 24, CRATE, crate=24)
r(92, "P", "P070", "SP_COCACOLA_P070", 24, "arkusz zgrzewka 24 -> szt (x24); max do pełnej zgrzewki", crate=24)
r(93, "P", "P071", "SP_COCACOLA_P071", 24, "arkusz zgrzewka 24 -> szt (x24), max do pełnej zgrzewki; 'Delice gazowana' = Kropla gazowana, do potw.", crate=24)

# Pago + Magazyn + Lemoniady — copies of the Warsaw rows (B2 pattern), label = Warsaw source
r(96, "P", "P024", "SP_PAGO_P024", 15, "arkusz szt 15 kg -> kg (x15)", label="Pago")
r(97, "P", "P027", "SP_PAGO_P027", 5, "arkusz karton 5 kg -> kg (x5)", label="Pago")
r(98, "P", "P028", "SP_PAGO_P028", 5, "arkusz karton 5 kg -> kg (x5)", label="Pago")
r(99, "P", "P026", "SP_PAGO_P026", 12, "arkusz karton 120 pit -> opak 10 (x12)", label="Pago")
r(100, "P", "P011", "SP_BUKAT_P011", label="Bukat")
r(101, "P", "P012", "SP_BUKAT_P012", label="Bukat")
r(102, "P", "P014", "SP_BUKAT_P014", label="Bukat")
r(103, "P", "P019", "SP_MORY_P019", 2, "arkusz pojemnik 2 kg -> kg (x2), do potw.", label="Magazyn")
r(104, "P", "P089", "SP_MORY_P089", label="Magazyn")
r(105, "P", "P092", "SP_MORY_P092", note="'Boxy beżowe bez logo' = P092 Tacki bez logo (operator, transport-v2)", label="Magazyn")
r(106, "P", "P090", "SP_MORY_P090", label="Magazyn")
r(107, "P", "P098", "SP_MORY_P098", label="Magazyn")
r(108, "P", "P091", "SP_MORY_P091", label="Magazyn")
r(109, "P", "P183", "SP_MORY_P183", 10, "arkusz opak 10 szt -> szt (x10); Mory opak 6 — do potw.", label="Magazyn")
r(110, "P", "P129", "SP_MORY_P129", 6, "arkusz opak 6 szt -> szt (x6)", label="Magazyn")
r(111, "P", "P077", "SP_FILBER_P077", 12, "arkusz karton 12 -> szt (x12)", label="Filber")
r(112, "P", "P075", "SP_FILBER_P075", 12, "arkusz karton 12 -> szt (x12)", label="Filber")
r(113, "P", "P076", "SP_FILBER_P076", 12, "arkusz karton 12 -> szt (x12)", label="Filber")

# BlueService — arkusz bez jednostek: pack from the Warsaw Blue Service row (x1)
for row, pid, src in [(116, "P082", "SP_BLUESERV_P082"), (117, "P083", "SP_BLUESERV_P083"),
                      (118, "P084", "SP_BLUESERV_P084"), (119, "P085", "SP_BLUESERV_P085"),
                      (120, "P086", "SP_BLUESERV_P086"), (121, "P087", "SP_BLUESERV_P087"),
                      (122, "P088", "SP_BLUESERV_P088"), (123, "P093", "SP_BLUESERV_P093"),
                      (124, "P094", "SP_BLUESERV_P094"), (125, "P095", "SP_BLUESERV_P095"),
                      (126, "P096", "SP_BLUESERV_P096"), (127, "P097", "SP_BLUESERV_P097"),
                      (129, "P100", "SP_BLUESERV_P100"), (130, "P101", "SP_BLUESERV_P101"),
                      (132, "P104", "SP_BLUESERV_P104"), (133, "P106", "SP_BLUESERV_P106"),
                      (134, "P107", "SP_BLUESERV_P107"), (135, "P108", "SP_BLUESERV_P108"),
                      (136, "P169", "SP_BLUESERV_P169"), (138, "P111", "SP_BLUESERV_P111"),
                      (139, "P112", "SP_BLUESERV_P112"), (140, "P116", "SP_BLUESERV_P116"),
                      (141, "P117", "SP_BLUESERV_P117"), (142, "P118", "SP_BLUESERV_P118"),
                      (143, "P119", "SP_BLUESERV_P119"), (145, "P122", "SP_BLUESERV_P122"),
                      (146, "P123", "SP_BLUESERV_P123"), (148, "P125", "SP_BLUESERV_P125"),
                      (150, "P102", "SP_BLUESERV_P102"), (152, "P147", "SP_BLUESERV_P147"),
                      (153, "P132", "SP_MORY_P132"), (154, "P127", "SP_MORY_P127"),
                      (157, "P131", "SP_MORY_P131"), (158, "P149", "SP_BLUESERV_P149"),
                      (159, "P150", "SP_BLUESERV_P150"), (161, "P133", "SP_MORY_P133"),
                      (165, "P143", "SP_BLUESERV_P143")]:
    r(row, "P", pid, src)
r(144, "P", "P121", "SP_BLUESERV_P121", 10, "arkusz 'DUŻE opakowanie' -> szt (x10, opak 10 jak Warszawa), do potw.")
for row, pid in [(128, "P099"), (131, "P103"), (137, "P110"), (147, "P124"), (149, "P126"),
                 (151, "P146"), (156, "P148"), (160, "P151"), (163, "P152"), (164, "P144")]:
    r(row, "P0", pid, f"SP_BLUESERV_{pid}", note="arkusz 0/0 — w katalogu bez progów (do zamówienia doraźnie)")
r(155, "X", note="arkusz 0/0, brak produktu (papier A4)")
r(162, "X", note="arkusz 0/0, brak produktu (papier duży w roli)")


def num(s):
    return float(s) if s not in ("", None) else None


def fmt(x):
    if x is None:
        return ""
    x = round(x, 4)
    return str(int(x)) if float(x).is_integer() else str(x)


rows = {}
for line in (HERE / "inputs/gdansk-sheet-dump.txt").read_text(encoding="utf-8").splitlines():
    m = re.match(r"^(\d+) (.*)$", line)
    if m:
        rows[int(m.group(1))] = dict(p.split("=", 1) for p in m.group(2).split(" | "))

out = []
for first, last, sup, off in SECTIONS:
    for row in range(first, last + 1):
        if row not in rows:
            continue
        cells = rows[row]
        if row not in D:
            raise SystemExit(f"row {row} has no decision: {cells}")
        role, pid, src, factor, ov, note = D[row]
        smin, smax = num(cells.get("C")), num(cells.get("D"))
        if role == "P":
            if smin is None or smax is None:
                raise SystemExit(f"row {row} is P without thresholds")
            mn, mx = smin * factor, smax * factor
            if ov.get("crate"):
                mx = -(-mx // ov["crate"]) * ov["crate"]
        elif role == "P0":
            mn = mx = 0.0
        else:
            mn = mx = None
        name = cells["A"].strip().replace("\t", " ")
        name = re.sub(r"\s+", " ", name)
        if ov.get("label"):
            name = f"{name} ({ov['label']})"
        out.append({
            "sheet_row": row, "supplier_id": sup, "position": row - off, "role": role,
            "product_id": pid, "src_sp": src, "sheet_name": name,
            "sheet_unit": cells.get("B", "").strip(), "sheet_min": fmt(smin), "sheet_max": fmt(smax),
            "factor": fmt(factor) if role == "P" else "", "min": fmt(mn), "max": fmt(mx),
            "pu": ov.get("pu", ""), "upp": ov.get("upp", ""), "price": ov.get("price", ""), "order_note": ov.get("order_note", ""),
            "note": note,
        })
extra = set(D) - {o["sheet_row"] for o in out}
if extra:
    raise SystemExit(f"decisions for rows not in the sheet: {sorted(extra)}")

with open(HERE / "sheet-mapping.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(out[0]))
    w.writeheader()
    w.writerows(out)

from collections import Counter  # noqa: E402
print(len(out), Counter((o["supplier_id"], o["role"]) for o in out))
