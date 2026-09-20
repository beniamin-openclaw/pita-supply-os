// Manager inventory view (S-08 / FR-018). Read-only browse of submitted
// inventory snapshots across locations, with a product-enriched detail. Lives on
// its own route (/manager/inventory) so it doesn't touch the order workspace.
// Master-detail in one page: list → select → detail panel (mobile-first).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronLeft, ChevronRight, Download } from "lucide-react";

import { api, ApiError } from "../../apiClient";
import { ProductListToolbar } from "../../components/ui/ProductListToolbar";
import { useT } from "../../i18n";
import { categoryLabel } from "../../i18n/categoryLabels";
import {
  DEFAULT_PRODUCT_LIST_VIEW,
  applyProductListView,
  attentionReason,
  stockDelta,
  type ProductListView,
} from "../../lib/productListFilter";
import type {
  InventoryCountDetail,
  InventoryCountDetailLine,
  InventoryCountManagerItem,
} from "../../types";
import { buildInventoryCsv, inventoryCsvFilename } from "./lib/inventoryCsv";

/** Sticky group header offset = the page header's height (px-4 py-3 + text-lg). */
// Page header: px-4 py-3 (24px) + p-2 button around a 22px block-level svg = 62px.
const STICKY_GROUP_TOP = "top-[62px]";

