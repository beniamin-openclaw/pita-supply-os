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
import { Download, Loader2, Mail } from "lucide-react";

import { useT } from "../../../i18n";
import type { TransportBatchDetail } from "../../../types";
import {
  buildDriverDraftEmail,
  buildMimeMessage,
  buildPagoDraftEmail,
  createGmailDraft,
  requestGmailAccessToken,
  toBase64Url,
} from "../lib/gmailDraft";
import { buildTransportDriverPrintDoc, buildTransportPagoPrintDoc, hasValidRecipient, splitRecipients } from "../lib/transport";
import {
  buildDriverPdfDocDefinition,
  buildPagoPdfDocDefinition,
  downloadTransportPdf,
  generateTransportPdfBase64,
  transportPdfFilename,
} from "../lib/transportPdf";

interface PrintViewsProps {
  detail: TransportBatchDetail;
  // Precomputed by the caller (transportDisplayLabel needs `lang` +
  // `locationsById`, neither of which this component has) — see TransportPage.
  displayLabel: string;
  // Supplier's e-mail (possibly a comma/semicolon-separated distribution
  // list) — recipients for the PAGO order Gmail draft. undefined/null/no "@"
  // disables that draft button (mirrors the existing single-order dispatch
  // gate, hasValidRecipient).
  supplierEmail?: string | null;
  // Operator-configured recipients for the DRIVER Gmail draft
  // (`_meta.transport_driver_recipients`, via api.transportDraftConfig()).
  // Empty/null disables that draft button.
  driverRecipients?: string | null;
}

type PdfDoc = "driver" | "pago";
type DraftDoc = "gmailOrder" | "gmailDriver";

// Feature-gated: the Gmail-draft buttons only render when a Google OAuth
// Client ID is configured (VITE_GOOGLE_CLIENT_ID) — without one the OAuth
// token request has nothing to authenticate against.
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

export function PrintViews({ detail, displayLabel, supplierEmail, driverRecipients }: PrintViewsProps) {
  const { t } = useT();
  const [busy, setBusy] = useState<PdfDoc | DraftDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftSuccess, setDraftSuccess] = useState<DraftDoc | null>(null);

  const handleDownload = async (which: PdfDoc): Promise<void> => {
    setError(null);
    setDraftSuccess(null);
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

  const handleGmailDraft = async (which: DraftDoc): Promise<void> => {
    setError(null);
    setDraftSuccess(null);
    setBusy(which);
    try {
      const accessToken = await requestGmailAccessToken(GOOGLE_CLIENT_ID);
      const generatedAt = new Date().toLocaleString("pl-PL");

      let to: string;
      let subject: string;
      let bodyText: string;
      let pdfBase64: string;
      let attachmentFilename: string;

      if (which === "gmailOrder") {
        to = splitRecipients(supplierEmail ?? "").join(",");
        ({ subject, bodyText } = buildPagoDraftEmail(detail, displayLabel, t));
        const doc = buildTransportPagoPrintDoc(detail, displayLabel);
        const docDefinition = buildPagoPdfDocDefinition(doc, t, generatedAt);
        pdfBase64 = await generateTransportPdfBase64(docDefinition);
        attachmentFilename = transportPdfFilename(displayLabel, "zamowienie");
      } else {
        to = splitRecipients(driverRecipients ?? "").join(",");
        ({ subject, bodyText } = buildDriverDraftEmail(detail, displayLabel, t));
        const doc = buildTransportDriverPrintDoc(detail, displayLabel);
        const docDefinition = buildDriverPdfDocDefinition(doc, t, generatedAt);
        pdfBase64 = await generateTransportPdfBase64(docDefinition);
        attachmentFilename = transportPdfFilename(displayLabel, "lista-kierowcy");
      }

      const mime = buildMimeMessage({
        to,
        subject,
        bodyText,
        attachments: [{ filename: attachmentFilename, base64: pdfBase64, mimeType: "application/pdf" }],
      });
      await createGmailDraft(accessToken, toBase64Url(mime));
      setDraftSuccess(which);
      // Operator expectation ("przenosi na stronę Gmail"): jump straight to
      // the Drafts folder. window.open this late in an async chain may be
      // popup-blocked — the success line's link stays as the fallback.
      window.open("https://mail.google.com/mail/u/0/#drafts", "_blank", "noopener");
    } catch (e) {
      // Surface the REAL reason (v5.4.1): the generic copy hid whether it was
      // a closed popup, a blocked popup, a wrong-domain account, or a Gmail
      // API rejection — undebuggable from the operator's report.
      const detail = e instanceof Error && e.message ? e.message : "unknown";
      setError(t("manager.transport.gmailDraft.error", { detail }));
    } finally {
      setBusy(null);
    }
  };

  const orderRecipientOk = hasValidRecipient(supplierEmail);
  const driverRecipientOk = hasValidRecipient(driverRecipients);

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
        {GOOGLE_CLIENT_ID && (
          <>
            <button
              type="button"
              onClick={() => void handleGmailDraft("gmailOrder")}
              disabled={busy !== null || !orderRecipientOk}
              title={orderRecipientOk ? undefined : t("manager.transport.gmailDraft.noSupplierRecipientTooltip")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "gmailOrder" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Mail size={16} />
              )}
              {t("manager.transport.gmailDraft.orderButton")}
            </button>
            <button
              type="button"
              onClick={() => void handleGmailDraft("gmailDriver")}
              disabled={busy !== null || !driverRecipientOk}
              title={driverRecipientOk ? undefined : t("manager.transport.gmailDraft.noDriverRecipientTooltip")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "gmailDriver" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Mail size={16} />
              )}
              {t("manager.transport.gmailDraft.driverButton")}
            </button>
          </>
        )}
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {draftSuccess && (
        <div className="text-sm text-green-700">
          {t("manager.transport.gmailDraft.success")}{" "}
          <a
            href="https://mail.google.com/mail/#drafts"
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline"
          >
            {t("manager.transport.gmailDraft.openDraftsLink")}
          </a>
        </div>
      )}
    </div>
  );
}
