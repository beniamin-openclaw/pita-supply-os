import { describe, it, expect } from "vitest";

import { STRINGS, interpolateTemplate, type Lang } from "../../../i18n";
import type { StringKey } from "../../../i18n/strings";
import type {
  Location,
  ManagerOrderLineDetail,
  OrderableItem,
  TransportBatchDetail,
  TransportBatchOrder,
  TransportBatchSummary,
  TransportEligibleOrder,
  TransportEvent,
} from "../../../types";
import {
  anyTransportDirty,
  buildExtraItemsSupplierBlock,
  buildTransportDriverPrintDoc,
  buildTransportAddAllOptions,
  buildTransportMatrix,
  buildLogisticsOptions,
  buildTransportPagoPrintDoc,
  collectCaptainNotes,
  collectExtraItemsByLocation,
  collectLogisticsSuggestions,
  computePagoWarehouseExclusion,
  computeWeightStrip,
  filterEligibleByCity,
  filterTransportBatches,
  latestTransportDraft,
  LOGISTICS_FIELD_LABEL_KEYS,
  missingLogisticsFields,
  pagoExtraItemLines,
  parseConfigList,
  parseTransportDraftEventDetails,
  sortEligibleNewestFirst,
  sortTransportBatches,
  TRANSPORT_CHIP_SUPPLIER_IDS,
  transportCityOptions,
  transportLocationCity,
  transportScopeFromChips,
  hasValidRecipient,
  loadSeenTransports,
  markTransportSeen,
  orderAddOneOptions,
  seedTransportDrafts,
  sortTransportEvents,
  splitRecipients,
  transportAutoLabel,
  transportCitiesLine,
  transportDirtySavePayloads,
  transportDisplayLabel,
  transportEventTypeLabel,
  leadSupplierView,
  lineSupplierId,
  transportSuppliers,
} from "./transport";

/** In-memory Storage stub for loadSeenTransports/markTransportSeen tests —
 * avoids depending on jsdom's real localStorage between test files. */
