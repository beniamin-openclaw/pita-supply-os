// Pure product-list view helper (week2-feedback-quantities Phase 4): search,
// grouping (category | supplier), sorting and attention flags over a MINIMAL
// row shape, so both the Manager inventory detail (`InventoryCountDetailLine`)
// and the Captain count grid (`InventoryProduct` + the typed stock) can feed
// it. No React, no i18n — labels are raw values the caller translates at
// render time (categoryLabel / supplier_name), mirroring inventoryGrouping.ts.

export type ProductListGroupBy = "category" | "supplier";
export type ProductListSort = "name" | "stock" | "delta" | "category";

export interface ProductListView {
  query: string;
  groupBy: ProductListGroupBy;
  sort: ProductListSort;
  onlyAttention: boolean;
  onlyCritical: boolean;
  onlyUncounted: boolean;
}

/** The minimal row both screens can provide. `current_stock_qty_base`
 *  null/undefined means "not counted" (the captain grid's blank input);
 *  thresholds/supplier are optional exactly as on the backend models. */
export interface ProductListRow {
  product_id: string;
  product_name_pl: string;
  product_category: string;
  is_critical?: boolean;
  supplier_id?: string | null;
  supplier_name?: string | null;
  min_stock_qty_base?: number | null;
  target_stock_qty_base?: number | null;
  max_stock_qty_base?: number | null;
  current_stock_qty_base?: number | null;
}

export interface ProductListGroup<T extends ProductListRow> {
  /** Raw grouping key: the category value, or the supplier_id ("" = none). */
  key: string;
  /** Raw display label: the category value (translate via categoryLabel) or
   *  the supplier_name ("" = no supplier — caller shows its own fallback). */
  label: string;
  items: T[];
}

export interface ProductListResult<T extends ProductListRow> {
  rows: T[];
  groups: ProductListGroup<T>[];
}

export type AttentionReason = "belowMin" | "overMax" | "zeroWithTarget";

/** Typed stock above this multiple of the location max counts as attention
 *  (same factor as the captain grid's "sprawdź jednostkę" hint, Phase 3). */
export const ATTENTION_MAX_FACTOR = 3;

export const DEFAULT_PRODUCT_LIST_VIEW: ProductListView = {
  query: "",
  groupBy: "category",
  sort: "name",
  onlyAttention: false,
  onlyCritical: false,
  onlyUncounted: false,
};

function stockOf(row: ProductListRow): number | null {
  const v = row.current_stock_qty_base;
  return v === null || v === undefined || Number.isNaN(v) ? null : v;
}

/** First matching attention rule, or null. Rules (plan §2): stock below min,
 *  stock > 3 × max (max > 0), stock 0 with target > 0. An uncounted row never
 *  draws attention — there is no stock to judge. */
export function attentionReason(row: ProductListRow): AttentionReason | null {
  const stock = stockOf(row);
  if (stock === null) return null;
  const min = row.min_stock_qty_base ?? 0;
  const max = row.max_stock_qty_base ?? 0;
  const target = row.target_stock_qty_base ?? 0;
  if (stock === 0 && target > 0) return "zeroWithTarget";
  if (stock < min) return "belowMin";
  if (max > 0 && stock > ATTENTION_MAX_FACTOR * max) return "overMax";
  return null;
}

export function hasAttention(row: ProductListRow): boolean {
  return attentionReason(row) !== null;
}

/** Stock minus target, or null when either side is unknown. */
export function stockDelta(row: ProductListRow): number | null {
  const stock = stockOf(row);
  const target = row.target_stock_qty_base;
  if (stock === null || target === null || target === undefined) return null;
  return stock - target;
}

/** Case- and diacritic-insensitive needle prep: "Łódź" -> "lodz", so "kor"
 *  finds "Korfu" and "lo" finds "Łódź" on a phone keyboard without accents. */
function normalizeText(s: string): string {
  return s
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");
}

function matchesQuery(row: ProductListRow, needle: string): boolean {
  if (!needle) return true;
  const hay = normalizeText(
    [row.product_name_pl, row.product_id, row.supplier_name ?? "", row.product_category].join(" "),
  );
  return hay.includes(needle);
}

/** Filtering only — preserves the input order. The captain grid uses this
 *  alone (its master-data order must survive); `applyProductListView` adds
 *  sorting + grouping on top. */
export function filterProductRows<T extends ProductListRow>(rows: T[], view: ProductListView): T[] {
  const needle = normalizeText(view.query.trim());
  return rows.filter((row) => {
    if (!matchesQuery(row, needle)) return false;
    if (view.onlyCritical && !row.is_critical) return false;
    if (view.onlyUncounted && stockOf(row) !== null) return false;
    if (view.onlyAttention && !hasAttention(row)) return false;
    return true;
  });
}

const collator = (a: string, b: string): number => a.localeCompare(b, "pl");

function byName(a: ProductListRow, b: ProductListRow): number {
  return collator(a.product_name_pl, b.product_name_pl) || collator(a.product_id, b.product_id);
}

/** Nullable ascending: known values first (ascending), unknown last. */
function byNullableAsc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

export function sortProductRows<T extends ProductListRow>(rows: T[], sort: ProductListSort): T[] {
  const out = [...rows];
  switch (sort) {
    case "stock":
      out.sort((a, b) => byNullableAsc(stockOf(a), stockOf(b)) || byName(a, b));
      break;
    case "delta":
      out.sort((a, b) => byNullableAsc(stockDelta(a), stockDelta(b)) || byName(a, b));
      break;
    case "category":
      out.sort((a, b) => collator(a.product_category, b.product_category) || byName(a, b));
      break;
    case "name":
    default:
      out.sort(byName);
  }
  return out;
}

export function groupProductRows<T extends ProductListRow>(
  rows: T[],
  groupBy: ProductListGroupBy,
): ProductListGroup<T>[] {
  const order: string[] = [];
  const groups = new Map<string, ProductListGroup<T>>();
  rows.forEach((row) => {
    const key = groupBy === "supplier" ? (row.supplier_id ?? "") : row.product_category;
    const label = groupBy === "supplier" ? (row.supplier_name ?? "") : row.product_category;
    let group = groups.get(key);
    if (!group) {
      group = { key, label, items: [] };
      groups.set(key, group);
      order.push(key);
    }
    group.items.push(row);
  });
  const out = order.map((k) => groups.get(k)!);
  // Groups alphabetical (Polish collation), the label-less bucket last so
  // "Bez dostawcy" / "Bez kategorii" never sits on top of the real groups.
  out.sort((a, b) => {
    if (a.label === "" && b.label !== "") return 1;
    if (b.label === "" && a.label !== "") return -1;
    return collator(a.label, b.label);
  });
  return out;
}

/** Filter -> sort -> group. `rows` is the flat sorted+filtered list; `groups`
 *  the same rows bucketed per `view.groupBy`, groups alphabetical. */
export function applyProductListView<T extends ProductListRow>(
  rows: T[],
  view: ProductListView,
): ProductListResult<T> {
  const sorted = sortProductRows(filterProductRows(rows, view), view.sort);
  return { rows: sorted, groups: groupProductRows(sorted, view.groupBy) };
}
