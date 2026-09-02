// PDF generation for the Manager Transport screen's two printable documents
// (v5 feedback — replaces the window.print()/@media-print flow entirely; see
// PrintViews.tsx). pdfmake was chosen over jsPDF specifically because its
// bundled Roboto (the vfs fonts imported at download time) covers Polish
// diacritics (ą/ć/ę/ł/ń/ó/ś/ź/ż) out of the box — jsPDF's core fonts do not.
//
// This module is split in two:
//   - buildDriverPdfDocDefinition / buildPagoPdfDocDefinition — PURE functions
//     that turn a TransportDriverPrintDoc / TransportPagoPrintDoc (the content
//     already shaped by lib/transport.ts's builders) into a plain pdfmake
//     TDocumentDefinitions object. No pdfmake import needed to build or test
//     these — they only construct data.
//   - downloadTransportPdf — a thin, deliberately untested wrapper that lazily
//     imports the (large) pdfmake runtime + its vfs Roboto fonts so pdfmake
//     never lands in the main app bundle, then triggers the browser download.
//
// Visual fidelity target: replicate the legacy print/PDF layout (see the prior
// PrintViews.tsx history) — navy title bar, light-blue label cells in the
// logistics/header tables, navy table header rows with white bold text, zebra
// body striping, a bold "Razem" total column on the driver doc, side-by-side
// entity boxes on the Pago doc, and a small grey footer line.

import type { StringKey } from "../../../i18n/strings";
import type { PrintDriverProductLine, TransportDriverPrintDoc, TransportPagoPrintDoc } from "./transport";

export type TFunc = (key: StringKey, vars?: Record<string, string | number>) => string;

// pdfmake's types ship as a namespace (no default export), so this module
// stays pdfmake-import-free at the top level (see the header comment) and
// instead declares the minimal shape of a pdfmake docDefinition it needs.
// This keeps buildDriverPdfDocDefinition/buildPagoPdfDocDefinition callable
// (and unit-testable) without ever loading the pdfmake runtime.
export interface PdfDocDefinition {
  pageSize: "A4";
  pageOrientation: "portrait";
  pageMargins: [number, number, number, number];
  defaultStyle: { fontSize: number; font?: string };
  styles: Record<string, Record<string, unknown>>;
  content: unknown[];
}

const NAVY = "#1f3864";
const LIGHT_BLUE = "#d9e8f5";
const ZEBRA = "#f1f5f9";
const GREY = "#64748b";
const BORDER_COLOR = "#94a3b8";

/** Uniform thin-grey-border layout for a data table (mirrors the print CSS's
 * `1px solid #94a3b8` cell borders). */
const TABLE_BORDER_LAYOUT = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => BORDER_COLOR,
  vLineColor: () => BORDER_COLOR,
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: () => 3,
  paddingBottom: () => 3,
};

function titleBar(text: string): unknown {
  return {
    table: { widths: ["*"], body: [[{ text, style: "titleBar" }]] },
    layout: "noBorders",
    margin: [0, 0, 0, 10] as [number, number, number, number],
  };
}

function sectionBar(text: string, light = false): unknown {
  return {
    table: { widths: ["*"], body: [[{ text, style: light ? "lightBar" : "sectionBar" }]] },
    layout: "noBorders",
    margin: [0, 10, 0, 6] as [number, number, number, number],
  };
}

/** A 2-or-4-column "label | value [| label | value]" logistics header table —
 * mirrors `.trn-print-header-table` (light-blue label cells, thin borders).
 * A cell with `colSpan: N` merges its value across N value-columns; pdfmake
 * requires the merged columns to still be present as empty placeholder
 * objects in the body row, which this appends automatically. */
function headerTable(rows: { label: string; value: string; colSpan?: number }[][]): unknown {
  const body = rows.map((row) => {
    const cells: Record<string, unknown>[] = [];
    for (const cell of row) {
      cells.push({ text: cell.label, style: "headerLabel" });
      const span = cell.colSpan ?? 1;
      if (span > 1) {
        cells.push({ text: cell.value, colSpan: span });
        for (let i = 1; i < span; i++) cells.push({});
      } else {
        cells.push({ text: cell.value });
      }
    }
    return cells;
  });
  const widthCount = body[0]?.length ?? 2;
  return {
    table: { widths: Array(widthCount).fill("*"), body },
    layout: TABLE_BORDER_LAYOUT,
    margin: [0, 0, 0, 10] as [number, number, number, number],
  };
}

