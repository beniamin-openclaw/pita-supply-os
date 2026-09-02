import { describe, it, expect } from "vitest";

import { STRINGS, interpolateTemplate, type Lang } from "../../../i18n";
import type { StringKey } from "../../../i18n/strings";
import type {
  Location,
  ManagerOrderLineDetail,
  Supplier,
  TransportBatchDetail,
  TransportBatchOrder,
  TransportBatchSummary,
  TransportEvent,
} from "../../../types";
import {
  anyTransportDirty,
  buildExtraItemsSupplierBlock,
  buildTransportDriverPrintDoc,
  buildTransportDriverText,
  buildTransportEmailBody,
  buildTransportEmailSubject,
  buildTransportGmailUrl,
  buildTransportMatrix,
  buildLogisticsOptions,
  buildTransportPagoPrintDoc,
  collectCaptainNotes,
  collectExtraItemsByLocation,
  collectLogisticsSuggestions,
  computePagoWarehouseExclusion,
  computeWeightStrip,
  parseConfigList,
  hasValidRecipient,
  loadSeenTransports,
  markTransportSeen,
  seedTransportDrafts,
  sortTransportEvents,
  splitRecipients,
  transportAutoLabel,
  transportCitiesLine,
  transportDirtySavePayloads,
  transportDisplayLabel,
  transportEventTypeLabel,
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

describe("buildTransportEmailBody / buildTransportDriverText — ad-hoc items (F1)", () => {
  function batchWithExtraItems(items: [string | undefined, string | undefined]): TransportBatchDetail {
    return batch({
      orders: [
        { order_id: "ORD-1", location_id: "WOLA", location_name: "Pita Bros Wola", status: "manager_claimed", lines: [], extra_items: items[0] },
        { order_id: "ORD-2", location_id: "BRACKA", location_name: "Pita Bros Bracka", status: "manager_claimed", lines: [], extra_items: items[1] },
      ],
    });
  }

  it("buildTransportEmailBody lists the SAME item from two locations TWICE — never de-duplicated (10kg, not 5)", () => {
    const body = buildTransportEmailBody(batchWithExtraItems(["Feta - 5 kg", "Feta - 5 kg"]), makeT());
    const occurrences = body.split("Feta - 5 kg").length - 1;
    expect(occurrences).toBe(2);
  });

  it("buildTransportEmailBody skips the block entirely when no order has an ad-hoc item", () => {
    const body = buildTransportEmailBody(batchWithExtraItems([undefined, undefined]), makeT());
    expect(body).not.toContain("Pozycje spoza katalogu");
  });

  it("buildTransportEmailBody carries NO location attribution for ad-hoc items", () => {
    const body = buildTransportEmailBody(batchWithExtraItems(["Feta - 5 kg", undefined]), makeT());
    expect(body).toContain("Feta - 5 kg");
    expect(body).not.toContain("Wola");
    expect(body).not.toContain("Bracka");
  });

  it("buildTransportDriverText lists the same ad-hoc item WITH location attribution for each location", () => {
    const text = buildTransportDriverText(batchWithExtraItems(["Feta - 5 kg", "Feta - 5 kg"]), makeT());
    expect(text).toContain("Pita Bros Wola: Feta - 5 kg");
    expect(text).toContain("Pita Bros Bracka: Feta - 5 kg");
  });

  it("buildTransportDriverText omits the section when no order has an ad-hoc item", () => {
    const text = buildTransportDriverText(batchWithExtraItems([undefined, undefined]), makeT());
    expect(text).not.toContain("Pozycje spoza katalogu");
  });

  it("buildTransportDriverPrintDoc carries the same per-location ad-hoc entries as buildTransportDriverText", () => {
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
      { locationName: "Pita Bros Wola", note: "proszę pilnie, mamy event" },
    ]);
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

  it("pins manager-added rows (all lines -M-) to the bottom in add order", () => {
    // Base rows alphabetize; "Agrest" and "Bób" are manager-added (every line
    // an OL-...-M-... id) so despite sorting FIRST alphabetically they render
    // BELOW the base rows, in first-encounter (add) order (v5.1 feedback).
    const orders: TransportBatchOrder[] = [
      batchOrder({
        lines: [
          orderLine({ order_line_id: "OL-ORD-1-001", product_id: "P1", product_name_pl: "Ziemniaki" }),
          orderLine({ order_line_id: "OL-ORD-1-002", product_id: "P2", product_name_pl: "Cebula" }),
          orderLine({ order_line_id: "OL-ORD-1-M-aa11", product_id: "P3", product_name_pl: "Bób" }),
          orderLine({ order_line_id: "OL-ORD-1-M-bb22", product_id: "P4", product_name_pl: "Agrest" }),
        ],
      }),
    ];
    const matrix = buildTransportMatrix(orders);
    expect(matrix.map((r) => r.product_name_pl)).toEqual(["Cebula", "Ziemniaki", "Bób", "Agrest"]);
  });

  it("keeps a manager-filled cell of a captain-origin product row alphabetized", () => {
    // P1 exists via a captain line on ORD-1 AND a manager-added line on ORD-2:
    // the row is NOT manager-only, so it stays in the alphabetical base section.
    const orders: TransportBatchOrder[] = [
      batchOrder({
        order_id: "ORD-1",
        lines: [orderLine({ order_line_id: "OL-ORD-1-001", product_id: "P1", product_name_pl: "Pomidory" })],
      }),
      batchOrder({
        order_id: "ORD-2",
        location_id: "BRACKA",
        location_name: "Pita Bros Bracka",
        lines: [
          orderLine({ order_line_id: "OL-ORD-2-M-cc33", product_id: "P1", product_name_pl: "Pomidory" }),
          orderLine({ order_line_id: "OL-ORD-2-001", product_id: "P2", product_name_pl: "Cebula" }),
        ],
      }),
    ];
    const matrix = buildTransportMatrix(orders);
    expect(matrix.map((r) => r.product_name_pl)).toEqual(["Cebula", "Pomidory"]);
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
    const doc = buildTransportDriverPrintDoc(b, "Transport Sobota · Bukat · 22.08.26");
    expect(doc.transportId).toBe("TRN-20260821-BUKA-abc123");
    expect(doc.displayLabel).toBe("Transport Sobota · Bukat · 22.08.26"); // pass-through, caller-computed
    expect(doc.date).toBe("2026-08-23");
    expect(doc.time).toBe("07:30");
    expect(doc.driver).toBe("Jan Kowalski");
    expect(doc.vehicle).toBe("Ducato");
    expect(doc.supplierName).toBe("Bukat");
    expect(doc.supplierBarText).toBe("Bukat"); // not Pago -> no " / LINEAGE" suffix
    // Short forms — the redundant "Pita Bros " brand prefix is stripped on
    // the internal driver doc (operator feedback v5.1); still pl-collated.
    expect(doc.locations).toEqual(["Bracka", "Wola"]);
    expect(doc.locationsLine).toBe("Bracka, Wola");
    expect(doc.products).toHaveLength(1);
    expect(doc.products[0].name).toBe("Pomidory");
    expect(doc.products[0].totalQty).toBe(12);
    // Column order matches doc.locations: Bracka first, then Wola.
    expect(doc.products[0].qtyByLocation).toEqual([7, 5]);
  });

  it("adds ' / LINEAGE' to the supplier bar text for SUP_PAGO only", () => {
    const b = batch({ supplier_id: "SUP_PAGO", supplier_name: "Pago" });
    expect(buildTransportDriverPrintDoc(b, "Pago").supplierBarText).toBe("Pago / LINEAGE");
  });

  it("falls back to created date and empty driver/vehicle when logistics are unset", () => {
    const b = batch({ driver: null, vehicle: null, pickup_date: null, pickup_time: null });
    const doc = buildTransportDriverPrintDoc(b, "Bukat");
    expect(doc.date).toBe("2026-08-21");
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
    expect(doc.products.map((p) => p.productId)).toEqual(["P2"]);
    // doc.locations = [Bracka, Wola] (pl-collated); Bracka's cell is 0, Wola's is 3.
    expect(doc.products[0].qtyByLocation).toEqual([0, 3]);
  });
});

describe("buildTransportPagoPrintDoc", () => {
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
      { productId: "P1", name: "Pomidory malinowe", catalogNo: "Pomidory malinowe", unit: "kg", qty: 12 },
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

  it("uses supplier_sku as catalogNo when set", () => {
    const b = batch({
      lines: [
        {
          product_id: "P1",
          product_name_pl: "Gyros wieprzowy",
          supplier_product_id: "SP1",
          supplier_product_name: "Gyros wieprzowy 15kg",
          purchase_unit: "kg",
          total_qty_purchase: 15,
          per_location: [],
          supplier_sku: "GYRSW15KG",
        },
      ],
    });
    const doc = buildTransportPagoPrintDoc(b, "Bukat");
    expect(doc.products[0].catalogNo).toBe("GYRSW15KG");
    expect(doc.products[0].name).toBe("Gyros wieprzowy 15kg");
  });

  it("falls back catalogNo to the friendly name when supplier_sku is unset", () => {
    const b = batch({
      lines: [
        {
          product_id: "P1",
          product_name_pl: "Pomidory",
          supplier_product_id: "SP1",
          supplier_product_name: "Pomidory malinowe",
          purchase_unit: "kg",
          total_qty_purchase: 3,
          per_location: [],
        },
      ],
    });
    const doc = buildTransportPagoPrintDoc(b, "Bukat");
    expect(doc.products[0].catalogNo).toBe("Pomidory malinowe");
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

  it("falls back to created when pickup_date is unset", () => {
    const b = batch({ created: "2026-08-21T09:15:00+00:00", pickup_date: undefined, location_ids: ["WOLA"] });
    const label = transportDisplayLabel(b, makeT(), { lang: "pl", locationsById });
    expect(label).toBe("Transport Piątek · Warszawa · 21.08.26");
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
