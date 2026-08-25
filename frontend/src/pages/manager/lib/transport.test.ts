import { describe, it, expect } from "vitest";

import { STRINGS, interpolateTemplate, type Lang } from "../../../i18n";
import type { StringKey } from "../../../i18n/strings";
import type {
  ManagerOrderLineDetail,
  Supplier,
  TransportBatchDetail,
  TransportBatchOrder,
  TransportBatchSummary,
  TransportEvent,
} from "../../../types";
import {
  anyTransportDirty,
  buildTransportDriverPrintDoc,
  buildTransportDriverText,
  buildTransportEmailBody,
  buildTransportEmailSubject,
  buildTransportGmailUrl,
  buildTransportMatrix,
  buildTransportPagoPrintDoc,
  collectLogisticsSuggestions,
  computeWeightStrip,
  hasValidRecipient,
  seedTransportDrafts,
  sortTransportEvents,
  splitRecipients,
  transportDirtySavePayloads,
  transportEventTypeLabel,
} from "./transport";

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

describe("buildTransportDriverText", () => {
  it("includes the transport id, the date, per-product totals and the per-location breakdown", () => {
    const text = buildTransportDriverText(batch(), makeT());
    expect(text).toContain("TRN-20260821-BUKA-abc123");
    expect(text).toContain("2026-08-21");
    expect(text).toContain("Pomidory — 12 kg.");
    expect(text).toContain("  Pita Bros Wola: 5 kg.");
    expect(text).toContain("  Pita Bros Bracka: 7 kg.");
  });

  it("renders every product listed on the batch", () => {
    const b = batch({
      lines: [
        {
          product_id: "P1",
          product_name_pl: "Pomidory",
          supplier_product_id: "SP1",
          supplier_product_name: "Pomidory malinowe",
          purchase_unit: "kg",
          total_qty_purchase: 12,
          per_location: [],
        },
        {
          product_id: "P2",
          product_name_pl: "Cebula",
          supplier_product_id: "SP2",
          supplier_product_name: "Cebula czerwona",
          purchase_unit: "karton",
          total_qty_purchase: 3,
          per_location: [],
        },
      ],
    });
    const text = buildTransportDriverText(b, makeT());
    expect(text).toContain("Pomidory — 12 kg.");
    expect(text).toContain("Cebula — 3 karton.");
  });

  it("is language-aware for the header labels (en)", () => {
    const text = buildTransportDriverText(batch(), makeT("en"));
    expect(text).toContain("Supplier: Bukat");
  });
});

