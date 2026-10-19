// Collapsible "Pozycje zapasowe" section for backup-supplier cards
// (captain-backup-dropdown). Collapsed by default; a backup card that already
// has an order quantity stays visible while collapsed. Collapsing only hides
// cards — the quantities live in the page's `lines` state and the draft.

import { useState, type ReactNode } from "react";

import { useT } from "../../../i18n";
import { hasOrderQty } from "../lib/backupItems";
import type { OrderableItem, OrderLine } from "../types";

interface BackupItemsSectionProps {
  items: OrderableItem[];
  lines: Record<string, OrderLine>;
  renderCard: (item: OrderableItem) => ReactNode;
}

export function BackupItemsSection({
  items,
  lines,
  renderCard,
}: BackupItemsSectionProps): ReactNode {
  const { t } = useT();
  const [open, setOpen] = useState<boolean>(false);
  if (items.length === 0) return null;

  const filledCount: number = items.filter((item: OrderableItem) =>
    hasOrderQty(lines[item.product_id]),
  ).length;
  // One list in both states so React keeps the same card instance per key when
  // the section toggles.
  const visible: OrderableItem[] = open
    ? items
    : items.filter((item: OrderableItem) => hasOrderQty(lines[item.product_id]));
  const listId = "backup-items-list";

  return (
    <section className="mt-6 mb-3" data-testid="backup-items-section">
      <button
        type="button"
        onClick={() => setOpen((v: boolean) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-400 bg-white px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-slate-800">
            {t("captain.backupSectionTitle", { count: items.length })}
          </span>
          <span className="block text-xs text-slate-600">
            {filledCount > 0
              ? t("captain.backupSectionFilled", { count: filledCount })
              : t("captain.backupSectionHint")}
          </span>
        </span>
        <span className="shrink-0 text-sm font-medium text-slate-700">
          {open ? t("captain.backupSectionHide") : t("captain.backupSectionShow")}
          <span aria-hidden="true">{open ? " ▲" : " ▼"}</span>
        </span>
      </button>
      <div id={listId} className={visible.length > 0 ? "mt-3" : undefined}>
        {visible.map((item: OrderableItem) => renderCard(item))}
      </div>
    </section>
  );
}
