// Captain Order Submission page — Magic Patterns design integrated with our backend.
// Wires our `api` shortcuts (NOT MP's internal apiClient) and our localStorage
// helpers (saveDraft/loadDraft/clearDraft from auth.ts).
//
// Location: not returned by /api/captain/orderable (backend derives it from the
// token); we leave `locationName` blank for now. A future `/api/whoami` endpoint
// would let us populate it.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "../../apiClient";
import { getToken, saveDraft, loadDraft, clearDraft } from "../../auth";
import { useT } from "../../i18n";

import { Header } from "./components/Header";
import { SupplierPicker } from "./components/SupplierPicker";
import { ContextStrip } from "./components/ContextStrip";
import { ProductCard } from "./components/ProductCard";
import { StickyActionBar } from "./components/StickyActionBar";
import { ConfirmSubmitDialog } from "./components/ConfirmSubmitDialog";
import { SkeletonCard } from "./components/SkeletonCard";
import { Toast, type ToastProps } from "./components/Toast";

import { computeRowState } from "./lib/compute";
import { getRequestedDeliveryDate } from "./lib/dates";

import type { Supplier, OrderableItem, OrderLine, DraftState } from "./types";

export function CaptainMP() {
  const { t, formatDateTime } = useT();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeSupplierId, setActiveSupplierId] = useState<string | null>(null);
  const [orderableItems, setOrderableItems] = useState<OrderableItem[]>([]);
  const [lines, setLines] = useState<Record<string, OrderLine>>({});
  const [sentSuppliers, setSentSuppliers] = useState<Set<string>>(new Set());
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [draftBanner, setDraftBanner] = useState<{
    supplierId: string;
    timestamp: number;
  } | null>(null);

  const token = getToken("captain") || "";

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type, onClose: () => setToast(null) });
  }, []);

  // ---- Initial fetch: suppliers ---------------------------------------------
  useEffect(() => {
    let cancelled = false;
    api
      .suppliers()
      .then((data) => {
        if (!cancelled) setSuppliers(data.filter((s) => s.active));
      })
      .catch((err: ApiError) => {
        if (cancelled) return;
        if (err.status !== 401) {
          showToast(t("toast.suppliersError", { detail: err.detail }), "error");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSuppliers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // ---- Auto-select first supplier once loaded -------------------------------
  useEffect(() => {
    if (!activeSupplierId && suppliers.length > 0) {
      setActiveSupplierId(suppliers[0].supplier_id);
    }
  }, [suppliers, activeSupplierId]);

  // ---- Fetch orderable items on supplier change ------------------------------
  useEffect(() => {
    if (!activeSupplierId) return;
    let cancelled = false;
    setIsLoadingItems(true);
    setOrderableItems([]);
    setLines({});

    api
      .orderable(activeSupplierId)
      .then((items) => {
        if (cancelled) return;
        setOrderableItems(items);

        // Check for a recent draft. If present, surface a banner; don't auto-load.
        const draft = loadDraft<DraftState>(activeSupplierId);
        if (draft && draft.state?.lines && Object.keys(draft.state.lines).length > 0) {
          setDraftBanner({
            supplierId: activeSupplierId,
            timestamp: draft.state.timestamp,
          });
          // Initialize blank lines anyway; user explicitly accepts/dismisses.
        }
        // Initialize empty lines for the freshly-loaded items.
        const initialLines: Record<string, OrderLine> = {};
        items.forEach((item) => {
          initialLines[item.product_id] = {
            product_id: item.product_id,
            supplier_product_id: item.supplier_product_id,
            current_stock_qty_base: "",
            captain_final_qty_purchase: "",
          };
        });
        setLines(initialLines);
      })
      .catch((err: ApiError) => {
        if (cancelled) return;
        if (err.status !== 401) {
          showToast(t("toast.itemsError", { detail: err.detail }), "error");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingItems(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSupplierId, showToast]);

  // ---- Draft auto-save (debounced) ------------------------------------------
  useEffect(() => {
    if (!activeSupplierId || Object.keys(lines).length === 0) return;
    const timeoutId = setTimeout(() => {
      const draftState: DraftState = { lines, timestamp: Date.now() };
      saveDraft(activeSupplierId, draftState);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [lines, activeSupplierId]);

  // ---- Handlers --------------------------------------------------------------
  const handleLineChange = useCallback((newLine: OrderLine) => {
    setLines((prev) => ({
      ...prev,
      [newLine.product_id]: newLine,
    }));
  }, []);

  const handleScrollToRed = useCallback(() => {
    const firstRed = orderableItems.find((item) => {
      const line = lines[item.product_id];
      if (!line) return false;
      return computeRowState(item, line).state === "red";
    });
    if (firstRed) {
      const el = document.getElementById(`card-${firstRed.product_id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [orderableItems, lines]);

  const acceptDraft = useCallback(() => {
    if (!draftBanner) return;
    const draft = loadDraft<DraftState>(draftBanner.supplierId);
    if (draft?.state?.lines) {
      setLines(draft.state.lines);
    }
    setDraftBanner(null);
  }, [draftBanner]);

  const discardDraft = useCallback(() => {
    if (!draftBanner) return;
    clearDraft(draftBanner.supplierId);
    setDraftBanner(null);
  }, [draftBanner]);

  const handleSaveDraft = useCallback(() => {
    if (!activeSupplierId) return;
    saveDraft(activeSupplierId, { lines, timestamp: Date.now() });
    showToast(t("toast.draftSaved"), "success");
  }, [activeSupplierId, lines, showToast, t]);

  const handleSubmit = useCallback(async () => {
    if (!activeSupplierId) return;
    const supplier = suppliers.find((s) => s.supplier_id === activeSupplierId);
    if (!supplier) return;
    setConfirmOpen(false);
    setIsSubmitting(true);
    try {
      const payloadLines = Object.values(lines)
        .filter(
          (l) => l.current_stock_qty_base !== "" && l.captain_final_qty_purchase !== "",
        )
        .map((l) => ({
          product_id: l.product_id,
          supplier_product_id: l.supplier_product_id,
          current_stock_qty_base: Number(l.current_stock_qty_base),
          captain_final_qty_purchase: Number(l.captain_final_qty_purchase),
          reason_code: l.reason_code || null,
          captain_comment: l.captain_comment || undefined,
        }));

      await api.captainSubmit({
        supplier_id: activeSupplierId,
        requested_delivery_date: getRequestedDeliveryDate(supplier.delivery_days),
        lines: payloadLines,
        notes: "",
      });

      showToast(t("toast.orderSent"), "success");
      clearDraft(activeSupplierId);
      setSentSuppliers((prev) => new Set(prev).add(activeSupplierId));

      // Move to next un-submitted supplier if any.
      const remaining = suppliers.find(
        (s) => !sentSuppliers.has(s.supplier_id) && s.supplier_id !== activeSupplierId,
      );
      if (remaining) {
        setActiveSupplierId(remaining.supplier_id);
      }
    } catch (err) {
      const detail =
        err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "?";
      showToast(t("toast.submitError", { detail }), "error");
    } finally {
      setIsSubmitting(false);
    }
  }, [activeSupplierId, lines, sentSuppliers, suppliers, showToast, t]);

  // ---- Pre-submit confirmation gate (F5) -------------------------------------
  // Critical products with nothing ordered (final empty or 0). Non-blocking:
  // surfaced in the confirm dialog as a warning, captain may send anyway.
  const criticalMissing = useMemo(
    () =>
      orderableItems
        .filter((item) => {
          if (!item.is_critical) return false;
          const final = lines[item.product_id]?.captain_final_qty_purchase;
          return final === "" || final === undefined || Number(final) === 0;
        })
        .map((item) => item.product_name_pl),
    [orderableItems, lines],
  );

  const openConfirm = useCallback(() => setConfirmOpen(true), []);
  const cancelConfirm = useCallback(() => setConfirmOpen(false), []);

  // ---- Derived state ---------------------------------------------------------
  const activeSupplier =
    suppliers.find((s) => s.supplier_id === activeSupplierId) || null;

  const stats = useMemo(() => {
    let deviationCount = 0;
    let reasonCount = 0;
    let hasRedCards = false;
    let allZero = true;
    let anyTouched = false;
    orderableItems.forEach((item) => {
      const line = lines[item.product_id];
      if (!line) return;
      if (
        line.current_stock_qty_base !== "" ||
        line.captain_final_qty_purchase !== ""
      ) {
        anyTouched = true;
      }
      if (
        line.captain_final_qty_purchase !== "" &&
        Number(line.captain_final_qty_purchase) > 0
      ) {
        allZero = false;
      }
      const { state } = computeRowState(item, line);
      if (state === "red") hasRedCards = true;
      if (state === "orange" || state === "red") deviationCount++;
      if (line.reason_code) reasonCount++;
    });
    return { deviationCount, reasonCount, hasRedCards, allZero, anyTouched };
  }, [orderableItems, lines]);

  // We don't have per-supplier line counts available cheaply; show empty record
  // (badge omitted). The picker handles that gracefully.
  const lineCounts: Record<string, number> = useMemo(() => {
    if (!activeSupplierId) return {};
    return { [activeSupplierId]: orderableItems.length };
  }, [activeSupplierId, orderableItems.length]);

  // ---- Render ---------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-28">
      {toast && <Toast {...toast} />}

      <Header
        locationName=""
        token={token}
        onShowOrders={() => navigate("/captain-v2/orders")}
        onShowInventory={() => navigate("/captain-v2/inventory-count")}
      />

      {isLoadingSuppliers ? (
        <div className="px-4 py-4 text-sm text-slate-600">{t("captain.suppliersLoading")}</div>
      ) : (
        <SupplierPicker
          suppliers={suppliers}
          activeId={activeSupplierId}
          onSelect={setActiveSupplierId}
          lineCounts={lineCounts}
          sentSuppliers={sentSuppliers}
        />
      )}

      <ContextStrip supplier={activeSupplier} />

      <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
        {draftBanner && (
          <div
            role="dialog"
            aria-label={t("captain.draftBannerAriaLabel")}
            className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"
          >
            <div className="text-amber-900">
              {t("captain.draftBannerTitle", {
                time: formatDateTime(draftBanner.timestamp, { timeStyle: "short", dateStyle: undefined }),
              })}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={acceptDraft}
                className="px-3 py-2 rounded-md bg-amber-700 text-white text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                {t("captain.draftBannerAccept")}
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="px-3 py-2 rounded-md bg-white text-amber-900 border border-amber-300 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                {t("captain.draftBannerDiscard")}
              </button>
            </div>
          </div>
        )}

        {isLoadingItems ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : orderableItems.length === 0 ? (
          <div className="text-center py-12 text-slate-600">{t("captain.itemsEmpty")}</div>
        ) : (
          <>
            {stats.allZero && stats.anyTouched && (
              <div className="bg-green-50 border border-green-300 rounded-xl p-6 text-center mb-4">
                <div className="text-green-900 font-semibold mb-1">{t("captain.stockAtTarget")}</div>
                <div className="text-green-700 text-sm">{t("captain.stockAtTargetSub")}</div>
              </div>
            )}
            {orderableItems.map((item) => (
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
            ))}
          </>
        )}
      </main>

      {activeSupplierId && orderableItems.length > 0 && !isLoadingItems && (
        <StickyActionBar
          lineCount={orderableItems.length}
          deviationCount={stats.deviationCount}
          reasonCount={stats.reasonCount}
          hasRedCards={stats.hasRedCards}
          isEmpty={!stats.anyTouched}
          onScrollToRed={handleScrollToRed}
          onSaveDraft={handleSaveDraft}
          onSubmit={openConfirm}
          isSubmitting={isSubmitting}
        />
      )}

      <ConfirmSubmitDialog
        open={confirmOpen}
        lineCount={orderableItems.length}
        deviationCount={stats.deviationCount}
        reasonCount={stats.reasonCount}
        criticalMissing={criticalMissing}
        onConfirm={handleSubmit}
        onCancel={cancelConfirm}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
