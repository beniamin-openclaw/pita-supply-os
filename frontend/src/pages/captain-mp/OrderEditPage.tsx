// Captain edit-order screen. Loads the existing order detail, prefills the
// product cards with prior stock/qty/reason values, lets the user adjust,
// and submits via PATCH /api/captain/order/{id}.
//
// Scope deliberately narrowed: edits the existing line set in place. If the
// captain wants to add a brand-new product, they should ask the manager
// (which would normally use a fresh submit anyway).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { api, ApiError } from "../../apiClient";
import { useT } from "../../i18n";
import type {
  CaptainOrderDetail,
  ManagerOrderLineDetail,
  OrderableItem,
} from "../../types";

import { ProductCard } from "./components/ProductCard";
import { StickyActionBar } from "./components/StickyActionBar";
import { SkeletonCard } from "./components/SkeletonCard";
import { Toast, type ToastProps } from "./components/Toast";
import { computeRowState } from "./lib/compute";
import { buildPayloadLines } from "./lib/buildPayloadLines";
import type { OrderLine } from "./types";

/** Translate an enriched detail line into the shape ProductCard expects. */
function lineToItem(line: ManagerOrderLineDetail): OrderableItem {
  return {
    product_id: line.product_id,
    product_name_pl: line.product_name_pl,
    inventory_unit: line.inventory_unit,
    is_critical: line.is_critical,
    purchase_unit: line.purchase_unit,
    units_per_purchase_unit: line.units_per_purchase_unit,
    rounding_rule: line.rounding_rule ?? "full_only", // detail line carries it (S-09); fall back to full_only
    min_stock_qty_base: 0,
    // Real ceiling from the detail join (impl-review F1) so computeRowState's uncounted over-MAX
    // gate mirrors the backend; was hardcoded 0/true, which made the over-MAX
    // pill unreachable on edit (a cleared stock + over-MAX order then 400'd at
    // the backend with no on-screen warning).
    max_stock_qty_base: line.max_stock_qty_base,
    target_stock_qty_base: line.target_stock_qty_base,
    allow_over_max_due_to_packaging: line.allow_over_max_due_to_packaging,
    supplier_product_id: line.supplier_product_id,
    supplier_product_name: line.supplier_product_name,
  };
}

function lineToFormState(line: ManagerOrderLineDetail): OrderLine {
  return {
    product_id: line.product_id,
    supplier_product_id: line.supplier_product_id,
    // Persisted stock is shown as-is. An order submitted with a BLANK stock
    // persists as 0 (buildPayloadLines coerces blank→0), so re-editing it shows
    // "0" here, not blank — 0 is the value of record (the backend stored it).
    current_stock_qty_base: line.current_stock_qty_base,
    captain_final_qty_purchase: line.captain_final_qty_purchase,
    reason_code: line.reason_code ?? "",
    captain_comment: line.captain_comment,
  };
}