function formatDelta(delta: number | null): string {
  if (delta === null) return "—";
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function ManagerInventoryPage() {
  const { t, tPlural, formatDateTime, lang } = useT();
  const navigate = useNavigate();

  const [counts, setCounts] = useState<InventoryCountManagerItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InventoryCountDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  // Decision-layer view (Phase 4): search / group / sort / attention filter.
  // Ephemeral by design (S-05 precedent) and reset per opened snapshot.
  const [listView, setListView] = useState<ProductListView>(DEFAULT_PRODUCT_LIST_VIEW);
  const patchListView = useCallback((patch: Partial<ProductListView>) => {
    setListView((prev) => ({ ...prev, ...patch }));
  }, []);

  const listResult = useMemo(
    () => applyProductListView<InventoryCountDetailLine>(detail?.lines ?? [], listView),
    [detail, listView],
  );

  useEffect(() => {
    let cancelled = false;
    api
      .managerInventoryCounts()
      .then((data) => {
        if (cancelled) return;
        setCounts(data);
        setError(null);
      })
      .catch((e: ApiError) => {
        if (cancelled) return;
        if (e.status !== 401) setError(e.detail);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Location options derived from the fetched rows (mirrors ManagerFilterBar's
  // derive-from-data approach); filtering is client-side over the union.
  const locationOptions = useMemo(() => {
    const byId = new Map<string, string>();
    (counts ?? []).forEach((c) => byId.set(c.location_id, c.location_name));
    return Array.from(byId, ([id, name]) => ({ id, name }));
  }, [counts]);

  const visibleCounts = useMemo(
    () =>
      (counts ?? []).filter(
        (c) => locationFilter === "" || c.location_id === locationFilter,
      ),
    [counts, locationFilter],
  );

  // Guards against a stale detail response: rapid row-clicks could otherwise let
  // an earlier fetch resolve after a later one and overwrite the shown detail.
  const detailReqRef = useRef<string | null>(null);
  const selectCount = useCallback((countId: string) => {
    detailReqRef.current = countId;
    setSelectedId(countId);
    setListView(DEFAULT_PRODUCT_LIST_VIEW);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    api
      .managerInventoryCount(countId)
      .then((d) => {
        if (detailReqRef.current === countId) setDetail(d);
      })
      .catch((e: ApiError) => {
        if (detailReqRef.current === countId && e.status !== 401) setDetailError(e.detail);
      })
      .finally(() => {
        if (detailReqRef.current === countId) setDetailLoading(false);
      });
  }, []);

  const backToList = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  // CSV export of the currently-open snapshot (manager-only; operator request
  // 2026-09-02). buildInventoryCsv is pure/DOM-free — this callback owns the
  // actual browser download (Blob + object URL + click + revoke).
  const downloadCsv = useCallback(() => {
    if (!detail) return;
    const csv = buildInventoryCsv(detail, t);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = inventoryCsvFilename(detail);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [detail, t]);

  // ---- Detail panel ----------------------------------------------------------
  if (selectedId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-12">
        <header className="bg-brand text-white px-4 py-3 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={backToList}
              aria-label={t("manager.inventory.detailBack")}
              className="p-2 -ml-2 active:bg-white/10 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <h1 className="font-semibold text-lg tracking-tight">
              {detail
                ? t("manager.inventory.detailTitle", { location: detail.location_name })
                : t("manager.inventory.title")}
            </h1>
          </div>
        </header>

        <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
          {detailLoading && (
            <div className="text-sm text-slate-500">{t("manager.inventory.loading")}</div>
          )}
          {detailError && (
            <div className="rounded border-2 border-red-400 bg-red-50 p-4 text-sm text-red-900" role="alert">
              {t("manager.inventory.fetchError", { detail: detailError })}
            </div>
          )}
          {detail && (
            <>
              <div className="mb-4 text-sm text-slate-600">
                <div>{formatDateTime(detail.count_submitted_at ?? detail.count_date)}</div>
                {detail.count_user && (
                  <div>{t("manager.inventory.countedBy", { who: detail.count_user })}</div>
                )}
                {detail.last_edited_at && (
                  <div className="text-slate-500">
                    {t("inventory.history.editedLabel", {
                      time: formatDateTime(detail.last_edited_at),
                    })}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <Download size={16} aria-hidden="true" />
                  {t("manager.inventory.csvButton")}
                </button>
                <p className="mt-1.5 text-xs text-slate-500">
                  {t("manager.inventory.csvPriceNote")}
                </p>
              </div>

              <ProductListToolbar
                idPrefix="mgr-inv-list"
                view={listView}
                onChange={patchListView}
                showGroupBy
                showSort
                toggles={["attention", "critical"]}
              />

              {listResult.groups.length === 0 ? (
                <div className="rounded border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                  {t("manager.inventory.noResults")}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left font-semibold px-3 py-2">
                          {t("manager.inventory.productCol")}
                        </th>
                        <th className="text-right font-semibold px-2 py-2">
                          {t("manager.inventory.stockCol")}
                        </th>
                        <th className="text-right font-semibold px-2 py-2">
                          {t("manager.inventory.targetCol")}
                        </th>
                        <th className="text-right font-semibold px-2 py-2">
                          {t("manager.inventory.deltaCol")}
                        </th>
                        <th className="text-left font-semibold px-2 py-2">
                          {t("manager.inventory.flagCol")}
                        </th>
                      </tr>
                    </thead>
                    {listResult.groups.map((group) => {
                      const groupLabel: string =
                        listView.groupBy === "supplier"
                          ? group.label || t("manager.inventory.noSupplier")
                          : group.label
                            ? categoryLabel(group.label, lang)
                            : t("inventory.uncategorized");
                      return (
                        <tbody key={`${listView.groupBy}:${group.key}`}>
                          <tr>
                            <th
                              colSpan={5}
                              scope="colgroup"
                              className={`sticky ${STICKY_GROUP_TOP} z-10 border-t border-gray-200 bg-slate-100 px-3 py-1.5 text-left text-xs font-semibold text-slate-700`}
                            >
                              {groupLabel}
                              <span className="ml-2 font-normal text-slate-500 tabular-nums">
                                {group.items.length}
                              </span>
                            </th>
                          </tr>
                          {group.items.map((ln) => {
                            const reason = attentionReason(ln);
                            const delta = stockDelta(ln);
                            return (
                              <tr
                                key={ln.product_id}
                                data-testid={`mgr-inv-row-${ln.product_id}`}
                                className={`border-t border-gray-100 align-top ${
                                  reason ? "bg-amber-50/60" : ""
                                }`}
                              >
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-slate-900 break-words">
                                      {ln.product_name_pl}
                                    </span>
                                    {ln.is_critical && (
                                      <span className="shrink-0 rounded bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5">
                                        {t("card.critical")}
                                      </span>
                                    )}
                                  </div>
                                  {listView.groupBy !== "supplier" && ln.supplier_name && (
                                    <div className="text-xs text-slate-500">{ln.supplier_name}</div>
                                  )}
                                  {ln.count_comment && (
                                    <div className="text-xs text-slate-500 mt-0.5">
                                      {ln.count_comment}
                                    </div>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                                  {ln.current_stock_qty_base} {ln.inventory_unit}
                                </td>
                                <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-slate-600">
                                  {ln.target_stock_qty_base ?? "—"}
                                </td>
                                <td
                                  className={`px-2 py-2 text-right tabular-nums whitespace-nowrap ${
                                    delta !== null && delta < 0 ? "text-red-700" : "text-slate-600"
                                  }`}
                                >
                                  {formatDelta(delta)}
                                </td>
                                <td className="px-2 py-2">
                                  {reason && (
                                    <span
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"
                                      data-testid={`mgr-inv-flag-${ln.product_id}`}
                                    >
                                      <AlertTriangle size={12} aria-hidden="true" className="shrink-0" />
                                      <span>
                                        {reason === "belowMin" &&
                                          t("manager.inventory.attention.belowMin", {
                                            min: ln.min_stock_qty_base ?? 0,
                                          })}
                                        {reason === "overMax" &&
                                          t("manager.inventory.attention.overMax", {
                                            max: ln.max_stock_qty_base ?? 0,
                                          })}
                                        {reason === "zeroWithTarget" &&
                                          t("manager.inventory.attention.zeroWithTarget", {
                                            target: ln.target_stock_qty_base ?? 0,
                                          })}
                                      </span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      );
                    })}
                  </table>
                </div>
              )}

              {/* Read-only correction history (Phase 2, training-feedback-0901) —
                  omitted entirely when this snapshot was never corrected. */}
              {detail.events && detail.events.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">
                    {t("inventory.history.eventsTitle")}
                  </h3>
                  <ul className="space-y-2">
                    {detail.events.map((ev) => (
                      <li
                        key={ev.event_id}
                        className="rounded-lg border border-gray-200 bg-white p-2.5"
                      >
                        <div className="text-xs text-slate-500">
                          {ev.at ? formatDateTime(ev.at) : "—"}
                          {" · "}
                          {ev.actor?.trim() || "—"}
                        </div>
                        <div className="mt-0.5 text-sm text-slate-800">{ev.details}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  // ---- List ------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-12">
      <header className="bg-brand text-white px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/manager")}
            aria-label={t("manager.inventory.back")}
            className="p-2 -ml-2 active:bg-white/10 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <h1 className="font-semibold text-lg tracking-tight">{t("manager.inventory.title")}</h1>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
        {locationOptions.length > 1 && (
          <div className="mb-4">
            <label htmlFor="mgr-inv-loc" className="sr-only">
              {t("manager.inventory.locationAll")}
            </label>
            <select
              id="mgr-inv-loc"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t("manager.inventory.locationAll")}</option>
              {locationOptions.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <div className="rounded border-2 border-red-400 bg-red-50 p-4 text-sm text-red-900" role="alert">
            {t("manager.inventory.fetchError", { detail: error })}
          </div>
        )}

        {!error && counts === null && (
          <div className="text-sm text-slate-500">{t("manager.inventory.loading")}</div>
        )}

        {!error && counts !== null && visibleCounts.length === 0 && (
          <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {t("manager.inventory.empty")}
          </div>
        )}

        {visibleCounts.length > 0 && (
          <ul className="space-y-2">
            {visibleCounts.map((c) => (
              <li key={c.count_id}>
                <button
                  type="button"
                  onClick={() => selectCount(c.count_id)}
                  className="w-full text-left bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-3 active:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{c.location_name}</div>
                    <div className="text-xs text-slate-600">
                      {formatDateTime(c.count_submitted_at ?? c.count_date)}
                      {c.count_user ? ` · ${c.count_user}` : ""}
                    </div>
                    <div className="text-xs text-slate-500">
                      {tPlural("manager.inventory.lineCount", "items", c.line_count)}
                    </div>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
