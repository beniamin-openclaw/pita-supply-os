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
import { CaptainTabs } from "./components/CaptainTabs";
import { SupplierPicker } from "./components/SupplierPicker";
import { ContextStrip } from "./components/ContextStrip";
import { ProductCard } from "./components/ProductCard";
import { StickyActionBar } from "./components/StickyActionBar";
import { ConfirmSubmitDialog } from "./components/ConfirmSubmitDialog";
import { PrefillControl } from "./components/PrefillControl";
import { ConfirmPrefillDialog } from "./components/ConfirmPrefillDialog";
import { SkeletonCard } from "./components/SkeletonCard";
import { Toast, type ToastProps } from "./components/Toast";

import { computeRowState } from "./lib/compute";
import { getRequestedDeliveryDate } from "./lib/dates";

import type { Supplier, OrderableItem, OrderLine, DraftState } from "./types";
import type { InventoryCountSummary, InventoryLatestResponse } from "../../types";

// Pilot supplier for the Wola×Bukat round-trip (S-01). The order screen defaults
// to this supplier on load instead of suppliers[0] (the first CSV row,
// SUP_BLUESERV — 0 orderable lines at Wola). Retargeting the pilot later is a
// one-line edit; no env var needed (same value in dev and prod).
const PILOT_SUPPLIER_ID = "SUP_BUKAT";

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
  // FR-024 snapshot picker model (replaces the single-latestSnapshot of S-07):
  //  - availableSnapshots: compact rows (no lines) for the picker
  //  - selectedSnapshotId: defaults to the newest (backend sorts count_date desc)
  //  - snapshotDetails: lazily-loaded lines, cached by count_id
  //  - prefillConfirm: which destructive action is awaiting confirmation
  const [availableSnapshots, setAvailableSnapshots] = useState<InventoryCountSummary[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [snapshotDetails, setSnapshotDetails] = useState<
    Record<string, InventoryLatestResponse | null>
  >({});
  const [prefillConfirm, setPrefillConfirm] = useState<"overwrite" | "clear" | null>(null);

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
  }, [showToast, t]);

  // ---- Fetch available inventory snapshots once (FR-024 picker source) -------
  // Silent on error: prefill is optional and must never block ordering. Seed
  // mode / no snapshots → [] → no control. Location-wide, so fetched once;
  // default the selection to the newest (backend sorts count_date desc).
  useEffect(() => {
    let cancelled = false;
    api
      .inventoryCounts()
      .then((rows) => {
        if (cancelled) return;
        setAvailableSnapshots(rows);
        if (rows.length > 0) setSelectedSnapshotId(rows[0].count_id);
      })
      .catch(() => {
        /* optional feature — ignore errors */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Lazy-load the SELECTED snapshot's lines, cached by id -----------------
  // The picker rows carry no lines (FR-024); we fetch them only when a snapshot
  // is selected, and cache by count_id so re-selecting is free. On a (rare)
  // failed detail fetch we cache an empty result so the fill buttons un-disable
  // instead of spinning forever — they'll simply match 0 lines.
  useEffect(() => {
    if (!selectedSnapshotId) return;
    if (selectedSnapshotId in snapshotDetails) return; // cached (null = error result, also cached)
    let cancelled = false;
    const id = selectedSnapshotId;
    api
      .inventoryCount(id)
      .then((detail) => {
        if (!cancelled) setSnapshotDetails((prev) => ({ ...prev, [id]: detail }));
      })
      .catch(() => {
        if (cancelled) return;
        // Store null (not a type-violating sentinel) so the cache key exists
        // and the loading state clears, while consumers' `if (!detail) return`
        // guard keeps the fill buttons no-op on an errored snapshot.
        setSnapshotDetails((prev) => ({ ...prev, [id]: null }));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSnapshotId, snapshotDetails]);

  // ---- Auto-select the pilot supplier (Bukat) once loaded -------------------
  // Default to the pilot supplier if it's in the (already active-filtered) list,
  // else fall back to the first supplier — today's behaviour. The
  // `suppliers.length > 0` guard keeps `suppliers[0]` defined; an inactive pilot
  // simply falls through to the fallback.
  useEffect(() => {
    if (!activeSupplierId && suppliers.length > 0) {
      const pilot =
        suppliers.find((s) => s.supplier_id === PILOT_SUPPLIER_ID) ?? suppliers[0];
      // Intentional one-time default once suppliers load; activeSupplierId is
      // also user-settable (picker), so it can't be derived purely in render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSupplierId(pilot.supplier_id);
    }
  }, [suppliers, activeSupplierId]);

  // ---- Fetch orderable items on supplier change ------------------------------
  useEffect(() => {
    if (!activeSupplierId) return;
    let cancelled = false;
    // Intentional synchronous reset when the supplier changes: clear the
    // previous supplier's items + form lines and show the loader before the
    // refetch. The set-state-in-effect rule over-fires on this deliberate
    // pattern (no async path can clear the stale list before paint).
    /* eslint-disable react-hooks/set-state-in-effect */
    setIsLoadingItems(true);
    setOrderableItems([]);
    setLines({});
    /* eslint-enable react-hooks/set-state-in-effect */

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
  }, [activeSupplierId, showToast, t]);

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

  // ---- Pre-fill actions (FR-023/024) -----------------------------------------
  // All three pull from the SELECTED snapshot (lazily-loaded lines). Matching is
  // by product_id between the snapshot and the orderable lines.
  //
  // fillEmpties — SAFE default: fills only fields the captain hasn't typed
  // (=== ""); a typed 0 is preserved (the blank-vs-0 rule). Never clobbers.
  const fillEmpties = useCallback(() => {
    const detail = selectedSnapshotId ? snapshotDetails[selectedSnapshotId] : null;
    if (!detail) return;
    const stockByPid: Record<string, number> = {};
    detail.lines.forEach((ln) => {
      stockByPid[ln.product_id] = ln.current_stock_qty_base;
    });
    const filled = Object.keys(lines).filter(
      (pid) => pid in stockByPid && lines[pid].current_stock_qty_base === "",
    ).length;
    setLines((prev) => {
      const next: Record<string, OrderLine> = { ...prev };
      Object.keys(next).forEach((pid) => {
        if (pid in stockByPid && next[pid].current_stock_qty_base === "") {
          next[pid] = { ...next[pid], current_stock_qty_base: stockByPid[pid] };
        }
      });
      return next;
    });
    showToast(t("captain.prefillApplied", { count: filled }), "success");
  }, [selectedSnapshotId, snapshotDetails, lines, showToast, t]);

  // overwriteAll — DESTRUCTIVE: replaces every matched line's stock with the
  // snapshot value, including hand-typed ones. Confirm-gated by the parent (the
  // button only opens the dialog; this runs on confirm).
  const overwriteAll = useCallback(() => {
    const detail = selectedSnapshotId ? snapshotDetails[selectedSnapshotId] : null;
    if (!detail) return;
    const stockByPid: Record<string, number> = {};
    detail.lines.forEach((ln) => {
      stockByPid[ln.product_id] = ln.current_stock_qty_base;
    });
    const overwritten = Object.keys(lines).filter((pid) => pid in stockByPid).length;
    setLines((prev) => {
      const next: Record<string, OrderLine> = { ...prev };
      Object.keys(next).forEach((pid) => {
        if (pid in stockByPid) {
          next[pid] = { ...next[pid], current_stock_qty_base: stockByPid[pid] };
        }
      });
      return next;
    });
    showToast(t("captain.prefillOverwriteToast", { count: overwritten }), "success");
  }, [selectedSnapshotId, snapshotDetails, lines, showToast, t]);

  // clearAll — DESTRUCTIVE: blanks every stock field (blank = not counted, per
  // the blank-vs-0 rule — NOT a literal 0). Confirm-gated. Needs no snapshot.
  const clearAll = useCallback(() => {
    setLines((prev) => {
      const next: Record<string, OrderLine> = { ...prev };
      Object.keys(next).forEach((pid) => {
        next[pid] = { ...next[pid], current_stock_qty_base: "" };
      });
      return next;
    });
    showToast(t("captain.prefillClearedToast"), "success");
  }, [showToast, t]);

  const requestOverwrite = useCallback(() => setPrefillConfirm("overwrite"), []);
  const requestClear = useCallback(() => setPrefillConfirm("clear"), []);
  const cancelPrefillConfirm = useCallback(() => setPrefillConfirm(null), []);
  const confirmPrefill = useCallback(() => {
    if (prefillConfirm === "overwrite") overwriteAll();
    else if (prefillConfirm === "clear") clearAll();
    setPrefillConfirm(null);
  }, [prefillConfirm, overwriteAll, clearAll]);

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

  // ---- Pre-fill control: visibility + selected-snapshot naming ---------------
  const selectedSummary = useMemo(
    () => availableSnapshots.find((s) => s.count_id === selectedSnapshotId) ?? null,
    [availableSnapshots, selectedSnapshotId],
  );
  // "Loading" = a snapshot is selected but its lines aren't cached yet (the
  // fetch caches an empty result even on failure, so this can't hang).
  // Loading = selected but not yet in the cache. null = fetch failed (done loading).
  const isSnapshotDetailLoading =
    !!selectedSnapshotId && !(selectedSnapshotId in snapshotDetails);

  // Always-available once snapshots exist for the location and items are loaded
  // (FR-023 promotes the old dismissable banner to a permanent control).
  const showPrefillControl =
    availableSnapshots.length > 0 &&
    !!activeSupplierId &&
    !isLoadingItems &&
    orderableItems.length > 0;

  // Named source for the overwrite-confirm body (the FR-017 "name the source"
  // safeguard, carried onto the destructive path).
  const overwriteConfirmTime = selectedSummary
    ? formatDateTime(selectedSummary.count_submitted_at ?? selectedSummary.count_date)
    : "";
  const overwriteConfirmWho = selectedSummary?.count_user ?? "—";

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

      <CaptainTabs />

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
        {/* Order-history link — mirrors the Remanent screen's "Historia →"
            so order history is reachable here under Zamówienia, not only
            from the hamburger. */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => navigate("/captain-v2/orders")}
            className="text-sm font-semibold text-brand hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            {t("orders.history.navLink")} →
          </button>
        </div>
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

        {showPrefillControl && (
          <PrefillControl
            snapshots={availableSnapshots}
            selectedId={selectedSnapshotId}
            onSelect={setSelectedSnapshotId}
            isDetailLoading={isSnapshotDetailLoading}
            onFillEmpties={fillEmpties}
            onOverwrite={requestOverwrite}
            onClear={requestClear}
          />
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

      <ConfirmPrefillDialog
        open={prefillConfirm !== null}
        title={
          prefillConfirm === "clear"
            ? t("captain.prefillClearConfirmTitle")
            : t("captain.prefillOverwriteConfirmTitle")
        }
        body={
          prefillConfirm === "clear"
            ? t("captain.prefillClearConfirmBody")
            : t("captain.prefillOverwriteConfirmBody", {
                time: overwriteConfirmTime,
                who: overwriteConfirmWho,
              })
        }
        confirmLabel={
          prefillConfirm === "clear"
            ? t("captain.prefillClearConfirm")
            : t("captain.prefillOverwriteConfirm")
        }
        cancelLabel={t("captain.prefillOverwriteCancel")}
        onConfirm={confirmPrefill}
        onCancel={cancelPrefillConfirm}
      />
    </div>
  );
}
