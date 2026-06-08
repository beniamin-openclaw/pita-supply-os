// Suggestion learning-loop review (S-03 / FR-012). Read-only per-product
// roll-up of the order-line history so the owner sees where the engine's
// suggestion was overridden (and why) and can decide which master-data rows to
// correct. Sorted worst-deviation first by the backend. Own route, mirrors the
// ManagerInventoryPage read-view pattern.

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { api, ApiError } from "../../apiClient";
import { useT, type StringKey } from "../../i18n";
import type { SuggestionReviewItem } from "../../types";

const SYSTEM_WRONG = "SYSTEM_SUGGESTION_WRONG";

function deviationClasses(pct: number): string {
  if (pct >= 0.2) return "bg-red-100 text-red-700";
  if (pct >= 0.1) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

export function ManagerSuggestionReviewPage() {
  const { t } = useT();
  const navigate = useNavigate();

  const [items, setItems] = useState<SuggestionReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .managerSuggestionReview()
      .then((data) => {
        setItems(data);
        setError(null);
      })
      .catch((e: ApiError) => {
        if (e.status !== 401) setError(e.detail);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pct = (x: number): string => `${Math.round(x * 100)}%`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-12">
      <header className="bg-brand text-white px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/manager")}
            aria-label={t("manager.review.back")}
            className="p-2 -ml-2 active:bg-white/10 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <h1 className="font-semibold text-lg tracking-tight">{t("manager.review.title")}</h1>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
        <p className="mb-4 text-xs text-slate-600 bg-slate-100 rounded-lg px-3 py-2 border border-slate-200">
          {t("manager.review.explainer")}
        </p>

        {error && (
          <div className="rounded border-2 border-red-400 bg-red-50 p-4 text-sm text-red-900" role="alert">
            {t("manager.review.fetchError", { detail: error })}
          </div>
        )}

        {!error && items === null && (
          <div className="text-sm text-slate-500">{t("manager.review.loading")}</div>
        )}

        {!error && items !== null && items.length === 0 && (
          <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {t("manager.review.empty")}
          </div>
        )}

        {items !== null && items.length > 0 && (
          <ul className="space-y-3">
            {items.map((it) => (
              <li
                key={it.product_id}
                className="bg-white border border-gray-200 rounded-xl p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{it.product_name_pl}</div>
                    <div className="text-xs text-slate-500">
                      {it.product_category}
                      {" · "}
                      {t("manager.review.lineOrderCount", {
                        lines: it.line_count,
                        orders: it.order_count,
                      })}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold tabular-nums ${deviationClasses(
                      it.avg_abs_deviation_pct,
                    )}`}
                    title={t("manager.review.colDeviation")}
                  >
                    {pct(it.avg_abs_deviation_pct)}
                  </span>
                </div>

                <div className="mt-2 text-sm text-slate-700 tabular-nums">
                  {t("manager.review.flow", {
                    suggested: it.avg_suggested_qty_purchase,
                    captain: it.avg_captain_final_qty_purchase,
                    manager: it.avg_manager_final_qty_purchase,
                  })}
                </div>

                {Object.keys(it.reason_code_counts).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(it.reason_code_counts).map(([code, count]) => (
                      <span
                        key={code}
                        className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                          code === SYSTEM_WRONG
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {t(`reason.codes.${code}` as StringKey)} ×{count}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
