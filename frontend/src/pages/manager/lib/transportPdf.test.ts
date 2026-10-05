import { describe, it, expect } from "vitest";

import { STRINGS, interpolateTemplate, type Lang } from "../../../i18n";
import type { StringKey } from "../../../i18n/strings";
import type { TransportBatchDetail } from "../../../types";
import { buildTransportDriverPrintDoc, buildTransportPagoPrintDoc } from "./transport";
import {
  buildDriverPdfDocDefinition,
  buildPagoPdfDocDefinition,
  transportPdfFilename,
} from "./transportPdf";

/** Minimal `t` fixture driven by the real STRINGS table (mirrors transport.test.ts). */
function makeT(lang: Lang = "pl") {
  return (key: StringKey, vars?: Record<string, string | number>): string =>
    interpolateTemplate(STRINGS[key][lang], vars);
}

/** Minimal batch fixture — only the fields the builders read matter (mirrors
 * transport.test.ts's `batch()`). */
function batch(overrides: Partial<TransportBatchDetail> = {}): TransportBatchDetail {
  return {
    transport_id: "TRN-20260821-BUKA-abc123",
    supplier_id: "SUP_BUKAT",
    supplier_name: "Bukat",
    created: "2026-08-21T09:15:00+00:00",
    order_count: 2,
    location_ids: ["WOLA", "BRACKA"],
    status: "sent",
    notes: "",
    total_weight_kg: 0,
    unknown_weight_count: 0,
    events: [],
    orders: [
      { order_id: "ORD-1", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_sent", lines: [] },
      { order_id: "ORD-2", location_id: "BRACKA", location_name: "Pita Bros Bracka", status: "manager_sent", lines: [] },
    ],
    lines: [
      {
        product_id: "P1",
        product_name_pl: "Pomidory",
        supplier_product_id: "SP1",
        supplier_product_name: "Pomidory malinowe",
        purchase_unit: "kg",
        total_qty_purchase: 12,
        per_location: [
          { location_id: "WOLA", location_name: "Pita Bros Wola", order_id: "ORD-1", qty_purchase: 5 },
          { location_id: "BRACKA", location_name: "Pita Bros Bracka", order_id: "ORD-2", qty_purchase: 7 },
        ],
      },
    ],
    ...overrides,
  };
}

const GENERATED_AT = "21.08.2026, 09:20:00";

/** Recursively collect every string found anywhere in a pdfmake docDefinition's
 * content tree (text values, nested table cells, columns, stacks…) into one
 * flat searchable string — good enough for "does X appear anywhere" assertions
 * without depending on pdfmake's exact node shapes. */
function flattenText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join(" ");
  if (typeof node === "object") {
    return Object.values(node as Record<string, unknown>).map(flattenText).join(" ");
  }
  return "";
}

/** Collect every `fillColor` value present anywhere in the doc tree. */
function collectFillColors(node: unknown): string[] {
  if (node == null) return [];
  if (Array.isArray(node)) return node.flatMap(collectFillColors);
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const own = typeof obj.fillColor === "string" ? [obj.fillColor as string] : [];
    return [...own, ...Object.values(obj).flatMap(collectFillColors)];
  }
  return [];
}

describe("transportPdfFilename", () => {
  it("slugifies the display label with the separator and dashes", () => {
    expect(transportPdfFilename("Transport Sobota · Warszawa · 22.08.26", "lista-kierowcy")).toBe(
      "Transport-Sobota-Warszawa-22.08.26-lista-kierowcy.pdf",
    );
  });

  it("keeps Polish diacritics", () => {
    expect(transportPdfFilename("Transport Środa · Żoliborz", "zamowienie")).toBe(
      "Transport-Środa-Żoliborz-zamowienie.pdf",
    );
  });

  it("strips characters illegal in filenames without eating separator dashes", () => {
    // The illegal characters here carry no surrounding whitespace, so nothing
    // introduces a new dash — the invariant under test is that a real
    // separator dash (from " · " or whitespace) survives the strip pass.
    expect(transportPdfFilename('Bad:/Name*?"<>|Here', "lista-kierowcy")).toBe(
      "BadNameHere-lista-kierowcy.pdf",
    );
    expect(transportPdfFilename('Bad:Name · Illegal*Chars', "zamowienie")).toBe(
      "BadName-IllegalChars-zamowienie.pdf",
    );
  });

  it("collapses runs of whitespace into a single dash", () => {
    expect(transportPdfFilename("Transport   Duzo   Spacji", "zamowienie")).toBe(
      "Transport-Duzo-Spacji-zamowienie.pdf",
    );
  });
});