function footerLine(t: TFunc, generatedAt: string, transportId: string): unknown {
  return {
    text: `${t("manager.transport.print.footerGenerated", { when: generatedAt })} — ${transportId}`,
    style: "footer",
    margin: [0, 10, 0, 0] as [number, number, number, number],
  };
}

const SHARED_STYLES: Record<string, Record<string, unknown>> = {
  titleBar: { fillColor: NAVY, color: "#ffffff", bold: true, alignment: "center", fontSize: 14, margin: [0, 8, 0, 8] },
  sectionBar: { fillColor: NAVY, color: "#ffffff", bold: true, alignment: "center", fontSize: 11, margin: [0, 5, 0, 5] },
  lightBar: { fillColor: LIGHT_BLUE, color: "#0f172a", bold: true, alignment: "center", fontSize: 11, margin: [0, 5, 0, 5] },
  headerLabel: { fillColor: LIGHT_BLUE, bold: true, fontSize: 9 },
  tableHeader: { fillColor: NAVY, color: "#ffffff", bold: true, fontSize: 9 },
  total: { bold: true },
  footer: { fontSize: 8, color: GREY },
};

// ---------- Driver document ("LISTA DLA KIEROWCY") --------------------------

/** Build the pdfmake docDefinition for the DRIVER document — logistics header
 * + a per-product x per-location matrix with a bold Razem (total) column.
 * Pure: takes the already-shaped `TransportDriverPrintDoc` (from
 * lib/transport.ts's `buildTransportDriverPrintDoc`) plus a caller-supplied
 * `generatedAt` timestamp (kept out of this function so it stays pure/
 * testable — no `new Date()` inside). */
export function buildDriverPdfDocDefinition(
  doc: TransportDriverPrintDoc,
  t: TFunc,
  generatedAt: string,
): PdfDocDefinition {
  const headerRows: { label: string; value: string; colSpan?: number }[][] = [
    [{ label: t("manager.transport.print.locationsRowLabel"), value: doc.locationsLine, colSpan: 3 }],
    [
      { label: t("manager.transport.print.dateLabel"), value: doc.date },
      { label: t("manager.transport.print.timeLabel"), value: doc.time },
    ],
    [
      { label: t("manager.transport.print.driverLabel"), value: doc.driver },
      { label: t("manager.transport.print.docNumberLabel"), value: `${doc.displayLabel} (${doc.transportId})` },
    ],
    [{ label: t("manager.transport.print.vehicleLabel"), value: doc.vehicle, colSpan: 3 }],
  ];

  const columnHeaders = [
    { text: t("manager.transport.print.lpCol"), style: "tableHeader" },
    { text: t("manager.transport.print.productCol"), style: "tableHeader" },
    { text: t("manager.transport.print.unitCol"), style: "tableHeader" },
    ...doc.locations.map((loc) => ({ text: loc, style: "tableHeader" })),
    { text: t("manager.transport.print.totalCol"), style: "tableHeader" },
  ];

  const bodyRows = doc.products.map((p: PrintDriverProductLine, idx: number) => {
    const zebra = idx % 2 === 1 ? { fillColor: ZEBRA } : {};
    return [
      { text: String(idx + 1), ...zebra },
      { text: p.name, ...zebra },
      { text: p.unit, ...zebra },
      ...p.qtyByLocation.map((qty) => ({ text: String(qty), ...zebra })),
      { text: String(p.totalQty), style: "total", ...zebra },
    ];
  });

  // Ad-hoc off-catalogue items (training-feedback-0901 F1), WITH location
  // attribution — this is an internal document, and the driver needs to know
  // who gets the extra feta. Omitted entirely when no member order carries one.
  const extraItemsSection: unknown[] =
    doc.extraItems.length > 0
      ? [
          sectionBar(t("manager.transport.print.extraItemsSectionTitle")),
          {
            table: {
              widths: ["*", "*"],
              body: doc.extraItems.map((item) => [{ text: item.locationName }, { text: item.text }]),
            },
            layout: TABLE_BORDER_LAYOUT,
          },
        ]
      : [];

  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [30, 30, 30, 30],
    defaultStyle: { fontSize: 9 },
    styles: SHARED_STYLES,
    content: [
      titleBar(t("manager.transport.print.driverBarTitle")),
      headerTable(headerRows),
      sectionBar(doc.supplierBarText),
      {
        table: {
          headerRows: 1,
          widths: [20, "*", 30, ...doc.locations.map(() => 45), 40],
          body: [columnHeaders, ...bodyRows],
        },
        layout: TABLE_BORDER_LAYOUT,
      },
      ...extraItemsSection,
      footerLine(t, generatedAt, doc.transportId),
    ],
  };
}

