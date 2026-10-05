// Searchable "add product" control shared by the Captain edit screen and the
// Manager claimed-order pane (add-product-to-order). It lets the user filter the
// products that can still be added to an order (the caller passes the orderable
// list already minus the lines already present) and pick one. The dropdown closes
// on selection, Escape, or an outside click, and the whole control renders nothing
// when there is nothing left to add.
//
// Manager one-off override (manager-add-any-product): items flagged
// `configured_for_location === false` stay hidden behind a "show all of the
// supplier's products" checkbox inside the dropdown and carry a "not on this
// location's list" tag. Lists without such items (the Captain's) look unchanged.

import { useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";

import { useT } from "../../i18n";
import type { OrderableItem } from "../../types";

interface AddProductPickerProps {
  /** Products available to add — already de-duped against the order by the caller. */
  items: OrderableItem[];
  onSelect: (item: OrderableItem) => void;
  disabled?: boolean;
}

export function AddProductPicker({
  items,
  onSelect,
  disabled = false,
}: AddProductPickerProps): React.ReactElement | null {
  const { t } = useT();
  const [open, setOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [showAll, setShowAll] = useState<boolean>(false);

  // Every close (pick, Escape, outside click, toggle) drops the one-off
  // checkbox so it never carries over to the next order or location.
  function close(): void {
    setOpen(false);
    setShowAll(false);
  }
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Close on outside click + Escape while the dropdown is open.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Focus the search field as soon as the dropdown opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Hooks above run unconditionally (Rules of Hooks); the early return is below
  // them. Nothing left to add → render nothing (the button hides itself).
  if (items.length === 0) return null;

  const hasOutsideList = items.some((it) => it.configured_for_location === false);
  const visible: OrderableItem[] = showAll
    ? items
    : items.filter((it) => it.configured_for_location !== false);
  const q = query.trim().toLowerCase();
  const filtered: OrderableItem[] = q
    ? visible.filter(
        (it) =>
          it.product_name_pl.toLowerCase().includes(q) ||
          it.supplier_product_name.toLowerCase().includes(q),
      )
    : visible;

  function handlePick(item: OrderableItem): void {
    onSelect(item);
    setQuery("");
    close();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-400 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <Plus size={16} aria-hidden="true" />
        {t("addProduct.button")}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search size={15} className="text-slate-400" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("addProduct.placeholder")}
              aria-label={t("addProduct.placeholder")}
              className="w-full bg-transparent text-sm focus:outline-none"
            />
          </div>
          {hasOutsideList && (
            <label className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
              />
              {t("addProduct.showAll")}
            </label>
          )}
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">{t("addProduct.empty")}</li>
            ) : (
              filtered.map((item) => (
                <li key={item.supplier_product_id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => handlePick(item)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                  >
                    <span className="text-slate-900">
                      {item.product_name_pl}
                      {item.configured_for_location === false && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                          {t("addProduct.outsideList")}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {item.purchase_unit}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
