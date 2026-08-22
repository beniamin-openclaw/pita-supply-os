// Manager Transport ("TO" — combined delivery run) workspace (to-ordering-pago
// Phase 3). Combines several locations' submitted/claimed orders for one
// supplier into a single Transport batch, then lets the manager review the
// batch: per-product totals, a private per-location driver matrix (copyable),
// and — when the supplier has a real email on file — a totals-only Gmail
// draft. One page, three stacked sections (supplier picker / eligible orders
// to combine / past batches + detail), templated on ManagerInventoryPage's
// header + list conventions but kept single-page (no back/forward navigation)
// because the eligible list and the batch list are both always relevant here.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";

import { api, ApiError } from "../../apiClient";
import { AppHeader } from "../../components/ui/AppHeader";
import { roundQty } from "../../components/ui/number";
import { useT } from "../../i18n";
import { statusVisual } from "../captain-mp/lib/orderStatus";
import { buildTransportDriverText, buildTransportGmailUrl, hasValidRecipient } from "./lib/transport";
import type {
  Supplier,
  TransportBatchDetail,
  TransportBatchSummary,
  TransportEligibleOrder,
  TransportSkippedOrder,
} from "../../types";

interface CreateResult {
  transportId: string;
  combinedCount: number;
  skipped: TransportSkippedOrder[];
}

