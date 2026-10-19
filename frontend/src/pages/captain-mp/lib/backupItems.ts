// Backup-supplier items on the Captain order screen (captain-backup-dropdown,
// owner review 19.10 pkt 5): a backup source (`supplier_products.is_backup`)
// moves out of the main list into a "Pozycje zapasowe" section, collapsed by
// default. The primary item lives on another supplier's tab, so the section
// is per supplier tab, not under the primary card.

import type { OrderableItem, OrderLine } from "../types";

export interface SplitItems {
  primary: OrderableItem[];
  backup: OrderableItem[];
}

/** Split the tab's items into regular cards and backup cards, keeping order. */
export function splitBackupItems(items: OrderableItem[]): SplitItems {
  const primary: OrderableItem[] = [];
  const backup: OrderableItem[] = [];
  items.forEach((item: OrderableItem) => {
    if (item.is_backup === true) backup.push(item);
    else primary.push(item);
  });
  return { primary, backup };
}

/**
 * A backup card with an order quantity (including a typed 0) stays on screen
 * while the section is collapsed — an entered order is never hidden.
 */
export function hasOrderQty(line: OrderLine | undefined): boolean {
  return !!line && line.captain_final_qty_purchase !== "";
}
