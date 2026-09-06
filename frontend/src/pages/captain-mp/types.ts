// UI-local types for the Captain MP integration.
// Backend payload types live in ../../types.ts; this file holds UI-state types
// that are not part of the API contract (e.g. inputs allow empty string until
// the user types a number).

import type { ReasonCode } from "../../types";
import type { ExtraItemRow } from "./lib/extraItems";

export type { OrderableItem, Supplier, Location, ReasonCode } from "../../types";

/** 4-state visual vocabulary plus a "not entered yet" grey. */
export type CardState = "green" | "yellow" | "orange" | "red" | "grey";

/** In-memory line item — inputs are `''` until the user types a number.
 * On submit they get coerced to `number` to match `OrderLineSubmit`. */
export interface OrderLine {
  product_id: string;
  supplier_product_id: string;
  current_stock_qty_base: number | "";
  captain_final_qty_purchase: number | "";
  reason_code?: ReasonCode | "";
  captain_comment?: string;
}

/** Draft persistence shape (localStorage).
 *
 * `extraItems` / `captainNote` are OPTIONAL on purpose: a draft written before
 * they existed has neither, and reading one must never crash or wipe the lines
 * it does carry. Both were missing entirely until impl-review F4 — the restore
 * banner asserted "liczby są zapamiętane" while the ad-hoc rows and the comment
 * silently did not survive a reload or a supplier switch. */
export interface DraftState {
  lines: Record<string, OrderLine>;
  timestamp: number;
  extraItems?: ExtraItemRow[];
  captainNote?: string;
}

export const REASON_CODES: readonly ReasonCode[] = [
  "EVENT_HIGH_TRAFFIC",
  "WEEKEND_HIGH_TRAFFIC",
  "STOCK_UNTIL_NEXT_DELIVERY",
  "LOW_STORAGE",
  "PACKAGING_LIMITATION",
  "SUPPLIER_UNDERDELIVERS",
  "SYSTEM_SUGGESTION_WRONG",
  "OTHER",
] as const;

// REASON_LABELS removed in E2 — labels now come from i18n/strings.ts via t("reason.codes.<CODE>").
