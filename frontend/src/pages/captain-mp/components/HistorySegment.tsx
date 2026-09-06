// Zamówienia / Remanenty segment shown at the top of both Historia sub-pages
// (OrdersListPage, InventoryHistoryPage list mode) — inventory-confirm-and-history
// Track B. Before this, the two histories had no path between them; now one
// pill switches between order history and inventory history without leaving
// the Historia tab.

import { Link, useLocation } from "react-router-dom";
import { useT } from "../../../i18n";

const ORDERS_PATH = "/captain-v2/orders";
const INVENTORY_PATH = "/captain-v2/inventory-history";

export function HistorySegment() {
  const { t } = useT();
  const { pathname } = useLocation();

  const ordersActive = pathname.startsWith(ORDERS_PATH);
  const inventoryActive = pathname.startsWith(INVENTORY_PATH);

  const base =
    "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
  const activeCls = "bg-slate-900 text-white border-slate-900";
  const inactiveCls = "bg-white text-slate-600 border-gray-300 hover:bg-gray-50";

  return (
    <nav aria-label={t("history.segment.ariaLabel")} className="flex gap-2 mb-4">
      <Link
        to={ORDERS_PATH}
        aria-current={ordersActive ? "page" : undefined}
        className={`${base} ${ordersActive ? activeCls : inactiveCls}`}
      >
        {t("history.segment.orders")}
      </Link>
      <Link
        to={INVENTORY_PATH}
        aria-current={inventoryActive ? "page" : undefined}
        className={`${base} ${inventoryActive ? activeCls : inactiveCls}`}
      >
        {t("history.segment.inventory")}
      </Link>
    </nav>
  );
}
