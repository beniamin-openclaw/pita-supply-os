// Searchable "add product" control shared by the Captain edit screen and the
// Manager claimed-order pane (add-product-to-order). It lets the user filter the
// products that can still be added to an order (the caller passes the orderable
// list already minus the lines already present) and pick one. The dropdown closes
// on selection, Escape, or an outside click, and the whole control renders nothing
// when there is nothing left to add.

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Close on outside click + Escape while the dropdown is open.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
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

  const q = query.trim().toLowerCase();
  const filtered: OrderableItem[] = q
    ? items.filter(
        (it) =>
          it.product_name_pl.toLowerCase().includes(q) ||
          it.supplier_product_name.toLowerCase().includes(q),
      )
    : items;

  function handlePick(item: OrderableItem): void {
    onSelect(item);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
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
                    <span className="text-slate-900">{item.product_name_pl}</span>
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
