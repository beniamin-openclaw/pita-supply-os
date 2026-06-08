// Manager inventory view (S-08 / FR-018). Read-only browse of submitted
// inventory snapshots across locations, with a product-enriched detail. Lives on
// its own route (/manager/inventory) so it doesn't touch the order workspace.
// Master-detail in one page: list → select → detail panel (mobile-first).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { api, ApiError } from "../../apiClient";
import { useT } from "../../i18n";
import type {
  InventoryCountDetail,
  InventoryCountManagerItem,
} from "../../types";

export function ManagerInventoryPage() {
  const { t, formatDateTime } = useT();
  const navigate = useNavigate();

  const [counts, setCounts] = useState<InventoryCountManagerItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InventoryCountDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .managerInventoryCounts()
      .then((data) => {
        setCounts(data);
        setError(null);
      })
      .catch((e: ApiError) => {
        if (e.status !== 401) setError(e.detail);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const selectCount = useCallback((countId: string) => {
    setSelectedId(countId);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    api
      .managerInventoryCount(countId)
      .then((d) => setDetail(d))
      .catch((e: ApiError) => {
        if (e.status !== 401) setDetailError(e.detail);
      })
      .finally(() => setDetailLoading(false));
  }, []);

  const backToList = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
  }, []);

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
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left font-semibold px-3 py-2">
                        {t("manager.inventory.productCol")}
                      </th>
                      <th className="text-right font-semibold px-3 py-2">
                        {t("manager.inventory.stockCol")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((ln) => (
                      <tr key={ln.product_id} className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{ln.product_name_pl}</span>
                            {ln.is_critical && (
                              <span className="shrink-0 rounded bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5">
                                {t("card.critical")}
                              </span>
                            )}
                          </div>
                          {ln.count_comment && (
                            <div className="text-xs text-slate-500 mt-0.5">{ln.count_comment}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {ln.current_stock_qty_base} {ln.inventory_unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                      {t("manager.inventory.lineCount", { count: c.line_count })}
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
