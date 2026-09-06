// Correct a previously submitted inventory count (Phase 2, training-feedback-
// 0901) — reached via "Popraw" from InventoryHistoryPage. The operator's
// problem: someone counted half the location, got interrupted, and had to
// redo everything because a submitted count could not be corrected.
//
// Reuses the SAME categorized product grid as InventoryCountPage
// (InventoryCountGrid), pre-filled from the snapshot being corrected: a
// product that was counted shows its prior value, one that wasn't stays
// blank. Submits via PATCH /api/captain/inventory/count/{count_id} — replace
// semantics: the full line set sent here becomes the new authoritative
// snapshot, so blanking a counted product removes it (blank means "not
// counted", never zero).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { api, ApiError } from "../../apiClient";
import { useT } from "../../i18n";
import { addNameSuggestion, getNameSuggestions } from "../../lib/nameSuggestions";
import type { InventoryCountLineSubmit, InventoryProduct } from "../../types";

import { InventoryCountGrid } from "./components/InventoryCountGrid";
import { Toast, type ToastProps } from "./components/Toast";
import { groupProductsByCategory } from "./lib/inventoryGrouping";
import { blankInventoryLine, type InventoryLineInput } from "./lib/inventoryLines";

export function InventoryCountEditPage() {
  const { t, formatDateTime } = useT();
  const navigate = useNavigate();
  const { count_id } = useParams<{ count_id: string }>();

  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [lines, setLines] = useState<Record<string, InventoryLineInput>>({});
  const [editedBy, setEditedBy] = useState<string>("");
  // Optional free-text "why". The backend already appends it to the audit
  // event's details ("… (powód: …)") — without this input that API surface had
  // no producer at all (impl-review drift 3), and the correction history read
  // as a bare list of number changes with no explanation.
  const [editReason, setEditReason] = useState<string>("");
  const [originalDate, setOriginalDate] = useState<string | null>(null);
  const [originalWho, setOriginalWho] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Previously-typed names for this role (Phase 1a) — wired into a <datalist>
  // below so a returning Captain sees suggestions after typing a couple of
  // letters. Read once on mount; the freshly-saved name is added on success.
  const nameSuggestions = useMemo(() => getNameSuggestions("count_user"), []);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type, onClose: () => setToast(null) });
  }, []);

  // Load the location's full active product catalogue + the snapshot being
  // corrected, in parallel (mirrors OrderEditPage's dual-fetch pattern).
  // Every product configured for the location is shown — not only the ones
  // already counted — so a partial count can be completed here too.
  useEffect(() => {
    if (!count_id) return;
    let cancelled = false;
    Promise.all([api.inventoryProducts(), api.inventoryCount(count_id)])
      .then(([prods, snapshot]) => {
        if (cancelled) return;
        setProducts(prods);
        // Categories start collapsed, same as InventoryCountPage.
        setCollapsedCategories(new Set(prods.map((p) => p.product_category)));

        const initial: Record<string, InventoryLineInput> = {};
        prods.forEach((p) => {
          initial[p.product_id] = blankInventoryLine();
        });
        snapshot.lines.forEach((ln) => {
          initial[ln.product_id] = {
            current_stock_qty_base: ln.current_stock_qty_base,
            count_comment: ln.count_comment,
          };
        });
        setLines(initial);
        setOriginalDate(snapshot.count_submitted_at ?? snapshot.count_date);
        setOriginalWho(snapshot.count_user ?? null);
        setLoadError(null);
      })
      .catch((err: ApiError) => {
        if (cancelled) return;
        if (err.status !== 401) setLoadError(err.detail);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [count_id]);

  const handleStockChange = useCallback((productId: string, value: number | "") => {
    setLines((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || blankInventoryLine()),
        current_stock_qty_base: value,
      },
    }));
  }, []);

  const handleCommentChange = useCallback((productId: string, raw: string) => {
    setLines((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || blankInventoryLine()),
        count_comment: raw,
      },
    }));
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const groupedProducts = useMemo(() => groupProductsByCategory(products), [products]);

  // Only products with a typed stock value become lines — blank = not
  // counted, and (replace semantics) a product on the prior snapshot but
  // left blank here is dropped, never sent as a 0.
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

  const handleSubmit = useCallback(async () => {
    if (!count_id) return;
    setIsSubmitting(true);
    try {
      const resp = await api.inventoryCountEdit(count_id, {
        lines: countedLines,
        edited_by: editedBy.trim(),
        edit_reason: editReason.trim(),
      });
      addNameSuggestion("count_user", editedBy.trim());
      showToast(t("inventory.edit.successToast", { count: resp.line_count }), "success");
      // Re-open the corrected snapshot's detail (freshly re-fetched) rather
      // than dropping back to the bare list — InventoryHistoryPage reads this
      // router state on mount and re-selects the same count.
      setTimeout(
        () => navigate("/captain-v2/inventory-history", { state: { openCountId: count_id } }),
        600,
      );
    } catch (err) {
      const detail =
        err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "?";
      showToast(t("inventory.edit.errorToast", { detail }), "error");
    } finally {
      setIsSubmitting(false);
    }
  }, [count_id, countedLines, editedBy, editReason, navigate, showToast, t]);

  const saveDisabled = countedCount === 0 || isSubmitting || editedBy.trim().length === 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-28">
      {toast && <Toast {...toast} />}

      <header className="bg-brand text-white px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/captain-v2/inventory-history")}
            aria-label={t("inventory.edit.back")}
            className="p-2 -ml-2 active:bg-white/10 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h1 className="font-semibold text-base tracking-tight break-words leading-tight">
              {t("inventory.edit.title")}
            </h1>
            {originalDate && (
              <div className="text-xs opacity-90 break-words leading-tight">
                {t("inventory.edit.originalInfo", {
                  date: formatDateTime(originalDate),
                  who: originalWho?.trim() || "—",
                })}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
        <p className="mb-4 text-sm text-slate-600">{t("inventory.edit.subtitle")}</p>

        {loadError && (
          <div
            className="mb-4 rounded border-2 border-red-400 bg-red-50 p-4 text-sm text-red-900"
            role="alert"
          >
            {t("inventory.edit.loadError", { detail: loadError })}
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="inv-edited-by" className="block text-xs font-semibold text-slate-700 mb-1">
            {t("inventory.edit.editedByLabel")}
            <span className="text-red-600" aria-hidden="true">
              {" "}
              *
            </span>
          </label>
          <input
            id="inv-edited-by"
            type="text"
            list="inv-edited-by-suggestions"
            value={editedBy}
            onChange={(e) => setEditedBy(e.target.value)}
            autoComplete="name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="inv-edited-by-suggestions">
            {nameSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <p className="mt-1 text-[11px] text-slate-500">{t("inventory.edit.editedByRequired")}</p>

          <label
            htmlFor="inv-edit-reason"
            className="mt-3 block text-sm font-medium text-slate-700"
          >
            {t("inventory.edit.reasonLabel")}
          </label>
          <input
            id="inv-edit-reason"
            type="text"
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            placeholder={t("inventory.edit.reasonPlaceholder")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-slate-600">{t("inventory.edit.loading")}</div>
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
      </main>

      {!isLoading && products.length > 0 && (
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
                  <span className="text-slate-600">{t("inventory.edit.fillFirst")}</span>
                ) : (
                  <span className="text-green-700 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-600" aria-hidden="true" />
                    {t("inventory.edit.readyToSave")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex sm:shrink-0">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saveDisabled}
                className={`flex-1 sm:flex-none px-6 py-3 text-sm font-semibold text-white rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                  saveDisabled ? "bg-gray-500 cursor-not-allowed" : "bg-brand active:bg-brand-active"
                }`}
              >
                {isSubmitting ? t("inventory.edit.savingBtn") : t("inventory.edit.saveBtn")}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
