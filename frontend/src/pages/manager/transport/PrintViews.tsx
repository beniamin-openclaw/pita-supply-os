// PDF download buttons for a Transport batch (v5 feedback — operator decision:
// the two Transport documents are DOWNLOADED as real .pdf files, not printed).
// Replaces the prior window.print()/@media-print flow entirely — there is no
// hidden print area, no print stylesheet, no `afterprint` listener anymore.
//
// Two documents, same as before:
//   - LISTA DLA KIEROWCY (driver) — internal only, per-product x per-location
//     matrix with a Razem (total) column. Never sent to the supplier.
//   - ZLECENIE ODBIORU WŁASNEGO (Pago order) — totals-only product table, no
//     location data anywhere.
// Document CONTENT still comes from the pure builders in lib/transport.ts
// (buildTransportDriverPrintDoc / buildTransportPagoPrintDoc); this component
// turns that content into a pdfmake docDefinition via lib/transportPdf.ts and
// triggers a browser download. pdfmake is lazy-loaded inside
// `downloadTransportPdf` so it never lands in the main app bundle.

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { useT } from "../../../i18n";
import type { TransportBatchDetail } from "../../../types";
import { buildTransportDriverPrintDoc, buildTransportPagoPrintDoc } from "../lib/transport";
import {
  buildDriverPdfDocDefinition,
  buildPagoPdfDocDefinition,
  downloadTransportPdf,
  transportPdfFilename,
} from "../lib/transportPdf";

interface PrintViewsProps {
  detail: TransportBatchDetail;
  // Precomputed by the caller (transportDisplayLabel needs `lang` +
  // `locationsById`, neither of which this component has) — see TransportPage.
  displayLabel: string;
}

type PdfDoc = "driver" | "pago";

export function PrintViews({ detail, displayLabel }: PrintViewsProps) {
  const { t } = useT();
  const [busy, setBusy] = useState<PdfDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (which: PdfDoc): Promise<void> => {
    setError(null);
    setBusy(which);
    try {
      const generatedAt = new Date().toLocaleString("pl-PL");
      if (which === "driver") {
        const doc = buildTransportDriverPrintDoc(detail, displayLabel);
        const docDefinition = buildDriverPdfDocDefinition(doc, t, generatedAt);
        await downloadTransportPdf(docDefinition, transportPdfFilename(displayLabel, "lista-kierowcy"));
      } else {
        const doc = buildTransportPagoPrintDoc(detail, displayLabel);
        const docDefinition = buildPagoPdfDocDefinition(doc, t, generatedAt);
        await downloadTransportPdf(docDefinition, transportPdfFilename(displayLabel, "zamowienie"));
      }
    } catch {
      setError(t("manager.transport.print.downloadError"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleDownload("driver")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "driver" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {t("manager.transport.print.driverButton")}
        </button>
        <button
          type="button"
          onClick={() => void handleDownload("pago")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "pago" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {t("manager.transport.print.pagoButton")}
        </button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
