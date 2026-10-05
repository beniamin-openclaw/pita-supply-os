// Pure helpers for the Manager Transport ("TO" — combined delivery run) screen
// (to-ordering-pago Phase 3). No fetch here; all I/O lives in apiClient + the
// page component.
//
// Two very different documents come out of one TransportBatchDetail:
//   - the DRIVER list (buildTransportDriverPrintDoc -> driver PDF, plus the
//     driver Gmail draft) — internal — carries the per-location breakdown
//     (who gets how much), because the driver needs to know where to drop
//     what.
//   - the SUPPLIER order (buildTransportPagoPrintDoc -> ZOW PDF, plus the
//     Pago Gmail draft) — carries per-product TOTALS ONLY. The supplier never
//     sees which location ordered what; splitting deliveries between
//     locations is Pita Bros' own logistics, not the supplier's business
//     (plan: "Driver list stays private"). Keep this asymmetry — do not add
//     per-location detail to a supplier-facing builder.
//
// A second axis since transport-pago-mory-combined: a Pago batch also carries
// Magazyn własny Mory orders (the driver collects them on the same run).
// Supplier-facing documents (the Pago PDF, the Pago Gmail draft, the
// warehouse-exclusion notice, the extras checklist) are built from
// `leadSupplierView` — the batch supplier's own members and lines only; Pago
// never sees a Mory line. Driver documents cover every supplier, in blocks
// (lead first).
//
// transport-v2 removed the clipboard driver text and the compose-URL order
// e-mail (it put every product into the e-mail body); the two Gmail drafts
// (gmailDraft.ts) are the only e-mails left, and the Pago one carries no
// products at all — they live in the attached PDF.

import type { Lang } from "../../../i18n";
import type { StringKey } from "../../../i18n/strings";
import type {
  Location,
  ManagerOrderLineDetail,
  OrderableItem,
  OrderLineManagerFinal,
  TransportBatchDetail,
  TransportBatchOrder,
  TransportBatchSummary,
  TransportEligibleOrder,
  TransportEvent,
  TransportSupplierRef,
} from "../../../types";
import { compareProductOrder } from "../../../lib/productOrder";
import { type DraftMap, dirtySavePayload, draftQty, hasDirtyDrafts } from "./draftState";
import { effectiveManagerQtyPurchase } from "./managerLine";

type TFunc = (key: StringKey, vars?: Record<string, string | number>) => string;

/** ISO datetime/date -> the date part only ("YYYY-MM-DD"), timezone-free so
 * the print docs and the history sort stay deterministic regardless of the
 * viewer's locale. "" when absent (a batch with no dispatched member yet). */
function isoDatePart(iso?: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// ---- transport-pago-mory-combined: suppliers on one batch ------------------

/** Supplier of a line or member order. A missing or "" `supplier_id` (an
 * older backend, or the model default) counts as the batch's own supplier —
 * falsy, not nullish, on purpose. */
export function lineSupplierId(
  item: { supplier_id?: string },
  detail: Pick<TransportBatchDetail, "supplier_id">,
): string {
  return item.supplier_id || detail.supplier_id;
}

/** Same rule as `lineSupplierId`, for a member order. */
export const orderSupplierId = lineSupplierId;

/** Suppliers of a batch in block order: `detail.suppliers` when the backend
 * sends it (lead, companions, other members), else the batch's own supplier;
 * plus — defensively — any member or line supplier not listed yet. */
export function transportSuppliers(detail: TransportBatchDetail): TransportSupplierRef[] {
  const out: TransportSupplierRef[] =
    detail.suppliers && detail.suppliers.length > 0
      ? [...detail.suppliers]
      : [{ supplier_id: detail.supplier_id, supplier_name: detail.supplier_name }];
  const seen = new Set(out.map((s) => s.supplier_id));
  const add = (id: string, name?: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ supplier_id: id, supplier_name: name || id });
  };
  for (const o of detail.orders) add(orderSupplierId(o, detail), o.supplier_name);
  for (const l of detail.lines) add(lineSupplierId(l, detail), l.supplier_name);
  return out;
}

/** The member orders of one supplier. */
export function transportOrdersFor(
  detail: TransportBatchDetail,
  supplierId: string,
): TransportBatchOrder[] {
  return detail.orders.filter((o) => orderSupplierId(o, detail) === supplierId);
}

/** The batch as its OWN supplier sees it: only the lead supplier's member
 * orders and aggregate lines, and `location_ids` / `order_count` recomputed
 * from those orders (so a Pago document's label never names a location that
 * only has a Mory order). Every supplier-facing builder runs on this, so no
 * caller can forget the filter. For a single-supplier batch it is the batch
 * itself. */
export function leadSupplierView(detail: TransportBatchDetail): TransportBatchDetail {
  const orders = transportOrdersFor(detail, detail.supplier_id);
  if (orders.length === detail.orders.length) {
    return { ...detail, lines: detail.lines.filter((l) => lineSupplierId(l, detail) === detail.supplier_id) };
  }
  return {
    ...detail,
    orders,
    order_count: orders.length,
    location_ids: [...new Set(orders.map((o) => o.location_id))].sort(),
    lines: detail.lines.filter((l) => lineSupplierId(l, detail) === detail.supplier_id),
  };
}

/** The positive-quantity aggregate lines of each supplier, in block order,
 * with the ONE empty-block rule every driver document shares (plan-review
 * F2): blocks without a positive line are dropped; when none is left, the
 * lead block stays, with no lines, so the document still names its
 * supplier. */
function driverBlocks(
  detail: TransportBatchDetail,
): { supplier: TransportSupplierRef; lines: TransportBatchDetail["lines"] }[] {
  const blocks = transportSuppliers(detail)
    .map((supplier) => ({
      supplier,
      lines: detail.lines.filter(
        (l) => lineSupplierId(l, detail) === supplier.supplier_id && l.total_qty_purchase > 0,
      ),
    }))
    .filter((b) => b.lines.length > 0);
  if (blocks.length > 0) return blocks;
  return [
    {
      supplier: { supplier_id: detail.supplier_id, supplier_name: detail.supplier_name },
      lines: [],
    },
  ];
}

// ---- training-feedback-0901 F1: ad-hoc off-catalogue items on the Transport
// path -------------------------------------------------------------------
//
// The Captain's "+ dodaj produkt" free-text add (extra_items, one item per
// line — see captain-mp/lib/extraItems.ts) reaches the supplier on the
// single-order path via emailBody.ts + the backend's gmail_url.py. Three
// shapes on the Transport path:
//
//   - flat block (buildExtraItemsSupplierBlock): VERBATIM, never
//     de-duplicated (two locations both asking "Feta - 5 kg" are 10kg total,
//     not 5 — collapsing them would under-order), NO location attribution.
//     Used by the driver Gmail draft body only.
//   - DRIVER PDF (collectExtraItemsByLocation): the same items, WITH
//     per-location attribution — the driver is the one who has to know who
//     gets the extra feta.
//   - PAGO (transport-v2): extras never go into the Pago e-mail body. The
//     Manager ticks the lines agreed with Pago (pagoExtraItemLines -> a
//     checklist, unticked by default) and only the ticked texts reach the
//     ZOW PDF, in their own section (buildTransportPagoPrintDoc's
//     approvedExtraItems).

