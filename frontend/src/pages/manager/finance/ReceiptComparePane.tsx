// Right-hand detail pane of "Faktury vs dostawy" (finance reconciliation,
// pilot KEN) — one receipt vs its matched (or candidate) eBiuro invoice.
// Two cards (Dostawa | Faktura), a line-by-line compare table, an "extra
// invoice lines" alias-assignment section, and the confirm/mismatch review
// action bar. Fully self-contained — the parent only needs `receiptId` and
// two callbacks (review saved, toast).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, ApiError } from "../../../apiClient";
import { useT } from "../../../i18n";
import type { FinanceReceiptDetail, FinanceReceiptReview } from "../../../types";
import { lineStatusClass, lineStatusLabel } from "./financeChips";
import { formatDate, formatDateTime, formatMoney, formatQty } from "./financeFormat";

interface ReceiptComparePaneProps {
  receiptId: string;
  onReviewSaved: (receiptId: string, review: FinanceReceiptReview) => void;
  onToast: (msg: string, ok: boolean) => void;
}

export function ReceiptComparePane({
  receiptId,
  onReviewSaved,
  onToast,
}: ReceiptComparePaneProps) {
  const { t, lang } = useT();

  const [detail, setDetail] = useState<FinanceReceiptDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the manager clicks a candidate pill to re-compare against a
  // different eBiuro document than the backend's own best match.
  const [docIdOverride, setDocIdOverride] = useState<number | undefined>(undefined);

  const [note, setNote] = useState("");
  const [reviewSaving, setReviewSaving] = useState<"confirmed" | "mismatch" | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // One chosen product_id per extra-invoice-line ordinal, staged before "Assign".
  const [aliasSelections, setAliasSelections] = useState<Record<number, string>>({});
  const [aliasBusyOrdinal, setAliasBusyOrdinal] = useState<number | null>(null);
  const [aliasError, setAliasError] = useState<string | null>(null);

  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Guards against a stale response (rapid receipt switches / candidate clicks).
  const reqRef = useRef<string | null>(null);
  // Only reseed the note textarea on the FIRST load of a given receipt — not
  // on every re-fetch (e.g. after switching candidates or assigning an
  // alias), so an in-progress note the manager is typing isn't clobbered.
  const seededForReceipt = useRef<string | null>(null);
  // Object URLs minted for opened PDFs — revoked on unmount (they also survive
  // as long as the opened tab needs them while this pane stays open).
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      objectUrlsRef.current = [];
    };
  }, []);

  // Reset transient UI state whenever the selected receipt changes. Intentional
  // synchronous reset (same deliberate pattern — and same rule opt-out — as
  // CaptainMP's supplier-change effect): the previous receipt's candidate
  // override and error/alias state must be gone before the next paint.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setDocIdOverride(undefined);
    setReviewError(null);
    setAliasError(null);
    setPdfError(null);
    setAliasSelections({});
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [receiptId]);

  useEffect(() => {
    const reqKey = `${receiptId}:${docIdOverride ?? ""}`;
    reqRef.current = reqKey;
    // Intentional synchronous loader/error reset before the refetch — see the
    // note on the reset effect above.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    api
      .financeReceipt(receiptId, docIdOverride)
      .then((d) => {
        if (reqRef.current !== reqKey) return; // stale
        setDetail(d);
        if (seededForReceipt.current !== receiptId) {
          setNote(d.receipt.review?.note ?? "");
          seededForReceipt.current = receiptId;
        }
      })
      .catch((e: ApiError) => {
        if (reqRef.current !== reqKey) return; // stale
        if (e.status !== 401) setError(e.detail);
      })
      .finally(() => {
        if (reqRef.current === reqKey) setLoading(false);
      });
  }, [receiptId, docIdOverride]);

  // Products already on the receipt — the alias-assignment select's options.
  const productOptions = useMemo(() => {
    const seen = new Map<string, string>();
    (detail?.lines ?? []).forEach((ln) => seen.set(ln.product_id, ln.product_name_pl));
    return Array.from(seen, ([product_id, product_name_pl]) => ({ product_id, product_name_pl }));
  }, [detail]);

  const handleReview = useCallback(
    async (status: "confirmed" | "mismatch") => {
      if (!detail) return;
      const docId = detail.document?.doc_id;
      if (!docId) {
        setReviewError(t("manager.finance.review.needDocument"));
        return;
      }
      setReviewSaving(status);
      setReviewError(null);
      try {
        const review = await api.financeReview(receiptId, { doc_id: docId, status, note });
        setDetail((prev) =>
          prev
            ? { ...prev, receipt: { ...prev.receipt, review, status: review.status as typeof prev.receipt.status } }
            : prev,
        );
        onReviewSaved(receiptId, review);
        onToast(t("manager.finance.toast.reviewSaved"), true);
      } catch (e) {
        const msg = e instanceof ApiError ? e.detail : String(e);
        setReviewError(t("manager.finance.review.saveError", { detail: msg }));
      } finally {
        setReviewSaving(null);
      }
    },
    [detail, note, onReviewSaved, onToast, receiptId, t],
  );

  const handleAssign = useCallback(
    async (ordinal: number) => {
      if (!detail?.document) return;
      const productId = aliasSelections[ordinal];
      if (!productId) return;
      setAliasBusyOrdinal(ordinal);
      setAliasError(null);
      try {
        const updated = await api.financeAlias(receiptId, {
          doc_id: detail.document.doc_id,
          invoice_ordinal: ordinal,
          product_id: productId,
        });
        setDetail(updated);
        onToast(t("manager.finance.extra.assigned"), true);
      } catch (e) {
        const msg = e instanceof ApiError ? e.detail : String(e);
        setAliasError(t("manager.finance.extra.assignError", { detail: msg }));
      } finally {
        setAliasBusyOrdinal(null);
      }
    },
    [aliasSelections, detail, onToast, receiptId, t],
  );

  const openPdf = useCallback(
    async (docId: number) => {
      setPdfBusy(true);
      setPdfError(null);
      try {
        const blob = await api.financeDocumentPdf(docId);
        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.push(url);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e) {
        const msg = e instanceof ApiError ? e.detail : String(e);
        setPdfError(t("manager.finance.detail.pdfError", { detail: msg }));
      } finally {
        setPdfBusy(false);
      }
    },
    [t],
  );

  if (loading && !detail) {
    return <div className="text-sm text-slate-500">{t("manager.finance.detail.loading")}</div>;
  }
  if (error) {
    return (
      <div className="rounded border-2 border-red-400 bg-red-50 p-4 text-sm text-red-900" role="alert">
        {t("manager.finance.detail.fetchError", { detail: error })}
      </div>
    );
  }
  if (!detail) return null;

  const { receipt, document, candidates, lines, extra_lines: extraLines, photos } = detail;
  const review = receipt.review;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Dostawa ------------------------------------------------------- */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">
            {t("manager.finance.detail.deliveryTitle")}
          </h3>
          <div className="space-y-1 text-sm text-slate-700">
            <div>{formatDate(receipt.receipt_date)}</div>
            {receipt.received_by && (
              <div>
                {t("manager.finance.detail.receivedByLabel")}: {receipt.received_by}
              </div>
            )}
            <div>
              {t("manager.finance.detail.orderIdLabel")}: {receipt.order_id}
            </div>
            <div>
              {t("manager.finance.detail.lineCountLabel")}: {receipt.line_count}
            </div>
            <div>
              {t("manager.finance.detail.estimateLabel")}:{" "}
              {receipt.estimate_netto_pln != null
                ? `${formatMoney(receipt.estimate_netto_pln)} zł`
                : t("manager.finance.card.noEstimate")}
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1 text-xs font-semibold text-slate-600">
              {t("manager.finance.detail.photosLabel")}
            </div>
            {photos.length === 0 ? (
              <div className="text-xs text-slate-500">{t("manager.finance.detail.noPhotos")}</div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {photos.map((p) => (
                  <a
                    key={p.name}
                    href={p.signed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded border border-gray-200"
                  >
                    <img src={p.signed_url} alt={p.name} className="h-16 w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Faktura -------------------------------------------------------- */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">
            {t("manager.finance.detail.invoiceTitle")}
          </h3>
          {!document ? (
            <div className="text-sm text-slate-500">{t("manager.finance.detail.noInvoice")}</div>
          ) : (
            <>
              <div className="space-y-1 text-sm text-slate-700">
                <div>
                  {t("manager.finance.detail.invoiceNumberLabel")}: {document.invoice_number ?? "—"}
                </div>
                {document.ksef_number && (
                  <div>
                    {t("manager.finance.detail.ksefLabel")}: {document.ksef_number}
                  </div>
                )}
                <div>
                  {t("manager.finance.detail.issueDateLabel")}: {formatDate(document.issue_date)}
                </div>
                <div>
                  {t("manager.finance.detail.sellDateLabel")}: {formatDate(document.sell_date)}
                </div>
                <div>
                  {t("manager.finance.detail.nettoLabel")}: {formatMoney(document.netto)} zł
                </div>
                <div>
                  {t("manager.finance.detail.bruttoLabel")}: {formatMoney(document.brutto)} zł
                </div>
                {document.contractor_name && (
                  <div>
                    {t("manager.finance.detail.contractorLabel")}: {document.contractor_name}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => openPdf(document.doc_id)}
                disabled={pdfBusy}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {t("manager.finance.detail.openPdf")}
              </button>
              {pdfError && <div className="mt-1 text-xs text-red-700">{pdfError}</div>}

              {candidates.length > 1 && (
                <div className="mt-3">
                  <div className="mb-1 text-xs font-semibold text-slate-600">
                    {t("manager.finance.detail.candidatesLabel")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {candidates.map((c) => (
                      <button
                        key={c.doc_id}
                        type="button"
                        onClick={() => setDocIdOverride(c.doc_id)}
                        className={`rounded-full border px-2 py-1 text-xs transition-colors ${
                          document.doc_id === c.doc_id
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {t("manager.finance.detail.candidatePill", {
                          number: c.invoice_number ?? "—",
                          date: formatDate(c.sell_date ?? c.issue_date),
                          netto: formatMoney(c.netto),
                        })}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Line-by-line compare table ---------------------------------------- */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">{t("manager.finance.table.product")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("manager.finance.table.received")}</th>
              <th className="px-3 py-2 text-left font-semibold">{t("manager.finance.table.invoice")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("manager.finance.table.delta")}</th>
              <th className="px-3 py-2 text-left font-semibold">{t("manager.finance.table.status")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                  {t("manager.finance.table.empty")}
                </td>
              </tr>
            )}
            {lines.map((ln) => (
              <tr key={ln.order_line_id} className="border-t border-gray-100 align-top">
                <td className="px-3 py-2 font-medium text-slate-900">{ln.product_name_pl}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {formatQty(ln.received_qty_purchase)} {ln.purchase_unit}
                </td>
                <td className="px-3 py-2">
                  {ln.invoice_qty != null ? (
                    <>
                      <div className="tabular-nums">
                        {formatQty(ln.invoice_qty)} {ln.invoice_unit ?? ""}
                      </div>
                      {ln.invoice_name && (
                        <div className="text-xs text-gray-500">{ln.invoice_name}</div>
                      )}
                      {ln.invoice_unit_price_netto != null && (
                        <div className="text-xs text-gray-500">
                          {formatMoney(ln.invoice_unit_price_netto)} zł/j.
                        </div>
                      )}
                      {ln.unit_note && <div className="text-xs text-amber-700">{ln.unit_note}</div>}
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {ln.delta_qty != null ? formatQty(ln.delta_qty) : "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-semibold ${lineStatusClass(ln.status)}`}
                  >
                    {lineStatusLabel(ln.status, lang)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Extra invoice lines (not received) --------------------------------- */}
      {extraLines.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">
            {t("manager.finance.extra.heading")}
          </h3>
          {aliasError && <div className="mb-2 text-xs text-red-700">{aliasError}</div>}
          <ul className="space-y-2">
            {extraLines.map((el) => (
              <li
                key={el.invoice_ordinal}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2"
              >
                <div className="min-w-0 text-sm">
                  <div className="truncate font-medium text-slate-900">{el.invoice_name}</div>
                  <div className="tabular-nums text-xs text-slate-600">
                    {formatQty(el.invoice_qty)} {el.invoice_unit ?? ""} · {formatMoney(el.invoice_netto)} zł
                  </div>
                </div>
                {document && (
                  <div className="flex items-center gap-2">
                    <select
                      value={aliasSelections[el.invoice_ordinal] ?? ""}
                      onChange={(e) =>
                        setAliasSelections((prev) => ({
                          ...prev,
                          [el.invoice_ordinal]: e.target.value,
                        }))
                      }
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{t("manager.finance.extra.assignPlaceholder")}</option>
                      {productOptions.map((p) => (
                        <option key={p.product_id} value={p.product_id}>
                          {p.product_name_pl}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={
                        !aliasSelections[el.invoice_ordinal] || aliasBusyOrdinal === el.invoice_ordinal
                      }
                      onClick={() => handleAssign(el.invoice_ordinal)}
                      className="rounded border border-blue-300 bg-white px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-50"
                    >
                      {t("manager.finance.extra.assignButton")}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Review action bar ---------------------------------------------------- */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        {review && (
          <div className="mb-3 text-xs text-slate-600">
            {t("manager.finance.review.existing", {
              status:
                review.status === "confirmed"
                  ? t("manager.finance.review.statusConfirmed")
                  : t("manager.finance.review.statusMismatch"),
              actor: review.actor ?? "—",
              when: formatDateTime(review.reviewed_at),
            })}
            {review.note && (
              <div className="mt-1">{t("manager.finance.review.noteLabel", { note: review.note })}</div>
            )}
          </div>
        )}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("manager.finance.review.notePlaceholder")}
          rows={2}
          className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {reviewError && <div className="mb-2 text-xs text-red-700">{reviewError}</div>}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={reviewSaving !== null}
            onClick={() => handleReview("confirmed")}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {reviewSaving === "confirmed"
              ? t("manager.finance.review.saving")
              : t("manager.finance.review.confirmButton")}
          </button>
          <button
            type="button"
            disabled={reviewSaving !== null}
            onClick={() => handleReview("mismatch")}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {reviewSaving === "mismatch"
              ? t("manager.finance.review.saving")
              : t("manager.finance.review.mismatchButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
