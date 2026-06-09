// Captain Location Inventory Count page (S-06 / FR-015, FR-016).
// Counts every product configured for the Captain's location in one pass →
// confirm → POST /api/captain/inventory/submit creates a dated snapshot.
// Mirrors CaptainMP's fetch → draft → confirm → submit → toast flow. The draft
// uses a fixed sentinel key because inventory is location-scoped (one count per
// location), not supplier-scoped like the order screen.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";

import { api, ApiError } from "../../apiClient";
import { getToken, saveDraft, loadDraft, clearDraft } from "../../auth";
import { useT } from "../../i18n";

import { Header } from "./components/Header";
import { CaptainTabs } from "./components/CaptainTabs";
import { Toast, type ToastProps } from "./components/Toast";

import type {
  InventoryProduct,
  InventoryCountLineSubmit,
  InventoryLatestResponse,
} from "../../types";

// Inventory is location-wide (one count per location), so the draft uses a
// fixed key rather than CaptainMP's per-supplier id.
const DRAFT_KEY = "__inventory__";

/** Local calendar date as YYYY-MM-DD (matches `<input type="date">`). */
function localTodayIso(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** In-memory line — stock stays "" until the user types a number. */
interface InventoryLineInput {
  current_stock_qty_base: number | "";
  count_comment: string;
}

interface InventoryDraftState {
  lines: Record<string, InventoryLineInput>;
  count_date?: string;
  timestamp: number;
}

function blankLine(): InventoryLineInput {
  return { current_stock_qty_base: "", count_comment: "" };
}

// ---- Confirm dialog (lightweight; Escape + backdrop cancel) ------------------

interface ConfirmApproveDialogProps {
  open: boolean;
  counted: number;
  total: number;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function ConfirmApproveDialog({
  open,
  counted,
  total,
  onConfirm,
  onCancel,
  isSubmitting,
}: ConfirmApproveDialogProps) {
  const { t } = useT();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-slate-900/50"
        aria-hidden="true"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-confirm-title"
        aria-describedby="inv-confirm-summary"
        className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-gray-200 outline-none"
      >
        <div className="px-5 pt-5 pb-3">
          <h2
            id="inv-confirm-title"
            className="text-lg font-bold text-slate-900 leading-tight"
          >
            {t("inventory.confirmTitle")}
          </h2>
        </div>
        <div className="px-5 pb-2">
          <p id="inv-confirm-summary" className="text-sm text-slate-700">
            {t("inventory.confirmSummary", { counted, total })}
          </p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 pt-3 pb-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-3 text-sm font-semibold text-slate-800 bg-gray-100 rounded-lg active:bg-gray-200 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {t("inventory.confirmBack")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white rounded-lg bg-brand active:bg-brand-active transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {isSubmitting ? t("inventory.submittingBtn") : t("inventory.confirmSend")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Page -------------------------------------------------------------------

export function InventoryCountPage() {
  const { t, formatDateTime } = useT();
  const navigate = useNavigate();

  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [lines, setLines] = useState<Record<string, InventoryLineInput>>({});
  const [countDate, setCountDate] = useState<string>(localTodayIso);
  const [countedBy, setCountedBy] = useState<string>("");
  const [latestSnapshot, setLatestSnapshot] = useState<InventoryLatestResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [draftBanner, setDraftBanner] = useState<{ timestamp: number } | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const token = getToken("captain") || "";
  const todayIso = localTodayIso();

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type, onClose: () => setToast(null) });
  }, []);

  // ---- Fetch products on mount ---------------------------------------------
  // `isLoading` starts true; we deliberately do NOT setState synchronously in
  // the effect body (avoids react-hooks/set-state-in-effect) — the .finally
  // flips it false once the fetch settles.
  useEffect(() => {
    let cancelled = false;
    api
      .inventoryProducts()
      .then((items) => {
        if (cancelled) return;
        setProducts(items);
        const initial: Record<string, InventoryLineInput> = {};
        items.forEach((p) => {
          initial[p.product_id] = blankLine();
        });
        setLines(initial);

        // Categories start COLLAPSED by default so the Captain can scan the
        // whole list fast and open only the sections they need. Seed the
        // collapsed set with every category name (same derivation as
        // groupedProducts) once products load.
        setCollapsedCategories(
          new Set(items.map((p) => p.product_category || t("inventory.uncategorized"))),
        );

        // Surface a draft banner if a recent count is in progress; don't auto-load.
        const draft = loadDraft<InventoryDraftState>(DRAFT_KEY);
        if (draft?.state?.lines && Object.keys(draft.state.lines).length > 0) {
          setDraftBanner({ timestamp: draft.state.timestamp });
        }
      })
      .catch((err: ApiError) => {
        if (cancelled) return;
        if (err.status !== 401) {
          showToast(t("inventory.productsError", { detail: err.detail }), "error");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showToast, t]);

  // ---- Fetch latest snapshot for the "last count" banner (FR-022) ----------
  useEffect(() => {
    let cancelled = false;
    api
      .inventoryLatest()
      .then((snap) => {
        if (!cancelled) setLatestSnapshot(snap);
      })
      .catch(() => {
        // Seed mode / no prior count — banner stays hidden.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Draft auto-save (debounced) -----------------------------------------
  // Guard on "at least one stock value entered", NOT just "lines exist": on
  // mount the products fetch seeds 52 blank lines, which would otherwise fire a
  // save 500ms later and CLOBBER a real saved draft with empty data before the
  // user can resume it (the draft banner would show, but Wznów would restore
  // nothing). Only persist once the user has actually counted something.
  useEffect(() => {
    const hasEntry = Object.values(lines).some(
      (line) => line.current_stock_qty_base !== "",
    );
    if (!hasEntry) return;
    const id = setTimeout(() => {
      saveDraft<InventoryDraftState>(DRAFT_KEY, {
        lines,
        count_date: countDate,
        timestamp: Date.now(),
      });
    }, 500);
    return () => clearTimeout(id);
  }, [lines, countDate]);

  // ---- Handlers -------------------------------------------------------------
  const handleStockChange = useCallback((productId: string, raw: string) => {
    setLines((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || blankLine()),
        current_stock_qty_base: raw === "" ? "" : Number(raw),
      },
    }));
  }, []);

  const handleCommentChange = useCallback((productId: string, raw: string) => {
    setLines((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || blankLine()),
        count_comment: raw,
      },
    }));
  }, []);

  const acceptDraft = useCallback(() => {
    const draft = loadDraft<InventoryDraftState>(DRAFT_KEY);
    if (draft?.state?.lines) setLines(draft.state.lines);
    if (draft?.state?.count_date) setCountDate(draft.state.count_date);
    setDraftBanner(null);
  }, []);

  const discardDraft = useCallback(() => {
    clearDraft(DRAFT_KEY);
    setDraftBanner(null);
  }, []);

  const handleSaveDraft = useCallback(() => {
    saveDraft<InventoryDraftState>(DRAFT_KEY, {
      lines,
      count_date: countDate,
      timestamp: Date.now(),
    });
    showToast(t("inventory.draftSaved"), "success");
  }, [countDate, lines, showToast, t]);

  const handleCountDateChange = useCallback((raw: string) => {
    if (raw > localTodayIso()) {
      setCountDate(localTodayIso());
      return;
    }
    setCountDate(raw);
  }, []);

  const lastCountTime = useMemo((): string | null => {
    if (!latestSnapshot) return null;
    if (latestSnapshot.count_submitted_at) {
      return formatDateTime(latestSnapshot.count_submitted_at, {
        dateStyle: "short",
        timeStyle: "short",
      });
    }
    return formatDateTime(latestSnapshot.count_date, { dateStyle: "short" });
  }, [formatDateTime, latestSnapshot]);

  // Only products with a typed stock value become lines (blank = not counted).
  const countedLines = useMemo<InventoryCountLineSubmit[]>(
    () =>
      Object.entries(lines)
        .filter(([, line]) => line.current_stock_qty_base !== "")
        .map(([product_id, line]) => ({
          product_id,
          current_stock_qty_base: Number(line.current_stock_qty_base),
          count_comment: line.count_comment.trim() || undefined,
        })),
    [lines],
  );

  const countedCount = countedLines.length;

  // Group products by category (first-seen order) for collapsible sections.
  const groupedProducts = useMemo<{ category: string; items: InventoryProduct[] }[]>(() => {
    const order: string[] = [];
    const byCategory = new Map<string, InventoryProduct[]>();
    products.forEach((p) => {
      const cat = p.product_category || t("inventory.uncategorized");
      let bucket = byCategory.get(cat);
      if (!bucket) {
        bucket = [];
        byCategory.set(cat, bucket);
        order.push(cat);
      }
      bucket.push(p);
    });
    return order.map((cat) => ({ category: cat, items: byCategory.get(cat)! }));
  }, [products, t]);

  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    setConfirmOpen(false);
    setIsSubmitting(true);
    try {
      const resp = await api.inventorySubmit({
        lines: countedLines,
        count_user: countedBy.trim(),
        count_date: countDate,
        notes: "",
      });
      clearDraft(DRAFT_KEY);
      setCountedBy("");
      // Reset to a fresh blank pass (append-only — a re-count is a new snapshot).
      setLines((prev) => {
        const reset: Record<string, InventoryLineInput> = {};
        Object.keys(prev).forEach((pid) => {
          reset[pid] = blankLine();
        });
        return reset;
      });
      setCountDate(localTodayIso());
      const snap = await api.inventoryLatest();
      setLatestSnapshot(snap);
      const notPersisted = resp.warnings.some((w) => w.includes("not persisted"));
      showToast(
        notPersisted
          ? t("inventory.notPersistedWarning")
          : t("inventory.successToast", { count: resp.line_count }),
        notPersisted ? "error" : "success",
      );
    } catch (err) {
      const detail =
        err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "?";
      showToast(t("inventory.submitError", { detail }), "error");
    } finally {
      setIsSubmitting(false);
    }
  }, [countDate, countedBy, countedLines, showToast, t]);

  // ---- Render ---------------------------------------------------------------
  const submitDisabled =
    countedCount === 0 || isSubmitting || countedBy.trim().length === 0;

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

      <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">{t("inventory.title")}</h2>
          <p className="text-sm text-slate-600">{t("inventory.subtitle")}</p>
          <button
            type="button"
            onClick={() => navigate("/captain-v2/inventory-history")}
            className="mt-2 text-sm font-semibold text-brand hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            {t("inventory.history.navLink")} →
          </button>
        </div>

        {/* Variant C — stacked metadata; blank-vs-0 hint lives in the sticky bar */}
        <div className="mb-4 space-y-3">
          <div>
            <label htmlFor="inv-count-date" className="block text-xs font-semibold text-slate-700 mb-1">
              {t("inventory.countDateLabel")}
            </label>
            <input
              id="inv-count-date"
              type="date"
              value={countDate}
              max={todayIso}
              onChange={(e) => handleCountDateChange(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="inv-counted-by" className="block text-xs font-semibold text-slate-700 mb-1">
              {t("inventory.countedByLabel")}
              <span className="text-red-600" aria-hidden="true">
                {" "}
                *
              </span>
            </label>
            <input
              id="inv-counted-by"
              type="text"
              value={countedBy}
              onChange={(e) => setCountedBy(e.target.value)}
              autoComplete="name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-[11px] text-slate-500">{t("inventory.countedByRequired")}</p>
          </div>
        </div>

        {latestSnapshot && lastCountTime && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
            {t("inventory.lastCountBanner", {
              who: latestSnapshot.count_user?.trim() || "—",
              time: lastCountTime,
            })}
          </div>
        )}

        {draftBanner && (
          <div
            role="dialog"
            aria-label={t("inventory.draftBannerAriaLabel")}
            className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"
          >
            <div className="text-amber-900">
              {t("inventory.draftBannerTitle", {
                time: formatDateTime(draftBanner.timestamp, { timeStyle: "short" }),
              })}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={acceptDraft}
                className="px-3 py-2 rounded-md bg-amber-700 text-white text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                {t("inventory.draftBannerAccept")}
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="px-3 py-2 rounded-md bg-white text-amber-900 border border-amber-300 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                {t("inventory.draftBannerDiscard")}
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-slate-600">{t("inventory.loading")}</div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-slate-600">{t("inventory.empty")}</div>
        ) : (
          <div className="space-y-3">
            {groupedProducts.map((group) => {
              const collapsed = collapsedCategories.has(group.category);
              const countedInGroup = group.items.filter((p) => {
                const v = lines[p.product_id]?.current_stock_qty_base;
                return v !== "" && v !== undefined;
              }).length;
              return (
                <section
                  key={group.category}
                  className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(group.category)}
                    aria-expanded={!collapsed}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                      {collapsed ? (
                        <ChevronRight size={16} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={16} aria-hidden="true" />
                      )}
                      {group.category}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 tabular-nums">
                      {t("inventory.categoryCount", {
                        counted: countedInGroup,
                        total: group.items.length,
                      })}
                    </span>
                  </button>

                  {!collapsed && (
                    <ul className="space-y-2 border-t border-gray-100 p-2">
                      {group.items.map((p) => {
                        const line = lines[p.product_id] || blankLine();
                        return (
                          <li
                            key={p.product_id}
                            className="bg-white border border-gray-200 rounded-xl p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-900 truncate">
                                    {p.product_name_pl}
                                  </span>
                                  {p.is_critical && (
                                    <span className="shrink-0 rounded bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5">
                                      {t("card.critical")}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500">{p.inventory_unit}</div>
                              </div>
                              <div className="shrink-0">
                                <label className="sr-only" htmlFor={`stock-${p.product_id}`}>
                                  {t("inventory.qtyLabel")}
                                </label>
                                <input
                                  id={`stock-${p.product_id}`}
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  step="any"
                                  value={line.current_stock_qty_base}
                                  onChange={(e) => handleStockChange(p.product_id, e.target.value)}
                                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                            <label
                              htmlFor={`comment-${p.product_id}`}
                              className="sr-only"
                            >
                              {t("inventory.commentPlaceholder")}
                            </label>
                            <input
                              type="text"
                              id={`comment-${p.product_id}`}
                              value={line.count_comment}
                              onChange={(e) => handleCommentChange(p.product_id, e.target.value)}
                              placeholder={t("inventory.commentPlaceholder")}
                              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      {!isLoading && products.length > 0 && (
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-bar z-30">
          <div className="flex items-center justify-between gap-4 max-w-3xl mx-auto">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-500 mb-1 truncate">
                {t("inventory.blankVsZeroHint")}
              </p>
              <div className="text-xs text-slate-700 font-medium mb-1 truncate">
                {t("inventory.counted", { counted: countedCount, total: products.length })}
              </div>
              <div className="text-xs font-semibold">
                {countedCount === 0 ? (
                  <span className="text-slate-600">{t("inventory.fillFirst")}</span>
                ) : (
                  <span className="text-green-700 flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full bg-green-600"
                      aria-hidden="true"
                    />
                    {t("inventory.readyToSubmit")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSubmitting}
                className="px-4 py-3 text-sm font-medium text-slate-800 bg-gray-100 rounded-lg active:bg-gray-200 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                {t("inventory.saveDraftBtn")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={submitDisabled}
                className={`px-6 py-3 text-sm font-semibold text-white rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                  submitDisabled
                    ? "bg-gray-500 cursor-not-allowed"
                    : "bg-brand active:bg-brand-active"
                }`}
              >
                {isSubmitting ? t("inventory.submittingBtn") : t("inventory.submitBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmApproveDialog
        open={confirmOpen}
        counted={countedCount}
        total={products.length}
        onConfirm={handleSubmit}
        onCancel={() => setConfirmOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