// ---------- Pago / supplier document ("ZLECENIE ODBIORU WŁASNEGO") ---------

/** Build the pdfmake docDefinition for the SUPPLIER document — two
 * side-by-side header boxes ("Dane podmiotu" / "Dane dokumentu") then a
 * totals-only product table. Deliberately carries NO per-location data
 * anywhere (mirrors `buildTransportPagoPrintDoc`'s no-location-leak
 * discipline) — the supplier never sees which location ordered what. */
export function buildPagoPdfDocDefinition(
  doc: TransportPagoPrintDoc,
  t: TFunc,
  generatedAt: string,
): PdfDocDefinition {
  const docBoxRows: { label: string; value: string }[][] = [
    [{ label: t("manager.transport.print.docNumberLabel"), value: `${doc.displayLabel} (${doc.transportId})` }],
    [{ label: t("manager.transport.print.pagoDoc.pickupDateLabel"), value: doc.pickupDate }],
    [{ label: t("manager.transport.print.pagoDoc.typeLabel"), value: t("manager.transport.print.pagoDoc.typeValue") }],
    [{ label: t("manager.transport.print.driverLabel"), value: doc.driver }],
  ];

  const entityBox = doc.entity
    ? {
        stack: [
          sectionBar(t("manager.transport.print.pagoDoc.entityBoxTitle")),
          headerTable([
            [{ label: t("manager.transport.print.pagoDoc.fullNameLabel"), value: doc.entity.name }],
            [{ label: t("manager.transport.print.pagoDoc.nipLabel"), value: doc.entity.nip }],
            [{ label: t("manager.transport.print.pagoDoc.address1Label"), value: doc.entity.address1 }],
            [{ label: t("manager.transport.print.pagoDoc.address2Label"), value: doc.entity.address2 }],
          ]),
        ],
      }
    : null;

  const docBox = {
    stack: [sectionBar(t("manager.transport.print.pagoDoc.docBoxTitle")), headerTable(docBoxRows)],
  };

  const entityBoxes = entityBox
    ? { columns: [entityBox, docBox], columnGap: 10 }
    : { columns: [docBox] };

  const columnHeaders = [
    { text: t("manager.transport.print.lpCol"), style: "tableHeader" },
    { text: t("manager.transport.print.pagoDoc.catalogCol"), style: "tableHeader" },
    { text: t("manager.transport.print.unitCol"), style: "tableHeader" },
    { text: t("manager.transport.print.qtyCol"), style: "tableHeader" },
  ];

  const bodyRows = doc.products.map((p, idx) => {
    const zebra = idx % 2 === 1 ? { fillColor: ZEBRA } : {};
    return [
      { text: String(idx + 1), ...zebra },
      { text: p.catalogNo, ...zebra },
      { text: p.unit, ...zebra },
      { text: String(p.qty), ...zebra },
    ];
  });

  const content: unknown[] = [titleBar(doc.titleBarText), entityBoxes];

  if (doc.isPago) {
    content.push(sectionBar(t("manager.transport.print.pagoDoc.pickupBar"), true));
  }

  content.push(
    headerTable([
      [
        { label: t("manager.transport.print.vehicleLabel"), value: doc.vehicle },
        { label: t("manager.transport.print.pagoDoc.pickupTimeLabel"), value: doc.pickupTime },
      ],
    ]),
    {
      table: { headerRows: 1, widths: [20, "*", 40, 40], body: [columnHeaders, ...bodyRows] },
      layout: TABLE_BORDER_LAYOUT,
    },
    footerLine(t, generatedAt, doc.transportId),
  );

  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [30, 30, 30, 30],
    defaultStyle: { fontSize: 9 },
    styles: SHARED_STYLES,
    content,
  };
}

// ---------- Filename ---------------------------------------------------------

/** Slugify `displayLabel` + `suffix` into a safe download filename:
 * " · " and runs of whitespace become "-", characters illegal in filenames
 * are stripped, Polish letters are kept verbatim (they are legal on every
 * mainstream filesystem). E.g.
 *   transportPdfFilename("Transport Sobota · Warszawa · 22.08.26", "lista-kierowcy")
 *   -> "Transport-Sobota-Warszawa-22.08.26-lista-kierowcy.pdf"
 */