/** One ad-hoc off-catalogue item line, attributed to the location whose
 * Captain added it — the driver-facing shape (see the section header above). */
export interface TransportExtraItem {
  locationName: string;
  text: string; // one already-serialized "{name} - {qty} {unit}" line, verbatim
}

/** Every non-blank `extra_items` LINE across a batch's member orders, each
 * attributed to its order's location. Preserves order-then-line order; NEVER
 * deduplicates. `order.extra_items` is read via `?? ""` — an order from a
 * backend that doesn't carry the field yet contributes nothing rather than
 * throwing. Shared by buildTransportDriverPrintDoc and
 * buildExtraItemsSupplierBlock so the driver documents cannot drift. */
export function collectExtraItemsByLocation(orders: TransportBatchOrder[]): TransportExtraItem[] {
  const out: TransportExtraItem[] = [];
  for (const order of orders) {
    const raw = (order.extra_items ?? "").trim();
    if (!raw) continue;
    for (const rawLine of raw.split("\n")) {
      const text = rawLine.trim();
      if (text) out.push({ locationName: order.location_name, text });
    }
  }
  return out;
}

/**
 * Flat "Pozycje spoza katalogu" block lines — [] when no member order carries
 * any ad-hoc item (callers then skip the block entirely). Verbatim, never
 * de-duplicated, no location attribution — see the section header above.
 * Used by gmailDraft.ts's buildDriverDraftEmail; never by a Pago builder.
 */
export function buildExtraItemsSupplierBlock(orders: TransportBatchOrder[], t: TFunc): string[] {
  const items = collectExtraItemsByLocation(orders).map((item) => item.text);
  if (items.length === 0) return [];
  return [t("manager.transport.email.extraItemsHeader"), ...items];
}

/** A member order's non-blank Captain comment (`captain_note`), attributed to
 * its location — the Manager-ONLY surface (F1 point 5): unlike extra_items,
 * captain_note never appears in any supplier-facing body or PDF, only on the
 * Transport screen (TransportPage.tsx). */
export interface TransportCaptainNote {
  /** Unique per member order — the React key. See collectCaptainNotes. */
  orderId: string;
  locationName: string;
  note: string;
}

/** Every member order's non-blank captain_note, in order, skipping blank/
 * whitespace-only or absent notes. `order.captain_note` is read via `?? ""`
 * (see TransportBatchOrder's field comment). */
export function collectCaptainNotes(orders: TransportBatchOrder[]): TransportCaptainNote[] {
  const out: TransportCaptainNote[] = [];
  for (const order of orders) {
    const note = (order.captain_note ?? "").trim();
    // `orderId` rides along purely so the caller has a UNIQUE React key.
    // `manager_transport_create` has no per-location dedupe (only add-location
    // does), so one batch can legitimately hold two orders from the same
    // location — keying the list on locationName alone would collide and make
    // React's reconciliation of these notes unreliable (post-review R2).
    if (note) out.push({ orderId: order.order_id, locationName: order.location_name, note });
  }
  return out;
}

/**
 * Split a possibly comma/semicolon-separated distribution list into trimmed
 * addresses, dropping anything that doesn't carry "@" (placeholders like
 * "TBD" mixed into a list are silently ignored rather than sent to a dead
 * address). Operator decision: supplier.email may hold a distribution list
 * (e.g. Pago's legacy sheet PAGO list) — Gmail's `to` param takes a
 * comma-joined string of all of them.
 */
export function splitRecipients(email: string): string[] {
  return email
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}

/** True when `email` holds at least one usable ("@"-carrying) address. Mirrors
 * the backend dispatch gate (main.py's "@" check) so the UI never offers an
 * email draft to a dead/placeholder address. */
export function hasValidRecipient(email?: string | null): boolean {
  if (!email) return false;
  return splitRecipients(email).length > 0;
}

// ---- v2 (ADDENDUM v2): draft workstation helpers ---------------------------
//
// A DRAFT batch's member orders carry FULL enriched lines (TransportBatchOrder.
// lines), so the manager can edit qty/comment per product x location cell using
// the SAME read-modify-write machinery as the single-order Manager screen
// (managerSave). The helpers below are pure — no fetch — mirroring lib/draftState.ts
// but keyed per order_id (one order = one column of the matrix = one managerSave
// call).

/** One row of the editable product x location matrix: a product, unioned
 * across every member order that carries it, with each contributing order's
 * full line keyed by order_id (undefined = this order doesn't carry the
 * product — an empty/addable cell). */
export interface TransportMatrixRow {
  product_id: string;
  product_name_pl: string;
  purchase_unit: string;
  // Sort key (supplier-product-order-minimum), taken from the row's first
  // line: TransportPage passes ONE supplier's orders per matrix section
  // (transport-pago-mory-combined), so every line of a product shares it.
  supplier_product_id: string;
  display_order?: number | null;
  linesByOrderId: Record<string, ManagerOrderLineDetail>;
}

/** True when a matrix row exists ONLY through manager-added lines (the
 * add-line route mints `OL-{order}-M-{hex}` ids; captain lines are numeric,
 * grid-prefill lines are `-P-`). Such a row was hand-added to a draft after
 * creation, so it renders at the BOTTOM of the matrix in add order instead of
 * being sorted into the base list (operator feedback v5.1: "powinien
 * dodawać się od dołu"). The pin is specific to this editor — the Manager
 * order table and every document place a manager-added line at its own
 * position (supplier-product-order-minimum). */
function isManagerAddedRow(row: TransportMatrixRow): boolean {
  const lines = Object.values(row.linesByOrderId);
  return lines.length > 0 && lines.every((l) => l.order_line_id.includes("-M-"));
}

/** Union of products across every member order's lines, one row per product.
 * Base rows (captain-submitted / grid-prefilled) are in the canonical supplier
 * order (display_order, then supplier_product_id — lib/productOrder.ts), the
 * same order as the Captain screen, the e-mail and the Transport documents;
 * rows added by the manager via "+ Dodaj produkt" append BELOW them in
 * first-encounter (i.e. add) order — see `isManagerAddedRow`. */