export function OrderEditPage() {
  const { t, formatDateTime } = useT();
  const navigate = useNavigate();
  const { order_id } = useParams<{ order_id: string }>();

  const [order, setOrder] = useState<CaptainOrderDetail | null>(null);
  const [lines, setLines] = useState<Record<string, OrderLine>>({});
  const [items, setItems] = useState<OrderableItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error") =>
      setToast({ message, type, onClose: () => setToast(null) }),
    [],
  );

  // Load the order once on mount.
  useEffect(() => {
    if (!order_id) return;
    let cancelled = false;
    api
      .captainOrder(order_id)
      .then((data) => {
        if (cancelled) return;
        if (!data.editable) {
          // Server says this can't be edited — bounce back to detail with a toast.
          showToast(t("orders.editToast.locked"), "error");
          navigate(`/captain-v2/orders/${data.order_id}`, { replace: true });
          return;
        }
        setLoadError(null);
        setOrder(data);
        const builtItems = data.lines.map(lineToItem);
        const builtLines: Record<string, OrderLine> = {};
        for (const dl of data.lines) {
          builtLines[dl.product_id] = lineToFormState(dl);
        }
        setItems(builtItems);
        setLines(builtLines);
      })
      .catch((e: ApiError) => {
        if (cancelled) return;
        if (e.status !== 401) setLoadError(e.detail);
      });
    return () => {
      cancelled = true;
    };
  }, [order_id, navigate, showToast, t]);

  const handleLineChange = useCallback((newLine: OrderLine) => {
    setLines((prev) => ({ ...prev, [newLine.product_id]: newLine }));
  }, []);

  const handleScrollToRed = useCallback(() => {
    const firstRed = items.find((item) => {
      const line = lines[item.product_id];
      if (!line) return false;
      return computeRowState(item, line).state === "red";
    });
    if (firstRed) {
      const el = document.getElementById(`card-${firstRed.product_id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [items, lines]);

  const stats = useMemo(() => {
    let deviationCount = 0;
    let reasonCount = 0;
    let hasRedCards = false;
    let anyTouched = false;
    items.forEach((item) => {
      const line = lines[item.product_id];
      if (!line) return;
      if (
        line.current_stock_qty_base !== "" ||
        line.captain_final_qty_purchase !== ""
      ) {
        anyTouched = true;
      }
      const { state } = computeRowState(item, line);
      if (state === "red") hasRedCards = true;
      if (state === "orange" || state === "red") deviationCount++;
      if (line.reason_code) reasonCount++;
    });
    return { deviationCount, reasonCount, hasRedCards, anyTouched };
  }, [items, lines]);

  const handleSubmit = useCallback(async () => {
    if (!order) return;
    const payloadLines = buildPayloadLines(lines);
    // Same UI guard as the new-order screen: 0 buildable lines would 422.
    if (payloadLines.length === 0) {
      showToast(t("apiError.orderEmpty"), "error");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.captainOrderEdit(order.order_id, {
        requested_delivery_date: order.requested_delivery_date ?? undefined,
        lines: payloadLines,
        // Clear notes: if the manager sent this back with a review comment
        // (stored in notes), resubmitting means the captain has addressed it,
        // so the send-back banner should disappear.
        notes: "",
      });

      showToast(t("orders.editToast.success"), "success");
      // Navigate back to detail to show the freshly updated record.
      setTimeout(() => navigate(`/captain-v2/orders/${order.order_id}`), 600);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          showToast(t("orders.editToast.locked"), "error");
          setTimeout(() => navigate("/captain-v2/orders", { replace: true }), 1500);
        } else if (err.status !== 401) {
          showToast(t("orders.editToast.error", { detail: err.detail }), "error");
        }
      } else {
        showToast(t("orders.editToast.error", { detail: String(err) }), "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [order, lines, navigate, showToast, t]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-28">
      {toast && <Toast {...toast} />}

      <header className="bg-brand text-white px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/captain-v2/orders/${order_id}`)}
            aria-label={t("orders.title")}
            className="p-2 -ml-2 active:bg-white/10 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h1 className="font-semibold text-base tracking-tight truncate">
              {t("orders.detail.editBtn")} · {order?.supplier_name ?? "…"}
            </h1>
            <div className="text-xs opacity-90 truncate">
              {order?.captain_submitted_at
                ? t("orders.detail.submittedAt", {
                    value: formatDateTime(order.captain_submitted_at),
                  })
                : "…"}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
        {loadError && (
          <div className="mb-4 rounded border-2 border-red-400 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <div className="font-semibold">{t("manager.error")}</div>
            <div className="mt-1">{loadError}</div>
          </div>
        )}

        {order && order.notes && order.notes.trim() !== "" && (
          <div
            className="mb-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900"
            role="status"
          >
            {t("orders.sendBackBanner", { reason: order.notes })}
          </div>
        )}

        {!order && !loadError ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          items.map((item) => (
            <ProductCard
              key={item.product_id}
              item={item}
              line={
                lines[item.product_id] || {
                  product_id: item.product_id,
                  supplier_product_id: item.supplier_product_id,
                  current_stock_qty_base: "",
                  captain_final_qty_purchase: "",
                }
              }
              onChange={handleLineChange}
            />
          ))
        )}
      </main>

      {order && items.length > 0 && (
        <StickyActionBar
          lineCount={items.length}
          deviationCount={stats.deviationCount}
          reasonCount={stats.reasonCount}
          hasRedCards={stats.hasRedCards}
          isEmpty={!stats.anyTouched}
          onScrollToRed={handleScrollToRed}
          onSaveDraft={() => {
            /* edit mode has no draft — explicit save = submit */
          }}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