describe("buildDriverPdfDocDefinition", () => {
  it("includes the title bar text", () => {
    const doc = buildTransportDriverPrintDoc(batch(), "Transport Sobota · Bukat · 22.08.26");
    const pdfDoc = buildDriverPdfDocDefinition(doc, makeT(), GENERATED_AT);
    expect(flattenText(pdfDoc.content)).toContain("PITA BROS — LISTA DLA KIEROWCY");
  });

  it("has one matrix column per location plus a Razem total column", () => {
    const doc = buildTransportDriverPrintDoc(batch(), "Bukat");
    const pdfDoc = buildDriverPdfDocDefinition(doc, makeT(), GENERATED_AT);
    // The product matrix is the table with `headerRows` set (distinguishes it
    // from the borderless title bar / bordered logistics header tables, which
    // don't set headerRows).
    const table = pdfDoc.content.find(
      (node): node is { table: { widths: unknown[]; body: unknown[][]; headerRows: number } } =>
        typeof node === "object" &&
        node !== null &&
        "table" in node &&
        typeof (node as { table?: { headerRows?: unknown } }).table?.headerRows === "number",
    ) as { table: { widths: unknown[]; body: unknown[][]; headerRows: number } } | undefined;
    expect(table).toBeTruthy();
    // lp, product, unit, one column per location, total = 4 + locations.length
    expect(table!.table.widths).toHaveLength(4 + doc.locations.length);
    const headerRow = table!.table.body[0];
    const headerText = flattenText(headerRow);
    for (const loc of doc.locations) expect(headerText).toContain(loc);
    expect(headerText).toContain("Razem");
  });

  it("uses navy fillColor on the title/section bar styles referenced by the header cells", () => {
    const doc = buildTransportDriverPrintDoc(batch(), "Bukat");
    const pdfDoc = buildDriverPdfDocDefinition(doc, makeT(), GENERATED_AT);
    // Header/title bars reference named pdfmake styles (style: "titleBar" /
    // "sectionBar" / "tableHeader") rather than inlining fillColor on every
    // cell — the navy color lives in the styles dictionary those names resolve
    // against, which is itself part of the returned docDefinition.
    expect(collectFillColors(pdfDoc.styles)).toContain("#1f3864");
  });

  it("footer contains the transport id and the generated-at timestamp", () => {
    const doc = buildTransportDriverPrintDoc(batch(), "Bukat");
    const pdfDoc = buildDriverPdfDocDefinition(doc, makeT(), GENERATED_AT);
    const text = flattenText(pdfDoc.content);
    expect(text).toContain("TRN-20260821-BUKA-abc123");
    expect(text).toContain(GENERATED_AT);
  });
});

