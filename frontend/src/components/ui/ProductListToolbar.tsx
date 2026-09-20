// Shared product-list toolbar (week2-feedback-quantities Phase 4): search
// (150 ms debounce), group-by segmented control, sort select and toggle
// chips, driving a `ProductListView` (src/lib/productListFilter.ts). Used by
// the Manager inventory detail and the Captain count grid; each caller
// decides which controls to show. State is EPHEMERAL — owned by the parent,
// never persisted (S-05 precedent: no localStorage for view filters).

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { useT } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import type {
  ProductListGroupBy,
  ProductListSort,
  ProductListView,
} from "../../lib/productListFilter";

export const SEARCH_DEBOUNCE_MS = 150;

export type ProductListToggle = "attention" | "critical" | "uncounted";

export interface ProductListToolbarProps {
  view: ProductListView;
  /** Partial patch — the parent merges it into its view state. */
  onChange: (patch: Partial<ProductListView>) => void;
  /** Stable id prefix so two toolbars on one page never share input ids. */
  idPrefix: string;
  showGroupBy?: boolean;
  showSort?: boolean;
  /** Which toggle chips to render, in order. Omitted = none. */
  toggles?: ProductListToggle[];
}

const GROUP_BY_OPTIONS: { value: ProductListGroupBy; labelKey: StringKey }[] = [
  { value: "category", labelKey: "productList.groupBy.category" },
  { value: "supplier", labelKey: "productList.groupBy.supplier" },
];

const SORT_OPTIONS: { value: ProductListSort; labelKey: StringKey }[] = [
  { value: "name", labelKey: "productList.sort.name" },
  { value: "stock", labelKey: "productList.sort.stock" },
  { value: "delta", labelKey: "productList.sort.delta" },
  { value: "category", labelKey: "productList.sort.category" },
];

const TOGGLE_META: Record<
  ProductListToggle,
  { field: "onlyAttention" | "onlyCritical" | "onlyUncounted"; labelKey: StringKey }
> = {
  attention: { field: "onlyAttention", labelKey: "productList.onlyAttention" },
  critical: { field: "onlyCritical", labelKey: "productList.onlyCritical" },
  uncounted: { field: "onlyUncounted", labelKey: "productList.onlyUncounted" },
};

export function ProductListToolbar({
  view,
  onChange,
  idPrefix,
  showGroupBy = false,
  showSort = false,
  toggles = [],
}: ProductListToolbarProps) {
  const { t } = useT();

  // Local echo of the search box so typing stays instant; the parent's
  // `view.query` only updates after the debounce settles.
  const [draft, setDraft] = useState<string>(view.query);
  // Parent reset (e.g. a new snapshot opened) — mirror `view.query` into the
  // box without re-emitting. "Adjust state during render" pattern: remember
  // the last parent value we synced from and re-sync only when it changes.
  const [syncedQuery, setSyncedQuery] = useState<string>(view.query);
  if (syncedQuery !== view.query) {
    setSyncedQuery(view.query);
    setDraft(view.query);
  }

  const timerRef = useRef<number | null>(null);
  // Latest onChange for the debounce timer (a stale closure would otherwise
  // patch through a previous render's callback).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const scheduleQuery = (next: string): void => {
    setDraft(next);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onChangeRef.current({ query: next });
    }, SEARCH_DEBOUNCE_MS);
  };

  const clearQuery = (): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setDraft("");
    onChange({ query: "" });
  };

  const searchId = `${idPrefix}-search`;
  const sortId = `${idPrefix}-sort`;

  return (
    <div className="mb-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          {t("productList.searchLabel")}
        </label>
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          id={searchId}
          type="search"
          value={draft}
          onChange={(e) => scheduleQuery(e.target.value)}
          placeholder={t("productList.searchPlaceholder")}
          autoComplete="off"
          className="[&::-webkit-search-cancel-button]:appearance-none w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-9 text-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:text-sm"
        />
        {draft !== "" && (
          <button
            type="button"
            onClick={clearQuery}
            aria-label={t("productList.searchClear")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {(showGroupBy || showSort) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {showGroupBy && (
            <div
              role="group"
              aria-label={t("productList.groupByLabel")}
              className="inline-flex rounded-md border border-slate-300 bg-white p-0.5"
            >
              {GROUP_BY_OPTIONS.map((opt) => {
                const active = view.groupBy === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChange({ groupBy: opt.value })}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      active ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {t(opt.labelKey)}
                  </button>
                );
              })}
            </div>
          )}

          {showSort && (
            <div className="flex items-center gap-1.5">
              <label htmlFor={sortId} className="text-xs font-semibold text-slate-800">
                {t("productList.sortLabel")}
              </label>
              <select
                id={sortId}
                value={view.sort}
                onChange={(e) => onChange({ sort: e.target.value as ProductListSort })}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:text-xs"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {toggles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {toggles.map((toggle) => {
            const meta = TOGGLE_META[toggle];
            const active = view[meta.field];
            return (
              <button
                key={toggle}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ [meta.field]: !active })}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  active
                    ? "border-blue-400 bg-blue-50 text-blue-800"
                    : "border-slate-300 bg-white text-slate-500"
                }`}
              >
                {t(meta.labelKey)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
