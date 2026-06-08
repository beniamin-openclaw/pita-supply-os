// Captain's "My orders" list. Tap a row to drill into detail (read-only view
// + Edit button when status === 'captain_submitted').

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { api, ApiError } from "../../apiClient";
import { useT } from "../../i18n";
import type { CaptainOrderListItem } from "../../types";
import { CaptainTabs } from "./components/CaptainTabs";
import { statusVisual } from "./lib/orderStatus";

export function OrdersListPage() {
  const { t, formatDateTime } = useT();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<CaptainOrderListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .captainOrders({ limit: 20 })
      .then((data) => {
        setOrders(data);
        setError(null);
      })
      .catch((e: ApiError) => {
        if (e.status !== 401) setError(e.detail);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-12">
      <header className="bg-brand text-white px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/captain-v2")}
            aria-label={t("orders.back")}
            className="p-2 -ml-2 active:bg-white/10 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <h1 className="font-semibold text-lg tracking-tight">{t("orders.title")}</h1>
        </div>
      </header>

      <CaptainTabs />

      <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
        {error && (
          <div className="mb-4 rounded border-2 border-red-400 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <div className="font-semibold">{t("manager.error")}</div>
            <div className="mt-1">{t("orders.fetchError", { detail: error })}</div>
            <button
              type="button"
              onClick={load}
              className="mt-2 rounded border border-red-400 bg-white px-2 py-1 text-xs hover:bg-red-100"
            >
              {t("manager.tryAgain")}
            </button>
          </div>
        )}

        {orders === null && !error ? (
          <p className="text-sm text-slate-600">{t("orders.loading")}</p>
        ) : orders && orders.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {t("orders.empty")}
          </div>
        ) : (
          <ul className="space-y-2">
            {(orders ?? []).map((o) => (
              <li key={o.order_id}>
                <button
                  type="button"
                  onClick={() => navigate(`/captain-v2/orders/${o.order_id}`)}
                  className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-slate-900 truncate">{o.supplier_name}</span>
                      <span className="shrink-0 flex items-center gap-1.5">
                        {o.last_edited_at && (
                          <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                            {t("orders.editedBadge")}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${statusVisual(o.status).pill}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusVisual(o.status).dot}`} aria-hidden="true" />
                          {t(statusVisual(o.status).labelKey)}
                        </span>
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 truncate">
                      {o.line_count} {t("orders.linesShort")} · {o.total_value_estimate_pln?.toFixed(2) ?? "?"} PLN ·{" "}
                      {o.captain_submitted_at ? formatDateTime(o.captain_submitted_at) : "—"}
                      {o.editable && (
                        <span className="ml-1 text-blue-700 font-medium">· {t("orders.edit.editable")}</span>
                      )}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-slate-400">{o.order_id}</div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400 shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
