// Permanent Captain navigation tabs (Phase 5) — Zamówienia / Remanent.
// Sits directly under the brand header on every captain-v2 screen so the
// inventory module is reachable without opening the hamburger (the demo pain).
// Variant C: the active tab is brand-filled, the inactive one outlined. Active
// state is derived from the route, NOT stored.

import { Link, useLocation } from "react-router-dom";
import { ClipboardList, PackageSearch } from "lucide-react";
import { useT } from "../../../i18n";

const ORDERS_PATH = "/captain-v2";
const INVENTORY_PATH = "/captain-v2/inventory-count";

export function CaptainTabs() {
  const { t } = useT();
  const { pathname } = useLocation();

  // The inventory tab owns the inventory-count subtree; everything else under
  // captain-v2 (the order screen + the orders list/detail/edit) belongs to the
  // Zamówienia tab.
  const inventoryActive = pathname.startsWith(INVENTORY_PATH);
  const ordersActive = !inventoryActive;

  const base =
    "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";
  const activeCls = "bg-brand text-white border-brand";
  const inactiveCls = "bg-white text-slate-600 border-gray-300 hover:bg-gray-50";

  return (
    <nav
      className="bg-white border-b border-gray-200 px-4 py-2.5"
      aria-label={t("tabs.ariaLabel")}
    >
      <div className="flex gap-2 max-w-3xl mx-auto">
        <Link
          to={ORDERS_PATH}
          aria-current={ordersActive ? "page" : undefined}
          className={`${base} ${ordersActive ? activeCls : inactiveCls}`}
        >
          <ClipboardList size={16} aria-hidden="true" />
          {t("tabs.orders")}
        </Link>
        <Link
          to={INVENTORY_PATH}
          aria-current={inventoryActive ? "page" : undefined}
          className={`${base} ${inventoryActive ? activeCls : inactiveCls}`}
        >
          <PackageSearch size={16} aria-hidden="true" />
          {t("tabs.inventory")}
        </Link>
      </div>
    </nav>
  );
}
