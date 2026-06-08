// Read-only Captain order detail. Pulls /api/captain/order/{id}, renders the
// enriched lines + a (conditional) "Edytuj zamówienie" button that navigates
// to the edit form. If status !== captain_submitted, button is disabled with
// a short explanation.

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertOctagon, ChevronLeft, Lock, Pencil } from "lucide-react";

import { api, ApiError } from "../../apiClient";
import { useT } from "../../i18n";
import type { CaptainOrderDetail } from "../../types";
import { statusVisual } from "./lib/orderStatus";

export function OrderDetailPage() {
  const { t, formatDateTime } = useT();
  const navigate = useNavigate();
  const { order_id } = useParams<{ order_id: string }>();
  const [order, setOrder] = useState<CaptainOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!order_id) return;
    api
      .captainOrder(order_id)
      .then((data) => {
        setOrder(data);
        setError(null);
      })
      .catch((e: ApiError) => {
        if (e.status !== 401) setError(e.detail);
      });
  }, [order_id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
      <header className="bg-brand text-white px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/captain-v2/orders")}
            aria-label={t("orders.title")}
            className="p-2 -ml-2 active:bg-white/10 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <h1 className="font-semibold text-lg tracking-tight truncate">
            {order ? order.supplier_name : t("orders.loading")}
          </h1>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
        {error && (
          <div className="mb-4 rounded border-2 border-red-400 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <div className="font-semibold">{t("manager.error")}</div>
            <div className="mt-1">{error}</div>
          </div>
        )}

        {!order && !error ? (
          <p className="text-sm text-slate-600">{t("orders.loading")}</p>
        ) : !order ? null : (
          <>
            {/* Summary card */}
            {/* Send-back banner: manager released the order back with a reason
                (stored in notes). Show only while editable (captain can act). */}
            {order.editable && order.notes && order.notes.trim() !== "" && (
              <div
                className="mb-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900"
                role="status"
              >
                {t("orders.sendBackBanner", { reason: order.notes })}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="font-mono text-xs text-slate-500">{order.order_id}</div>
                <span className="flex items-center gap-1.5">
                  {order.last_edited_at && (
                    <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                      {t("orders.editedBadge")}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full border ${statusVisual(order.status).pill}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusVisual(order.status).dot}`} aria-hidden="true" />
                    {t(statusVisual(order.status).labelKey)}
                  </span>
                </span>
              </div>
              <dl className="text-sm text-slate-800 space-y-1">
                <div>
                  {t("orders.detail.total", {
                    value: order.total_value_estimate_pln?.toFixed(2) ?? "?",
                  })}
                </div>
                {order.requested_delivery_date && (
                  <div>
                    {t("orders.detail.requestedDelivery", {
                      value: order.requested_delivery_date,
                    })}
                  </div>
                )}
                {order.captain_submitted_at && (
                  <div>
                    {t("orders.detail.submittedAt", {
                      value: formatDateTime(order.captain_submitted_at),
                    })}
                  </div>
                )}
                {order.last_edited_at && (
                  <div className="text-purple-800 font-medium">
                    {t("orders.editedAt", { value: formatDateTime(order.last_edited_at) })}
                  </div>
                )}
                <div className="text-xs text-slate-600 mt-2">
                  {order.editable ? t("orders.editableHint") : t("orders.lockedHint")}
                </div>
              </dl>
            </div>

            {/* Lines */}
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
              {t("orders.detail.linesHeader")}
            </h2>
            <ul className="space-y-2 mb-6">
              {order.lines.map((line) => (
                <li
                  key={line.order_line_id}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 font-medium text-slate-900 truncate">
                        {line.is_critical && (
                          <AlertOctagon
                            size={14}
                            className="text-red-600 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        <span className="truncate">{line.product_name_pl}</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        stan: {line.current_stock_qty_base} {line.inventory_unit} ·
                        sugestia: {line.suggested_qty_purchase} {line.purchase_unit}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-slate-900 tabular-nums">
                        {line.captain_final_qty_purchase}{" "}
                        <span className="text-xs font-normal text-slate-600">
                          {line.purchase_unit}
                        </span>
                      </div>
                      {typeof line.delta_vs_suggestion_pct === "number" &&
                        Math.abs(line.delta_vs_suggestion_pct) >= 0.05 && (
                          <div
                            className={`text-xs font-semibold ${
                              line.delta_vs_suggestion_pct > 0
                                ? "text-orange-700"
                                : "text-red-700"
                            }`}
                          >
                            {line.delta_vs_suggestion_pct > 0 ? "+" : ""}
                            {Math.round(line.delta_vs_suggestion_pct * 100)}%
                          </div>
                        )}
                    </div>
                  </div>
                  {(line.reason_code || line.captain_comment) && (
                    <div className="mt-2 text-xs text-slate-600 italic">
                      {line.reason_code}
                      {line.captain_comment ? ` — ${line.captain_comment}` : ""}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Edit / locked button */}
            {order.editable ? (
              <button
                type="button"
                onClick={() => navigate(`/captain-v2/orders/${order.order_id}/edit`)}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-brand rounded-lg active:bg-brand-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <Pencil size={16} aria-hidden="true" />
                {t("orders.detail.editBtn")}
              </button>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="flex items-center gap-2 font-semibold mb-1">
                  <Lock size={14} aria-hidden="true" />
                  {t("orders.detail.lockedBtn")}
                </div>
                <div className="text-xs">{t("orders.detail.lockedExplain")}</div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
