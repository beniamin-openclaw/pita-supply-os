// CSV export of one submitted inventory count, for the Manager inventory view
// (S-08 / FR-018) — operator request 2026-09-02 ("Daj opcję pobrania
// inwentaryzacji jako plik CSV z kwotami i wartością, po stronie menedżera").
// Manager-only: there is no equivalent on any Captain screen.
//
// Pure, DOM-free string builder — the Blob/anchor download trigger lives in
// ManagerInventoryPage.tsx (mirrors transportPdf.ts's split: pure builder here,
// thin browser-download wrapper in the component/page).
//
// Prices (inventory-value, 2026-10-02): the backend now joins a net price
// per inventory unit, an ESTIMATED VAT rate and the line values onto
// `InventoryCountDetailLine` (supply-os-v1/app/inventory_value.py), plus the
// totals on `InventoryCountDetail`. A line without a price keeps its price and
// value cells empty — never "0", which would claim a computed zero.

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

/** Number of columns in the header / product / TOTAL rows (kept in one place
 *  so the TOTAL row's padding can never drift from the header). */
const CSV_COLUMN_COUNT = 13;

/** Money with two decimals and a comma ("12,50"); empty for a missing value. */
function formatCsvMoney(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : n.toFixed(2).replace(".", ",");
}

/** VAT rate as a whole percent ("5%"); empty when the backend sent none. */
function formatCsvVat(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? "" : `${Math.round(rate * 100)}%`;
}

/** A threshold the backend could not join (no location setting) is `null` /
 *  absent — emitted as an empty cell, never "0" (which would falsely claim a
 *  configured zero threshold). */
function formatCsvThreshold(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : formatCsvNumber(n);
}

/** Renders an ISO instant in Europe/Warsaw as "YYYY-MM-DD HH:MM" (no UTC
 *  offset suffix), via `formatToParts` so the exact separators are ours, not
 *  locale-dependent. `hourCycle: "h23"` rather than `hour12: false` — some
 *  runtimes render `hour12: false` as "24:00" for midnight instead of
 *  "00:00". Every screen renders timestamps in Warsaw local time
 *  (`formatDateTime`, i18n/index.ts) — the CSV must agree with what the user
 *  already saw on screen, not print the raw UTC instant the backend sent. */
const WARSAW_TIMESTAMP_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** A bare "YYYY-MM-DD" date (no time component — e.g. the `count_date`
 *  fallback) has nothing to convert. Reformatting it through `new Date(...)`
 *  would parse it as UTC midnight and — once shifted into Warsaw local time —
 *  print a spurious "02:00" (or "01:00" in winter) that was never in the data. */
const BARE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** ISO date ("YYYY-MM-DD") or datetime ("YYYY-MM-DDTHH:MM:SS+00:00") -> the
 *  same instant rendered in Europe/Warsaw as "YYYY-MM-DD HH:MM". A bare date
 *  (see `BARE_DATE_RE`) passes through unchanged. */
function formatIsoForCsv(iso: string): string {
  if (BARE_DATE_RE.test(iso)) return iso;
  // `formatToParts` throws RangeError on an unparseable value, where the old
  // string-replace implementation silently could not (post-review R4). An
  // export is a read-only convenience: a malformed timestamp must degrade to
  // the raw value in one cell, never cost the operator the whole file.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = WARSAW_TIMESTAMP_PARTS.formatToParts(d);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/**
 * Build the full CSV document for one inventory count snapshot: a leading
 * metadata block (location, date, who counted, whether it was later
 * corrected), a header row, one row per counted product, and a final TOTAL
 * row. Returns a single string, BOM-prefixed, ready to hand to a `Blob`.
 *
 * Column order: Produkt, Kategoria, Jednostka, Ilość, Min, Cel, Max, Krytyczny,
 * Cena netto jedn. (PLN), Wartość netto (PLN), VAT, Wartość brutto (PLN),
 * Komentarz. Min/Cel/Max are the location thresholds joined by the backend
 * (week2-feedback-quantities Phase 4); a line without a setting leaves them
 * empty. Price/value cells come from the backend (see the file-level comment)
 * and stay empty for an unpriced line. The TOTAL row carries the backend's
 * net and gross totals, or empty cells when the backend sent none.
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
    t("manager.inventory.csv.colMin"),
    t("manager.inventory.csv.colTarget"),
    t("manager.inventory.csv.colMax"),
    t("manager.inventory.csv.colCritical"),
    t("manager.inventory.csv.colPrice"),
    t("manager.inventory.csv.colValue"),
    t("manager.inventory.csv.colVat"),
    t("manager.inventory.csv.colValueGross"),
    t("manager.inventory.csv.colComment"),
  ]);

  const productRows = detail.lines.map((line) =>
    csvRow([
      line.product_name_pl,
      line.product_category,
      line.inventory_unit,
      formatCsvNumber(line.current_stock_qty_base),
      formatCsvThreshold(line.min_stock_qty_base),
      formatCsvThreshold(line.target_stock_qty_base),
      formatCsvThreshold(line.max_stock_qty_base),
      line.is_critical ? yes : no,
      formatCsvMoney(line.unit_price_netto_pln),
      formatCsvMoney(line.value_netto_pln),
      formatCsvVat(line.vat_rate),
      formatCsvMoney(line.value_brutto_pln),
      line.count_comment,
    ]),
  );

  const totalCells = Array<string>(CSV_COLUMN_COUNT).fill("");
  totalCells[0] = t("manager.inventory.csv.totalLabel");
  totalCells[9] = formatCsvMoney(detail.total_value_netto_pln);
  totalCells[11] = formatCsvMoney(detail.total_value_brutto_pln);
  const totalRow = csvRow(totalCells);

  const lines = [...metaRows, "", header, ...productRows, totalRow];
  return BOM + lines.join(CSV_NEWLINE);
}

/** Filename for the download: `remanent_<location_id>_<count_date>.csv`
 *  (count_date is already the plain "YYYY-MM-DD" the backend sends). */
export function inventoryCsvFilename(detail: InventoryCountDetail): string {
  return `remanent_${detail.location_id}_${detail.count_date}.csv`;
}