describe("buildPagoPdfDocDefinition", () => {
  it("never leaks a location name into the product table (no-location-leak invariant)", () => {
    const doc = buildTransportPagoPrintDoc(batch(), "Bukat");
    const pdfDoc = buildPagoPdfDocDefinition(doc, makeT(), GENERATED_AT);
    // Find the product table specifically (headerRows: 1, 4 columns: Lp/Produkt/Jm/Ilość).
    const productTable = pdfDoc.content.find(
      (node): node is { table: { body: unknown[][] } } =>
        typeof node === "object" &&
        node !== null &&
        "table" in node &&
        (node as { table?: { body?: unknown[][] } }).table?.body?.[0]?.length === 4,
    ) as { table: { body: unknown[][] } } | undefined;
    expect(productTable).toBeTruthy();
    const productTableText = flattenText(productTable!.table.body);
    expect(productTableText).not.toContain("Pita Bros Wola");
    expect(productTableText).not.toContain("Pita Bros Bracka");
  });

  it("leaks NO location anywhere in the document — not per product, not as a summary", () => {
    const doc = buildTransportPagoPrintDoc(batch(), "Bukat");
    const pdfDoc = buildPagoPdfDocDefinition(doc, makeT(), GENERATED_AT);
    const text = flattenText(pdfDoc.content);
    // Until 2026-09-02 the document-data box carried a locations summary line.
    // The operator removed it: the supplier has no business knowing which of
    // our locations ordered, or even how many there are. The DRIVER document
    // is the opposite case and keeps its per-location columns.
    expect(text).not.toContain("Pita Bros Bracka");
    expect(text).not.toContain("Pita Bros Wola");
    expect(text).not.toContain("Bracka");
    expect(text).not.toContain("Wola");
  });

  it("includes the Pago entity box for SUP_PAGO", () => {
    const doc = buildTransportPagoPrintDoc(batch({ supplier_id: "SUP_PAGO" }), "Pago");
    const pdfDoc = buildPagoPdfDocDefinition(doc, makeT(), GENERATED_AT);
    const text = flattenText(pdfDoc.content);
    expect(text).toContain("Pita Bros sp. z o.o.");
    expect(text).toContain("9522100633");
  });

  it("uses navy fillColor on the title bar style", () => {
    const doc = buildTransportPagoPrintDoc(batch(), "Bukat");
    const pdfDoc = buildPagoPdfDocDefinition(doc, makeT(), GENERATED_AT);
    expect(collectFillColors(pdfDoc.styles)).toContain("#1f3864");
  });

  it("footer contains the transport id", () => {
    const doc = buildTransportPagoPrintDoc(batch(), "Bukat");
    const pdfDoc = buildPagoPdfDocDefinition(doc, makeT(), GENERATED_AT);
    expect(flattenText(pdfDoc.content)).toContain("TRN-20260821-BUKA-abc123");
  });

  it("prints the product name, not the supplier_sku code, in the product column", () => {
    const b = batch({
      lines: [
        {
          product_id: "P1",
          product_name_pl: "Gyros 15 KG",
          supplier_product_id: "SP_PAGO_P024",
          supplier_product_name: "Gyros 15 KG",
          purchase_unit: "blok",
          total_qty_purchase: 10,
          per_location: [],
          supplier_sku: "PAGO-001",
          warehouse_pickup: true,
        },
      ],
    });
    const doc = buildTransportPagoPrintDoc(b, "Pago");
    const pdfDoc = buildPagoPdfDocDefinition(doc, makeT(), GENERATED_AT);
    const text = flattenText(pdfDoc.content);
    expect(text).toContain("Gyros 15 KG");
    expect(text).not.toContain("PAGO-001");
    expect(text).not.toContain("Nr katalogowy");
  });
});

// ---- training-feedback-0901 F1: ad-hoc off-catalogue items, WITH location
// attribution, on the driver PDF -------------------------------------------

