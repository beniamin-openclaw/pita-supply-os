// Placeholder — replace with Magic Patterns-generated Captain Submit UI.
// The DESIGN_HANDOFF.md Magic Patterns prompt produces a single component;
// paste it here (or split into components in this directory).
//
// What this placeholder demonstrates: the page is auth-gated, the API client
// works, and the live backend is reachable. Use it to verify connectivity
// before plugging in the real UI.

import { useEffect, useState } from "react";
import { api, ApiError } from "../apiClient";
import { clearToken } from "../auth";
import type { OrderableItem, Supplier } from "../types";

export function CaptainPage() {
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("SUP_PAGO");
  const [items, setItems] = useState<OrderableItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.suppliers().then(setSuppliers).catch((e: ApiError) => setError(e.detail));
  }, []);

  useEffect(() => {
    if (!selectedSupplier) return;
    setLoading(true);
    api.orderable(selectedSupplier)
      .then(setItems)
      .catch((e: ApiError) => setError(e.detail))
      .finally(() => setLoading(false));
  }, [selectedSupplier]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-blue-800 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <h1 className="text-base font-semibold">PITA BROS — Captain Submit (placeholder)</h1>
          <button
            type="button"
            onClick={() => {
              clearToken("captain");
              location.reload();
            }}
            className="text-xs underline opacity-80 hover:opacity-100"
          >
            Wyloguj
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="mb-4 text-sm text-slate-600">
          Tymczasowy widok diagnostyczny. Po wygenerowaniu UI z Magic Patterns,
          zamień zawartość tego pliku na komponenty z DESIGN_HANDOFF.md.
        </p>

        {error && (
          <div className="mb-4 rounded border-2 border-red-400 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <div className="font-semibold">Backend zwrócił błąd:</div>
            <div className="mt-1">{error}</div>
          </div>
        )}

        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
            Dostawcy
          </h2>
          {suppliers === null ? (
            error ? null : <p className="text-sm text-slate-500">Ładowanie…</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {suppliers.map((s) => (
                <button
                  key={s.supplier_id}
                  type="button"
                  onClick={() => setSelectedSupplier(s.supplier_id)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    selectedSupplier === s.supplier_id
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-blue-500"
                  }`}
                >
                  {s.supplier_name}
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
            Orderable @ WOLA × {selectedSupplier}
          </h2>
          {error ? null : loading ? (
            <p className="text-sm text-slate-500">Ładowanie…</p>
          ) : items && items.length > 0 ? (
            <ul className="space-y-2">
              {items.map((it) => (
                <li
                  key={it.product_id}
                  className="rounded border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-900">{it.product_name_pl}</span>
                      {it.is_critical && (
                        <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                          CRITICAL
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-slate-500">{it.product_id}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    target {it.target_stock_qty_base} {it.inventory_unit} ·
                    max {it.max_stock_qty_base} ·
                    1 {it.purchase_unit} = {it.units_per_purchase_unit} {it.inventory_unit}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Brak produktów do zamówienia od tego dostawcy.</p>
          )}
        </section>
      </main>
    </div>
  );
}
