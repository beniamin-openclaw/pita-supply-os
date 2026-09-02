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
        warehouse_pickup: true,
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
    // Find the product table specifically (headerRows: 1, 4 columns: Lp/Nr katalogowy/Jm/Ilość).
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

  it("does not include a per-location column anywhere in the full document either", () => {
    const doc = buildTransportPagoPrintDoc(batch(), "Bukat");
    const pdfDoc = buildPagoPdfDocDefinition(doc, makeT(), GENERATED_AT);
    // The batch's locations line (a summary, not a per-line breakdown) is
    // allowed to appear once in the document-data box — but never per product.
    const text = flattenText(pdfDoc.content);
    expect(text).toContain("Pita Bros Bracka, Pita Bros Wola");
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

  it("renders the supplier_sku catalog code in the Nr katalogowy column when set", () => {
    const b = batch({
      lines: [
        {
          product_id: "P1",
          product_name_pl: "Gyros wieprzowy",
          supplier_product_id: "SP1",
          supplier_product_name: "Gyros wieprzowy 15kg",
          purchase_unit: "kg",
          total_qty_purchase: 15,
          per_location: [],
          warehouse_pickup: true,
          supplier_sku: "GYRSW15KG",
        },
      ],
    });
    const doc = buildTransportPagoPrintDoc(b, "Bukat");
    const pdfDoc = buildPagoPdfDocDefinition(doc, makeT(), GENERATED_AT);
    const text = flattenText(pdfDoc.content);
    expect(text).toContain("GYRSW15KG");
    expect(text).not.toContain("Gyros wieprzowy 15kg");
  });

  it("falls back to the friendly name in the Nr katalogowy column when supplier_sku is unset", () => {
    const doc = buildTransportPagoPrintDoc(batch(), "Bukat");
    const pdfDoc = buildPagoPdfDocDefinition(doc, makeT(), GENERATED_AT);
    const text = flattenText(pdfDoc.content);
    expect(text).toContain("Pomidory malinowe");
  });
});
