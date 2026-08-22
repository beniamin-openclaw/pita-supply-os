// Searchable "add location" control for a draft Transport batch (v2,
// to-ordering-pago ADDENDUM v2) — lets the manager fold in a location that
// has no captain submission yet (POST .../add-location creates a skeleton
// order; products are then added via AddProductPicker per column). Mirrors
// components/ui/AddProductPicker.tsx's structure (search + dropdown, closes
// on outside click / Escape / selection), specialized to Location[].

import { useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";

import { useT } from "../../../i18n";
import type { Location } from "../../../types";

interface AddLocationPickerProps {
  /** Locations available to add — already de-duped against the batch by the caller. */
  items: Location[];
  onSelect: (location: Location) => void;
  disabled?: boolean;
}

export function AddLocationPicker({
  items,
  onSelect,
  disabled = false,
}: AddLocationPickerProps): React.ReactElement | null {
  const { t } = useT();
  const [open, setOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (items.length === 0) return null;

  const q = query.trim().toLowerCase();
  const filtered: Location[] = q
    ? items.filter((it) => it.location_name.toLowerCase().includes(q))
    : items;

  function handlePick(location: Location): void {
    onSelect(location);
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
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <Plus size={16} aria-hidden="true" />
        {t("manager.transport.addLocation.button")}
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
              placeholder={t("manager.transport.addLocation.placeholder")}
              aria-label={t("manager.transport.addLocation.placeholder")}
              className="w-full bg-transparent text-sm focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">
                {t("manager.transport.addLocation.empty")}
              </li>
            ) : (
              filtered.map((location) => (
                <li key={location.location_id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => handlePick(location)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                  >
                    <span className="text-slate-900">{location.location_name}</span>
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