export function buildTransportMatrix(orders: TransportBatchOrder[]): TransportMatrixRow[] {
  const byProduct = new Map<string, TransportMatrixRow>();
  for (const order of orders) {
    for (const line of order.lines) {
      let row = byProduct.get(line.product_id);
      if (!row) {
        row = {
          product_id: line.product_id,
          product_name_pl: line.product_name_pl,
          purchase_unit: line.purchase_unit,
          supplier_product_id: line.supplier_product_id,
          display_order: line.display_order ?? null,
          linesByOrderId: {},
        };
        byProduct.set(line.product_id, row);
      }
      row.linesByOrderId[order.order_id] = line;
    }
  }
  const rows = [...byProduct.values()];
  const base = rows.filter((r) => !isManagerAddedRow(r));
  const managerAdded = rows.filter(isManagerAddedRow); // keeps Map insertion (= add) order
  base.sort(compareProductOrder);
  return [...base, ...managerAdded];
}

/** Union, across every member order, of products orderable-but-not-yet-present
 * on that order — one row per product, in the canonical supplier order
 * (lib/productOrder.ts, same as the Captain order screen), feeding
 * the SINGLE matrix-wide "+ Dodaj produkt" picker (feature 4, v4 feedback
 * round 2) that replaced the old per-location pickers. Each entry is the
 * FIRST matching order's `OrderableItem` verbatim (so it slots straight into
 * the shared `AddProductPicker` component); `supplier_product_id` is per
 * supplier+product and identical across locations, but a caller that actually
 * adds the product must still resolve it PER ORDER from that order's own
 * orderable list (see `handleAddProductAll` in TransportPage) — not every
 * order necessarily carries this exact `OrderableItem` instance.
 *
 * Items outside a location's list (`configured_for_location === false`,
 * manager-add-any-product) are left out — add-to-all never applies the one-off
 * override; that goes through `orderAddOneOptions` for a single order. */
export function buildTransportAddAllOptions(
  orders: TransportBatchOrder[],
  orderableByOrderId: Record<string, OrderableItem[]>,
): OrderableItem[] {
  const byProduct = new Map<string, OrderableItem>();
  for (const order of orders) {
    const present = new Set(order.lines.map((l) => l.product_id));
    for (const item of orderableByOrderId[order.order_id] ?? []) {
      if (item.configured_for_location === false) continue;
      if (present.has(item.product_id) || byProduct.has(item.product_id)) continue;
      byProduct.set(item.product_id, item);
    }
  }
  return [...byProduct.values()].sort(compareProductOrder);
}

/** Products that can still be added to ONE member order — its full orderable
 * list (incl. one-off items outside the location's list) minus what it already
 * carries, in canonical supplier order (manager-add-any-product). */
export function orderAddOneOptions(
  order: TransportBatchOrder,
  orderableByOrderId: Record<string, OrderableItem[]>,
): OrderableItem[] {
  const present = new Set(order.lines.map((l) => l.product_id));
  return (orderableByOrderId[order.order_id] ?? [])
    .filter((item) => !present.has(item.product_id))
    .sort(compareProductOrder);
}

/** Per-order draft state for a draft batch — one `DraftMap` (order_line_id ->
 * {qty, comment}) per member order, so each order's dirty tracking and
 * managerSave payload stay independent (mirrors one column = one order = one
 * PATCH call). */
export type TransportDraftMap = Record<string, DraftMap>;

/** Seed every member order's draft map from its own loaded lines (effective
 * qty = manager_final once the Manager set it — an explicit 0 included — else
 * captain_final, see lib/orderQty.ts; comment = manager_comment) —
 * the per-order equivalent of draftState.ts's `seedDrafts`. */
export function seedTransportDrafts(orders: TransportBatchOrder[]): TransportDraftMap {
  const out: TransportDraftMap = {};
  for (const order of orders) {
    const map: DraftMap = {};
    for (const line of order.lines) {
      map[line.order_line_id] = {
        qty: effectiveManagerQtyPurchase(line),
        comment: line.manager_comment ?? "",
      };
    }
    out[order.order_id] = map;
  }
  return out;
}

/** Draft effective qty for ONE cell of the matrix (order_id x line), falling
 * back to the line's own baseline when that order has no draft entry yet
 * (e.g. a column just added via add-location/add-product). */
export function draftQtyFor(
  drafts: TransportDraftMap,
  orderId: string,
  line: ManagerOrderLineDetail,
): number {
  return draftQty(drafts[orderId] ?? {}, line);
}

/** True when `order`'s draft differs from its seeded baseline in any line. */
export function transportOrderDirty(order: TransportBatchOrder, drafts: TransportDraftMap): boolean {
  return hasDirtyDrafts(drafts[order.order_id] ?? {}, order.lines);
}

/** True when ANY member order has an unsaved edit — drives the batch-level
 * "Zapisz zmiany" affordance and the switch-batch/supplier confirm guard. */
export function anyTransportDirty(orders: TransportBatchOrder[], drafts: TransportDraftMap): boolean {
  return orders.some((order) => transportOrderDirty(order, drafts));
}

/** One order's managerSave payload — DIRTY lines only (read-modify-write: an
 * untouched line is simply absent from the payload, so its persisted
 * manager_comment is never overwritten). */
export interface TransportOrderSavePayload {
  order_id: string;
  finals: OrderLineManagerFinal[];
}

/** Build one managerSave-shaped payload per order that has at least one dirty
 * line — the "save every dirty column" batch action. An order with no edits
 * contributes nothing (empty finals are never returned), so the caller only
 * issues a managerSave call for orders that actually changed. */
export function transportDirtySavePayloads(
  orders: TransportBatchOrder[],
  drafts: TransportDraftMap,
): TransportOrderSavePayload[] {
  const out: TransportOrderSavePayload[] = [];
  for (const order of orders) {
    const finals = dirtySavePayload(drafts[order.order_id] ?? {}, order.lines);
    if (finals.length > 0) out.push({ order_id: order.order_id, finals });
  }
  return out;
}

/** Weight strip math for the batch detail header: total / limit / remaining
 * (may go negative) / over (>= 0) / isOver, plus the "brak wagi dla N pozycji"
 * count passed straight through. A null `limit_kg` (no limit set) neutralizes
 * remaining/over/isOver rather than dividing by/comparing against nothing. */
export interface TransportWeightStrip {
  totalKg: number;
  limitKg: number | null;
  remainingKg: number | null;
  overKg: number;
  isOver: boolean;
  unknownCount: number;
}

export function computeWeightStrip(
  detail: Pick<TransportBatchDetail, "total_weight_kg" | "limit_kg" | "unknown_weight_count">,
): TransportWeightStrip {
  const limitKg = detail.limit_kg ?? null;
  const totalKg = detail.total_weight_kg;
  if (limitKg == null) {
    return { totalKg, limitKg: null, remainingKg: null, overKg: 0, isOver: false, unknownCount: detail.unknown_weight_count };
  }
  const remainingKg = Math.round((limitKg - totalKg) * 100) / 100;
  const overKg = Math.max(0, Math.round((totalKg - limitKg) * 100) / 100);
  return {
    totalKg,
    limitKg,
    remainingKg,
    overKg,
    isOver: remainingKg < 0,
    unknownCount: detail.unknown_weight_count,
  };
}