export function transportPdfFilename(displayLabel: string, suffix: string): string {
  const slug = displayLabel
    .trim()
    // " · " (the display-label segment separator) and any run of whitespace -> "-"
    .replace(/\s*·\s*/g, "-")
    .replace(/\s+/g, "-")
    // Strip characters illegal (or awkward) in filenames across OSes:
    // / \ : * ? " < > | and control chars. Polish letters (ą ć ę ł ń ó ś ź ż
    // and uppercase) are untouched — not in this exclusion set.
    .replace(/[/\\:*?"<>|]/g, "")
    // Collapse any run of dashes left behind by stripped characters.
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug}-${suffix}.pdf`;
}

// ---------- Download wrapper (thin, not unit-tested) -------------------------

/** Lazily loads the pdfmake runtime + its bundled Roboto vfs fonts (kept out
 * of the main bundle — pdfmake is large) and triggers a browser download of
 * `docDefinition` as `filename`. */
export async function downloadTransportPdf(
  docDefinition: PdfDocDefinition,
  filename: string,
): Promise<void> {
  const pdfMakeModule = await import("pdfmake/build/pdfmake");
  const vfsModule = await import("pdfmake/build/vfs_fonts");
  // Runtime shape varies by how the CJS/UMD build gets interop-wrapped by the
  // bundler (default export vs. namespace-with-members) — defensively resolve
  // both the pdfMake instance and the plain vfs dictionary.
  const pdfMakeAny = pdfMakeModule as unknown as {
    default?: { addVirtualFileSystem: (vfs: Record<string, string>) => void; createPdf: (doc: unknown) => { download: (name?: string) => Promise<void> } };
    addVirtualFileSystem?: (vfs: Record<string, string>) => void;
    createPdf?: (doc: unknown) => { download: (name?: string) => Promise<void> };
  };
  const pdfMake = pdfMakeAny.default ?? pdfMakeAny;
  const vfsAny = vfsModule as unknown as { default?: Record<string, string> } & Record<string, string>;
  const vfs = vfsAny.default ?? vfsAny;

  if (typeof pdfMake.addVirtualFileSystem === "function") {
    pdfMake.addVirtualFileSystem(vfs);
  }
  if (typeof pdfMake.createPdf !== "function") {
    throw new Error("pdfmake failed to load (createPdf unavailable)");
  }
  await pdfMake.createPdf(docDefinition).download(filename);
}

/** Same lazy pdfmake import path as `downloadTransportPdf`, but resolves to
 * the PDF's raw base64 content (no data: URI prefix) instead of triggering a
 * browser download — used by the Gmail-draft flow to attach the PDF to a
 * MIME message. */
export async function generateTransportPdfBase64(
  docDefinition: PdfDocDefinition,
): Promise<string> {
  const pdfMakeModule = await import("pdfmake/build/pdfmake");
  const vfsModule = await import("pdfmake/build/vfs_fonts");
  type GetBase64 = ((cb: (result: string) => void) => void) &
    (() => Promise<string>);
  const pdfMakeAny = pdfMakeModule as unknown as {
    default?: {
      addVirtualFileSystem: (vfs: Record<string, string>) => void;
      createPdf: (doc: unknown) => { getBase64: GetBase64 };
    };
    addVirtualFileSystem?: (vfs: Record<string, string>) => void;
    createPdf?: (doc: unknown) => { getBase64: GetBase64 };
  };
  const pdfMake = pdfMakeAny.default ?? pdfMakeAny;
  const vfsAny = vfsModule as unknown as { default?: Record<string, string> } & Record<string, string>;
  const vfs = vfsAny.default ?? vfsAny;

  if (typeof pdfMake.addVirtualFileSystem === "function") {
    pdfMake.addVirtualFileSystem(vfs);
  }
  if (typeof pdfMake.createPdf !== "function") {
    throw new Error("pdfmake failed to load (createPdf unavailable)");
  }
  // pdfmake 0.3 changed getBase64 from callback-style to PROMISE-returning —
  // the old `.getBase64(cb)` silently ignores the callback there, which hung
  // the Gmail-draft flow forever with no error (live-diagnosed v5.6.2).
  // Handle both shapes: prefer the returned promise, keep the callback for a
  // 0.2-style build, and reject instead of hanging when neither fires.
  return new Promise<string>((resolve, reject) => {
    try {
      const maybePromise = pdfMake!.createPdf!(docDefinition).getBase64(
        (result: string) => resolve(result),
      ) as unknown;
      if (maybePromise && typeof (maybePromise as Promise<string>).then === "function") {
        (maybePromise as Promise<string>).then(resolve, reject);
      }
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