describe("buildDriverPdfDocDefinition — ad-hoc items with location attribution (F1)", () => {
  it("includes each item's location name AND text when present", () => {
    const doc = buildTransportDriverPrintDoc(
      batch({
        orders: [
          { order_id: "ORD-1", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_sent", lines: [], extra_items: "Feta - 5 kg" },
          { order_id: "ORD-2", location_id: "BRACKA", location_name: "Pita Bros Bracka", status: "manager_sent", lines: [], extra_items: "Feta - 5 kg" },
        ],
      }),
      "Bukat",
    );
    const pdfDoc = buildDriverPdfDocDefinition(doc, makeT(), GENERATED_AT);
    const text = flattenText(pdfDoc.content);
    expect(text).toContain("Pita Bros Wola");
    expect(text).toContain("Pita Bros Bracka");
    // Never de-duplicated — the same text appears once PER location.
    expect(text.match(/Feta - 5 kg/g)?.length).toBe(2);
  });

  it("omits the section entirely when no member order has an ad-hoc item", () => {
    const doc = buildTransportDriverPrintDoc(batch(), "Bukat");
    const pdfDoc = buildDriverPdfDocDefinition(doc, makeT(), GENERATED_AT);
    expect(flattenText(pdfDoc.content)).not.toContain("Pozycje spoza katalogu");
  });
});

describe("buildDriverPdfDocDefinition — supplier sections (transport-pago-mory-combined)", () => {
  it("renders one navy bar and one table per supplier section, rows numbered from 1", () => {
    const b = batch({
      supplier_id: "SUP_PAGO",
      supplier_name: "Pago",
      suppliers: [
        { supplier_id: "SUP_PAGO", supplier_name: "Pago" },
        { supplier_id: "SUP_MORY", supplier_name: "Magazyn własny Mory" },
      ],
      lines: [
        { ...batch().lines[0], supplier_id: "SUP_PAGO", product_name_pl: "Gyros" },
        { ...batch().lines[0], supplier_id: "SUP_MORY", product_name_pl: "Pita" },
      ],
    });
    const doc = buildTransportDriverPrintDoc(b, "Pago");
    const pdfDoc = buildDriverPdfDocDefinition(doc, makeT(), GENERATED_AT);
    const text = flattenText(pdfDoc.content);
    expect(text.indexOf("Pago / LINEAGE")).toBeGreaterThan(-1);
    expect(text.indexOf("Magazyn własny Mory")).toBeGreaterThan(text.indexOf("Gyros"));
    expect(text.indexOf("Pita")).toBeGreaterThan(text.indexOf("Magazyn własny Mory"));
    const tables = pdfDoc.content.filter(
      (node) =>
        typeof node === "object" &&
        node !== null &&
        "table" in node &&
        typeof (node as { table?: { headerRows?: unknown } }).table?.headerRows === "number",
    ) as { table: { body: { text: string }[][] } }[];
    expect(tables).toHaveLength(2);
    for (const table of tables) expect(table.table.body[1][0].text).toBe("1");
  });
});

// ---- transport-v2: approved Pago extras on the ZOW PDF, notes on the driver PDF

describe("buildPagoPdfDocDefinition — approved extras section (transport-v2)", () => {
  const pagoWithExtras = (): TransportBatchDetail =>
    batch({
      supplier_id: "SUP_PAGO",
      supplier_name: "Pago",
      orders: [
        { order_id: "ORD-1", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_sent", lines: [], extra_items: "Tacki - 2 opak\nFeta - 5 kg" },
        { order_id: "ORD-2", location_id: "BRACKA", location_name: "Pita Bros Bracka", status: "manager_sent", lines: [] },
      ],
      lines: batch().lines.map((l) => ({ ...l, warehouse_pickup: true })),
    });

  it("prints no extras section and no extra text when nothing was approved", () => {
    const doc = buildTransportPagoPrintDoc(pagoWithExtras(), "Transport");
    const text = flattenText(buildPagoPdfDocDefinition(doc, makeT(), GENERATED_AT).content);
    expect(text).not.toContain("Pozycje dodatkowe uzgodnione z PAGO");
    expect(text).not.toContain("Tacki");
    expect(text).not.toContain("Feta");
  });

  it("prints only the approved lines, after the product table, with no location data", () => {
    const doc = buildTransportPagoPrintDoc(pagoWithExtras(), "Transport", ["Tacki - 2 opak"]);
    const pdf = buildPagoPdfDocDefinition(doc, makeT(), GENERATED_AT);
    const text = flattenText(pdf.content);
    expect(text).toContain("Pozycje dodatkowe uzgodnione z PAGO");
    expect(text).toContain("Tacki - 2 opak");
    expect(text).not.toContain("Feta");
    expect(text).not.toContain("Wola");
    expect(text).not.toContain("Bracka");

    const contentTexts = pdf.content.map((node) => flattenText(node));
    const productsAt = contentTexts.findIndex((s) => s.includes("Pomidory malinowe"));
    const titleAt = contentTexts.findIndex((s) => s.includes("Pozycje dodatkowe uzgodnione z PAGO"));
    const extraAt = contentTexts.findIndex((s) => s.includes("Tacki - 2 opak"));
    expect(productsAt).toBeGreaterThan(-1);
    expect(titleAt).toBeGreaterThan(productsAt);
    expect(extraAt).toBeGreaterThan(titleAt);
  });

  it("uses the generic title on a non-Pago supplier document", () => {
    const doc = buildTransportPagoPrintDoc(batch(), "Bukat", ["Karton extra"]);
    const text = flattenText(buildPagoPdfDocDefinition(doc, makeT(), GENERATED_AT).content);
    expect(text).toContain("Pozycje dodatkowe uzgodnione z dostawcą");
    expect(text).not.toContain("uzgodnione z PAGO");
    expect(text).toContain("Karton extra");
  });

  it("is language-aware (en)", () => {
    const doc = buildTransportPagoPrintDoc(pagoWithExtras(), "Transport", ["Tacki - 2 opak"]);
    const text = flattenText(buildPagoPdfDocDefinition(doc, makeT("en"), GENERATED_AT).content);
    expect(text).toContain("Additional items agreed with PAGO");
  });
});

describe("buildDriverPdfDocDefinition — batch notes (transport-v2)", () => {
  it("prints an 'Uwagi' row with the notes when set", () => {
    const doc = buildTransportDriverPrintDoc(batch({ notes: "  Wjazd od rampy nr 2 " }), "Transport");
    const text = flattenText(buildDriverPdfDocDefinition(doc, makeT(), GENERATED_AT).content);
    expect(text).toContain("Uwagi");
    expect(text).toContain("Wjazd od rampy nr 2");
  });

  it("prints no 'Uwagi' row when the notes are blank", () => {
    const doc = buildTransportDriverPrintDoc(batch({ notes: "   " }), "Transport");
    const text = flattenText(buildDriverPdfDocDefinition(doc, makeT(), GENERATED_AT).content);
    expect(text).not.toContain("Uwagi");
  });
});
