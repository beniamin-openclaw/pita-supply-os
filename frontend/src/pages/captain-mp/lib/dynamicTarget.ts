// Dynamic-target helpers for the Captain screens (dynamic-target-wola). Pure,
// no React. The suggestion math lives in compute.ts and reads ONLY
// item.target_stock_qty_base; these helpers only shape what the card and the
// context strip DISPLAY, and keep the edit screen's items on the order's
// snapshot target so its gate matches the backend.

import type { OrderableItem, TargetSource } from "../../../types";
import type { ManagerOrderLineDetail } from "../../../types";

/** The dynamic source of an item, or null when static / absent. */
export function dynamicSource(item: OrderableItem): TargetSource | null {
  const src = item.target_source;
  return src && src.mode === "dynamic" ? src : null;
}

/** Delivery window (ISO dates) for the context strip — from the first item that
 * carries a dynamic target. Null when nothing on the screen is dynamic. */
export function deliveryWindowOf(
  items: OrderableItem[],
): { delivery: string; next: string } | null {
  for (const item of items) {
    const src = dynamicSource(item);
    if (src && src.delivery_date && src.next_delivery_date) {
      return { delivery: src.delivery_date, next: src.next_delivery_date };
    }
  }
  return null;
}

/**
 * Edit screen (H4): the fresh orderable list carries TODAY's dynamic target,
 * but the backend gates an edited line that was on the original order against
 * the target SNAPSHOTTED on that line. Overlay the snapshot (and a max never
 * below it, mirroring the backend's effective max) onto any fresh item whose
 * product is on the order, and drop its live math. Products not on the order
 * keep the fresh item untouched (the backend resolves those fresh too).
 *
 * Only active when the backend actually served `target_source` (flag on):
 * with the flag off the backend edit path uses the static setting, which is
 * exactly what the fresh item already carries.
 */
export function overlaySnapshotTargets(
  fresh: OrderableItem[],
  lines: ManagerOrderLineDetail[],
): OrderableItem[] {
  const flagOn = fresh.some((it) => it.target_source != null);
  if (!flagOn) return fresh;
  const byPid = new Map(lines.map((ln) => [ln.product_id, ln] as const));
  return fresh.map((item) => {
    const line = byPid.get(item.product_id);
    if (!line) return item;
    return {
      ...item,
      target_stock_qty_base: line.target_stock_qty_base,
      max_stock_qty_base: Math.max(item.max_stock_qty_base, line.target_stock_qty_base),
      target_source: undefined,
    };
  });
}
