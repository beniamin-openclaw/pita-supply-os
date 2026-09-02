import { describe, it, expect } from "vitest";

import { STRINGS, interpolateTemplate, type Lang } from "../../../i18n";
import type { StringKey } from "../../../i18n/strings";
import type { InventoryCountDetail, InventoryCountDetailLine } from "../../../types";
import { buildInventoryCsv, inventoryCsvFilename } from "./inventoryCsv";

/** Minimal `t` fixture driven by the real STRINGS table (mirrors
 * transport.test.ts / gmailDraft.test.ts). */
function makeT(lang: Lang = "pl") {
  return (key: StringKey, vars?: Record<string, string | number>): string =>
    interpolateTemplate(STRINGS[key][lang], vars);
}

function line(overrides: Partial<InventoryCountDetailLine> = {}): InventoryCountDetailLine {
  return {
    product_id: "P1",
    product_name_pl: "Pomidory",
    product_category: "Warzywa",
    inventory_unit: "kg",
    is_critical: false,
    current_stock_qty_base: 12.5,
    count_comment: "",
    ...overrides,
  };
}

function detail(overrides: Partial<InventoryCountDetail> = {}): InventoryCountDetail {
  return {
    count_id: "INV-20260901-WOL-abc123",
    location_id: "WOLA",
    location_name: "Pita Bros Wola",
    count_date: "2026-09-01",
    count_submitted_at: "2026-09-01T10:15:00+00:00",
    count_user: "Jan Kowalski",
    last_edited_at: null,
    line_count: 1,
    notes: "",
    lines: [line()],
    ...overrides,
  };
}

/** Strip the leading BOM and split into rows — the shape every test below
 * inspects. */
function rowsOf(csv: string): string[] {
  return csv.slice(1).split("\r\n");
}

describe("buildInventoryCsv", () => {
  it("prefixes the document with a UTF-8 BOM", () => {
    const csv = buildInventoryCsv(detail(), makeT());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.length).toBeGreaterThan(1);
  });

  it("leads with the location/date/counted-by metadata, blank line, then the header", () => {
    const rows = rowsOf(buildInventoryCsv(detail(), makeT()));
    expect(rows[0]).toBe("Lokalizacja;Pita Bros Wola");
    expect(rows[1]).toBe("Data;2026-09-01 10:15:00+00:00");
    expect(rows[2]).toBe("Liczył;Jan Kowalski");
    expect(rows[3]).toBe("Korygowano;Nie");
    expect(rows[4]).toBe("");
    expect(rows[5]).toBe(
      "Produkt;Kategoria;Jednostka;Ilość;Krytyczny;Cena jedn. (PLN);Wartość (PLN);Komentarz",
    );
  });

  it("falls back to count_date when count_submitted_at is absent", () => {
    const rows = rowsOf(buildInventoryCsv(detail({ count_submitted_at: null }), makeT()));
    expect(rows[1]).toBe("Data;2026-09-01");
  });

  it("marks a corrected snapshot with the correction timestamp, an uncorrected one with just Nie", () => {
    const correctedRows = rowsOf(
      buildInventoryCsv(detail({ last_edited_at: "2026-09-02T08:30:00+00:00" }), makeT()),
    );
    expect(correctedRows[3]).toBe("Korygowano;Tak (2026-09-02 08:30:00+00:00)");

    const uncorrectedRows = rowsOf(buildInventoryCsv(detail({ last_edited_at: null }), makeT()));
    expect(uncorrectedRows[3]).toBe("Korygowano;Nie");
  });

  it("is language-aware for the header row (en)", () => {
    const rows = rowsOf(buildInventoryCsv(detail(), makeT("en")));
    expect(rows[5]).toBe("Product;Category;Unit;Quantity;Critical;Unit price (PLN);Value (PLN);Comment");
  });

  it("renders a normal product row with a comma decimal separator and empty price/value cells", () => {
    const rows = rowsOf(buildInventoryCsv(detail({ lines: [line()] }), makeT()));
    // header at index 5 -> the one product row is index 6.
    expect(rows[6]).toBe("Pomidory;Warzywa;kg;12,5;Nie;;;");
  });

  it("marks a critical product as Tak in the Krytyczny column", () => {
    const rows = rowsOf(
      buildInventoryCsv(detail({ lines: [line({ is_critical: true })] }), makeT()),
    );
    expect(rows[6]).toBe("Pomidory;Warzywa;kg;12,5;Tak;;;");
  });

  it("renders a whole-number quantity without a trailing comma", () => {
    const rows = rowsOf(
      buildInventoryCsv(detail({ lines: [line({ current_stock_qty_base: 8 })] }), makeT()),
    );
    expect(rows[6]).toBe("Pomidory;Warzywa;kg;8;Nie;;;");
  });

  it("escapes a comment containing a semicolon and a double quote", () => {
    const rows = rowsOf(
      buildInventoryCsv(
        detail({ lines: [line({ count_comment: 'Braki 5 szt; sprawdzić "dostawcę"' })] }),
        makeT(),
      ),
    );
    expect(rows[6]).toBe('Pomidory;Warzywa;kg;12,5;Nie;;;"Braki 5 szt; sprawdzić ""dostawcę"""');
  });

  it("renders one row per counted product, in the given order", () => {
    const rows = rowsOf(
      buildInventoryCsv(
        detail({
          lines: [
            line({ product_id: "P1", product_name_pl: "Pomidory" }),
            line({ product_id: "P2", product_name_pl: "Cebula", current_stock_qty_base: 3 }),
          ],
        }),
        makeT(),
      ),
    );
    expect(rows[6]).toContain("Pomidory");
    expect(rows[7]).toContain("Cebula");
  });

  it("ends with a TOTAL row whose value column is left empty, not zero", () => {
    const rows = rowsOf(buildInventoryCsv(detail({ lines: [line(), line()] }), makeT()));
    const totalRow = rows[rows.length - 1];
    expect(totalRow).toBe(["RAZEM", "", "", "", "", "", "", ""].join(";"));
  });

  it("is language-aware for the TOTAL row label (en)", () => {
    const rows = rowsOf(buildInventoryCsv(detail(), makeT("en")));
    expect(rows[rows.length - 1]).toBe(["TOTAL", "", "", "", "", "", "", ""].join(";"));
  });

  it("handles a snapshot with no counted lines (header immediately followed by the TOTAL row)", () => {
    const rows = rowsOf(buildInventoryCsv(detail({ lines: [], line_count: 0 }), makeT()));
    expect(rows[6]).toBe(["RAZEM", "", "", "", "", "", "", ""].join(";"));
  });
});

describe("inventoryCsvFilename", () => {
  it("builds remanent_<location_id>_<count_date>.csv", () => {
    expect(inventoryCsvFilename(detail())).toBe("remanent_WOLA_2026-09-01.csv");
  });

  it("uses the detail's own location_id and count_date", () => {
    expect(
      inventoryCsvFilename(detail({ location_id: "BRACKA", count_date: "2026-01-15" })),
    ).toBe("remanent_BRACKA_2026-01-15.csv");
  });
});