function makeStorageStub(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

/** Minimal `t` fixture driven by the real STRINGS table (mirrors emailBody.test.ts's
 * minimal-factory style) — exercises the actual translations instead of stubbing. */
function makeT(lang: Lang = "pl") {
  return (key: StringKey, vars?: Record<string, string | number>): string =>
    interpolateTemplate(STRINGS[key][lang], vars);
}

/** Minimal batch fixture — only the fields the builders read matter. */
function batch(overrides: Partial<TransportBatchDetail> = {}): TransportBatchDetail {
  return {
    transport_id: "TRN-20260821-BUKA-abc123",
    supplier_id: "SUP_BUKAT",
    supplier_name: "Bukat",
    created: "2026-08-21T09:15:00+00:00",
    order_count: 2,
    location_ids: ["WOLA", "BRACKA"],
    status: "sent",
    notes: "",
    total_weight_kg: 0,
    unknown_weight_count: 0,
    events: [],
    orders: [
      { order_id: "ORD-1", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_sent", lines: [] },
      { order_id: "ORD-2", location_id: "BRACKA", location_name: "Pita Bros Bracka", status: "manager_sent", lines: [] },
    ],
    lines: [
      {
        product_id: "P1",
        product_name_pl: "Pomidory",
        supplier_product_id: "SP1",
        supplier_product_name: "Pomidory malinowe",
        purchase_unit: "kg",
        total_qty_purchase: 12,
        per_location: [
          { location_id: "WOLA", location_name: "Pita Bros Wola", order_id: "ORD-1", qty_purchase: 5 },
          { location_id: "BRACKA", location_name: "Pita Bros Bracka", order_id: "ORD-2", qty_purchase: 7 },
        ],
      },
    ],
    ...overrides,
  };
}

// ---- training-feedback-0901 F1: ad-hoc off-catalogue items on the Transport
// path -------------------------------------------------------------------

describe("collectExtraItemsByLocation / buildExtraItemsSupplierBlock", () => {
  it("collects every non-blank extra_items LINE across orders, attributed to location, never deduped", () => {
    const orders = [
      { order_id: "ORD-1", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_claimed" as const, lines: [], extra_items: "Feta - 5 kg\nCebula - 2 kg" },
      { order_id: "ORD-2", location_id: "BRACKA", location_name: "Pita Bros Bracka", status: "manager_claimed" as const, lines: [], extra_items: "Feta - 5 kg" },
    ];
    expect(collectExtraItemsByLocation(orders)).toEqual([
      { locationName: "Pita Bros Wola", text: "Feta - 5 kg" },
      { locationName: "Pita Bros Wola", text: "Cebula - 2 kg" },
      { locationName: "Pita Bros Bracka", text: "Feta - 5 kg" },
    ]);
  });

  it("treats an absent extra_items field as no items rather than throwing (FE-ahead-of-BE safety)", () => {
    const orders = [
      { order_id: "ORD-1", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_claimed" as const, lines: [] },
    ];
    expect(() => collectExtraItemsByLocation(orders)).not.toThrow();
    expect(collectExtraItemsByLocation(orders)).toEqual([]);
  });

  it("ignores a blank/whitespace-only extra_items value", () => {
    const orders = [
      { order_id: "ORD-1", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_claimed" as const, lines: [], extra_items: "   " },
    ];
    expect(collectExtraItemsByLocation(orders)).toEqual([]);
  });

  it("buildExtraItemsSupplierBlock prefixes a header only when at least one item exists", () => {
    const withItems = buildExtraItemsSupplierBlock(
      [{ order_id: "ORD-1", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_claimed", lines: [], extra_items: "Feta - 5 kg" }],
      makeT(),
    );
    expect(withItems[0]).toBe("Pozycje spoza katalogu:");
    expect(withItems).toContain("Feta - 5 kg");

    const withoutItems = buildExtraItemsSupplierBlock(
      [{ order_id: "ORD-1", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_claimed", lines: [] }],
      makeT(),
    );
    expect(withoutItems).toEqual([]);
  });
});

describe("buildTransportDriverPrintDoc — ad-hoc items (F1)", () => {
  it("buildTransportDriverPrintDoc carries the per-location ad-hoc entries", () => {
    const b = batch({
      orders: [
        { order_id: "ORD-1", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_claimed", lines: [], extra_items: "Feta - 5 kg\nCebula - 2 kg" },
      ],
    });
    const doc = buildTransportDriverPrintDoc(b, "Bukat");
    expect(doc.extraItems).toEqual([
      { locationName: "Pita Bros Wola", text: "Feta - 5 kg" },
      { locationName: "Pita Bros Wola", text: "Cebula - 2 kg" },
    ]);
  });

  it("buildTransportDriverPrintDoc.extraItems is [] when no order carries one", () => {
    const doc = buildTransportDriverPrintDoc(batch(), "Bukat");
    expect(doc.extraItems).toEqual([]);
  });
});

describe("collectCaptainNotes (F1 point 5 — Manager-only surface)", () => {
  it("collects a note per location, skipping blank/whitespace-only/absent notes", () => {
    const orders = [
      { order_id: "ORD-1", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_claimed" as const, lines: [], captain_note: "proszę pilnie, mamy event" },
      { order_id: "ORD-2", location_id: "BRACKA", location_name: "Pita Bros Bracka", status: "manager_claimed" as const, lines: [], captain_note: "   " },
      { order_id: "ORD-3", location_id: "KEN", location_name: "Pita Bros Ken", status: "manager_claimed" as const, lines: [] },
    ];
    expect(collectCaptainNotes(orders)).toEqual([
      { orderId: "ORD-1", locationName: "Pita Bros Wola", note: "proszę pilnie, mamy event" },
    ]);
  });

  it("keys two orders from the SAME location distinctly (post-review R2)", () => {
    // manager_transport_create has no per-location dedupe, so one batch can
    // hold two WOLA orders. Keying the rendered list on locationName alone
    // collided; orderId is what makes each entry unique.
    const orders = [
      { order_id: "ORD-1", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_claimed" as const, lines: [], captain_note: "pierwsze" },
      { order_id: "ORD-2", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_claimed" as const, lines: [], captain_note: "drugie" },
    ];
    const notes = collectCaptainNotes(orders);
    expect(notes.map((n) => n.orderId)).toEqual(["ORD-1", "ORD-2"]);
    expect(new Set(notes.map((n) => n.orderId)).size).toBe(2);
  });

  it("returns [] when no order carries a note", () => {
    const orders = [
      { order_id: "ORD-1", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_claimed" as const, lines: [] },
    ];
    expect(collectCaptainNotes(orders)).toEqual([]);
  });
});

describe("splitRecipients / hasValidRecipient", () => {
  it("splits comma- and semicolon-separated lists, trims, and drops entries without @", () => {
    expect(splitRecipients("a@x.pl, b@y.pl;  c@z.pl , not-an-email")).toEqual([
      "a@x.pl",
      "b@y.pl",
      "c@z.pl",
    ]);
  });

  it("hasValidRecipient is false for empty/placeholder/absent values", () => {
    expect(hasValidRecipient(undefined)).toBe(false);
    expect(hasValidRecipient(null)).toBe(false);
    expect(hasValidRecipient("")).toBe(false);
    expect(hasValidRecipient("TBD")).toBe(false);
  });

  it("hasValidRecipient is true when at least one address carries @", () => {
    expect(hasValidRecipient("TBD, real@x.pl")).toBe(true);
  });
});

// ---- v2 (ADDENDUM v2): draft workstation helpers ---------------------------

function orderLine(overrides: Partial<ManagerOrderLineDetail> = {}): ManagerOrderLineDetail {
  return {
    order_line_id: "OL-1",
    product_id: "P1",
    product_name_pl: "Pomidory",
    inventory_unit: "kg",
    is_critical: false,
    supplier_product_id: "SP1",
    supplier_product_name: "Pomidory malinowe",
    purchase_unit: "kg",
    units_per_purchase_unit: 1,
    current_stock_qty_base: 0,
    target_stock_qty_base: 10,
    max_stock_qty_base: 20,
    allow_over_max_due_to_packaging: false,
    suggested_qty_base: 10,
    suggested_qty_purchase: 10,
    captain_final_qty_purchase: 5,
    captain_final_qty_base: 5,
    manager_final_qty_purchase: 0,
    manager_final_qty_base: 0,
    captain_comment: "",
    manager_comment: "",
    ...overrides,
  };
}

function batchOrder(overrides: Partial<TransportBatchOrder> = {}): TransportBatchOrder {
  return {
    order_id: "ORD-1",
    location_id: "WOLA",
    location_name: "Pita Bros Wola",
    status: "manager_claimed",
    lines: [],
    ...overrides,
  };
}

describe("buildTransportMatrix", () => {
  it("unions products across orders and maps each cell to its order's line", () => {
    const orders: TransportBatchOrder[] = [
      batchOrder({
        order_id: "ORD-1",
        lines: [orderLine({ order_line_id: "OL-1", product_id: "P1", product_name_pl: "Pomidory" })],
      }),
      batchOrder({
        order_id: "ORD-2",
        location_id: "BRACKA",
        location_name: "Pita Bros Bracka",
        lines: [
          orderLine({ order_line_id: "OL-2", product_id: "P1", product_name_pl: "Pomidory" }),
          orderLine({ order_line_id: "OL-3", product_id: "P2", product_name_pl: "Cebula" }),
        ],
      }),
    ];

    const matrix = buildTransportMatrix(orders);

    expect(matrix.map((r) => r.product_id).sort()).toEqual(["P1", "P2"]);
    const p1 = matrix.find((r) => r.product_id === "P1")!;
    expect(p1.linesByOrderId["ORD-1"].order_line_id).toBe("OL-1");
    expect(p1.linesByOrderId["ORD-2"].order_line_id).toBe("OL-2");
    const p2 = matrix.find((r) => r.product_id === "P2")!;
    expect(p2.linesByOrderId["ORD-1"]).toBeUndefined();
    expect(p2.linesByOrderId["ORD-2"].order_line_id).toBe("OL-3");
  });

  it("orders rows canonically: display_order first, then supplier_product_id", () => {
    // Name order would be Cebula, Czosnek, Pomidory, Ziemniaki. Positions put
    // Ziemniaki (10) before Cebula (20); the unpositioned rows follow in
    // supplier_product_id order (SP_A before SP_B), not by name.
    const orders: TransportBatchOrder[] = [
      batchOrder({
        lines: [
          orderLine({ order_line_id: "OL-1", product_id: "P1", product_name_pl: "Pomidory", supplier_product_id: "SP_A", display_order: null }),
          orderLine({ order_line_id: "OL-2", product_id: "P2", product_name_pl: "Cebula", supplier_product_id: "SP_Z", display_order: 20 }),
          orderLine({ order_line_id: "OL-3", product_id: "P3", product_name_pl: "Czosnek", supplier_product_id: "SP_B" }),
          orderLine({ order_line_id: "OL-4", product_id: "P4", product_name_pl: "Ziemniaki", supplier_product_id: "SP_Y", display_order: 10 }),
        ],
      }),
    ];
    const matrix = buildTransportMatrix(orders);
    expect(matrix.map((r) => r.product_name_pl)).toEqual(["Ziemniaki", "Cebula", "Pomidory", "Czosnek"]);
    expect(matrix.map((r) => r.display_order)).toEqual([10, 20, null, null]);
    expect(matrix.map((r) => r.supplier_product_id)).toEqual(["SP_Y", "SP_Z", "SP_A", "SP_B"]);
  });

  it("pins manager-added rows (all lines -M-) to the bottom in add order", () => {
    // Base rows follow the canonical order; "Agrest" and "Bób" are
    // manager-added (every line an OL-...-M-... id) so despite sorting FIRST
    // they render BELOW the base rows, in first-encounter (add) order (v5.1
    // feedback) — this pin is specific to the Transport editor.
    const orders: TransportBatchOrder[] = [
      batchOrder({
        lines: [
          orderLine({ order_line_id: "OL-ORD-1-001", product_id: "P1", product_name_pl: "Ziemniaki", supplier_product_id: "SP_20", display_order: 20 }),
          orderLine({ order_line_id: "OL-ORD-1-002", product_id: "P2", product_name_pl: "Cebula", supplier_product_id: "SP_30", display_order: 30 }),
          orderLine({ order_line_id: "OL-ORD-1-M-aa11", product_id: "P3", product_name_pl: "Bób", supplier_product_id: "SP_90", display_order: 90 }),
          orderLine({ order_line_id: "OL-ORD-1-M-bb22", product_id: "P4", product_name_pl: "Agrest", supplier_product_id: "SP_10", display_order: 10 }),
        ],
      }),
    ];
    const matrix = buildTransportMatrix(orders);
    expect(matrix.map((r) => r.product_name_pl)).toEqual(["Ziemniaki", "Cebula", "Bób", "Agrest"]);
  });

  it("keeps a manager-filled cell of a captain-origin product row in the base section", () => {
    // P1 exists via a captain line on ORD-1 AND a manager-added line on ORD-2:
    // the row is NOT manager-only, so it stays in the canonically ordered base.
    const orders: TransportBatchOrder[] = [
      batchOrder({
        order_id: "ORD-1",
        lines: [orderLine({ order_line_id: "OL-ORD-1-001", product_id: "P1", product_name_pl: "Pomidory", supplier_product_id: "SP_P1", display_order: 10 })],
      }),
      batchOrder({
        order_id: "ORD-2",
        location_id: "BRACKA",
        location_name: "Pita Bros Bracka",
        lines: [
          orderLine({ order_line_id: "OL-ORD-2-M-cc33", product_id: "P1", product_name_pl: "Pomidory", supplier_product_id: "SP_P1", display_order: 10 }),
          orderLine({ order_line_id: "OL-ORD-2-001", product_id: "P2", product_name_pl: "Cebula", supplier_product_id: "SP_P2", display_order: 20 }),
        ],
      }),
    ];
    const matrix = buildTransportMatrix(orders);
    expect(matrix.map((r) => r.product_name_pl)).toEqual(["Pomidory", "Cebula"]);
  });
});

function orderable(overrides: Partial<OrderableItem> = {}): OrderableItem {
  return {
    product_id: "P1",
    product_name_pl: "Pomidory",
    inventory_unit: "kg",
    is_critical: false,
    purchase_unit: "kg",
    units_per_purchase_unit: 1,
    rounding_rule: "full_only",
    min_stock_qty_base: 0,
    max_stock_qty_base: 20,
    target_stock_qty_base: 10,
    allow_over_max_due_to_packaging: false,
    supplier_product_id: "SP1",
    supplier_product_name: "Pomidory malinowe",
    ...overrides,
  };
}

describe("buildTransportAddAllOptions", () => {
  it("lists products missing from any order in the canonical supplier order", () => {
    const orders: TransportBatchOrder[] = [
      batchOrder({
        order_id: "ORD-1",
        lines: [orderLine({ order_line_id: "OL-1", product_id: "P1" })],
      }),
    ];
    const orderableByOrderId: Record<string, OrderableItem[]> = {
      "ORD-1": [
        orderable({ product_id: "P1", supplier_product_id: "SP_P1", display_order: 10 }),
        orderable({ product_id: "P2", product_name_pl: "Awokado", supplier_product_id: "SP_P2" }),
        orderable({ product_id: "P3", product_name_pl: "Rukola", supplier_product_id: "SP_P3", display_order: 30 }),
        orderable({ product_id: "P4", product_name_pl: "Cebula", supplier_product_id: "SP_P4", display_order: 20 }),
      ],
    };
    const options = buildTransportAddAllOptions(orders, orderableByOrderId);
    // P1 is already on the only order; the rest follow position, then id.
    expect(options.map((o) => o.product_id)).toEqual(["P4", "P3", "P2"]);
  });

  it("never offers a one-off product outside a location's list to add-to-all", () => {
    const orders: TransportBatchOrder[] = [batchOrder({ order_id: "ORD-1", lines: [] })];
    const orderableByOrderId: Record<string, OrderableItem[]> = {
      "ORD-1": [
        orderable({ product_id: "P1", supplier_product_id: "SP_P1" }),
        orderable({ product_id: "P2", supplier_product_id: "SP_P2", configured_for_location: false }),
      ],
    };
    const options = buildTransportAddAllOptions(orders, orderableByOrderId);
    expect(options.map((o) => o.product_id)).toEqual(["P1"]);
  });
});

describe("orderAddOneOptions (manager-add-any-product)", () => {
  it("lists the order's full list incl. one-off items, minus lines it already has", () => {
    const order = batchOrder({
      order_id: "ORD-NOR",
      lines: [orderLine({ order_line_id: "OL-1", product_id: "P1" })],
    });
    const orderableByOrderId: Record<string, OrderableItem[]> = {
      "ORD-NOR": [
        orderable({ product_id: "P1", supplier_product_id: "SP_P1", display_order: 10 }),
        orderable({ product_id: "P024", supplier_product_id: "SP_P024", display_order: 30, configured_for_location: false }),
        orderable({ product_id: "P2", supplier_product_id: "SP_P2", display_order: 20 }),
      ],
    };
    const options = orderAddOneOptions(order, orderableByOrderId);
    expect(options.map((o) => o.product_id)).toEqual(["P2", "P024"]);
    expect(options[1].configured_for_location).toBe(false);
  });

  it("returns [] when the order's list has not loaded", () => {
    expect(orderAddOneOptions(batchOrder({ order_id: "ORD-X" }), {})).toEqual([]);
  });
});

describe("seedTransportDrafts / anyTransportDirty / transportDirtySavePayloads", () => {
  it("seeds each order's drafts from its own lines (effective qty + comment)", () => {
    const orders: TransportBatchOrder[] = [
      batchOrder({
        order_id: "ORD-1",
        lines: [orderLine({ order_line_id: "OL-1", captain_final_qty_purchase: 5, manager_final_qty_purchase: 0 })],
      }),
    ];
    const drafts = seedTransportDrafts(orders);
    expect(drafts["ORD-1"]["OL-1"]).toEqual({ qty: 5, comment: "" });
  });

  it("keeps a cell the Manager explicitly zeroed at 0 (order-line-zero-qty)", () => {
    const orders: TransportBatchOrder[] = [
      batchOrder({
        order_id: "ORD-1",
        lines: [
          orderLine({
            order_line_id: "OL-1",
            captain_final_qty_purchase: 5,
            manager_final_qty_purchase: 0,
            manager_final_set: true,
          }),
        ],
      }),
    ];
    const drafts = seedTransportDrafts(orders);
    expect(drafts["ORD-1"]["OL-1"]).toEqual({ qty: 0, comment: "" });
    expect(anyTransportDirty(orders, drafts)).toBe(false);
  });

  it("is not dirty right after seeding", () => {
    const orders: TransportBatchOrder[] = [
      batchOrder({ order_id: "ORD-1", lines: [orderLine({ order_line_id: "OL-1" })] }),
    ];
    const drafts = seedTransportDrafts(orders);
    expect(anyTransportDirty(orders, drafts)).toBe(false);
    expect(transportDirtySavePayloads(orders, drafts)).toEqual([]);
  });

  it("flags only the order whose line was edited, and preserves the OTHER (untouched) line's comment by simply not including it", () => {
    const orders: TransportBatchOrder[] = [
      batchOrder({
        order_id: "ORD-1",
        lines: [
          orderLine({ order_line_id: "OL-1", captain_final_qty_purchase: 5 }),
          orderLine({ order_line_id: "OL-2", product_id: "P2", captain_final_qty_purchase: 3, manager_comment: "stara uwaga" }),
        ],
      }),
      batchOrder({
        order_id: "ORD-2",
        location_id: "BRACKA",
        lines: [orderLine({ order_line_id: "OL-3", captain_final_qty_purchase: 2 })],
      }),
    ];
    const drafts = seedTransportDrafts(orders);
    // Edit only OL-1's qty.
    drafts["ORD-1"]["OL-1"] = { ...drafts["ORD-1"]["OL-1"], qty: 9 };

    expect(anyTransportDirty(orders, drafts)).toBe(true);

    const payloads = transportDirtySavePayloads(orders, drafts);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].order_id).toBe("ORD-1");
    expect(payloads[0].finals).toEqual([
      { order_line_id: "OL-1", manager_final_qty_purchase: 9, manager_comment: "" },
    ]);
    // OL-2 was never touched — it must not appear in the payload at all, so its
    // persisted manager_comment ("stara uwaga") is left alone server-side.
    expect(payloads[0].finals.find((f) => f.order_line_id === "OL-2")).toBeUndefined();
  });
});

describe("computeWeightStrip", () => {
  it("computes remaining and flags over-limit", () => {
    const strip = computeWeightStrip({ total_weight_kg: 500, limit_kg: 700, unknown_weight_count: 0 });
    expect(strip).toEqual({
      totalKg: 500,
      limitKg: 700,
      remainingKg: 200,
      overKg: 0,
      isOver: false,
      unknownCount: 0,
    });
  });

  it("flags isOver + overKg once total exceeds limit", () => {
    const strip = computeWeightStrip({ total_weight_kg: 800, limit_kg: 700, unknown_weight_count: 0 });
    expect(strip.isOver).toBe(true);
    expect(strip.remainingKg).toBe(-100);
    expect(strip.overKg).toBe(100);
  });

  it("handles a null limit (no limit set) — remainingKg/overKg neutral", () => {
    const strip = computeWeightStrip({ total_weight_kg: 500, limit_kg: null, unknown_weight_count: 2 });
    expect(strip.limitKg).toBeNull();
    expect(strip.remainingKg).toBeNull();
    expect(strip.overKg).toBe(0);
    expect(strip.isOver).toBe(false);
    expect(strip.unknownCount).toBe(2);
  });
});

describe("collectLogisticsSuggestions", () => {
  function summary(overrides: Partial<TransportBatchSummary> = {}): TransportBatchSummary {
    return {
      transport_id: "TRN-1",
      supplier_id: "SUP_PAGO",
      supplier_name: "Pago",
      order_count: 1,
      location_ids: ["WOLA"],
      status: "sent",
      ...overrides,
    };
  }

  it("dedupes and sorts non-empty driver values across batches", () => {
    const batches = [
      summary({ driver: "Jan Kowalski" }),
      summary({ driver: "Adam Nowak" }),
      summary({ driver: "Jan Kowalski" }),
      summary({ driver: null }),
      summary({ driver: "" }),
    ];
    expect(collectLogisticsSuggestions(batches, "driver")).toEqual(["Adam Nowak", "Jan Kowalski"]);
  });

  it("does the same for the vehicle field independently", () => {
    const batches = [summary({ vehicle: "Ducato" }), summary({ vehicle: "Transit" }), summary({ vehicle: "Ducato" })];
    expect(collectLogisticsSuggestions(batches, "vehicle")).toEqual(["Ducato", "Transit"]);
  });
});

describe("parseConfigList", () => {
  it("splits on comma, trims, and drops empties", () => {
    expect(parseConfigList("Mateusz Miecznikowski, Grzegorz")).toEqual([
      "Mateusz Miecznikowski",
      "Grzegorz",
    ]);
    expect(parseConfigList("a,,b ,")).toEqual(["a", "b"]);
  });

  it("splits on semicolon too", () => {
    expect(parseConfigList("a; b ;c")).toEqual(["a", "b", "c"]);
  });

  it("dedupes preserving first-seen order", () => {
    expect(parseConfigList("Grzegorz, Mateusz, Grzegorz")).toEqual(["Grzegorz", "Mateusz"]);
  });

  it("returns [] for null/undefined/empty", () => {
    expect(parseConfigList(null)).toEqual([]);
    expect(parseConfigList(undefined)).toEqual([]);
    expect(parseConfigList("")).toEqual([]);
  });
});

describe("buildLogisticsOptions", () => {
  it("merges configured + suggestions + current, deduped, configured first", () => {
    expect(
      buildLogisticsOptions(
        ["Grzegorz", "Mateusz Miecznikowski"],
        ["Jan Kowalski", "Grzegorz"],
        "Adam Nowak",
      ),
    ).toEqual(["Grzegorz", "Mateusz Miecznikowski", "Jan Kowalski", "Adam Nowak"]);
  });

  it("drops a null/undefined/empty current without adding an empty option", () => {
    expect(buildLogisticsOptions(["Grzegorz"], [], null)).toEqual(["Grzegorz"]);
    expect(buildLogisticsOptions(["Grzegorz"], [], undefined)).toEqual(["Grzegorz"]);
    expect(buildLogisticsOptions(["Grzegorz"], [], "")).toEqual(["Grzegorz"]);
  });

  it("does not duplicate current when it already appears in configured/suggestions", () => {
    expect(buildLogisticsOptions(["Grzegorz"], [], "Grzegorz")).toEqual(["Grzegorz"]);
  });

  it("returns [] when everything is empty", () => {
    expect(buildLogisticsOptions([], [], null)).toEqual([]);
  });
});

// ---- v3 Phase 6: event history ----------------------------------------------

function event(overrides: Partial<TransportEvent> = {}): TransportEvent {
  return {
    event_id: "EVT-1",
    transport_id: "TRN-1",
    event_type: "order_combined",
    actor: "manager-default",
    at: "2026-08-22T10:00:00+00:00",
    details: "",
    ...overrides,
  };
}

describe("transportEventTypeLabel", () => {
  it("resolves every known event_type to a non-empty, non-raw label", () => {
    const known = [
      "order_combined",
      "location_added",
      "order_removed",
      "order_sent",
      "batch_sent",
      "batch_cancelled",
      "logistics_changed",
      "quantities_changed",
      "delivery_confirmed",
      "order_draft_created",
      "driver_draft_created",
      "batch_reopened",
      "batch_reopen_aborted",
    ];
    for (const type of known) {
      const label = transportEventTypeLabel(makeT(), type);
      expect(label).not.toBe("");
      expect(label).not.toBe(type);
    }
  });

  it("falls back to the raw event_type for an unrecognized value", () => {
    expect(transportEventTypeLabel(makeT(), "some_future_event")).toBe("some_future_event");
  });

  it("labels the transport-v2 event types (pl + en)", () => {
    expect(transportEventTypeLabel(makeT(), "order_draft_created")).toBe("Utworzono szkic zamówienia");
    expect(transportEventTypeLabel(makeT(), "driver_draft_created")).toBe(
      "Utworzono szkic listy kierowcy",
    );
    expect(transportEventTypeLabel(makeT(), "batch_reopened")).toBe("Cofnięto wysłanie");
    expect(transportEventTypeLabel(makeT("en"), "batch_reopened")).toBe("Sending undone");
    expect(transportEventTypeLabel(makeT(), "batch_reopen_aborted")).toBe(
      "Cofnięcie wysłania przerwane — transport nadal wysłany",
    );
  });
});

describe("sortTransportEvents", () => {
  it("sorts newest first", () => {
    const events = [
      event({ event_id: "e1", at: "2026-08-20T09:00:00+00:00" }),
      event({ event_id: "e2", at: "2026-08-22T09:00:00+00:00" }),
      event({ event_id: "e3", at: "2026-08-21T09:00:00+00:00" }),
    ];
    expect(sortTransportEvents(events).map((e) => e.event_id)).toEqual(["e2", "e3", "e1"]);
  });

  it("treats a null `at` as oldest without crashing", () => {
    const events = [
      event({ event_id: "e1", at: null }),
      event({ event_id: "e2", at: "2026-08-22T09:00:00+00:00" }),
    ];
    expect(sortTransportEvents(events).map((e) => e.event_id)).toEqual(["e2", "e1"]);
  });

  it("does not mutate the input array", () => {
    const events = [event({ event_id: "e1", at: "2026-08-20T09:00:00+00:00" }), event({ event_id: "e2", at: "2026-08-22T09:00:00+00:00" })];
    const original = [...events];
    sortTransportEvents(events);
    expect(events).toEqual(original);
  });
});

// ---- v3 Phase 10: print/PDF views -------------------------------------------

describe("buildTransportDriverPrintDoc", () => {
  it("carries logistics header + a per-product x per-location MATRIX", () => {
    const b = batch({ driver: "Jan Kowalski", vehicle: "Ducato", pickup_date: "2026-08-23", pickup_time: "07:30" });
    const doc = buildTransportDriverPrintDoc(b, "Transport Sobota · Bukat · 22.08.26");
    expect(doc.transportId).toBe("TRN-20260821-BUKA-abc123");
    expect(doc.displayLabel).toBe("Transport Sobota · Bukat · 22.08.26"); // pass-through, caller-computed
    expect(doc.date).toBe("2026-08-23");
    expect(doc.time).toBe("07:30");
    expect(doc.driver).toBe("Jan Kowalski");
    expect(doc.vehicle).toBe("Ducato");
    expect(doc.supplierName).toBe("Bukat");
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].supplierBarText).toBe("Bukat"); // not Pago -> no " / LINEAGE" suffix
    // Short forms — the redundant "Pita Bros " brand prefix is stripped on
    // the internal driver doc (operator feedback v5.1); still pl-collated.
    expect(doc.locations).toEqual(["Bracka", "Wola"]);
    expect(doc.locationsLine).toBe("Bracka, Wola");
    const products = doc.sections[0].products;
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe("Pomidory");
    expect(products[0].totalQty).toBe(12);
    // Column order matches doc.locations: Bracka first, then Wola.
    expect(products[0].qtyByLocation).toEqual([7, 5]);
  });

  it("adds ' / LINEAGE' to the supplier bar text for SUP_PAGO only", () => {
    const b = batch({ supplier_id: "SUP_PAGO", supplier_name: "Pago" });
    expect(buildTransportDriverPrintDoc(b, "Pago").sections[0].supplierBarText).toBe("Pago / LINEAGE");
  });

  it("leaves date, driver, vehicle and time blank when logistics are unset (never the created date)", () => {
    const b = batch({ driver: null, vehicle: null, pickup_date: null, pickup_time: null });
    const doc = buildTransportDriverPrintDoc(b, "Bukat");
    expect(doc.date).toBe("");
    expect(doc.driver).toBe("");
    expect(doc.vehicle).toBe("");
    expect(doc.time).toBe("");
  });

  it("drops zero-qty product lines; a location with a zero cell still gets its column with 0", () => {
    const b = batch({
      lines: [
        {
          product_id: "P1",
          product_name_pl: "Pomidory",
          supplier_product_id: "SP1",
          supplier_product_name: "Pomidory malinowe",
          purchase_unit: "kg",
          total_qty_purchase: 0,
          per_location: [],
        },
        {
          product_id: "P2",
          product_name_pl: "Cebula",
          supplier_product_id: "SP2",
          supplier_product_name: "Cebula czerwona",
          purchase_unit: "karton",
          total_qty_purchase: 3,
          per_location: [
            { location_id: "WOLA", location_name: "Pita Bros Wola", order_id: "ORD-1", qty_purchase: 3 },
            { location_id: "BRACKA", location_name: "Pita Bros Bracka", order_id: "ORD-2", qty_purchase: 0 },
          ],
        },
      ],
    });
    const doc = buildTransportDriverPrintDoc(b, "Bukat");
    expect(doc.sections[0].products.map((p) => p.productId)).toEqual(["P2"]);
    // doc.locations = [Bracka, Wola] (pl-collated); Bracka's cell is 0, Wola's is 3.
    expect(doc.sections[0].products[0].qtyByLocation).toEqual([0, 3]);
  });
});

describe("buildTransportPagoPrintDoc", () => {
  it("leaves the pickup date blank when unset — never prints the created date as the pickup", () => {
    const b = batch({ pickup_date: null, pickup_time: null });
    const doc = buildTransportPagoPrintDoc(b, "Bukat");
    expect(doc.pickupDate).toBe("");
    expect(doc.pickupTime).toBe("");
  });

  it("carries per-product totals only — the product table structurally never leaks a per-location split", () => {
    const b = batch({ pickup_date: "2026-08-23" });
    const doc = buildTransportPagoPrintDoc(b, "Bukat");
    expect(doc.transportId).toBe("TRN-20260821-BUKA-abc123");
    expect(doc.displayLabel).toBe("Bukat"); // pass-through, caller-computed
    expect(doc.supplierName).toBe("Bukat");
    expect(doc.pickupDate).toBe("2026-08-23");
    expect(doc.isPago).toBe(false);
    expect(doc.entity).toBeNull();
    expect(doc.products).toEqual([
      { productId: "P1", name: "Pomidory malinowe", unit: "kg", qty: 12 },
    ]);

    // The no-location-leak assertion (product table only — the document-data
    // box legitimately carries a `locationsLine` summary): no product line
    // carries a `location` key or any per-location breakdown at all.
    const serializedProducts = JSON.stringify(doc.products);
    expect(serializedProducts).not.toContain("Wola");
    expect(serializedProducts).not.toContain("Bracka");
    for (const p of doc.products) {
      expect(Object.keys(p)).not.toContain("location");
      expect(Object.keys(p)).not.toContain("perLocation");
    }
  });

  it("builds the fixed Pago entity block + literal title bar only for SUP_PAGO", () => {
    const b = batch({ supplier_id: "SUP_PAGO", supplier_name: "Pago" });
    const doc = buildTransportPagoPrintDoc(b, "Bukat");
    expect(doc.isPago).toBe(true);
    expect(doc.titleBarText).toBe("PITA BROS — ZLECENIE ODBIORU WŁASNEGO");
    expect(doc.entity).toEqual({
      name: "Pita Bros sp. z o.o.",
      nip: "9522100633",
      address1: "ul. W. Laskonogiego 9",
      address2: "02-496 Warszawa",
    });
  });

  it("uses a generic title and no entity block for a non-Pago supplier", () => {
    const b = batch({ supplier_id: "SUP_BUKAT", supplier_name: "Bukat" });
    const doc = buildTransportPagoPrintDoc(b, "Bukat");
    expect(doc.isPago).toBe(false);
    expect(doc.titleBarText).toBe("Bukat — ZAMÓWIENIE");
    expect(doc.entity).toBeNull();
    // Not incidental: this test passed unchanged while the warehouse_pickup
    // filter was silently emptying every non-Pago order document.
    expect(doc.products.length).toBeGreaterThan(0);
  });

  it("falls back to product_name_pl when there is no supplier-facing name", () => {
    const b = batch({
      lines: [
        {
          product_id: "P2",
          product_name_pl: "Cebula",
          supplier_product_id: "SP2",
          supplier_product_name: "",
          purchase_unit: "kg",
          total_qty_purchase: 3,
          per_location: [],
        },
      ],
    });
    const doc = buildTransportPagoPrintDoc(b, "Bukat");
    expect(doc.products[0].name).toBe("Cebula");
  });

  it("drops zero-qty lines", () => {
    const b = batch({
      lines: [
        {
          product_id: "P1",
          product_name_pl: "Pomidory",
          supplier_product_id: "SP1",
          supplier_product_name: "Pomidory malinowe",
          purchase_unit: "kg",
          total_qty_purchase: 0,
          per_location: [],
        },
      ],
    });
    expect(buildTransportPagoPrintDoc(b, "Bukat").products).toEqual([]);
  });

  it("names the product, never the supplier_sku placeholder code", () => {
    const b = batch({
      lines: [
        {
          product_id: "P1",
          product_name_pl: "Gyros 15 KG",
          supplier_product_id: "SP_PAGO_P024",
          supplier_product_name: "Gyros 15 KG",
          purchase_unit: "blok",
          total_qty_purchase: 10,
          per_location: [],
          supplier_sku: "PAGO-001",
        },
      ],
    });
    const doc = buildTransportPagoPrintDoc(b, "Pago");
    expect(doc.products[0].name).toBe("Gyros 15 KG");
    expect(JSON.stringify(doc.products)).not.toContain("PAGO-001");
  });

  // --- warehouse_pickup filter (training-feedback-0901 Phase 4) ---
  //
  // The filter is PAGO-ONLY. This same builder also produces the generic
  // supplier order document for every other supplier, where the column is
  // false on every row — filtering there would empty a real supplier order.

  const pagoBatch = (lines: TransportBatchDetail["lines"]) =>
    batch({ supplier_id: "SUP_PAGO", supplier_name: "Pago", lines });

  const aggLine = (
    id: string,
    name: string,
    qty: number,
    warehouse_pickup?: boolean,
  ) => ({
    product_id: id,
    product_name_pl: name,
    supplier_product_id: `SP_${id}`,
    supplier_product_name: name,
    purchase_unit: "szt",
    total_qty_purchase: qty,
    per_location: [],
    ...(warehouse_pickup === undefined ? {} : { warehouse_pickup }),
  });

  it("Pago: drops a line that is not collected on the warehouse run", () => {
    const b = pagoBatch([aggLine("P130", "Rolki do kasy", 110, false)]);
    expect(buildTransportPagoPrintDoc(b, "Pago").products).toEqual([]);
  });

  it("Pago: drops a line whose warehouse_pickup is absent (column defaults false)", () => {
    const b = pagoBatch([aggLine("P089", "Boxy PB", 2)]);
    expect(buildTransportPagoPrintDoc(b, "Pago").products).toEqual([]);
  });

  it("Pago: keeps warehouse goods and drops the rest of the same batch", () => {
    const b = pagoBatch([
      aggLine("P024", "Gyros 15 KG", 2, true),
      aggLine("P130", "Rolki do kasy", 110, false),
    ]);
    const doc = buildTransportPagoPrintDoc(b, "Pago");
    expect(doc.products.map((p) => p.productId)).toEqual(["P024"]);
  });

  // The regression guard for the bug this filter first shipped with: an
  // unconditional filter emptied the ORDER document for every non-Pago
  // supplier, because migration 0015 flags only SP_PAGO_* rows.
  it("non-Pago: keeps every ordered line even though warehouse_pickup is false", () => {
    const b = batch({
      supplier_id: "SUP_BUKAT",
      supplier_name: "Bukat",
      lines: [
        aggLine("P1", "Pomidory", 12, false),
        aggLine("P2", "Cebula", 3),
      ],
    });
    const doc = buildTransportPagoPrintDoc(b, "Bukat");
    expect(doc.isPago).toBe(false);
    expect(doc.products.map((p) => p.productId)).toEqual(["P1", "P2"]);
  });

  // --- excludedProducts / warehousePickupDataMissing (training-feedback-0901 F7) ---

  it("collects the NAMES of every excluded line for a Pago batch", () => {
    const b = pagoBatch([
      aggLine("P024", "Gyros 15 KG", 2, true),
      aggLine("P130", "Rolki do kasy", 110, false),
      aggLine("P089", "Serwetki PB", 5, false),
    ]);
    const doc = buildTransportPagoPrintDoc(b, "Pago");
    expect(doc.excludedProducts).toEqual(["Rolki do kasy", "Serwetki PB"]);
    expect(doc.warehousePickupDataMissing).toBe(false);
  });

  it("is empty for a non-Pago batch even though nothing is flagged true", () => {
    const b = batch({
      supplier_id: "SUP_BUKAT",
      supplier_name: "Bukat",
      lines: [aggLine("P1", "Pomidory", 12, false), aggLine("P2", "Cebula", 3)],
    });
    const doc = buildTransportPagoPrintDoc(b, "Bukat");
    expect(doc.excludedProducts).toEqual([]);
    expect(doc.warehousePickupDataMissing).toBe(false);
  });

  it("flags warehousePickupDataMissing — NOT 'everything excluded' — when every positive line's field is undefined", () => {
    const b = pagoBatch([aggLine("P089", "Boxy PB", 2), aggLine("P090", "Tacki bez logo", 1)]);
    const doc = buildTransportPagoPrintDoc(b, "Pago");
    expect(doc.warehousePickupDataMissing).toBe(true);
    expect(doc.excludedProducts).toEqual([]);
  });

  it("does NOT flag missing data once at least one line carries a real boolean", () => {
    const b = pagoBatch([
      aggLine("P024", "Gyros 15 KG", 2, true),
      aggLine("P089", "Boxy PB", 2), // undefined, but not EVERY positive line
    ]);
    const doc = buildTransportPagoPrintDoc(b, "Pago");
    expect(doc.warehousePickupDataMissing).toBe(false);
    expect(doc.excludedProducts).toEqual(["Boxy PB"]);
  });

  it("ignores zero-qty lines for the missing-data determination", () => {
    const b = pagoBatch([aggLine("P1", "Zero qty item", 0)]);
    const doc = buildTransportPagoPrintDoc(b, "Pago");
    expect(doc.warehousePickupDataMissing).toBe(false);
    expect(doc.excludedProducts).toEqual([]);
  });
});

describe("computePagoWarehouseExclusion", () => {
  it("agrees with buildTransportPagoPrintDoc's excludedProducts/warehousePickupDataMissing", () => {
    const b = batch({
      supplier_id: "SUP_PAGO",
      supplier_name: "Pago",
      lines: [
        {
          product_id: "P130",
          product_name_pl: "Rolki do kasy",
          supplier_product_id: "SP_P130",
          supplier_product_name: "Rolki do kasy",
          purchase_unit: "szt",
          total_qty_purchase: 110,
          per_location: [],
          warehouse_pickup: false,
        },
      ],
    });
    const exclusion = computePagoWarehouseExclusion(b);
    const doc = buildTransportPagoPrintDoc(b, "Pago");
    expect(exclusion).toEqual({
      isPago: true,
      excludedProducts: doc.excludedProducts,
      warehousePickupDataMissing: doc.warehousePickupDataMissing,
    });
    expect(exclusion.excludedProducts).toEqual(["Rolki do kasy"]);
  });

  it("is inert ({isPago:false, excludedProducts:[], warehousePickupDataMissing:false}) for a non-Pago batch", () => {
    expect(computePagoWarehouseExclusion(batch())).toEqual({
      isPago: false,
      excludedProducts: [],
      warehousePickupDataMissing: false,
    });
  });
});

// ---- v4 feedback round 2 (feature 1): "Transport Sobota · Warszawa · 22.08.26" ----

function loc(overrides: Partial<Location> = {}): Location {
  return {
    location_id: "WOLA",
    location_name: "Pita Bros Wola",
    active: true,
    notes: "",
    ...overrides,
  };
}

describe("transportCitiesLine", () => {
  it("strips a leading Polish postal code from `city`", () => {
    const byId = { WOLA: loc({ city: "01-258 Warszawa" }) };
    expect(transportCitiesLine(["WOLA"], byId)).toBe("Warszawa");
  });

  it("applies the Warsaw alias case-insensitively", () => {
    const byId = { WOLA: loc({ city: "Warsaw" }) };
    expect(transportCitiesLine(["WOLA"], byId)).toBe("Warszawa");
  });

  it("dedupes case-insensitively, preserving first-seen order", () => {
    const byId = {
      WOLA: loc({ location_id: "WOLA", city: "Warszawa" }),
      BRACKA: loc({ location_id: "BRACKA", city: "warszawa" }),
      KRK: loc({ location_id: "KRK", city: "Kraków" }),
    };
    expect(transportCitiesLine(["WOLA", "BRACKA", "KRK"], byId)).toBe("Warszawa, Kraków");
  });

  it("falls back to the short location name (Pita Bros prefix stripped) when there's no usable city", () => {
    const byId = { WOLA: loc({ location_name: "Pita Bros Wola", city: undefined }) };
    expect(transportCitiesLine(["WOLA"], byId)).toBe("Wola");
  });

  it("omits a location id absent from master data entirely", () => {
    expect(transportCitiesLine(["GHOST"], {})).toBe("");
  });
});

describe("transportDisplayLabel / transportAutoLabel", () => {
  const locationsById = { WOLA: loc({ location_id: "WOLA", city: "Warszawa" }) };

  it("prefers pickup_date over created for both the weekday and the date segment", () => {
    const b = batch({
      supplier_name: "Bukat",
      created: "2026-08-21T09:15:00+00:00", // Friday
      pickup_date: "2026-08-22", // Saturday
      location_ids: ["WOLA"],
    });
    const label = transportDisplayLabel(b, makeT(), { lang: "pl", locationsById });
    expect(label).toBe("Transport Sobota · Warszawa · 22.08.26");
  });

  it("capitalizes the Polish weekday (Intl returns it lowercase)", () => {
    const b = batch({ pickup_date: "2026-08-22", location_ids: ["WOLA"] });
    const label = transportAutoLabel(b, makeT(), { lang: "pl", locationsById });
    expect(label).toContain("Sobota");
    expect(label).not.toContain("sobota ·"); // not the raw lowercase Intl output
  });

  it("a custom batch.name always wins over the auto-label", () => {
    const b = batch({ name: "Wtorkowy Pago", pickup_date: "2026-08-22", location_ids: ["WOLA"] });
    expect(transportDisplayLabel(b, makeT(), { lang: "pl", locationsById })).toBe("Wtorkowy Pago");
  });

  it("does NOT fall back to created when pickup_date is unset (transport-v2: no fake pickup day)", () => {
    const b = batch({ created: "2026-08-21T09:15:00+00:00", pickup_date: undefined, location_ids: ["WOLA"] });
    const label = transportDisplayLabel(b, makeT(), { lang: "pl", locationsById });
    expect(label).toBe("Transport · Warszawa");
    expect(label).not.toContain("Piątek");
    expect(label).not.toContain("21.08.26");
  });

  it("a null or blank pickup_date also yields no weekday and no date (en too)", () => {
    const nullPickup = batch({ created: "2026-10-05T08:00:00+00:00", pickup_date: null, location_ids: ["WOLA"] });
    expect(transportAutoLabel(nullPickup, makeT(), { lang: "pl", locationsById })).toBe("Transport · Warszawa");
    const blankPickup = batch({ pickup_date: "", location_ids: ["WOLA"] });
    expect(transportAutoLabel(blankPickup, makeT("en"), { lang: "en", locationsById })).toBe(
      "Transport · Warszawa",
    );
  });

  it("omits the weekday/date segment gracefully when neither pickup_date nor created is set", () => {
    const b = batch({ created: undefined, pickup_date: undefined, location_ids: ["WOLA"] });
    const label = transportDisplayLabel(b, makeT(), { lang: "pl", locationsById });
    expect(label).toBe("Transport · Warszawa");
  });

  it("falls back to the short location name when master data has no city for the batch's locations", () => {
    const b = batch({ pickup_date: "2026-08-22", location_ids: ["WOLA"] });
    const label = transportDisplayLabel(b, makeT(), {
      lang: "pl",
      locationsById: { WOLA: loc({ location_id: "WOLA", location_name: "Pita Bros Wola", city: undefined }) },
    });
    expect(label).toBe("Transport Sobota · Wola · 22.08.26");
  });

  it("is language-aware for the weekday (en)", () => {
    const b = batch({ pickup_date: "2026-08-22", location_ids: ["WOLA"] });
    const label = transportDisplayLabel(b, makeT("en"), { lang: "en", locationsById });
    expect(label).toContain("Saturday");
  });
});

// ---- v4 feedback round 2 (feature 2): "NOWY" badge on unopened batches -----

describe("loadSeenTransports / markTransportSeen", () => {
  it("starts empty on first use", () => {
    expect(loadSeenTransports(makeStorageStub()).size).toBe(0);
  });

  it("markTransportSeen persists the id for a later loadSeenTransports call", () => {
    const storage = makeStorageStub();
    markTransportSeen("TRN-1", storage);
    markTransportSeen("TRN-2", storage);
    const seen = loadSeenTransports(storage);
    expect(seen.has("TRN-1")).toBe(true);
    expect(seen.has("TRN-2")).toBe(true);
    expect(seen.has("TRN-3")).toBe(false);
  });

  it("caps the stored set at the 200 most recent ids", () => {
    const storage = makeStorageStub();
    for (let i = 0; i < 205; i++) markTransportSeen(`TRN-${i}`, storage);
    const seen = loadSeenTransports(storage);
    expect(seen.size).toBe(200);
    expect(seen.has("TRN-0")).toBe(false); // oldest dropped
    expect(seen.has("TRN-4")).toBe(false);
    expect(seen.has("TRN-204")).toBe(true); // newest kept
  });

  it("never throws when storage.setItem fails (private mode)", () => {
    const broken: Storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    expect(() => markTransportSeen("TRN-1", broken)).not.toThrow();
  });
});


// ---- transport-pago-mory-combined: Pago + Magazyn Mory on one run ----------

/** A Pago batch carrying one Magazyn Mory order: WOLA has a Pago order and
 * KEN only a Mory one. P027 is sold by both (an old Pago row vs the Mory row),
 * so the aggregate holds two P027 lines, one per supplier block. */
function mixedBatch(overrides: Partial<TransportBatchDetail> = {}): TransportBatchDetail {
  return batch({
    transport_id: "TRN-20260930-PAGO-abc123",
    supplier_id: "SUP_PAGO",
    supplier_name: "Pago",
    location_ids: ["KEN", "WOLA"],
    order_count: 2,
    suppliers: [
      { supplier_id: "SUP_PAGO", supplier_name: "Pago" },
      { supplier_id: "SUP_MORY", supplier_name: "Magazyn własny Mory" },
    ],
    orders: [
      {
        order_id: "ORD-P", location_id: "WOLA", location_name: "Pita Bros Wola",
        status: "manager_sent", lines: [], supplier_id: "SUP_PAGO", supplier_name: "Pago",
        extra_items: "Tacki - 2 opak",
      },
      {
        order_id: "ORD-M", location_id: "KEN", location_name: "Pita Bros KEN",
        status: "manager_sent", lines: [], supplier_id: "SUP_MORY",
        supplier_name: "Magazyn własny Mory", extra_items: "Serwetki - 1 karton",
      },
    ],
    lines: [
      {
        product_id: "P027", product_name_pl: "Souvlaki", supplier_product_id: "SP_PAGO_P027",
        supplier_product_name: "Souvlaki karton", purchase_unit: "karton", total_qty_purchase: 3,
        warehouse_pickup: true, supplier_id: "SUP_PAGO", supplier_name: "Pago",
        per_location: [
          { location_id: "WOLA", location_name: "Pita Bros Wola", order_id: "ORD-P", qty_purchase: 3 },
        ],
      },
      {
        product_id: "P027", product_name_pl: "Souvlaki", supplier_product_id: "SP_MORY_P027",
        supplier_product_name: "Souvlaki Mory", purchase_unit: "szt", total_qty_purchase: 4,
        warehouse_pickup: false, supplier_id: "SUP_MORY", supplier_name: "Magazyn własny Mory",
        per_location: [
          { location_id: "KEN", location_name: "Pita Bros KEN", order_id: "ORD-M", qty_purchase: 4 },
        ],
      },
      {
        product_id: "P050", product_name_pl: "Pita", supplier_product_id: "SP_MORY_P050",
        supplier_product_name: "Pita paczka", purchase_unit: "paczka", total_qty_purchase: 6,
        warehouse_pickup: false, supplier_id: "SUP_MORY", supplier_name: "Magazyn własny Mory",
        per_location: [
          { location_id: "KEN", location_name: "Pita Bros KEN", order_id: "ORD-M", qty_purchase: 6 },
        ],
      },
    ],
    ...overrides,
  });
}

describe("Pago + Mory on one run (transport-pago-mory-combined)", () => {
  it("leadSupplierView keeps only the Pago members, lines and locations", () => {
    const view = leadSupplierView(mixedBatch());
    expect(view.orders.map((o) => o.order_id)).toEqual(["ORD-P"]);
    expect(view.lines.map((l) => l.supplier_product_id)).toEqual(["SP_PAGO_P027"]);
    expect(view.location_ids).toEqual(["WOLA"]);
    expect(view.order_count).toBe(1);
  });

  it("a line or order with supplier_id \"\" counts as the lead's (falsy fallback)", () => {
    const b = batch({ supplier_id: "SUP_PAGO" });
    expect(lineSupplierId({ supplier_id: "" }, b)).toBe("SUP_PAGO");
    expect(lineSupplierId({}, b)).toBe("SUP_PAGO");
    const withBlank = batch({
      supplier_id: "SUP_PAGO",
      supplier_name: "Pago",
      lines: batch().lines.map((l) => ({ ...l, supplier_id: "" })),
      orders: batch().orders.map((o) => ({ ...o, supplier_id: "" })),
    });
    expect(leadSupplierView(withBlank).lines).toHaveLength(1);
    expect(leadSupplierView(withBlank).orders).toHaveLength(2);
    expect(buildTransportDriverPrintDoc(withBlank, "x").sections).toHaveLength(1);
  });

  it("a batch without any supplier fields behaves as before (one block, everything included)", () => {
    const b = batch();
    expect(transportSuppliers(b)).toEqual([{ supplier_id: "SUP_BUKAT", supplier_name: "Bukat" }]);
    expect(leadSupplierView(b).lines).toEqual(b.lines);
    expect(buildTransportDriverPrintDoc(b, "x")).toEqual(
      buildTransportDriverPrintDoc({ ...b, suppliers: [] }, "x"),
    );
  });

  it("transportSuppliers adds a member supplier missing from detail.suppliers (defensive tail)", () => {
    const b = mixedBatch({ suppliers: [{ supplier_id: "SUP_PAGO", supplier_name: "Pago" }] });
    expect(transportSuppliers(b).map((s) => s.supplier_id)).toEqual(["SUP_PAGO", "SUP_MORY"]);
    expect(transportSuppliers(b)[1].supplier_name).toBe("Magazyn własny Mory");
  });

  it("the Pago extras checklist lists Pago members' extra items only", () => {
    const lines = pagoExtraItemLines(mixedBatch());
    expect(lines.map((l) => l.text)).toEqual(["Tacki - 2 opak"]);
    expect(lines.map((l) => l.text)).not.toContain("Serwetki - 1 karton");
  });

  it("the Pago print doc lists Pago warehouse lines only; the exclusion notice ignores Mory", () => {
    const doc = buildTransportPagoPrintDoc(mixedBatch(), "Pago");
    expect(doc.products.map((p) => p.name)).toEqual(["Souvlaki karton"]);
    expect(doc.excludedProducts).toEqual([]);
    expect(computePagoWarehouseExclusion(mixedBatch()).excludedProducts).toEqual([]);
  });

  it("the Pago label lists only lead locations", () => {
    const locationsById: Record<string, Location> = {
      WOLA: { location_id: "WOLA", location_name: "Pita Bros Wola", city: "Warszawa", active: true },
      KEN: { location_id: "KEN", location_name: "Pita Bros KEN", city: "Kraków", active: true },
    } as Record<string, Location>;
    const opts = { lang: "pl" as Lang, locationsById };
    const full = transportDisplayLabel(mixedBatch(), makeT(), opts);
    const pago = transportDisplayLabel(leadSupplierView(mixedBatch()), makeT(), opts);
    expect(full).toContain("Kraków");
    expect(pago).not.toContain("Kraków");
    expect(pago).toContain("Warszawa");
  });

  it("the driver print doc carries every member's extra items (Pago and Mory)", () => {
    const doc = buildTransportDriverPrintDoc(mixedBatch(), "x");
    expect(doc.extraItems.map((i) => i.text)).toEqual(["Tacki - 2 opak", "Serwetki - 1 karton"]);
  });

  it("the driver print doc has two sections, Pago / LINEAGE first, on shared columns", () => {
    const doc = buildTransportDriverPrintDoc(mixedBatch(), "x");
    expect(doc.locations).toEqual(["KEN", "Wola"]);
    expect(doc.sections.map((s) => s.supplierBarText)).toEqual([
      "Pago / LINEAGE",
      "Magazyn własny Mory",
    ]);
    // The same product_id under two suppliers is two rows in two sections.
    expect(doc.sections[0].products.map((p) => p.productId)).toEqual(["P027"]);
    expect(doc.sections[1].products.map((p) => p.productId)).toEqual(["P027", "P050"]);
    expect(doc.sections[0].products[0].qtyByLocation).toEqual([0, 3]);
    expect(doc.sections[1].products[0].qtyByLocation).toEqual([4, 0]);
  });

  it("drops an empty block; with nothing positive the lead block stays, empty", () => {
    const onlyMory = mixedBatch({ lines: mixedBatch().lines.slice(1) });
    expect(buildTransportDriverPrintDoc(onlyMory, "x").sections.map((s) => s.supplierId)).toEqual([
      "SUP_MORY",
    ]);
    const empty = mixedBatch({ lines: [] });
    const sections = buildTransportDriverPrintDoc(empty, "x").sections;
    expect(sections).toEqual([{ supplierId: "SUP_PAGO", supplierBarText: "Pago / LINEAGE", products: [] }]);
  });
});

// ---- transport-v2 ----------------------------------------------------------

describe("transport-v2 print docs: driver notes + approved Pago extras", () => {
  it("buildTransportDriverPrintDoc carries the trimmed batch notes, '' when none", () => {
    expect(buildTransportDriverPrintDoc(batch({ notes: "  Wjazd od tyłu  " }), "x").notes).toBe(
      "Wjazd od tyłu",
    );
    expect(buildTransportDriverPrintDoc(batch({ notes: "   " }), "x").notes).toBe("");
    expect(buildTransportDriverPrintDoc(batch(), "x").notes).toBe("");
  });

  it("buildTransportPagoPrintDoc defaults approvedExtraItems to [] even when members carry extras", () => {
    const b = mixedBatch();
    expect(buildTransportPagoPrintDoc(b, "Pago").approvedExtraItems).toEqual([]);
  });

  it("buildTransportPagoPrintDoc keeps only the approved texts — trimmed, blanks dropped, no location", () => {
    const doc = buildTransportPagoPrintDoc(mixedBatch(), "Pago", ["  Tacki - 2 opak ", "", "   "]);
    expect(doc.approvedExtraItems).toEqual(["Tacki - 2 opak"]);
    expect(JSON.stringify(doc.approvedExtraItems)).not.toContain("Wola");
  });
});

describe("transportScopeFromChips", () => {
  it("lists the two chip suppliers, Pago first", () => {
    expect(TRANSPORT_CHIP_SUPPLIER_IDS).toEqual(["SUP_PAGO", "SUP_MORY"]);
  });

  it("both chips -> Pago with companions", () => {
    expect(transportScopeFromChips({ pago: true, mory: true })).toEqual({
      leadSupplierId: "SUP_PAGO",
      includeCompanions: true,
    });
  });

  it("only Pago -> Pago alone", () => {
    expect(transportScopeFromChips({ pago: true, mory: false })).toEqual({
      leadSupplierId: "SUP_PAGO",
      includeCompanions: false,
    });
  });

  it("only Mory -> Mory alone", () => {
    expect(transportScopeFromChips({ pago: false, mory: true })).toEqual({
      leadSupplierId: "SUP_MORY",
      includeCompanions: false,
    });
  });

  it("neither chip is treated as both", () => {
    expect(transportScopeFromChips({ pago: false, mory: false })).toEqual({
      leadSupplierId: "SUP_PAGO",
      includeCompanions: true,
    });
  });
});

const cityLocations: Record<string, Location> = {
  WOLA: loc({ location_id: "WOLA", location_name: "Pita Bros Wola", city: "01-258 Warszawa" }),
  BRACKA: loc({ location_id: "BRACKA", location_name: "Pita Bros Bracka", city: "Warsaw" }),
  KEN: loc({ location_id: "KEN", location_name: "Pita Bros KEN", city: "warszawa" }),
  POZ: loc({ location_id: "POZ", location_name: "Pita Bros Poznań", city: "Poznań" }),
  KRK: loc({ location_id: "KRK", location_name: "Pita Bros Kraków", city: "Kraków" }),
  NOCITY: loc({ location_id: "NOCITY", location_name: "Pita Bros Bez Miasta", city: "  " }),
};

describe("transportLocationCity / transportCityOptions", () => {
  it("normalizes postal codes and the Warsaw alias", () => {
    expect(transportLocationCity("WOLA", cityLocations)).toBe("Warszawa");
    expect(transportLocationCity("BRACKA", cityLocations)).toBe("Warszawa");
  });

  it("returns null for an unknown location or a blank city — no location-name fallback", () => {
    expect(transportLocationCity("MISSING", cityLocations)).toBeNull();
    expect(transportLocationCity("NOCITY", cityLocations)).toBeNull();
  });

  it("options are unique (case-insensitive), sorted the Polish way, without unresolvable cities", () => {
    expect(
      transportCityOptions(["POZ", "WOLA", "KEN", "BRACKA", "KRK", "NOCITY", "MISSING"], cityLocations),
    ).toEqual(["Kraków", "Poznań", "Warszawa"]);
  });

  it("first spelling wins for case-variants", () => {
    expect(transportCityOptions(["KEN", "WOLA"], cityLocations)).toEqual(["warszawa"]);
  });
});

function summary(overrides: Partial<TransportBatchSummary> = {}): TransportBatchSummary {
  return {
    transport_id: "TRN-X",
    supplier_id: "SUP_PAGO",
    supplier_name: "Pago",
    created: "2026-10-01T08:00:00+00:00",
    order_count: 1,
    location_ids: ["WOLA"],
    status: "sent",
    ...overrides,
  };
}

describe("sortTransportBatches", () => {
  it("sorts by pickup date (else created date) newest first, then created newest first", () => {
    const batches = [
      summary({ transport_id: "A", created: "2026-10-01T08:00:00+00:00", pickup_date: null }),
      summary({ transport_id: "B", created: "2026-09-20T08:00:00+00:00", pickup_date: "2026-10-03" }),
      summary({ transport_id: "C", created: "2026-10-02T08:00:00+00:00", pickup_date: null }),
      summary({ transport_id: "D", created: "2026-10-01T12:00:00+00:00", pickup_date: null }),
      summary({ transport_id: "E", created: "2026-09-30T08:00:00+00:00", pickup_date: "2026-10-01" }),
    ];
    // B (10-03) > C (10-02) > [D, A, E] on 10-01, ordered by created desc.
    expect(sortTransportBatches(batches).map((b) => b.transport_id)).toEqual([
      "B",
      "C",
      "D",
      "A",
      "E",
    ]);
  });

  it("puts a batch with no date at all last and keeps ties in input order", () => {
    const batches = [
      summary({ transport_id: "NODATE", created: null, pickup_date: null }),
      summary({ transport_id: "T1", created: "2026-10-01T08:00:00+00:00" }),
      summary({ transport_id: "T2", created: "2026-10-01T08:00:00+00:00" }),
    ];
    expect(sortTransportBatches(batches).map((b) => b.transport_id)).toEqual(["T1", "T2", "NODATE"]);
  });

  it("returns a new array and leaves the input untouched", () => {
    const batches = [summary({ transport_id: "old", created: "2026-09-01T08:00:00+00:00" }), summary({ transport_id: "new" })];
    const copy = [...batches];
    const sorted = sortTransportBatches(batches);
    expect(sorted).not.toBe(batches);
    expect(batches).toEqual(copy);
  });
});

describe("filterTransportBatches", () => {
  const both = new Set(["SUP_PAGO", "SUP_MORY"]);

  it("keeps a batch when any supplier_ids entry is selected", () => {
    const batches = [
      summary({ transport_id: "PAGO", supplier_ids: ["SUP_PAGO"] }),
      summary({ transport_id: "MIXED", supplier_ids: ["SUP_PAGO", "SUP_MORY"] }),
      summary({ transport_id: "MORY", supplier_id: "SUP_MORY", supplier_ids: ["SUP_MORY"] }),
    ];
    const onlyMory = filterTransportBatches(batches, { supplierIds: new Set(["SUP_MORY"]), cities: null }, cityLocations);
    expect(onlyMory.map((b) => b.transport_id)).toEqual(["MIXED", "MORY"]);
  });

  it("falls back to [supplier_id] when supplier_ids is missing or empty", () => {
    const batches = [
      summary({ transport_id: "OLD", supplier_ids: undefined }),
      summary({ transport_id: "EMPTY", supplier_ids: [] }),
      summary({ transport_id: "BUKAT", supplier_id: "SUP_BUKAT", supplier_ids: undefined }),
    ];
    const res = filterTransportBatches(batches, { supplierIds: both, cities: null }, cityLocations);
    expect(res.map((b) => b.transport_id)).toEqual(["OLD", "EMPTY"]);
  });

  it("cities = null means no city filter", () => {
    const batches = [summary({ transport_id: "POZ", location_ids: ["POZ"] })];
    expect(filterTransportBatches(batches, { supplierIds: both, cities: null }, cityLocations)).toHaveLength(1);
  });

  it("keeps a batch with any location in a selected city (case-insensitive)", () => {
    const batches = [
      summary({ transport_id: "WAW", location_ids: ["WOLA"] }),
      summary({ transport_id: "POZ", location_ids: ["POZ"] }),
      summary({ transport_id: "MIX", location_ids: ["POZ", "KEN"] }),
    ];
    const res = filterTransportBatches(
      batches,
      { supplierIds: both, cities: new Set(["WARSZAWA"]) },
      cityLocations,
    );
    expect(res.map((b) => b.transport_id)).toEqual(["WAW", "MIX"]);
  });

  it("always keeps a batch without locations or with a location whose city is unknown", () => {
    const batches = [
      summary({ transport_id: "NOLOC", location_ids: [] }),
      summary({ transport_id: "NOCITY", location_ids: ["POZ", "NOCITY"] }),
      summary({ transport_id: "UNKNOWN", location_ids: ["MISSING"] }),
      summary({ transport_id: "POZ", location_ids: ["POZ"] }),
    ];
    const res = filterTransportBatches(
      batches,
      { supplierIds: both, cities: new Set(["Kraków"]) },
      cityLocations,
    );
    expect(res.map((b) => b.transport_id)).toEqual(["NOLOC", "NOCITY", "UNKNOWN"]);
  });

  it("an empty city set hides every batch that has a resolvable city", () => {
    const batches = [summary({ transport_id: "WAW", location_ids: ["WOLA"] })];
    expect(filterTransportBatches(batches, { supplierIds: both, cities: new Set() }, cityLocations)).toEqual([]);
  });
});

function eligible(overrides: Partial<TransportEligibleOrder> = {}): TransportEligibleOrder {
  return {
    order_id: "O-1",
    location_id: "WOLA",
    location_name: "Pita Bros Wola",
    supplier_id: "SUP_PAGO",
    supplier_name: "Pago",
    order_date: "2026-10-01",
    status: "captain_submitted",
    captain_submitted_at: "2026-10-01T08:00:00+00:00",
    line_count: 3,
    ...overrides,
  };
}

describe("filterEligibleByCity / sortEligibleNewestFirst", () => {
  it("applies the city rule (unknown city always shows; null = no filter)", () => {
    const orders = [
      eligible({ order_id: "W", location_id: "WOLA" }),
      eligible({ order_id: "P", location_id: "POZ" }),
      eligible({ order_id: "N", location_id: "NOCITY" }),
    ];
    expect(filterEligibleByCity(orders, new Set(["Poznań"]), cityLocations).map((o) => o.order_id)).toEqual([
      "P",
      "N",
    ]);
    expect(filterEligibleByCity(orders, null, cityLocations)).toHaveLength(3);
  });

  it("merges the Pago and Mory blocks into one newest-first list", () => {
    // The backend returns the lead block newest-first, then the companion block.
    const orders = [
      eligible({ order_id: "P2", captain_submitted_at: "2026-10-04T08:00:00+00:00" }),
      eligible({ order_id: "P1", captain_submitted_at: "2026-09-21T08:00:00+00:00" }),
      eligible({ order_id: "M2", supplier_id: "SUP_MORY", captain_submitted_at: "2026-10-05T08:00:00+00:00" }),
      eligible({ order_id: "M1", supplier_id: "SUP_MORY", captain_submitted_at: "2026-09-30T08:00:00+00:00" }),
    ];
    expect(sortEligibleNewestFirst(orders).map((o) => o.order_id)).toEqual(["M2", "P2", "M1", "P1"]);
  });

  it("falls back to order_date, puts undated orders last and keeps ties stable", () => {
    const orders = [
      eligible({ order_id: "NONE", captain_submitted_at: null, order_date: "" }),
      eligible({ order_id: "BYDATE", captain_submitted_at: null, order_date: "2026-10-03" }),
      eligible({ order_id: "T1", captain_submitted_at: "2026-10-02T08:00:00+00:00" }),
      eligible({ order_id: "T2", captain_submitted_at: "2026-10-02T08:00:00+00:00" }),
    ];
    const copy = [...orders];
    expect(sortEligibleNewestFirst(orders).map((o) => o.order_id)).toEqual(["BYDATE", "T1", "T2", "NONE"]);
    expect(orders).toEqual(copy);
  });
});

describe("pagoExtraItemLines", () => {
  it("lists the lead supplier's non-blank extra lines with stable unique keys", () => {
    const b = batch({
      supplier_id: "SUP_PAGO",
      supplier_name: "Pago",
      orders: [
        { order_id: "ORD-1", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_claimed", lines: [], extra_items: "Feta - 5 kg\n\n  \nCebula - 2 kg" },
        { order_id: "ORD-2", location_id: "BRACKA", location_name: "Pita Bros Bracka", status: "manager_claimed", lines: [], extra_items: "Feta - 5 kg" },
        { order_id: "ORD-3", location_id: "KEN", location_name: "Pita Bros KEN", status: "manager_claimed", lines: [] },
      ],
    });
    const lines = pagoExtraItemLines(b);
    expect(lines).toEqual([
      { key: "ORD-1#0", orderId: "ORD-1", locationName: "Pita Bros Wola", text: "Feta - 5 kg" },
      { key: "ORD-1#1", orderId: "ORD-1", locationName: "Pita Bros Wola", text: "Cebula - 2 kg" },
      { key: "ORD-2#0", orderId: "ORD-2", locationName: "Pita Bros Bracka", text: "Feta - 5 kg" },
    ]);
    expect(new Set(lines.map((l) => l.key)).size).toBe(lines.length);
    // Same input -> same keys.
    expect(pagoExtraItemLines(b).map((l) => l.key)).toEqual(lines.map((l) => l.key));
  });

  it("never includes a companion (Magazyn Mory) member's extras", () => {
    expect(pagoExtraItemLines(mixedBatch()).map((l) => l.orderId)).toEqual(["ORD-P"]);
  });
});

describe("missingLogisticsFields", () => {
  it("lists empty fields in the fixed order; blank and whitespace count as missing", () => {
    expect(
      missingLogisticsFields({ pickup_date: null, pickup_time: "  ", driver: "", vehicle: undefined }),
    ).toEqual(["pickup_date", "pickup_time", "driver", "vehicle"]);
    expect(
      missingLogisticsFields({ pickup_date: "2026-10-06", pickup_time: null, driver: "Jan", vehicle: " " }),
    ).toEqual(["pickup_time", "vehicle"]);
    expect(
      missingLogisticsFields({ pickup_date: "2026-10-06", pickup_time: "07:00", driver: "Jan", vehicle: "Ducato" }),
    ).toEqual([]);
  });

  it("maps every field to the Logistics panel label", () => {
    const t = makeT();
    expect(t(LOGISTICS_FIELD_LABEL_KEYS.pickup_date)).toBe("Data odbioru");
    expect(t(LOGISTICS_FIELD_LABEL_KEYS.pickup_time)).toBe("Godzina odbioru");
    expect(t(LOGISTICS_FIELD_LABEL_KEYS.driver)).toBe("Kierowca");
    expect(t(LOGISTICS_FIELD_LABEL_KEYS.vehicle)).toBe("Samochód");
  });
});

describe("parseTransportDraftEventDetails / latestTransportDraft", () => {
  it("parses the backend format, extras last (may contain '; ' and '=')", () => {
    expect(
      parseTransportDraftEventDetails(
        "draft_id=r-123; mailbox=biuro@pitabros.pl; replaced=r-100; extras=Feta - 5 kg | Sos; czosnek=2 | Tacki",
      ),
    ).toEqual({
      draftId: "r-123",
      mailbox: "biuro@pitabros.pl",
      replacedDraftId: "r-100",
      extras: ["Feta - 5 kg", "Sos; czosnek=2", "Tacki"],
    });
    expect(parseTransportDraftEventDetails("draft_id=r1; mailbox=")).toEqual({
      draftId: "r1",
      mailbox: "",
      replacedDraftId: "",
      extras: [],
    });
  });

  it("returns null without a valid draft_id", () => {
    expect(parseTransportDraftEventDetails("")).toBeNull();
    expect(parseTransportDraftEventDetails("mailbox=biuro@pitabros.pl")).toBeNull();
    expect(parseTransportDraftEventDetails("draft_id=bad id; mailbox=x")).toBeNull();
  });

  it("picks the newest event of the requested kind", () => {
    const events = [
      event({ event_id: "d1", event_type: "driver_draft_created", at: "2026-10-05T12:00:00+00:00", details: "draft_id=r-d1; mailbox=biuro@pitabros.pl" }),
      event({ event_id: "o1", event_type: "order_draft_created", at: "2026-10-05T10:00:00+00:00", details: "draft_id=r-o1; mailbox=biuro@pitabros.pl" }),
      event({ event_id: "o2", event_type: "order_draft_created", at: "2026-10-05T11:00:00+00:00", details: "draft_id=r-o2; mailbox=biuro@pitabros.pl; replaced=r-o1" }),
      event({ event_id: "s", event_type: "batch_sent", at: "2026-10-05T13:00:00+00:00", details: "" }),
    ];
    expect(latestTransportDraft(events, "order")).toEqual({
      draftId: "r-o2",
      mailbox: "biuro@pitabros.pl",
      at: "2026-10-05T11:00:00+00:00",
    });
    expect(latestTransportDraft(events, "driver")?.draftId).toBe("r-d1");
  });

  it("skips unparseable events, treats a missing time as oldest, keeps the first of a tie", () => {
    const events = [
      event({ event_type: "order_draft_created", at: "2026-10-05T11:00:00+00:00", details: "draft_id=r-a; mailbox=m" }),
      event({ event_type: "order_draft_created", at: "2026-10-05T11:00:00+00:00", details: "draft_id=r-b; mailbox=m" }),
      event({ event_type: "order_draft_created", at: "2026-10-05T12:00:00+00:00", details: "garbage" }),
      event({ event_type: "order_draft_created", at: null, details: "draft_id=r-c; mailbox=m" }),
    ];
    expect(latestTransportDraft(events, "order")?.draftId).toBe("r-a");
    expect(latestTransportDraft([events[3]], "order")).toEqual({ draftId: "r-c", mailbox: "m", at: "" });
  });

  it("returns null when there is no draft event (or no events)", () => {
    expect(latestTransportDraft([event({ event_type: "batch_sent" })], "order")).toBeNull();
    expect(latestTransportDraft(null, "order")).toBeNull();
    expect(latestTransportDraft(undefined, "driver")).toBeNull();
  });
});