export function TransportPage() {
  const { t, formatDateTime } = useT();
  const navigate = useNavigate();

  // Supplier picker ------------------------------------------------------------
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string>("");

  // Eligible orders to combine ---------------------------------------------------
  const [eligible, setEligible] = useState<TransportEligibleOrder[] | null>(null);
  const [eligibleError, setEligibleError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadEligible = useCallback((sid: string) => {
    setEligible(null);
    setEligibleError(null);
    setSelected(new Set());
    api
      .transportEligible(sid)
      .then((data) => setEligible(data))
      .catch((e: ApiError) => {
        if (e.status !== 401) setEligibleError(e.detail);
      });
  }, []);

  // Past batches -----------------------------------------------------------------
  const [batches, setBatches] = useState<TransportBatchSummary[] | null>(null);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [selectedTransportId, setSelectedTransportId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TransportBatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadBatches = useCallback((sid: string) => {
    setBatches(null);
    setBatchesError(null);
    setSelectedTransportId(null);
    setDetail(null);
    api
      .transportBatches(sid)
      .then((data) => setBatches(data))
      .catch((e: ApiError) => {
        if (e.status !== 401) setBatchesError(e.detail);
      });
  }, []);

  // Supplier picker triggers both loads on change — deliberately NOT a
  // useEffect reacting to `supplierId`: that pattern calls setState
  // synchronously from the effect body (react-hooks/set-state-in-effect).
  // Loads instead fire from the promise callback below (async — the initial
  // default pick) and from the <select> onChange handler (an event handler),
  // both of which are outside an effect body.
  const selectSupplier = useCallback(
    (sid: string) => {
      setSupplierId(sid);
      loadEligible(sid);
      loadBatches(sid);
    },
    [loadEligible, loadBatches],
  );

  useEffect(() => {
    let cancelled = false;
    api
      .suppliers()
      .then((data) => {
        if (cancelled) return;
        const active = data.filter((s) => s.active);
        setSuppliers(active);
        const pago = active.find((s) => s.supplier_id === "SUP_PAGO");
        const defaultId = pago ? pago.supplier_id : (active[0]?.supplier_id ?? "");
        if (defaultId) selectSupplier(defaultId);
      })
      .catch((e: ApiError) => {
        if (!cancelled && e.status !== 401) setSuppliersError(e.detail);
      });
    return () => {
      cancelled = true;
    };
  }, [selectSupplier]);

  const supplier = useMemo(
    () => suppliers?.find((s) => s.supplier_id === supplierId) ?? null,
    [suppliers, supplierId],
  );

  const toggleSelected = (orderId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const selectionTotal = useMemo(() => {
    if (!eligible) return 0;
    return eligible
      .filter((o) => selected.has(o.order_id))
      .reduce((sum, o) => sum + (o.total_value_estimate_pln ?? 0), 0);
  }, [eligible, selected]);

  // Create --------------------------------------------------------------------
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);

  const handleCreate = useCallback(() => {
    if (!supplierId || selected.size === 0 || creating) return;
    setCreating(true);
    setCreateError(null);
    setCreateResult(null);
    api
      .transportCreate({ supplier_id: supplierId, order_ids: Array.from(selected) })
      .then((resp) => {
        setCreateResult({
          transportId: resp.transport_id,
          combinedCount: resp.combined.length,
          skipped: resp.skipped,
        });
        loadEligible(supplierId);
        loadBatches(supplierId);
      })
      .catch((e: ApiError) => {
        if (e.status !== 401) setCreateError(e.detail);
      })
      .finally(() => setCreating(false));
  }, [supplierId, selected, creating, loadEligible, loadBatches]);

  // Batch detail ----------------------------------------------------------------
  const selectBatch = useCallback((transportId: string) => {
    setSelectedTransportId(transportId);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    api
      .transportBatch(transportId)
      .then((d) => setDetail(d))
      .catch((e: ApiError) => {
        if (e.status !== 401) setDetailError(e.detail);
      })
      .finally(() => setDetailLoading(false));
  }, []);

  // rows = product, cols = detail.location_ids (private driver matrix).
  const matrix = useMemo(() => {
    if (!detail) return null;
    return detail.lines.map((line) => {
      const byLocation = new Map<string, number>();
      line.per_location.forEach((pl) => {
        byLocation.set(
          pl.location_id,
          roundQty((byLocation.get(pl.location_id) ?? 0) + pl.qty_purchase),
        );
      });
      return { line, byLocation };
    });
  }, [detail]);

  const locationNameById = useMemo(() => {
    const byId = new Map<string, string>();
    detail?.orders.forEach((o) => byId.set(o.location_id, o.location_name));
    return byId;
  }, [detail]);

  const [copyToast, setCopyToast] = useState<string | null>(null);

  const copyDriverText = useCallback(() => {
    if (!detail) return;
    const text = buildTransportDriverText(detail, t);
    navigator.clipboard
      .writeText(text)
      .then(() => setCopyToast(t("manager.transport.detail.copyToast")))
      .catch(() => setCopyToast(t("manager.transport.detail.copyError")));
    window.setTimeout(() => setCopyToast(null), 3000);
  }, [detail, t]);

  const gmail = useMemo(() => {
    if (!detail || !supplier) return null;
    return buildTransportGmailUrl(detail, supplier, t);
  }, [detail, supplier, t]);

  const emailDisabledReason = useMemo(() => {
    if (!supplier || !hasValidRecipient(supplier.email)) {
      return t("manager.transport.detail.emailHint");
    }
    if (gmail?.tooLong) return t("manager.transport.detail.emailTooLong");
    return null;
  }, [supplier, gmail, t]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-12">
      <AppHeader className="sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate("/manager")}
            aria-label={t("manager.transport.back")}
            className="p-2 -ml-2 active:bg-white/10 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <h1 className="font-semibold text-lg tracking-tight">{t("manager.transport.title")}</h1>
        </div>
      </AppHeader>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 space-y-6">
        {copyToast && (
          <div className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900" role="status">
            {copyToast}
          </div>
        )}

        <section>
          <label htmlFor="trn-supplier" className="block text-xs font-semibold text-slate-600 mb-1">
            {t("manager.transport.supplierLabel")}
          </label>
          {suppliersError && <div className="text-sm text-red-700 mb-1">{suppliersError}</div>}
          <select
            id="trn-supplier"
            value={supplierId}
            onChange={(e) => selectSupplier(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {(suppliers ?? []).map((s) => (
              <option key={s.supplier_id} value={s.supplier_id}>
                {s.supplier_name}
              </option>
            ))}
          </select>
        </section>

        {/* ---- Eligible orders (to combine) ---- */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">{t("manager.transport.eligible.title")}</h2>

          {eligibleError && (
            <div className="rounded border-2 border-red-400 bg-red-50 p-3 text-sm text-red-900 mb-3" role="alert">
              {t("manager.transport.eligible.fetchError", { detail: eligibleError })}
            </div>
          )}
          {!eligibleError && eligible === null && (
            <div className="text-sm text-slate-500">{t("manager.transport.eligible.loading")}</div>
          )}
          {!eligibleError && eligible !== null && eligible.length === 0 && (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
              {t("manager.transport.eligible.empty")}
            </div>
          )}

          {eligible && eligible.length > 0 && (
            <>
              <ul className="space-y-2 mb-3">
                {eligible.map((o) => {
                  const visual = statusVisual(o.status);
                  return (
                    <li key={o.order_id}>
                      <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={selected.has(o.order_id)}
                          onChange={() => toggleSelected(o.order_id)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900 truncate">{o.location_name}</span>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${visual.pill}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${visual.dot}`} aria-hidden="true" />
                              {t(visual.labelKey)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {o.captain_submitted_at && formatDateTime(o.captain_submitted_at)}
                            {o.ordered_by
                              ? ` · ${t("manager.transport.eligible.orderedBy", { who: o.ordered_by })}`
                              : ""}
                          </div>
                          <div className="text-xs text-slate-500">
                            {o.line_count} · {(o.total_value_estimate_pln ?? 0).toFixed(2)} PLN
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  {t("manager.transport.eligible.selectedSummary", {
                    count: selected.size,
                    total: selectionTotal.toFixed(2),
                  })}
                </div>
                <button
                  type="button"
                  disabled={selected.size === 0 || creating}
                  onClick={handleCreate}
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
                >
                  {creating ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      {t("manager.transport.createBusy")}
                    </span>
                  ) : (
                    t("manager.transport.createButton")
                  )}
                </button>
              </div>
            </>
          )}

          {createError && (
            <div className="mt-3 rounded border-2 border-red-400 bg-red-50 p-3 text-sm text-red-900" role="alert">
              {t("manager.transport.createError", { detail: createError })}
            </div>
          )}
          {createResult && (
            <div className="mt-3 rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
              <div>
                {t("manager.transport.createResult.combined", {
                  count: createResult.combinedCount,
                  id: createResult.transportId,
                })}
              </div>
              {createResult.skipped.length > 0 && (
                <div className="mt-2">
                  <div className="font-semibold">{t("manager.transport.createResult.skippedHeader")}</div>
                  <ul className="list-disc list-inside">
                    {createResult.skipped.map((s) => (
                      <li key={s.order_id}>
                        {s.order_id}: {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ---- Past batches + detail ---- */}
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">{t("manager.transport.batches.title")}</h2>

          {batchesError && (
            <div className="rounded border-2 border-red-400 bg-red-50 p-3 text-sm text-red-900 mb-3" role="alert">
              {t("manager.transport.batches.fetchError", { detail: batchesError })}
            </div>
          )}
          {!batchesError && batches === null && (
            <div className="text-sm text-slate-500">{t("manager.transport.batches.loading")}</div>
          )}
          {!batchesError && batches !== null && batches.length === 0 && (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
              {t("manager.transport.batches.empty")}
            </div>
          )}

          {batches && batches.length > 0 && (
            <ul className="space-y-2">
              {batches.map((b) => (
                <li key={b.transport_id}>
                  <button
                    type="button"
                    onClick={() => selectBatch(b.transport_id)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      selectedTransportId === b.transport_id
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-400"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-medium text-slate-900">{b.transport_id}</div>
                    <div className="text-xs text-slate-600">{b.created && formatDateTime(b.created)}</div>
                    <div className="text-xs text-slate-500">
                      {t("manager.transport.batches.rowSubtitle", {
                        count: b.order_count,
                        locations: b.location_ids.join(", "),
                      })}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selectedTransportId && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              {detailLoading && (
                <div className="text-sm text-slate-500">{t("manager.transport.detail.loading")}</div>
              )}
              {detailError && (
                <div className="rounded border-2 border-red-400 bg-red-50 p-3 text-sm text-red-900" role="alert">
                  {t("manager.transport.detail.fetchError", { detail: detailError })}
                </div>
              )}

              {detail && matrix && (
                <>
                  <h3 className="text-sm font-semibold text-slate-800 mb-2">
                    {t("manager.transport.detail.totalsTitle")}
                  </h3>
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="text-left font-semibold px-3 py-2">
                            {t("manager.transport.detail.productCol")}
                          </th>
                          <th className="text-right font-semibold px-3 py-2">
                            {t("manager.transport.detail.qtyCol")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.lines.map((line) => (
                          <tr key={line.product_id} className="border-t border-gray-100">
                            <td className="px-3 py-2">{line.product_name_pl}</td>
                            <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                              {line.total_qty_purchase} {line.purchase_unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-800 mb-2">
                    {t("manager.transport.detail.matrixTitle")}
                  </h3>
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="text-left font-semibold px-3 py-2">
                            {t("manager.transport.detail.productCol")}
                          </th>
                          {detail.location_ids.map((locId) => (
                            <th key={locId} className="text-right font-semibold px-3 py-2 whitespace-nowrap">
                              {locationNameById.get(locId) ?? locId}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matrix.map(({ line, byLocation }) => (
                          <tr key={line.product_id} className="border-t border-gray-100">
                            <td className="px-3 py-2">{line.product_name_pl}</td>
                            {detail.location_ids.map((locId) => (
                              <td key={locId} className="px-3 py-2 text-right tabular-nums">
                                {byLocation.has(locId) ? byLocation.get(locId) : "–"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <button
                      type="button"
                      onClick={copyDriverText}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {t("manager.transport.detail.copyButton")}
                    </button>

                    {!emailDisabledReason && gmail ? (
                      <a
                        href={gmail.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                      >
                        {t("manager.transport.detail.emailButton")}
                      </a>
                    ) : (
                      <span
                        className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                        title={emailDisabledReason ?? undefined}
                      >
                        {t("manager.transport.detail.emailButton")}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-slate-800 mb-2">
                    {t("manager.transport.detail.ordersTitle")}
                  </h3>
                  <ul className="space-y-1 text-sm text-slate-700">
                    {detail.orders.map((o) => (
                      <li key={o.order_id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{o.location_name}</span>
                        <span className="text-xs text-slate-500 shrink-0">{o.order_id}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
