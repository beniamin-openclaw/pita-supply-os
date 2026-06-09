// Captain inventory history (S-08 / FR-019). Read-only browse of the location's
// past snapshots, reachable from the Remanent screen. Reuses the EXISTING Captain
// endpoints — api.inventoryCounts() (list) + api.inventoryCount(id) (detail,
// product_id only) — and joins product names client-side from api.inventoryProducts()
// (a since-removed product falls back to its id with a "removed" badge). No new
// backend; the order pre-fill contract is untouched.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { api, ApiError } from "../../apiClient";
import { useT } from "../../i18n";
import type {
  InventoryCountSummary,
  InventoryLatestResponse,
  InventoryProduct,
} from "../../types";

import { Header } from "./components/Header";
import { CaptainTabs } from "./components/CaptainTabs";
import { getToken } from "../../auth";

export function InventoryHistoryPage() {
  const { t, tPlural, formatDateTime } = useT();
  const navigate = useNavigate();
  const token = getToken("captain") || "";

  const [counts, setCounts] = useState<InventoryCountSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [productsById, setProductsById] = useState<Record<string, InventoryProduct>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InventoryLatestResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .inventoryCounts()
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

  // Product name map for the client-side join (silent on error — names degrade
  // to product_id with a "removed" badge).
  useEffect(() => {
    let cancelled = false;
    api
      .inventoryProducts()
      .then((products) => {
        if (cancelled) return;
        const map: Record<string, InventoryProduct> = {};
        products.forEach((p) => (map[p.product_id] = p));
        setProductsById(map);
      })
      .catch(() => {
        /* names are optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Guards against a stale detail response (see ManagerInventoryPage): an earlier
  // fetch resolving after a later one must not overwrite the shown detail.
  const detailReqRef = useRef<string | null>(null);
  const selectCount = useCallback((countId: string) => {
    detailReqRef.current = countId;
    setSelectedId(countId);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    api
      .inventoryCount(countId)
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

  const detailRows = useMemo(() => {
    if (!detail) return [];
    return detail.lines.map((ln) => {
      const product = productsById[ln.product_id];
      return {
        product_id: ln.product_id,
        name: product?.product_name_pl ?? ln.product_id,
        unit: product?.inventory_unit ?? "",
        is_critical: product?.is_critical ?? false,
        removed: !product,
        stock: ln.current_stock_qty_base,
        comment: ln.count_comment,
      };
    });
  }, [detail, productsById]);

  // ---- Detail panel ----------------------------------------------------------
  if (selectedId) {
    const selectedSummary = (counts ?? []).find((c) => c.count_id === selectedId);
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-12">
        <header className="bg-brand text-white px-4 py-3 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={backToList}
              aria-label={t("inventory.history.detailBack")}
              className="p-2 -ml-2 active:bg-white/10 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <h1 className="font-semibold text-lg tracking-tight">
              {selectedSummary
                ? t("inventory.history.detailTitle", {
                    date: formatDateTime(
                      selectedSummary.count_submitted_at ?? selectedSummary.count_date,
                    ),
                  })
                : t("inventory.history.title")}
            </h1>
          </div>
        </header>

        <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
          {detailLoading && (
            <div className="text-sm text-slate-500">{t("inventory.history.loading")}</div>
          )}
          {detailError && (
            <div className="rounded border-2 border-red-400 bg-red-50 p-4 text-sm text-red-900" role="alert">
              {t("inventory.history.fetchError", { detail: detailError })}
            </div>
          )}
          {detail && (
            <>
              {selectedSummary?.count_user && (
                <div className="mb-4 text-sm text-slate-600">
                  {t("inventory.history.countedBy", { who: selectedSummary.count_user })}
                </div>
              )}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left font-semibold px-3 py-2">
                        {t("inventory.history.productCol")}
                      </th>
                      <th className="text-right font-semibold px-3 py-2">
                        {t("inventory.history.stockCol")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((row) => (
                      <tr key={row.product_id} className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-900">{row.name}</span>
                            {row.is_critical && (
                              <span className="shrink-0 rounded bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5">
                                {t("card.critical")}
                              </span>
                            )}
                            {row.removed && (
                              <span className="shrink-0 rounded bg-slate-200 text-slate-600 text-[10px] font-semibold px-1.5 py-0.5">
                                {t("inventory.history.productRemoved")}
                              </span>
                            )}
                          </div>
                          {row.comment && (
                            <div className="text-xs text-slate-500 mt-0.5">{row.comment}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {row.stock} {row.unit}
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
      <Header
        locationName=""
        token={token}
        onShowOrders={() => navigate("/captain-v2/orders")}
        onShowInventory={() => navigate("/captain-v2/inventory-count")}
      />

      <CaptainTabs />

      <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/captain-v2/inventory-count")}
            aria-label={t("inventory.history.back")}
            className="p-1.5 -ml-1.5 rounded-md text-slate-600 active:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <h2 className="text-lg font-bold text-slate-900">{t("inventory.history.title")}</h2>
        </div>

        {error && (
          <div className="rounded border-2 border-red-400 bg-red-50 p-4 text-sm text-red-900" role="alert">
            {t("inventory.history.fetchError", { detail: error })}
          </div>
        )}

        {!error && counts === null && (
          <div className="text-sm text-slate-500">{t("inventory.history.loading")}</div>
        )}

        {!error && counts !== null && counts.length === 0 && (
          <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {t("inventory.history.empty")}
          </div>
        )}

        {counts !== null && counts.length > 0 && (
          <ul className="space-y-2">
            {counts.map((c) => (
              <li key={c.count_id}>
                <button
                  type="button"
                  onClick={() => selectCount(c.count_id)}
                  className="w-full text-left bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-3 active:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">
                      {formatDateTime(c.count_submitted_at ?? c.count_date)}
                    </div>
                    <div className="text-xs text-slate-600">
                      {c.count_user ? `${c.count_user} · ` : ""}
                      {tPlural("inventory.history.lineCount", "items", c.line_count)}
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