describe("buildTransportEmailSubject / buildTransportEmailBody", () => {
  it("subject names the supplier and the date", () => {
    const subject = buildTransportEmailSubject(batch(), makeT());
    expect(subject).toContain("Bukat");
    expect(subject).toContain("2026-08-21");
  });

  it("body lists per-product totals only — NO location name leaks in", () => {
    const body = buildTransportEmailBody(batch(), makeT());
    expect(body).toContain("Pomidory malinowe");
    expect(body).toContain("12 kg");
    expect(body).not.toContain("Pita Bros Wola");
    expect(body).not.toContain("Pita Bros Bracka");
    expect(body).not.toContain("WOLA");
    expect(body).not.toContain("BRACKA");
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
    const body = buildTransportEmailBody(b, makeT());
    expect(body).toContain("Cebula");
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

describe("buildTransportGmailUrl", () => {
  const supplier: Supplier = {
    supplier_id: "SUP_BUKAT",
    supplier_name: "Bukat",
    email: "a@bukat.pl,b@bukat.pl",
    ordering_method: "email",
    active: true,
    notes: "",
  };

  it("joins multiple recipients comma-separated in the to= param (distribution-list decision)", () => {
    const { url } = buildTransportGmailUrl(batch(), supplier, makeT());
    expect(decodeURIComponent(url)).toContain("to=a@bukat.pl,b@bukat.pl");
  });

  it("stays under the length guard for a normal-sized batch", () => {
    const { tooLong } = buildTransportGmailUrl(batch(), supplier, makeT());
    expect(tooLong).toBe(false);
  });

  it("flips tooLong once the assembled URL exceeds MAX_GMAIL_URL_LENGTH", () => {
    const manyLines = Array.from({ length: 400 }, (_, i) => ({
      product_id: `P${i}`,
      product_name_pl: `Produkt bardzo długa nazwa numer ${i}`,
      supplier_product_id: `SP${i}`,
      supplier_product_name: `Produkt bardzo długa nazwa numer ${i}`,
      purchase_unit: "kg",
      total_qty_purchase: i,
      per_location: [],
    }));
    const { tooLong } = buildTransportGmailUrl(batch({ lines: manyLines }), supplier, makeT());
    expect(tooLong).toBe(true);
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

  it("sorts rows by product_name_pl", () => {
    const orders: TransportBatchOrder[] = [
      batchOrder({
        lines: [
          orderLine({ order_line_id: "OL-1", product_id: "P1", product_name_pl: "Ziemniaki" }),
          orderLine({ order_line_id: "OL-2", product_id: "P2", product_name_pl: "Cebula" }),
        ],
      }),
    ];
    const matrix = buildTransportMatrix(orders);
    expect(matrix.map((r) => r.product_name_pl)).toEqual(["Cebula", "Ziemniaki"]);
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
    const doc = buildTransportDriverPrintDoc(b, makeT());
    expect(doc.transportId).toBe("TRN-20260821-BUKA-abc123");
    expect(doc.displayLabel).toContain("Bukat"); // no `name` set on the fixture -> fallback label
    expect(doc.date).toBe("2026-08-23");
    expect(doc.time).toBe("07:30");
    expect(doc.driver).toBe("Jan Kowalski");
    expect(doc.vehicle).toBe("Ducato");
    expect(doc.supplierName).toBe("Bukat");
    expect(doc.supplierBarText).toBe("Bukat"); // not Pago -> no " / LINEAGE" suffix
    expect(doc.locations).toEqual(["Pita Bros Bracka", "Pita Bros Wola"]); // pl-collated
    expect(doc.locationsLine).toBe("Pita Bros Bracka, Pita Bros Wola");
    expect(doc.products).toHaveLength(1);
    expect(doc.products[0].name).toBe("Pomidory");
    expect(doc.products[0].totalQty).toBe(12);
    // Column order matches doc.locations: Bracka first, then Wola.
    expect(doc.products[0].qtyByLocation).toEqual([7, 5]);
  });

  it("adds ' / LINEAGE' to the supplier bar text for SUP_PAGO only", () => {
    const b = batch({ supplier_id: "SUP_PAGO", supplier_name: "Pago" });
    expect(buildTransportDriverPrintDoc(b, makeT()).supplierBarText).toBe("Pago / LINEAGE");
  });

  it("falls back to created date and empty driver/vehicle when logistics are unset", () => {
    const b = batch({ driver: null, vehicle: null, pickup_date: null, pickup_time: null });
    const doc = buildTransportDriverPrintDoc(b, makeT());
    expect(doc.date).toBe("2026-08-21");
    expect(doc.driver).toBe("");
    expect(doc.vehicle).toBe("");
    expect(doc.time).toBe("");
  });

  it("uses the batch's friendly name as the display label when set", () => {
    const b = batch({ name: "Wtorkowy Pago" });
    expect(buildTransportDriverPrintDoc(b, makeT()).displayLabel).toBe("Wtorkowy Pago");
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
    const doc = buildTransportDriverPrintDoc(b, makeT());
    expect(doc.products.map((p) => p.productId)).toEqual(["P2"]);
    // doc.locations = [Bracka, Wola] (pl-collated); Bracka's cell is 0, Wola's is 3.
    expect(doc.products[0].qtyByLocation).toEqual([0, 3]);
  });
});

describe("buildTransportPagoPrintDoc", () => {
  it("carries per-product totals only — the product table structurally never leaks a per-location split", () => {
    const b = batch({ pickup_date: "2026-08-23" });
    const doc = buildTransportPagoPrintDoc(b);
    expect(doc.transportId).toBe("TRN-20260821-BUKA-abc123");
    expect(doc.supplierName).toBe("Bukat");
    expect(doc.pickupDate).toBe("2026-08-23");
    expect(doc.isPago).toBe(false);
    expect(doc.entity).toBeNull();
    expect(doc.products).toEqual([{ productId: "P1", name: "Pomidory malinowe", unit: "kg", qty: 12 }]);

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
    const doc = buildTransportPagoPrintDoc(b);
    expect(doc.isPago).toBe(true);
    expect(doc.titleBarText).toBe("THE GREEK GOURMET — ZLECENIE ODBIORU WŁASNEGO");
    expect(doc.entity).toEqual({
      name: "The Greek Gourmet Małgorzata Kubiak-Vafidis",
      nip: "5222467646",
      address1: "W. Laskonogiego 9",
      address2: "02-496 Warszawa",
    });
  });

  it("uses a generic title and no entity block for a non-Pago supplier", () => {
    const b = batch({ supplier_id: "SUP_BUKAT", supplier_name: "Bukat" });
    const doc = buildTransportPagoPrintDoc(b);
    expect(doc.isPago).toBe(false);
    expect(doc.titleBarText).toBe("Bukat — ZAMÓWIENIE");
    expect(doc.entity).toBeNull();
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
    const doc = buildTransportPagoPrintDoc(b);
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
    expect(buildTransportPagoPrintDoc(b).products).toEqual([]);
  });
});