// ---- v4 feedback: friendly batch naming ------------------------------------

/** Strip a leading Polish postal code ("01-258 Warszawa" -> "Warszawa") and
 * apply the tiny English->Polish city alias map real master data contains
 * ("Warsaw" -> "Warszawa"), case-insensitively. Trims surrounding whitespace. */
function normalizeCityName(raw: string): string {
  const stripped = raw.replace(/^\d{2}-\d{3}\s+/, "").trim();
  const CITY_ALIASES: Record<string, string> = { warsaw: "Warszawa" };
  const aliased = CITY_ALIASES[stripped.toLowerCase()];
  return aliased ?? stripped;
}

/** "Pita Bros Wola" -> "Wola" — the short display form used when a location
 * has no usable `city` to fall back on. */
function shortLocationName(name: string): string {
  return name.replace(/^Pita Bros\s+/, "").trim();
}

/** Deduped (case-insensitive), first-seen-order, comma-joined city line for
 * a set of location ids — the "Miasto lub miasta" segment of the auto-label
 * (feature 1). A location with no usable `city` falls back to its short
 * location name; a location absent from `locationsById` (master data not
 * loaded yet) is skipped entirely. */
export function transportCitiesLine(
  locationIds: string[],
  locationsById: Record<string, Location>,
): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of locationIds) {
    const loc = locationsById[id];
    if (!loc) continue;
    let display: string | null = null;
    if (loc.city && loc.city.trim() !== "") {
      display = normalizeCityName(loc.city);
    } else if (loc.location_name) {
      display = shortLocationName(loc.location_name);
    }
    if (!display) continue;
    const key = display.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(display);
  }
  return out.join(", ");
}

const WEEKDAY_LOCALE: Record<Lang, string> = { pl: "pl-PL", en: "en-US" };

