// Captain Location Inventory Count page (S-06 / FR-015, FR-016).
// Counts every product configured for the Captain's location in one pass →
// confirm → POST /api/captain/inventory/submit creates a dated snapshot.
// Mirrors CaptainMP's fetch → draft → confirm → submit → toast flow. The draft
// uses a fixed sentinel key because inventory is location-scoped (one count per
// location), not supplier-scoped like the order screen.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "../../apiClient";
import { getToken, saveDraft, loadDraft, clearDraft } from "../../auth";
import { useT } from "../../i18n";

import { Header } from "./components/Header";
import { CaptainTabs } from "./components/CaptainTabs";
import { InventoryCountGrid } from "./components/InventoryCountGrid";
import { InventorySubmittedCard } from "./components/InventorySubmittedCard";
import { Toast, type ToastProps } from "./components/Toast";
import { groupProductsByCategory } from "./lib/inventoryGrouping";
import { blankInventoryLine as blankLine, type InventoryLineInput } from "./lib/inventoryLines";
import { addNameSuggestion, getNameSuggestions } from "../../lib/nameSuggestions";

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

interface InventoryDraftState {
  lines: Record<string, InventoryLineInput>;
  count_date?: string;
  timestamp: number;
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
  const [submitted, setSubmitted] = useState<{
    countId: string;
    submittedAt: number;
    who: string;
    lineCount: number;
  } | null>(null);

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
        // collapsed set with every RAW category key (same derivation as
        // groupedProducts / groupProductsByCategory) once products load —
        // display translation happens later, at render time, via
        // categoryLabel() inside InventoryCountGrid.
        setCollapsedCategories(new Set(items.map((p) => p.product_category)));

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
  const handleStockChange = useCallback((productId: string, value: number | "") => {
    setLines((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || blankLine()),
        current_stock_qty_base: value,
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

  // Read once on mount. This screen is the PRIMARY writer of the count_user
  // store: without the append below the list stays empty forever and the edit
  // screen's own datalist has nothing to offer (impl-review D4).
  const nameSuggestions = useMemo((): string[] => getNameSuggestions("count_user"), []);

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

  // Group products by category (first-seen order, raw key) for collapsible
  // sections — shared with InventoryCountEditPage. Display translation
  // (categoryLabel) happens at render time inside InventoryCountGrid, so
  // this grouping never depends on the active language.
  const groupedProducts = useMemo(() => groupProductsByCategory(products), [products]);

  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  // Reset to a fresh blank pass (append-only — a re-count is a new snapshot).
  // Shared by the not-persisted (seed-mode) fallback and the "new count" button
  // on the confirmation card.
  const resetForm = useCallback(() => {
    setLines((prev) => {
      const reset: Record<string, InventoryLineInput> = {};
      Object.keys(prev).forEach((pid) => {
        reset[pid] = blankLine();
      });
      return reset;
    });
    setCountedBy("");
    setCountDate(localTodayIso());
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
      addNameSuggestion("count_user", countedBy.trim());
      const notPersisted = resp.warnings.some((w) => w.includes("not persisted"));
      if (notPersisted) {
        // Seed mode — nothing was actually saved, so a confirmation card would
        // be misleading. Keep the pre-existing behaviour exactly: reset the
        // form and show the error-styled toast, no card.
        resetForm();
        showToast(t("inventory.notPersistedWarning"), "error");
      } else {
        setSubmitted({
          countId: resp.count_id,
          submittedAt: Date.now(),
          who: countedBy.trim(),
          lineCount: resp.line_count,
        });
      }
      const snap = await api.inventoryLatest();
      setLatestSnapshot(snap);
    } catch (err) {
      const detail =
        err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "?";
      showToast(t("inventory.submitError", { detail }), "error");
    } finally {
      setIsSubmitting(false);
    }
  }, [countDate, countedBy, countedLines, resetForm, showToast, t]);

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
        {submitted ? (
          <InventorySubmittedCard
            submittedAt={submitted.submittedAt}
            who={submitted.who}
            lineCount={submitted.lineCount}
            onViewHistory={() => navigate("/captain-v2/inventory-history")}
            onNewCount={() => {
              resetForm();
              setSubmitted(null);
            }}
          />
        ) : (
          <>
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
                  list="inv-counted-by-suggestions"
                  value={countedBy}
                  onChange={(e) => setCountedBy(e.target.value)}
                  autoComplete="name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <datalist id="inv-counted-by-suggestions">
                  {nameSuggestions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
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
              <InventoryCountGrid
                groupedProducts={groupedProducts}
                lines={lines}
                collapsedCategories={collapsedCategories}
                onToggleCategory={toggleCategory}
                onStockChange={handleStockChange}
                onCommentChange={handleCommentChange}
              />
            )}
          </>
        )}
      </main>

      {!submitted && !isLoading && products.length > 0 && (
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-bar z-30">
          <div className="max-w-3xl mx-auto">
            {/* Full-width hint line: in the narrow left column next to two buttons it
                wrapped into four lines on a 375 px phone (mobile-wrap review). */}
            <p className="text-[11px] text-slate-500 mb-2 leading-snug break-words">
              {t("inventory.blankVsZeroHint")}
            </p>
          {/* Phone: status line above a full-width button row; ≥sm: side by side.
              Two buttons next to a text column squeezed the status into a
              3-line stack on 375 px (mobile-wrap review). */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <div className="text-xs text-slate-700 font-medium leading-snug">
                {t("inventory.counted", { counted: countedCount, total: products.length })}
              </div>
              <div className="text-xs font-semibold leading-snug">
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
            <div className="flex gap-2 sm:shrink-0">
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
                className={`flex-1 sm:flex-none px-6 py-3 text-sm font-semibold text-white rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
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
        </div>
      )}

      {!submitted && (
        <ConfirmApproveDialog
          open={confirmOpen}
          counted={countedCount}
          total={products.length}
          onConfirm={handleSubmit}
          onCancel={() => setConfirmOpen(false)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
