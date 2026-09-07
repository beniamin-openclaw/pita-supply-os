// "Faktury vs dostawy" (finance reconciliation, pilot KEN) — the Manager's
// invoice-vs-delivery screen. LEFT: the location's goods-receipts for the
// chosen window, each with its match status, plus the eBiuro documents that
// matched no delivery ("Faktury bez dostawy") and the corrections. RIGHT: the
// selected receipt's full compare pane (ReceiptComparePane, self-contained).
//
// Read-mostly: the only writes it triggers are the eBiuro sync (a button) and,
// through the pane, a per-receipt review. A review result is folded back into
// the left-hand list so the card's chip updates without a refetch.

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { api, ApiError } from "../../../apiClient";
import { AppHeader } from "../../../components/ui/AppHeader";
import { useT } from "../../../i18n";
import type {
  FinanceDocumentItem,
  FinanceOverview,
  FinanceReceiptReview,
  FinanceReceiptStatus,
  Location,
} from "../../../types";
import { ReceiptComparePane } from "./ReceiptComparePane";
import { receiptStatusClass, receiptStatusLabel } from "./financeChips";
import { formatDate, formatDateTime, formatMoney } from "./financeFormat";

// Pilot location (task/operator decision) — the screen opens on KEN and the
// select lets the manager move to any other active location.
const DEFAULT_LOCATION_ID = "KEN";
const DAYS_OPTIONS: readonly number[] = [7, 14, 30, 60];
const DEFAULT_DAYS = 30;

interface LocationOption {
  id: string;
  name: string;
}

interface DocRowProps {
  doc: FinanceDocumentItem;
}