function capitalizeFirst(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/** Long weekday name for an ISO date/datetime string in `lang`'s locale,
 * capitalized (Polish's Intl output is lowercase — "sobota"). "" on an
 * unparseable date. Uses the UTC calendar fields so a bare date-only ISO
 * string ("2026-08-23") and a full datetime both resolve deterministically,
 * independent of the viewer's own timezone. */
function transportWeekdayLabel(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const weekday = new Intl.DateTimeFormat(WEEKDAY_LOCALE[lang], {
    weekday: "long",
    timeZone: "UTC",
  }).format(d);
  return capitalizeFirst(weekday);
}

/** "dd.MM.yy" for an ISO date/datetime string (UTC calendar fields — see
 * `transportWeekdayLabel`). "" on an unparseable date. */
function transportShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

/** The auto-generated fallback label (feature 1, v4 feedback round 2):
 * "Transport {Weekday} · {City or cities} · {dd.MM.yy}" — e.g.
 * "Transport Sobota · Warszawa · 22.08.26". The weekday AND date segment both
 * come from `pickup_date` ONLY (transport-v2): a batch without a pickup date
 * is "Transport · Warszawa" — its creation day is not its pickup day, and
 * labelling it so read as a confirmed pickup. An empty cities line likewise
 * drops its segment rather than leaving a stray "·". Pure — takes `lang`
 * explicitly rather than reading it from a hook, so it stays testable
 * without a React tree. */
export function transportAutoLabel(
  batch: Pick<TransportBatchSummary, "supplier_name" | "pickup_date" | "location_ids">,
  t: TFunc,
  opts: { lang: Lang; locationsById: Record<string, Location> },
): string {
  const sourceIso = batch.pickup_date || null;
  const weekday = sourceIso ? transportWeekdayLabel(sourceIso, opts.lang) : "";
  const datePart = sourceIso ? transportShortDate(sourceIso) : "";
  const cities = transportCitiesLine(batch.location_ids, opts.locationsById);

  const prefix = t("manager.transport.displayLabel.fallbackPrefix");
  const segments = [weekday ? `${prefix} ${weekday}` : prefix];
  if (cities) segments.push(cities);
  if (datePart) segments.push(datePart);
  return segments.join(" · ");
}

/** Operator-facing display label for a Transport batch (feature 1, v4
 * feedback, operator decision "A+C"): the friendly `name` when the batch has
 * one, else the auto-generated "Transport {weekday} · {city} · {date}" label
 * (`transportAutoLabel`). This is the label to use as the PRIMARY title
 * everywhere a batch is shown (list rows, detail header, both print docs) —
 * the raw `TRN-...` id is demoted to small secondary text next to it, never
 * dropped (it stays the durable identifier). */
export function transportDisplayLabel(
  batch: Pick<TransportBatchSummary, "supplier_name" | "name" | "pickup_date" | "location_ids">,
  t: TFunc,
  opts: { lang: Lang; locationsById: Record<string, Location> },
): string {
  const name = batch.name?.trim();
  if (name) return name;
  return transportAutoLabel(batch, t, opts);
}

/** Deduped, sorted non-empty values of one logistics field across past
 * batches — feeds the driver/vehicle `<datalist>` suggestions (v2 design
 * decision 8: free text, no new master-data surface). */
export function collectLogisticsSuggestions(
  batches: TransportBatchSummary[],
  field: "driver" | "vehicle",
): string[] {
  const seen = new Set<string>();
  for (const b of batches) {
    const v = b[field];
    if (v && v.trim() !== "") seen.add(v.trim());
  }
  return [...seen].sort((a, b) => a.localeCompare(b, "pl"));
}

// ---- operator-configured driver/vehicle dropdowns ("Zrob draft w Gmailu"
// draft-config extension) --------------------------------------------------

/** Parse an operator-configured `_meta` list (`transport_drivers` /
 * `transport_vehicles`, comma- or semicolon-separated — mirrors
 * `splitRecipients`'s separator handling) into trimmed, deduped
 * (first-seen-order preserved), non-empty entries. `null`/`undefined`/""
 * (unset, or the backend's degrade-to-"" contract) yields []. */
export function parseConfigList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;]/)) {
    const trimmed = part.trim();
    if (trimmed === "" || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/** Build the option list for one Logistics-panel dropdown (driver or
 * vehicle): the operator-configured dictionary, merged with historical
 * suggestions (`collectLogisticsSuggestions`) and the field's current saved
 * value — so a past batch naming someone/something not on the configured
 * list still displays correctly — deduped case-sensitively, first-seen-order
 * (configured entries first, so the operator's curated list leads).
 * `current` of null/undefined/"" contributes nothing (an unset field has no
 * value to preserve). */
export function buildLogisticsOptions(
  configured: string[],
  suggestions: string[],
  current: string | null | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (v: string) => {
    const trimmed = v.trim();
    if (trimmed === "" || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };
  configured.forEach(add);
  suggestions.forEach(add);
  if (current) add(current);
  return out;
}

// ---- v3 Phase 6: event history ---------------------------------------------
//
// One i18n key per known event_type ("field: old → new" diffs live in
// event.details, computed server-side — the FE only supplies the type label).
// An unmapped/unknown event_type falls back to the raw string so a future
// backend event type never disappears from the Historia section.

const EVENT_TYPE_LABEL_KEYS: Record<string, StringKey> = {
  order_combined: "manager.transport.events.type.orderCombined",
  location_added: "manager.transport.events.type.locationAdded",
  order_removed: "manager.transport.events.type.orderRemoved",
  order_sent: "manager.transport.events.type.orderSent",
  batch_sent: "manager.transport.events.type.batchSent",
  batch_cancelled: "manager.transport.events.type.batchCancelled",
  logistics_changed: "manager.transport.events.type.logisticsChanged",
  quantities_changed: "manager.transport.events.type.quantitiesChanged",
  delivery_confirmed: "manager.transport.events.type.deliveryConfirmed",
  // transport-v2
  order_draft_created: "manager.transport.events.type.orderDraftCreated",
  driver_draft_created: "manager.transport.events.type.driverDraftCreated",
  batch_reopened: "manager.transport.events.type.batchReopened",
  batch_reopen_aborted: "manager.transport.events.type.batchReopenAborted",
};

/** Human label for one event's `event_type` — a known type resolves through
 * i18n; anything else (a future/unrecognized type) falls back to the raw
 * string verbatim rather than disappearing from the history. */
export function transportEventTypeLabel(t: TFunc, eventType: string): string {
  const key = EVENT_TYPE_LABEL_KEYS[eventType];
  return key ? t(key) : eventType;
}

/** Events sorted newest first (defensive — the backend already returns them
 * this way, but a null `at` must not crash the sort). */
export function sortTransportEvents(events: TransportEvent[]): TransportEvent[] {
  return [...events].sort((a, b) => {
    const at = a.at ? Date.parse(a.at) : 0;
    const bt = b.at ? Date.parse(b.at) : 0;
    return bt - at;
  });
}

// ---- v3 Phase 10: print/PDF views ------------------------------------------
//
// Two documents built from the SAME TransportBatchDetail, mirroring the
// driver-text / supplier-email asymmetry above: the driver document carries
// the per-location breakdown (private, internal use); the Pago (supplier)
// document carries per-product totals ONLY — no location ever appears in it.

// v4 feedback (feature 3): the two print docs are redesigned to replicate the
// legacy PDFs' structure (navy title/section bars, light-blue header cells, a
// per-location MATRIX on the driver doc, a two-box header + fixed Pago entity
// block on the supplier doc) — layout lives in lib/transportPdf.ts; these builders
// only shape the data.

export interface PrintDriverProductLine {
  productId: string;
  name: string;
  unit: string;
  totalQty: number;
  // Aligned 1:1 with TransportDriverPrintDoc.locations — one cell per
  // location column, 0 when this product had nothing for that location (a
  // full matrix row, not a sparse list, so every product line has the same
  // column count as the header).
  qtyByLocation: number[];
}

/** One supplier block of the driver document (transport-pago-mory-combined):
 * a navy section bar and its own product x location table. */
export interface PrintDriverSection {
  supplierId: string;
  // Supplier name + " / LINEAGE" for SUP_PAGO, else the name verbatim.
  supplierBarText: string;
  products: PrintDriverProductLine[];
}

export interface TransportDriverPrintDoc {
  transportId: string;
  displayLabel: string; // caller-computed transportDisplayLabel(...) — the doc's primary title context
  date: string; // "" when unknown
  time: string; // pickup_time, "" when unset
  driver: string; // "" when unset
  vehicle: string; // "" when unset
  supplierName: string;
  locationsLine: string; // joined location names, for the header "Miasto/Lokalizacje" row
  locations: string[]; // location names, one per matrix column — same order as each line's qtyByLocation
  // Supplier blocks, lead first (driverBlocks). Every section's products are
  // aligned to the SAME `locations` columns.
  sections: PrintDriverSection[];
  // Ad-hoc off-catalogue items (F1), WITH location attribution — see
  // collectExtraItemsByLocation. [] when no member order carries one; the PDF
  // builder then omits the section entirely.
  extraItems: TransportExtraItem[];
  // The batch's logistics notes, trimmed (transport-v2). "" when none — the
  // PDF builder then omits the "Uwagi" row.
  notes: string;
}

/** Build the printable DRIVER document ("LISTA DLA KIEROWCY"): logistics
 * header (locations, date/time, driver/vehicle, doc number) + a per-product x
 * per-location MATRIX — the internal-only "who gets how much" record, never
 * sent to the supplier. Location columns come from the batch's member orders
 * (every location in the run gets a column, even one with a zero cell on a
 * given product); rows with a zero grand total are dropped, mirroring the
 * driver text / email builders above. */
export function buildTransportDriverPrintDoc(
  detail: TransportBatchDetail,
  displayLabel: string,
): TransportDriverPrintDoc {
  const namesById = new Map<string, string>();
  for (const o of detail.orders) namesById.set(o.location_id, o.location_name);
  const locationIds = [...namesById.keys()].sort((a, b) =>
    (namesById.get(a) ?? a).localeCompare(namesById.get(b) ?? b, "pl"),
  );
  // Driver-doc columns use the SHORT location form ("Bracka", not
  // "Pita Bros Bracka") — operator feedback v5.1: the brand prefix is
  // redundant on an internal doc and eats column width. Display-only:
  // qtyByLocation below stays index-aligned to `locationIds`.
  const locations = locationIds.map((id) => shortLocationName(namesById.get(id) ?? id));

  const toProductLine = (line: TransportBatchDetail["lines"][number]): PrintDriverProductLine => {
    const qtyById = new Map<string, number>();
    for (const pl of line.per_location) {
      qtyById.set(pl.location_id, (qtyById.get(pl.location_id) ?? 0) + pl.qty_purchase);
    }
    return {
      productId: line.product_id,
      name: line.product_name_pl,
      unit: line.purchase_unit,
      totalQty: line.total_qty_purchase,
      qtyByLocation: locationIds.map((id) => qtyById.get(id) ?? 0),
    };
  };
  const sections: PrintDriverSection[] = driverBlocks(detail).map((block) => ({
    supplierId: block.supplier.supplier_id,
    supplierBarText:
      block.supplier.supplier_id === "SUP_PAGO"
        ? `${block.supplier.supplier_name} / LINEAGE`
        : block.supplier.supplier_name,
    products: block.lines.map(toProductLine),
  }));

  return {
    transportId: detail.transport_id,
    displayLabel,
    date: isoDatePart(detail.pickup_date),
    time: detail.pickup_time ?? "",
    driver: detail.driver ?? "",
    vehicle: detail.vehicle ?? "",
    supplierName: detail.supplier_name,
    locationsLine: locations.join(", "),
    locations,
    sections,
    extraItems: collectExtraItemsByLocation(detail.orders),
    notes: (detail.notes ?? "").trim(),
  };
}

// ---- training-feedback-0901 F7: make the excluded Pago lines visible -------
//
// buildTransportPagoPrintDoc's `warehouse_pickup` filter (below) means the
// self-pickup document for SUP_PAGO silently drops everything that isn't
// physically collected on the warehouse run — real for a mixed batch (till
// rolls, napkins, trays purchased through Pago but never picked up there),
// but invisible to the manager without this. A COUNT would fire on nearly
// every Pago batch (warehouse_pickup=false is the NORMAL state for most
// lines) and get tuned out — so this surfaces NAMES instead.

export interface PagoWarehouseExclusion {
  isPago: boolean;
  // Names (product_name_pl) of positive-qty lines the warehouse_pickup filter
  // excluded from the self-pickup document. Always [] for a non-Pago batch —
  // only the Pago document filters on this column at all.
  excludedProducts: string[];
  // True when EVERY positive-qty line's warehouse_pickup is undefined — a
  // frontend deployed ahead of the backend, or the column genuinely has no
  // data yet. This is a DISTINCT state from "these lines were excluded": it
  // must never render as "everything excluded". Always false for a non-Pago
  // batch (the column is meaningless there).
  warehousePickupDataMissing: boolean;
}

/**
 * Which of a Pago batch's positive-qty lines the warehouse_pickup filter
 * drops from the self-pickup document, by name — the pure computation behind
 * both buildTransportPagoPrintDoc's `excludedProducts`/
 * `warehousePickupDataMissing` fields and TransportPage's on-screen notice
 * (computed once here so the two can never disagree). Runs on
 * `leadSupplierView`: a Magazyn Mory line is not "excluded from the Pago
 * pickup" — it was never a Pago line.
 */
export function computePagoWarehouseExclusion(fullDetail: TransportBatchDetail): PagoWarehouseExclusion {
  const detail = leadSupplierView(fullDetail);
  const isPago = detail.supplier_id === "SUP_PAGO";
  if (!isPago) return { isPago, excludedProducts: [], warehousePickupDataMissing: false };

  const positiveLines = detail.lines.filter((line) => line.total_qty_purchase > 0);
  // "No data at all" holds ONLY when every positive line's field is
  // undefined. A mix of true/false/undefined is treated as normal (undefined
  // reads as excluded, same as migration 0015's `false` default) — it is
  // specifically the ALL-undefined case that signals "this column hasn't
  // been populated for this batch yet" rather than "genuinely excluded".
  const warehousePickupDataMissing =
    positiveLines.length > 0 && positiveLines.every((line) => line.warehouse_pickup === undefined);

  const excludedProducts = warehousePickupDataMissing
    ? []
    : positiveLines
        .filter((line) => line.warehouse_pickup !== true)
        .map((line) => line.product_name_pl);

  return { isPago, excludedProducts, warehousePickupDataMissing };
}

export interface PrintPagoProductLine {
  productId: string;
  // Product cell — the supplier-facing name (falls back to product_name_pl).
  // The pickup document used to print supplier_sku here ("Nr katalogowy"),
  // but on prod those are our own placeholder codes (PAGO-001…), which told
  // the driver and the warehouse nothing (operator feedback 2026-10-01).
  name: string;
  unit: string;
  qty: number;
}

/** Fixed Pago pickup-order entity block (operator-supplied, 2026-08).
 * TODO(master-data): this is a print-doc-only display constant, not master
 * data — once the operator's real Pago catalog/entity batch lands (see plan
 * Open Questions: Pago master data), reconsider sourcing it from there
 * instead of a hardcoded literal. */
const PAGO_ENTITY = {
  name: "Pita Bros sp. z o.o.",
  nip: "9522100633",
  address1: "ul. W. Laskonogiego 9",
  address2: "02-496 Warszawa",
};

export interface TransportPagoPrintDoc {
  transportId: string;
  displayLabel: string; // caller-computed transportDisplayLabel(...) — mirrors the driver doc
  titleBarText: string;
  isPago: boolean;
  // Only populated for SUP_PAGO — other suppliers omit the entity box
  // entirely (there is no equivalent fixed data to show).
  entity: typeof PAGO_ENTITY | null;
  pickupDate: string; // "" when unknown
  pickupTime: string; // "" when unset
  driver: string;
  vehicle: string;
  supplierName: string;
  products: PrintPagoProductLine[];
  // F7 — see the section header above and PagoWarehouseExclusion.
  excludedProducts: string[];
  warehousePickupDataMissing: boolean;
  // Off-catalogue lines the Manager explicitly approved for this document
  // (transport-v2 extras checklist, see pagoExtraItemLines) — trimmed,
  // blanks dropped, verbatim otherwise; NO location attribution. [] (the
  // default) prints no extras section at all.
  approvedExtraItems: string[];
}

/** Build the printable SUPPLIER document ("ZLECENIE ODBIORU WŁASNEGO" for
 * Pago; a generic order doc otherwise): two header boxes (entity data +
 * document data) then per-product TOTALS ONLY. Carries NO location data at
 * all — not in `products`, and (since 2026-09-02) not as a summary line in the
 * document-data box either: the supplier has no business knowing which of our
 * locations ordered what, or even how many there are. Same discipline as the
 * Pago Gmail draft body. The DRIVER document is the opposite case and keeps
 * its per-location columns — that one is ours, not the supplier's.
 *
 * `approvedExtraItems` (transport-v2): only the off-catalogue lines the
 * Manager ticked in the send panel — never the raw extra_items of the batch,
 * so an extra not agreed with Pago can never reach the document. */
export function buildTransportPagoPrintDoc(
  fullDetail: TransportBatchDetail,
  displayLabel: string,
  approvedExtraItems: string[] = [],
): TransportPagoPrintDoc {
  // Lead supplier's lines only (transport-pago-mory-combined): a Magazyn Mory
  // line riding on the Pago run never reaches the Pago document. The caller
  // computes `displayLabel` from leadSupplierView too (TransportSendPanel).
  const detail = leadSupplierView(fullDetail);
  const { isPago, excludedProducts, warehousePickupDataMissing } =
    computePagoWarehouseExclusion(detail);

  return {
    transportId: detail.transport_id,
    displayLabel,
    titleBarText: isPago
      ? "PITA BROS — ZLECENIE ODBIORU WŁASNEGO"
      : `${detail.supplier_name} — ZAMÓWIENIE`,
    isPago,
    entity: isPago ? PAGO_ENTITY : null,
    pickupDate: isoDatePart(detail.pickup_date),
    pickupTime: detail.pickup_time ?? "",
    driver: detail.driver ?? "",
    vehicle: detail.vehicle ?? "",
    supplierName: detail.supplier_name,
    // Two filters, and the second one is PAGO-ONLY:
    //
    //   total_qty_purchase > 0  — nothing ordered, nothing to print.
    //   warehouse_pickup        — applied ONLY when isPago. The Pago document
    //                             is the run to the cold-storage warehouse, and
    //                             SUP_PAGO is a purchasing CHANNEL rather than a
    //                             warehouse: one real batch mixed frozen meat
    //                             and chilled dips with till rolls, napkins,
    //                             trays and paper. Only goods actually collected
    //                             there belong on that document.
    //
    // The `!isPago` escape is load-bearing, not defensive. This same builder
    // also produces the GENERIC supplier order document ("{supplier} —
    // ZAMÓWIENIE") for every other supplier, and migration 0015 defaults
    // warehouse_pickup to false on every row — only SP_PAGO_* rows are ever
    // flagged true. An unconditional filter therefore emptied the order PDF and
    // the Gmail order draft for Bukat, Coca-Cola and everyone else, silently.
    //
    // The driver doc, the order email and the driver text export never filter
    // on this at all — the warehouse run is a subset of the purchase. (The
    // lead-supplier filter above is a different axis: it drops companion
    // Magazyn Mory lines from every supplier-facing document.)
    products: detail.lines
      .filter(
        (line) =>
          line.total_qty_purchase > 0 && (!isPago || line.warehouse_pickup === true),
      )
      .map((line) => ({
        productId: line.product_id,
        name: line.supplier_product_name || line.product_name_pl,
        unit: line.purchase_unit,
        qty: line.total_qty_purchase,
      })),
    excludedProducts,
    warehousePickupDataMissing,
    approvedExtraItems: approvedExtraItems.map((text) => text.trim()).filter((text) => text !== ""),
  };
}

// ---- transport-v2: supplier chips, city filter, sorting --------------------
//
// The Transport screen's filter bar: two supplier chips (Pago, Magazyn Mory —
// at least one stays on) and one tile per city (all on by default). The
// eligible list and the history list both follow it, newest first.

/** The supplier chips of the filter bar, in display order. */
export const TRANSPORT_CHIP_SUPPLIER_IDS = ["SUP_PAGO", "SUP_MORY"] as const;

/** Which supplier chips are on. */
export interface TransportChips {
  pago: boolean;
  mory: boolean;
}

/** The eligible-list query for a chip state: both chips (or, defensively,
 * neither) -> the Pago run with its Magazyn Mory companions; one chip -> that
 * supplier alone, without companions. */
export function transportScopeFromChips(chips: TransportChips): {
  leadSupplierId: string;
  includeCompanions: boolean;
} {
  const [pagoId, moryId] = TRANSPORT_CHIP_SUPPLIER_IDS;
  if (chips.pago && !chips.mory) return { leadSupplierId: pagoId, includeCompanions: false };
  if (chips.mory && !chips.pago) return { leadSupplierId: moryId, includeCompanions: false };
  return { leadSupplierId: pagoId, includeCompanions: true };
}

/** The normalized city of one location (postal code stripped, "Warsaw" ->
 * "Warszawa" — same rule as the auto-label), or null when the location is
 * unknown or has no city. Unlike transportCitiesLine there is NO fallback to
 * the location name: a city filter must not invent a "city" called "Wola". */
export function transportLocationCity(
  locationId: string,
  locationsById: Record<string, Location>,
): string | null {
  const loc = locationsById[locationId];
  if (!loc || !loc.city) return null;
  const city = normalizeCityName(loc.city);
  return city === "" ? null : city;
}

/** The city tiles for a set of location ids: unique (case-insensitive, first
 * spelling wins), sorted Polish-alphabetically. Locations without a
 * resolvable city contribute nothing. */
export function transportCityOptions(
  locationIds: string[],
  locationsById: Record<string, Location>,
): string[] {
  const byKey = new Map<string, string>();
  for (const id of locationIds) {
    const city = transportLocationCity(id, locationsById);
    if (city === null) continue;
    const key = city.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, city);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "pl"));
}

/** The shared city rule: no filter (null) keeps everything; otherwise keep
 * when there is nothing to judge by (no locations), when ANY location is in
 * a selected city, or when ANY location has no resolvable city (an item is
 * never hidden because master data lacks a city). Case-insensitive. */
function matchesCities(
  locationIds: string[],
  cities: ReadonlySet<string> | null,
  locationsById: Record<string, Location>,
): boolean {
  if (cities === null) return true;
  if (locationIds.length === 0) return true;
  const wanted = new Set([...cities].map((c) => c.toLowerCase()));
  return locationIds.some((id) => {
    const city = transportLocationCity(id, locationsById);
    return city === null || wanted.has(city.toLowerCase());
  });
}

/** Milliseconds of an ISO string, or null when absent/unparseable. */
function isoMillis(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** Descending compare where a missing value sorts last. */
function compareDescNullsLast(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

/** History order (returns a NEW array): newest run first — by pickup date
 * when set, else by the creation date (date part) — then by creation time,
 * newest first. A batch with neither date sorts last; ties keep their input
 * order. */
export function sortTransportBatches(batches: TransportBatchSummary[]): TransportBatchSummary[] {
  const dayKey = (b: TransportBatchSummary): string =>
    isoDatePart(b.pickup_date) || isoDatePart(b.created);
  return [...batches].sort((a, b) => {
    const ka = dayKey(a);
    const kb = dayKey(b);
    if (ka !== kb) {
      if (!ka) return 1;
      if (!kb) return -1;
      return ka < kb ? 1 : -1;
    }
    return compareDescNullsLast(isoMillis(a.created), isoMillis(b.created));
  });
}

/** History filter: keep a batch when any of its suppliers (`supplier_ids`,
 * falling back to `[supplier_id]` on an older backend or an empty list) is a
 * selected chip supplier AND it passes the city rule (see matchesCities). */
export function filterTransportBatches(
  batches: TransportBatchSummary[],
  filter: { supplierIds: ReadonlySet<string>; cities: ReadonlySet<string> | null },
  locationsById: Record<string, Location>,
): TransportBatchSummary[] {
  return batches.filter((b) => {
    const ids = b.supplier_ids && b.supplier_ids.length > 0 ? b.supplier_ids : [b.supplier_id];
    if (!ids.some((id) => filter.supplierIds.has(id))) return false;
    return matchesCities(b.location_ids ?? [], filter.cities, locationsById);
  });
}

/** Eligible-list city filter — the same rule as the history (an order whose
 * location has no resolvable city always shows). */
export function filterEligibleByCity(
  orders: TransportEligibleOrder[],
  cities: ReadonlySet<string> | null,
  locationsById: Record<string, Location>,
): TransportEligibleOrder[] {
  return orders.filter((o) => matchesCities([o.location_id], cities, locationsById));
}

/** Eligible orders newest first (returns a NEW array): by
 * `captain_submitted_at`, falling back to `order_date`; missing dates last,
 * ties in input order. The backend returns the lead block and the companion
 * block each sorted, so the combined list otherwise jumps back in time. */
export function sortEligibleNewestFirst(orders: TransportEligibleOrder[]): TransportEligibleOrder[] {
  const when = (o: TransportEligibleOrder): number | null =>
    isoMillis(o.captain_submitted_at) ?? isoMillis(o.order_date);
  return [...orders].sort((a, b) => compareDescNullsLast(when(a), when(b)));
}

// ---- transport-v2: send panel helpers ---------------------------------------

/** One off-catalogue line of the Pago extras checklist. `locationName` is
 * for the Manager's eyes only — the ZOW PDF receives `text` alone. */
export interface TransportExtraLine {
  key: string; // stable and unique: `${orderId}#${n}`
  orderId: string;
  locationName: string;
  text: string;
}

/** The non-blank extra_items lines of the LEAD supplier's member orders (a
 * Magazyn Mory extra never reaches Pago), in order-then-line order, never
 * de-duplicated. Feeds the send panel's checklist; only ticked texts go to
 * buildTransportPagoPrintDoc. */
export function pagoExtraItemLines(detail: TransportBatchDetail): TransportExtraLine[] {
  const out: TransportExtraLine[] = [];
  for (const order of leadSupplierView(detail).orders) {
    const raw = (order.extra_items ?? "").trim();
    if (!raw) continue;
    let n = 0;
    for (const rawLine of raw.split("\n")) {
      const text = rawLine.trim();
      if (!text) continue;
      out.push({
        key: `${order.order_id}#${n}`,
        orderId: order.order_id,
        locationName: order.location_name,
        text,
      });
      n += 1;
    }
  }
  return out;
}

/** The logistics fields the send confirmation checks. */
export type TransportLogisticsField = "pickup_date" | "pickup_time" | "driver" | "vehicle";

/** Label key of each logistics field (the Logistics panel's own labels). */
export const LOGISTICS_FIELD_LABEL_KEYS: Record<TransportLogisticsField, StringKey> = {
  pickup_date: "manager.transport.logistics.pickupDateLabel",
  pickup_time: "manager.transport.logistics.pickupTimeLabel",
  driver: "manager.transport.logistics.driverLabel",
  vehicle: "manager.transport.logistics.vehicleLabel",
};

/** Logistics fields still empty (null, "" or whitespace), in the fixed order
 * pickup_date, pickup_time, driver, vehicle — a soft warning in the send
 * confirmation, never a block. */
export function missingLogisticsFields(
  detail: Pick<TransportBatchDetail, "pickup_date" | "pickup_time" | "driver" | "vehicle">,
): TransportLogisticsField[] {
  const order: TransportLogisticsField[] = ["pickup_date", "pickup_time", "driver", "vehicle"];
  return order.filter((field) => (detail[field] ?? "").trim() === "");
}

/** Parsed `details` of an `order_draft_created` / `driver_draft_created`
 * event. */
export interface TransportDraftEventDetails {
  draftId: string;
  mailbox: string;
  replacedDraftId: string; // "" when none
  extras: string[];
}

const DRAFT_ID_RE = /^[A-Za-z0-9_-]{1,200}$/;
const EXTRAS_SEGMENT = "; extras=";

/** Parse the backend's draft-event details, written exactly as
 * `draft_id=<id>; mailbox=<mailbox>[; replaced=<id>][; extras=<a> | <b>]`
 * (main.py `_transport_draft_created_details`). `extras` is always the last
 * segment, so everything after the first "; extras=" belongs to it. null
 * when there is no valid draft_id. */
export function parseTransportDraftEventDetails(details: string): TransportDraftEventDetails | null {
  const raw = details ?? "";
  const extrasAt = raw.indexOf(EXTRAS_SEGMENT);
  const head = extrasAt >= 0 ? raw.slice(0, extrasAt) : raw;
  const extrasRaw = extrasAt >= 0 ? raw.slice(extrasAt + EXTRAS_SEGMENT.length) : "";
  const fields = new Map<string, string>();
  for (const part of head.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    if (key && !fields.has(key)) fields.set(key, part.slice(eq + 1).trim());
  }
  const draftId = fields.get("draft_id") ?? "";
  if (!DRAFT_ID_RE.test(draftId)) return null;
  const replaced = fields.get("replaced") ?? "";
  return {
    draftId,
    mailbox: fields.get("mailbox") ?? "",
    replacedDraftId: DRAFT_ID_RE.test(replaced) ? replaced : "",
    extras: extrasRaw
      .split(" | ")
      .map((e) => e.trim())
      .filter((e) => e !== ""),
  };
}

/** The current Gmail draft of one kind for a batch: the newest
 * `<kind>_draft_created` event (by `at`; an event without a time counts as
 * oldest; ties keep the input order — the backend lists newest first) whose
 * details parse. null when there is none. */
export function latestTransportDraft(
  events: TransportEvent[] | null | undefined,
  kind: "order" | "driver",
): { draftId: string; mailbox: string; at: string } | null {
  const type = `${kind}_draft_created`;
  let best: { draftId: string; mailbox: string; at: string; ms: number | null } | null = null;
  for (const e of events ?? []) {
    if (e.event_type !== type) continue;
    const parsed = parseTransportDraftEventDetails(e.details);
    if (!parsed) continue;
    const ms = isoMillis(e.at);
    if (best === null || compareDescNullsLast(ms, best.ms) < 0) {
      best = { draftId: parsed.draftId, mailbox: parsed.mailbox, at: e.at ?? "", ms };
    }
  }
  return best ? { draftId: best.draftId, mailbox: best.mailbox, at: best.at } : null;
}

// ---- v4 feedback (feature 2): "NOWY" badge on unopened batches -------------
//
// A tiny localStorage-backed "seen" set (mirrors auth.ts's try/catch-guarded
// style — private-mode browsers must not throw). The optional `storage` param
// makes both functions unit-testable with a stub instead of the real
// `window.localStorage`.

const SEEN_TRANSPORTS_KEY = "supply_os_transport_seen";
const SEEN_TRANSPORTS_CAP = 200;

/** Ids of Transport batches the manager has already opened at least once, or
 * an empty set on first use / private-mode / corrupt storage. */
export function loadSeenTransports(storage: Storage = window.localStorage): Set<string> {
  try {
    const raw = storage.getItem(SEEN_TRANSPORTS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

/** Mark `id` as seen, persisting the updated set capped at the 200 most
 * recent ids (oldest dropped first). A storage failure (quota, private mode)
 * is swallowed — the badge simply reappears next load, never a crash. */
export function markTransportSeen(id: string, storage: Storage = window.localStorage): void {
  try {
    const seen = [...loadSeenTransports(storage)];
    const next = seen.filter((existing) => existing !== id);
    next.push(id);
    const capped = next.slice(-SEEN_TRANSPORTS_CAP);
    storage.setItem(SEEN_TRANSPORTS_KEY, JSON.stringify(capped));
  } catch {
    // ignore — private mode browsers may block
  }
}
