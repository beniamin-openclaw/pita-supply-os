// CSV export of one submitted inventory count, for the Manager inventory view
// (S-08 / FR-018) — operator request 2026-09-02 ("Daj opcję pobrania
// inwentaryzacji jako plik CSV z kwotami i wartością, po stronie menedżera").
// Manager-only: there is no equivalent on any Captain screen.
//
// Pure, DOM-free string builder — the Blob/anchor download trigger lives in
// ManagerInventoryPage.tsx (mirrors transportPdf.ts's split: pure builder here,
// thin browser-download wrapper in the component/page).
//
// THE PRICE GAP (read before touching this file): the operator asked for
// "kwoty i wartość" (unit prices + stock value). `InventoryCountDetail` /
// `InventoryCountDetailLine` (supply-os-v1/app/models.py) carry no price —
// price only exists on `SupplierProduct.price_estimate_pln`, which is keyed by
// (supplier_id, product_id). An inventory count is LOCATION-WIDE across every
// supplier (captain_inventory_products spans suppliers), so a counted product
// may map to zero, one, or several supplier_products with different prices —
// there is no single "the" price to join here even in principle, and no
// Manager-callable endpoint returns one against a plain product_id today
// (`GET /api/manager/orderable` needs a supplier_id and still returns
// `OrderableItem`, which itself carries no price field — see types.ts).
// So: the "Cena jedn." / "Wartość" columns below are ALWAYS emitted empty.
// Do NOT hardcode or guess a price here — the exact required backend follow-up
// is: add `price_estimate_pln` (or an equivalent per-supplier join) to
// `InventoryCountDetailLine` / `InventoryCountDetail` in
// supply-os-v1/app/models.py + the `_enrich_inventory_count_detail` join in
// supply-os-v1/app/main.py. Until that lands, this module has nothing to add.

import type { StringKey } from "../../../i18n/strings";
import type { InventoryCountDetail } from "../../../types";

type TFunc = (key: StringKey, vars?: Record<string, string | number>) => string;

const CSV_DELIMITER = ";"; // Polish Excel's default list separator.
const CSV_NEWLINE = "\r\n";
/** UTF-8 BOM — without it, Excel on Windows guesses a non-UTF-8 codepage and
 *  mangles Polish diacritics (ą/ć/ę/ł/ń/ó/ś/ź/ż) on open. Written as an escape
 *  (not a literal invisible character) so it survives any editor/tool that
 *  might otherwise normalize it away. */
const BOM = "\uFEFF";

/** Quote one CSV cell (RFC 4180-style, semicolon variant) when it contains the
 *  delimiter, a double quote, or a newline; double any embedded quote. A plain
 *  field passes through unchanged. */
function escapeCsvField(value: string): string {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(CSV_DELIMITER);
}

/** Polish Excel expects a comma decimal separator: "12.5" -> "12,5". Values
 *  here come straight from a submitted snapshot (not computed via
 *  subtraction/division), so there is no binary-float tail to round away
 *  first — plain string substitution is enough. */
function formatCsvNumber(n: number): string {
  return String(n).replace(".", ",");
}

/** ISO date ("YYYY-MM-DD") or datetime ("YYYY-MM-DDTHH:MM:SS+00:00") -> the
 *  same value with the "T" separator swapped for a space, so it reads as a
 *  plain timestamp in a spreadsheet cell. A bare date (no "T") is unchanged. */
function formatIsoForCsv(iso: string): string {
  return iso.replace("T", " ");
}

/**
 * Build the full CSV document for one inventory count snapshot: a leading
 * metadata block (location, date, who counted, whether it was later
 * corrected), a header row, one row per counted product, and a final TOTAL
 * row. Returns a single string, BOM-prefixed, ready to hand to a `Blob`.
 *
 * Column order: Produkt, Kategoria, Jednostka, Ilość, Krytyczny, Cena jedn.
 * (PLN), Wartość (PLN), Komentarz. "Cena jedn." and "Wartość" are ALWAYS
 * empty — see the file-level comment for why, and what backend change would
 * be needed to fill them in. The TOTAL row's value cell is likewise left
 * empty rather than "0" — there is nothing to sum, and writing "0" would
 * falsely claim a computed total of zero.
 *
 * Pure and DOM-free (no `Blob`/`document` access) so it is directly
 * unit-testable; the caller triggers the actual browser download.
 */
export function buildInventoryCsv(detail: InventoryCountDetail, t: TFunc): string {
  const yes = t("manager.inventory.csv.yes");
  const no = t("manager.inventory.csv.no");

  const correctedValue = detail.last_edited_at
    ? `${yes} (${formatIsoForCsv(detail.last_edited_at)})`
    : no;

  const metaRows = [
    csvRow([t("manager.inventory.csv.metaLocation"), detail.location_name]),
    csvRow([
      t("manager.inventory.csv.metaDate"),
      formatIsoForCsv(detail.count_submitted_at ?? detail.count_date),
    ]),
    csvRow([t("manager.inventory.csv.metaCountedBy"), detail.count_user ?? ""]),
    csvRow([t("manager.inventory.csv.metaCorrected"), correctedValue]),
  ];

  const header = csvRow([
    t("manager.inventory.csv.colProduct"),
    t("manager.inventory.csv.colCategory"),
    t("manager.inventory.csv.colUnit"),
    t("manager.inventory.csv.colQty"),
    t("manager.inventory.csv.colCritical"),
    t("manager.inventory.csv.colPrice"),
    t("manager.inventory.csv.colValue"),
    t("manager.inventory.csv.colComment"),
  ]);

  const productRows = detail.lines.map((line) =>
    csvRow([
      line.product_name_pl,
      line.product_category,
      line.inventory_unit,
      formatCsvNumber(line.current_stock_qty_base),
      line.is_critical ? yes : no,
      "", // Cena jedn. (PLN) — not reachable; see file-level comment.
      "", // Wartość (PLN) — not reachable; see file-level comment.
      line.count_comment,
    ]),
  );

  const totalRow = csvRow([t("manager.inventory.csv.totalLabel"), "", "", "", "", "", "", ""]);

  const lines = [...metaRows, "", header, ...productRows, totalRow];
  return BOM + lines.join(CSV_NEWLINE);
}

/** Filename for the download: `remanent_<location_id>_<count_date>.csv`
 *  (count_date is already the plain "YYYY-MM-DD" the backend sends). */
export function inventoryCsvFilename(detail: InventoryCountDetail): string {
  return `remanent_${detail.location_id}_${detail.count_date}.csv`;
}