/** One eBiuro document in the "bez dostawy" / "Korekty" lists (read-only). */
function DocRow({ doc }: DocRowProps): ReactElement {
  const { t } = useT();
  return (
    <li className="rounded-lg border border-gray-200 bg-white p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-900">
            {doc.supplier_name ?? doc.contractor_name ?? "—"}
          </div>
          <div className="text-xs text-slate-500">
            {t("manager.finance.doc.invoiceNumber", { number: doc.invoice_number ?? "—" })}
            {" · "}
            {formatDate(doc.sell_date ?? doc.issue_date)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs tabular-nums text-slate-700">
            {t("manager.finance.doc.netto", { amount: formatMoney(doc.netto) })}
          </div>
          {doc.is_correction && (
            <span className="mt-1 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[11px] font-semibold text-purple-700">
              {t("manager.finance.doc.correctionBadge")}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function ManagerFinancePage(): ReactElement {
  const { t, lang } = useT();
  const navigate = useNavigate();

  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState<string>(DEFAULT_LOCATION_ID);
  const [days, setDays] = useState<number>(DEFAULT_DAYS);

  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped by a successful sync to re-run the overview effect with the same
  // location/days (a plain refetch trigger, not part of the query itself).
  const [reloadKey, setReloadKey] = useState<number>(0);

  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const [syncBusy, setSyncBusy] = useState<boolean>(false);
  const [syncMsg, setSyncMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = useCallback((msg: string, ok: boolean): void => {
    setToast({ msg, ok });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  // Location dictionary for the select. A failure here is non-fatal — the
  // default location stays selectable and the overview call below surfaces
  // any real backend/auth problem.
  useEffect(() => {
    api
      .locations("manager")
      .then((rows) => setLocations(rows))
      .catch(() => {
        // ignore — the select falls back to the currently selected id
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Intentional synchronous reset before the refetch: show the loader and
    // drop a stale error when location/days change. Same deliberate pattern
    // (and same rule opt-out) as CaptainMP's supplier-change fetch.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    api
      .financeOverview(locationId, days)
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        // Auto-select the first receipt; keep the current selection when it is
        // still present in the refreshed list.
        setSelectedReceiptId((prev) => {
          if (prev && data.receipts.some((r) => r.receipt_id === prev)) return prev;
          return data.receipts.length > 0 ? data.receipts[0].receipt_id : null;
        });
      })
      .catch((e: ApiError) => {
        if (cancelled) return;
        setOverview(null);
        setSelectedReceiptId(null);
        if (e.status !== 401) setError(e.detail);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locationId, days, reloadKey]);

  const locationOptions = useMemo((): LocationOption[] => {
    const rows: LocationOption[] = locations
      .filter((l) => l.active)
      .map((l) => ({ id: l.location_id, name: l.location_name }));
    if (!rows.some((o) => o.id === locationId)) {
      rows.unshift({ id: locationId, name: locationId });
    }
    return rows;
  }, [locations, locationId]);

  const handleSync = useCallback(async (): Promise<void> => {
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const res = await api.financeSync();
      setSyncMsg({
        text: t("manager.finance.syncResult", {
          companies: res.companies,
          fetched: res.fetched,
          unchanged: res.unchanged,
          skipped: res.skipped,
          upserted: res.upserted,
        }),
        ok: true,
      });
      setReloadKey((k) => k + 1);
    } catch (e) {
      // A 503 here is EXPECTED when eBiuro isn't configured on the server —
      // show the backend's own detail inline, never crash the screen.
      const err = e instanceof ApiError ? e : null;
      const text =
        err && err.status === 503 && !err.detail
          ? t("manager.finance.syncNotConfigured")
          : t("manager.finance.syncError", { detail: err ? err.detail : String(e) });
      setSyncMsg({ text, ok: false });
    } finally {
      setSyncBusy(false);
    }
  }, [t]);

  const handleReviewSaved = useCallback(
    (receiptId: string, review: FinanceReceiptReview): void => {
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              receipts: prev.receipts.map((r) =>
                r.receipt_id === receiptId
                  ? { ...r, review, status: review.status as FinanceReceiptStatus }
                  : r,
              ),
            }
          : prev,
      );
    },
    [],
  );

  const receipts = overview?.receipts ?? [];
  const unmatched = overview?.unmatched_documents ?? [];
  const corrections = overview?.corrections ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 pb-12">
      <AppHeader className="sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate("/manager")}
            aria-label={t("manager.finance.back")}
            className="-ml-2 rounded-md p-2 transition-colors active:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <h1 className="text-lg font-semibold tracking-tight">{t("manager.finance.title")}</h1>
        </div>
      </AppHeader>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 p-4">
        {toast && (
          <div
            role={toast.ok ? "status" : "alert"}
            className={`rounded border px-3 py-2 text-sm ${
              toast.ok
                ? "border-green-300 bg-green-50 text-green-900"
                : "border-red-400 bg-red-50 text-red-900"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* Controls ------------------------------------------------------- */}
        <section className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-3">
          <div>
            <label
              htmlFor="fin-location"
              className="mb-1 block text-xs font-semibold text-slate-600"
            >
              {t("manager.finance.locationLabel")}
            </label>
            <select
              id="fin-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {locationOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="fin-days" className="mb-1 block text-xs font-semibold text-slate-600">
              {t("manager.finance.daysLabel")}
            </label>
            <select
              id="fin-days"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DAYS_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {t("manager.finance.daysOptionLabel", { n: d })}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={syncBusy}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {syncBusy ? t("manager.finance.syncing") : t("manager.finance.syncButton")}
          </button>

          <div className="text-xs text-slate-500">
            {overview?.synced_at
              ? t("manager.finance.syncedAt", { when: formatDateTime(overview.synced_at) })
              : t("manager.finance.syncedNever")}
          </div>
        </section>

        {syncMsg && (
          <div
            role={syncMsg.ok ? "status" : "alert"}
            className={`rounded border px-3 py-2 text-sm ${
              syncMsg.ok
                ? "border-green-300 bg-green-50 text-green-900"
                : "border-red-400 bg-red-50 text-red-900"
            }`}
          >
            {syncMsg.text}
          </div>
        )}

        {overview && !overview.sync_configured && (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t("manager.finance.syncNotConfigured")}
          </div>
        )}

        {error && (
          <div
            className="rounded border-2 border-red-400 bg-red-50 p-4 text-sm text-red-900"
            role="alert"
          >
            {t("manager.finance.fetchError", { detail: error })}
          </div>
        )}

        {loading && !overview && (
          <div className="text-sm text-slate-500">{t("manager.finance.loading")}</div>
        )}

        {overview && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            {/* LEFT — receipts, unmatched invoices, corrections ---------- */}
            <div className="space-y-6">
              <section>
                <h2 className="mb-2 text-sm font-semibold text-slate-700">
                  {t("manager.finance.receiptsHeading")}
                </h2>
                {receipts.length === 0 ? (
                  <div className="rounded border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                    {t("manager.finance.empty")}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {receipts.map((r) => {
                      const selected = r.receipt_id === selectedReceiptId;
                      return (
                        <li key={r.receipt_id}>
                          <button
                            type="button"
                            onClick={() => setSelectedReceiptId(r.receipt_id)}
                            aria-current={selected ? "true" : undefined}
                            className={`w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                              selected
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate font-medium text-slate-900">
                                  {r.supplier_name}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {formatDate(r.receipt_date)}
                                  {r.received_by
                                    ? ` · ${t("manager.finance.card.receivedBy", {
                                        who: r.received_by,
                                      })}`
                                    : ""}
                                </div>
                              </div>
                              <span
                                className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${receiptStatusClass(
                                  r.status,
                                )}`}
                              >
                                {receiptStatusLabel(r.status, lang)}
                              </span>
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                              <span>{t("manager.finance.card.lineCount", { n: r.line_count })}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {t("manager.finance.card.photoCount", { n: r.wz_photo_count })}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                {r.estimate_netto_pln != null
                                  ? t("manager.finance.card.estimate", {
                                      amount: formatMoney(r.estimate_netto_pln),
                                    })
                                  : t("manager.finance.card.noEstimate")}
                              </span>
                              {r.duplicate_receipt && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
                                  {t("manager.finance.card.duplicateBadge")}
                                </span>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section>
                <h2 className="mb-2 text-sm font-semibold text-slate-700">
                  {t("manager.finance.unmatchedHeading")}
                </h2>
                {unmatched.length === 0 ? (
                  <div className="rounded border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
                    {t("manager.finance.unmatchedEmpty")}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {unmatched.map((d) => (
                      <DocRow key={d.doc_id} doc={d} />
                    ))}
                  </ul>
                )}
              </section>

              {corrections.length > 0 && (
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-slate-700">
                    {t("manager.finance.correctionsHeading")}
                  </h2>
                  <ul className="space-y-2">
                    {corrections.map((d) => (
                      <DocRow key={d.doc_id} doc={d} />
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* RIGHT — selected receipt vs its invoice -------------------- */}
            <div>
              {selectedReceiptId ? (
                <ReceiptComparePane
                  receiptId={selectedReceiptId}
                  onReviewSaved={handleReviewSaved}
                  onToast={showToast}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                  {t("manager.finance.detail.selectPrompt")}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
